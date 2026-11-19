const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const MATERIA_ID = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const CUESTIONARIO_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const INTENTO_ID = 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f';
const PREGUNTA_ID = '11111111-1111-4111-8111-111111111111';

const mockCuestionarioService = {
  generar: jest.fn(),
  listar: jest.fn(),
  obtener: jest.fn(),
  eliminar: jest.fn(),
  iniciarIntento: jest.fn(),
  responder: jest.fn(),
  obtenerResultadoIntento: jest.fn(),
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
    createResumenService: jest.fn(() => ({})),
    createCuestionarioService: jest.fn(() => mockCuestionarioService),
  };
});

const request = require('supertest');
const app = require('../src/app');
const ApiError = require('../src/utils/ApiError');

const CUESTIONARIO = {
  id: CUESTIONARIO_ID,
  materia_id: MATERIA_ID,
  materia_nombre: 'Cálculo Diferencial',
  documento_id: DOCUMENTO_ID,
  titulo: 'Repaso de cálculo',
  dificultad: 'intermedia',
  cantidad_preguntas: 5,
  tipos: ['opcion_multiple'],
  modelo: 'gemini-3.5-flash-lite',
  tokens_entrada: 500,
  tokens_salida: 800,
  fecha_creacion: '2026-11-19T10:00:00.000Z',
  preguntas: [],
  intentos: [],
};

const INTENTO = {
  id: INTENTO_ID,
  cuestionario_id: CUESTIONARIO_ID,
  estado: 'en_progreso',
  total_preguntas: 5,
  preguntas_objetivas: 5,
  respuestas_correctas: 0,
  puntuacion: null,
  fecha_inicio: '2026-11-19T10:05:00.000Z',
  fecha_finalizacion: null,
};

describe('rutas de cuestionarios (HU13)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCuestionarioService.generar.mockResolvedValue(CUESTIONARIO);
    mockCuestionarioService.listar.mockResolvedValue({ items: [CUESTIONARIO], total: 1 });
    mockCuestionarioService.obtener.mockResolvedValue(CUESTIONARIO);
    mockCuestionarioService.eliminar.mockResolvedValue(undefined);
    mockCuestionarioService.iniciarIntento.mockResolvedValue({
      intento: INTENTO,
      cuestionario: CUESTIONARIO,
    });
    mockCuestionarioService.responder.mockResolvedValue({
      intento: { ...INTENTO, estado: 'finalizado', puntuacion: 100 },
      cuestionario: CUESTIONARIO,
      preguntas: [],
    });
    mockCuestionarioService.obtenerResultadoIntento.mockResolvedValue({
      intento: INTENTO,
      cuestionario: CUESTIONARIO,
      preguntas: [],
    });
  });

  it('POST /api/asistente/cuestionario usa los valores por defecto', async () => {
    const response = await request(app)
      .post('/api/asistente/cuestionario')
      .send({ materia_id: MATERIA_ID })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(CUESTIONARIO);
    expect(mockCuestionarioService.generar).toHaveBeenCalledWith({
      materiaId: MATERIA_ID,
      documentoId: null,
      cantidadPreguntas: 10,
      dificultad: 'intermedia',
      tipos: ['opcion_multiple', 'verdadero_falso', 'abierta'],
    });
  });

  it('POST /api/asistente/cuestionario rechaza una materia que no es UUID', async () => {
    const response = await request(app)
      .post('/api/asistente/cuestionario')
      .send({ materia_id: '123' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(mockCuestionarioService.generar).not.toHaveBeenCalled();
  });

  it('POST /api/asistente/cuestionario rechaza cantidades fuera de rango', async () => {
    await request(app)
      .post('/api/asistente/cuestionario')
      .send({ materia_id: MATERIA_ID, cantidad_preguntas: 4 })
      .expect(400);

    await request(app)
      .post('/api/asistente/cuestionario')
      .send({ materia_id: MATERIA_ID, cantidad_preguntas: 21 })
      .expect(400);

    expect(mockCuestionarioService.generar).not.toHaveBeenCalled();
  });

  it('POST /api/asistente/cuestionario rechaza una lista de tipos vacia', async () => {
    await request(app)
      .post('/api/asistente/cuestionario')
      .send({ materia_id: MATERIA_ID, tipos: [] })
      .expect(400);

    expect(mockCuestionarioService.generar).not.toHaveBeenCalled();
  });

  it('POST /api/asistente/cuestionario devuelve 422 si la materia no tiene documentos', async () => {
    mockCuestionarioService.generar.mockRejectedValue(
      ApiError.unprocessable('La materia no tiene documentos procesados.'),
    );

    const response = await request(app)
      .post('/api/asistente/cuestionario')
      .send({ materia_id: MATERIA_ID })
      .expect(422);

    expect(response.body.error.message).toMatch(/documentos procesados/);
  });

  it('POST /api/asistente/cuestionario devuelve 429 con el codigo de cuota', async () => {
    mockCuestionarioService.generar.mockRejectedValue(
      ApiError.rateLimited('Alcanzaste el limite diario de cuestionarios.', {
        code: 'AI_QUOTA_EXCEEDED',
      }),
    );

    const response = await request(app)
      .post('/api/asistente/cuestionario')
      .send({ materia_id: MATERIA_ID })
      .expect(429);

    expect(response.body.error.details.code).toBe('AI_QUOTA_EXCEEDED');
  });

  it('GET /api/asistente/cuestionarios pagina los resultados', async () => {
    const response = await request(app)
      .get('/api/asistente/cuestionarios')
      .query({ limit: 10, offset: 0 })
      .expect(200);

    expect(response.body.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
    expect(mockCuestionarioService.listar).toHaveBeenCalledWith({
      limite: 10,
      desplazamiento: 0,
    });
  });

  it('GET /api/asistente/cuestionarios/:id rechaza un UUID invalido', async () => {
    await request(app).get('/api/asistente/cuestionarios/123').expect(400);
    expect(mockCuestionarioService.obtener).not.toHaveBeenCalled();
  });

  it('GET /api/asistente/cuestionarios/:id devuelve el cuestionario', async () => {
    const response = await request(app)
      .get(`/api/asistente/cuestionarios/${CUESTIONARIO_ID}`)
      .expect(200);

    expect(response.body.data).toEqual(CUESTIONARIO);
  });

  it('DELETE /api/asistente/cuestionarios/:id elimina el cuestionario', async () => {
    const response = await request(app)
      .delete(`/api/asistente/cuestionarios/${CUESTIONARIO_ID}`)
      .expect(200);

    expect(response.body.data).toEqual({ id: CUESTIONARIO_ID });
  });

  it('POST /api/asistente/cuestionarios/:id/intentos inicia un intento', async () => {
    const response = await request(app)
      .post(`/api/asistente/cuestionarios/${CUESTIONARIO_ID}/intentos`)
      .expect(201);

    expect(response.body.data.intento).toEqual(INTENTO);
  });

  it('POST /api/asistente/intentos/:id/responder registra las respuestas', async () => {
    const response = await request(app)
      .post(`/api/asistente/intentos/${INTENTO_ID}/responder`)
      .send({ respuestas: [{ pregunta_id: PREGUNTA_ID, respuesta: 'La derivada' }] })
      .expect(200);

    expect(response.body.data.intento.estado).toBe('finalizado');
    expect(mockCuestionarioService.responder).toHaveBeenCalledWith(INTENTO_ID, [
      { pregunta_id: PREGUNTA_ID, respuesta: 'La derivada' },
    ]);
  });

  it('POST /api/asistente/intentos/:id/responder rechaza una lista vacia', async () => {
    await request(app)
      .post(`/api/asistente/intentos/${INTENTO_ID}/responder`)
      .send({ respuestas: [] })
      .expect(400);

    expect(mockCuestionarioService.responder).not.toHaveBeenCalled();
  });

  it('POST /api/asistente/intentos/:id/responder rechaza preguntas repetidas', async () => {
    await request(app)
      .post(`/api/asistente/intentos/${INTENTO_ID}/responder`)
      .send({
        respuestas: [
          { pregunta_id: PREGUNTA_ID, respuesta: 'A' },
          { pregunta_id: PREGUNTA_ID, respuesta: 'B' },
        ],
      })
      .expect(400);

    expect(mockCuestionarioService.responder).not.toHaveBeenCalled();
  });

  it('GET /api/asistente/intentos/:id devuelve el intento propio', async () => {
    const response = await request(app)
      .get(`/api/asistente/intentos/${INTENTO_ID}`)
      .expect(200);

    expect(response.body.data.intento).toEqual(INTENTO);
  });

  it('devuelve 404 cuando el recurso es ajeno', async () => {
    mockCuestionarioService.obtener.mockRejectedValue(
      ApiError.notFound('Cuestionario no encontrado.'),
    );

    const response = await request(app)
      .get(`/api/asistente/cuestionarios/${CUESTIONARIO_ID}`)
      .expect(404);

    expect(response.body.error.message).toBe('Cuestionario no encontrado.');
  });
});
