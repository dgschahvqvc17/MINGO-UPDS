const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const CONVERSACION_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const mockChatService = {
  enviar: jest.fn(),
  listar: jest.fn(),
  obtener: jest.fn(),
  eliminar: jest.fn(),
};
const mockResumenService = { generar: jest.fn(), obtenerGuardado: jest.fn() };

jest.mock('../src/middlewares/auth.middleware', () => (req, _res, next) => {
  req.user = { id: USUARIO_ID, email: 'estudiante@mingo.test', role: 'estudiante' };
  req.accessToken = 'token-de-prueba';
  next();
});

jest.mock('../src/container', () => {
  const actual = jest.requireActual('../src/container');
  return {
    ...actual,
    createResumenService: jest.fn(() => mockResumenService),
    createChatService: jest.fn(() => mockChatService),
  };
});

const request = require('supertest');
const app = require('../src/app');
const ApiError = require('../src/utils/ApiError');

const RESPUESTA = {
  conversacion_id: CONVERSACION_ID,
  mensaje_id: 'mensaje-2',
  respuesta: 'Según tus documentos, la derivada mide la tasa de cambio.',
  modelo: 'gpt-4o-mini',
  referencias: [],
  consumo: { tokens_entrada: 100, tokens_salida: 40 },
};

describe('rutas del chat academico (HU12)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChatService.enviar.mockResolvedValue(RESPUESTA);
    mockChatService.listar.mockResolvedValue({ items: [], total: 0 });
    mockChatService.obtener.mockResolvedValue({ id: CONVERSACION_ID, mensajes: [] });
    mockChatService.eliminar.mockResolvedValue(undefined);
  });

  it('POST /api/asistente/chat devuelve la respuesta con valores por defecto', async () => {
    const response = await request(app)
      .post('/api/asistente/chat')
      .send({ mensaje: '¿Qué es una derivada?' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(RESPUESTA);
    expect(mockChatService.enviar).toHaveBeenCalledWith({
      conversacionId: undefined,
      mensaje: '¿Qué es una derivada?',
      materiaId: undefined,
      documentoIds: [],
      usarDocumentos: true,
    });
  });

  it('POST /api/asistente/chat propaga los filtros al servicio', async () => {
    await request(app)
      .post('/api/asistente/chat')
      .send({
        conversacion_id: CONVERSACION_ID,
        mensaje: 'Pregunta de seguimiento',
        documento_ids: [DOCUMENTO_ID],
        usar_documentos: false,
      })
      .expect(200);

    expect(mockChatService.enviar).toHaveBeenCalledWith(
      expect.objectContaining({
        conversacionId: CONVERSACION_ID,
        documentoIds: [DOCUMENTO_ID],
        usarDocumentos: false,
      }),
    );
  });

  it('POST /api/asistente/chat rechaza un mensaje vacio', async () => {
    const response = await request(app)
      .post('/api/asistente/chat')
      .send({ mensaje: '   ' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(mockChatService.enviar).not.toHaveBeenCalled();
  });

  it('POST /api/asistente/chat rechaza documentos que no son UUID', async () => {
    await request(app)
      .post('/api/asistente/chat')
      .send({ mensaje: 'Hola', documento_ids: ['123'] })
      .expect(400);

    expect(mockChatService.enviar).not.toHaveBeenCalled();
  });

  it('POST /api/asistente/chat devuelve 429 con el codigo de cuota', async () => {
    mockChatService.enviar.mockRejectedValue(
      ApiError.rateLimited('Limite de mensajes alcanzado.', {
        code: 'AI_QUOTA_EXCEEDED',
      }),
    );

    const response = await request(app)
      .post('/api/asistente/chat')
      .send({ mensaje: 'Hola' })
      .expect(429);

    expect(response.body.error.details.code).toBe('AI_QUOTA_EXCEEDED');
  });

  it('POST /api/asistente/chat devuelve 503 si la IA falla', async () => {
    mockChatService.enviar.mockRejectedValue(
      ApiError.serviceUnavailable('El proveedor de IA no respondio.'),
    );

    await request(app)
      .post('/api/asistente/chat')
      .send({ mensaje: 'Hola' })
      .expect(503);
  });

  it('GET /api/asistente/conversaciones devuelve la lista con metadatos', async () => {
    const response = await request(app).get('/api/asistente/conversaciones?limit=5&offset=5').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.meta).toEqual({ page: 2, limit: 5, total: 0, totalPages: 0 });
    expect(mockChatService.listar).toHaveBeenCalledWith({ limite: 5, desplazamiento: 5 });
  });

  it('GET /api/asistente/conversaciones/:id devuelve el historial', async () => {
    const response = await request(app)
      .get(`/api/asistente/conversaciones/${CONVERSACION_ID}`)
      .expect(200);

    expect(response.body.data.id).toBe(CONVERSACION_ID);
    expect(mockChatService.obtener).toHaveBeenCalledWith(CONVERSACION_ID);
  });

  it('GET /api/asistente/conversaciones/:id rechaza un UUID invalido', async () => {
    await request(app).get('/api/asistente/conversaciones/123').expect(400);

    expect(mockChatService.obtener).not.toHaveBeenCalled();
  });

  it('DELETE /api/asistente/conversaciones/:id elimina la conversacion', async () => {
    const response = await request(app)
      .delete(`/api/asistente/conversaciones/${CONVERSACION_ID}`)
      .expect(200);

    expect(response.body.data).toEqual({ id: CONVERSACION_ID });
    expect(mockChatService.eliminar).toHaveBeenCalledWith(CONVERSACION_ID);
  });
});
