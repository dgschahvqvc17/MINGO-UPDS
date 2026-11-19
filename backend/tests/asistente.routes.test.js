const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const mockResumenService = {
  generar: jest.fn(),
  obtenerGuardado: jest.fn(),
};

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
  };
});

const request = require('supertest');
const app = require('../src/app');
const ApiError = require('../src/utils/ApiError');

const RESUMEN = {
  id: 'resumen-id',
  documento_id: DOCUMENTO_ID,
  documento_nombre: 'Apuntes de calculo',
  profundidad: 'media',
  resumen_general: 'Resumen estructurado del documento.',
  temas_principales: ['Derivadas'],
  conceptos_importantes: [{ termino: 'Derivada', descripcion: 'Tasa de cambio.' }],
  modelo: 'gpt-4o-mini',
  tokens_entrada: 100,
  tokens_salida: 50,
  contenido_truncado: false,
  guardado: true,
  reutilizado: false,
  fecha_creacion: '2026-11-18T10:00:00.000Z',
};

describe('rutas de resumenes (HU10)', () => {
  beforeEach(() => {
    mockResumenService.generar.mockResolvedValue(RESUMEN);
    mockResumenService.obtenerGuardado.mockResolvedValue(RESUMEN);
  });

  it('POST /api/asistente/resumen genera el resumen con valores por defecto', async () => {
    const response = await request(app)
      .post('/api/asistente/resumen')
      .send({ documento_id: DOCUMENTO_ID })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(RESUMEN);
    expect(mockResumenService.generar).toHaveBeenCalledWith({
      documento_id: DOCUMENTO_ID,
      profundidad: 'media',
      guardar: true,
    });
  });

  it('POST /api/asistente/resumen rechaza un documento_id que no es UUID', async () => {
    const response = await request(app)
      .post('/api/asistente/resumen')
      .send({ documento_id: '123' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(mockResumenService.generar).not.toHaveBeenCalled();
  });

  it('POST /api/asistente/resumen rechaza una profundidad desconocida', async () => {
    const response = await request(app)
      .post('/api/asistente/resumen')
      .send({ documento_id: DOCUMENTO_ID, profundidad: 'extrema' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(mockResumenService.generar).not.toHaveBeenCalled();
  });

  it('POST /api/asistente/resumen devuelve 422 si el documento no esta procesado', async () => {
    mockResumenService.generar.mockRejectedValue(
      ApiError.unprocessable('El documento todavia no esta procesado.'),
    );

    const response = await request(app)
      .post('/api/asistente/resumen')
      .send({ documento_id: DOCUMENTO_ID })
      .expect(422);

    expect(response.body.error.message).toMatch(/no esta procesado/);
  });

  it('POST /api/asistente/resumen devuelve 429 con el codigo de cuota', async () => {
    mockResumenService.generar.mockRejectedValue(
      ApiError.rateLimited('Alcanzaste el limite diario de resumenes.', {
        code: 'AI_QUOTA_EXCEEDED',
      }),
    );

    const response = await request(app)
      .post('/api/asistente/resumen')
      .send({ documento_id: DOCUMENTO_ID })
      .expect(429);

    expect(response.body.error.details.code).toBe('AI_QUOTA_EXCEEDED');
  });

  it('POST /api/asistente/resumen devuelve 503 si la IA no esta disponible', async () => {
    mockResumenService.generar.mockRejectedValue(
      ApiError.serviceUnavailable('El servicio de IA no esta configurado.'),
    );

    await request(app)
      .post('/api/asistente/resumen')
      .send({ documento_id: DOCUMENTO_ID })
      .expect(503);
  });

  it('GET /api/asistente/resumen/:documento_id recupera el resumen guardado', async () => {
    const response = await request(app)
      .get(`/api/asistente/resumen/${DOCUMENTO_ID}`)
      .expect(200);

    expect(response.body.data).toEqual(RESUMEN);
    expect(mockResumenService.obtenerGuardado).toHaveBeenCalledWith(DOCUMENTO_ID);
  });

  it('GET /api/asistente/resumen/:documento_id devuelve data null si no hay resumen', async () => {
    mockResumenService.obtenerGuardado.mockResolvedValue(null);

    const response = await request(app)
      .get(`/api/asistente/resumen/${DOCUMENTO_ID}`)
      .expect(200);

    expect(response.body.data).toBeNull();
  });

  it('GET /api/asistente/resumen/:documento_id rechaza un UUID invalido', async () => {
    await request(app).get('/api/asistente/resumen/123').expect(400);

    expect(mockResumenService.obtenerGuardado).not.toHaveBeenCalled();
  });
});
