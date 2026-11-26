const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const MATERIA_ID = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const CUESTIONARIO_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const INTENTO_ID = 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f';
const PREGUNTA_ID = '11111111-1111-4111-8111-111111111111';

let mockRolActual = 'estudiante';

const mockCuestionarioService = {
  generar: jest.fn(),
  listar: jest.fn(),
  listarDisponibles: jest.fn(),
  publicar: jest.fn(),
  listarCalificaciones: jest.fn(),
  obtener: jest.fn(),
  eliminar: jest.fn(),
  iniciarIntento: jest.fn(),
  responder: jest.fn(),
  obtenerResultadoIntento: jest.fn(),
  listarIntentos: jest.fn(),
};

jest.mock('../src/middlewares/auth.middleware', () => (req, _res, next) => {
  req.user = {
    id: USUARIO_ID,
    email: `${mockRolActual}@mingo.test`,
    role: mockRolActual,
    roles: [mockRolActual],
  };
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

describe('rutas de cuestionarios (HU13 y publicacion HU20)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRolActual = 'estudiante';
    mockCuestionarioService.generar.mockResolvedValue(CUESTIONARIO);
    mockCuestionarioService.listar.mockResolvedValue({ items: [CUESTIONARIO], total: 1 });
    mockCuestionarioService.listarDisponibles.mockResolvedValue({
      items: [{ ...CUESTIONARIO, publicado: true }],
      total: 1,
    });
    mockCuestionarioService.publicar.mockResolvedValue({
      ...CUESTIONARIO,
      publicado: true,
      fecha_publicacion: '2026-11-20T10:00:00.000Z',
    });
    mockCuestionarioService.listarCalificaciones.mockResolvedValue({
      items: [{ intento_id: INTENTO_ID, puntuacion: 80 }],
      total: 1,
    });
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
    mockCuestionarioService.listarIntentos.mockResolvedValue({ items: [INTENTO], total: 1 });
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

  it('GET /api/asistente/intentos lista el historial paginado', async () => {
    const response = await request(app)
      .get('/api/asistente/intentos')
      .query({ limit: 5, offset: 5 })
      .expect(200);

    expect(response.body.data).toEqual([INTENTO]);
    expect(response.body.meta).toEqual({ page: 2, limit: 5, total: 1, totalPages: 1 });
    expect(mockCuestionarioService.listarIntentos).toHaveBeenCalledWith({
      limite: 5,
      desplazamiento: 5,
    });
  });

  it('GET /api/asistente/intentos rechaza un limite fuera de rango', async () => {
    await request(app).get('/api/asistente/intentos').query({ limit: 0 }).expect(400);
    expect(mockCuestionarioService.listarIntentos).not.toHaveBeenCalled();
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

  describe('publicación y calificaciones (HU20)', () => {
    it('GET /api/asistente/cuestionarios/disponibles no cae en la ruta :id', async () => {
      const response = await request(app)
        .get('/api/asistente/cuestionarios/disponibles')
        .query({ limit: 5, offset: 0 })
        .expect(200);

      expect(response.body.data[0].publicado).toBe(true);
      expect(mockCuestionarioService.listarDisponibles).toHaveBeenCalledWith({
        limite: 5,
        desplazamiento: 0,
      });
      expect(mockCuestionarioService.obtener).not.toHaveBeenCalled();
    });

    it('GET /api/asistente/cuestionarios/disponibles rechaza un limite fuera de rango', async () => {
      await request(app)
        .get('/api/asistente/cuestionarios/disponibles')
        .query({ limit: 51 })
        .expect(400);

      expect(mockCuestionarioService.listarDisponibles).not.toHaveBeenCalled();
    });

    it('PATCH /api/asistente/cuestionarios/:id/publicacion devuelve 403 al estudiante', async () => {
      const response = await request(app)
        .patch(`/api/asistente/cuestionarios/${CUESTIONARIO_ID}/publicacion`)
        .send({ publicado: true })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(mockCuestionarioService.publicar).not.toHaveBeenCalled();
    });

    it('PATCH /api/asistente/cuestionarios/:id/publicacion publica siendo docente', async () => {
      mockRolActual = 'docente';

      const response = await request(app)
        .patch(`/api/asistente/cuestionarios/${CUESTIONARIO_ID}/publicacion`)
        .send({ publicado: true })
        .expect(200);

      expect(response.body.data).toMatchObject({
        id: CUESTIONARIO_ID,
        publicado: true,
      });
      expect(mockCuestionarioService.publicar).toHaveBeenCalledWith(CUESTIONARIO_ID, true);
    });

    it('PATCH /api/asistente/cuestionarios/:id/publicacion rechaza un cuerpo invalido', async () => {
      mockRolActual = 'docente';

      await request(app)
        .patch(`/api/asistente/cuestionarios/${CUESTIONARIO_ID}/publicacion`)
        .send({ publicado: 'si' })
        .expect(400);

      expect(mockCuestionarioService.publicar).not.toHaveBeenCalled();
    });

    it('GET /api/asistente/cuestionarios/:id/calificaciones devuelve 403 al estudiante', async () => {
      await request(app)
        .get(`/api/asistente/cuestionarios/${CUESTIONARIO_ID}/calificaciones`)
        .expect(403);

      expect(mockCuestionarioService.listarCalificaciones).not.toHaveBeenCalled();
    });

    it('GET /api/asistente/cuestionarios/:id/calificaciones lista las notas del docente', async () => {
      mockRolActual = 'docente';

      const response = await request(app)
        .get(`/api/asistente/cuestionarios/${CUESTIONARIO_ID}/calificaciones`)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(response.body.data).toEqual([{ intento_id: INTENTO_ID, puntuacion: 80 }]);
      expect(response.body.meta).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
      expect(mockCuestionarioService.listarCalificaciones).toHaveBeenCalledWith(CUESTIONARIO_ID, {
        limite: 10,
        desplazamiento: 0,
      });
    });

    it('GET /api/asistente/cuestionarios/:id/calificaciones rechaza un limite fuera de rango', async () => {
      mockRolActual = 'docente';

      await request(app)
        .get(`/api/asistente/cuestionarios/${CUESTIONARIO_ID}/calificaciones`)
        .query({ limit: 0 })
        .expect(400);

      expect(mockCuestionarioService.listarCalificaciones).not.toHaveBeenCalled();
    });
  });
});
