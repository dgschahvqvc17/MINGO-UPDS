const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const MATERIA_ID = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const CONJUNTO_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const TARJETA_ID = 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f';

const mockTarjetaService = {
  generar: jest.fn(),
  listar: jest.fn(),
  obtener: jest.fn(),
  eliminar: jest.fn(),
  actualizarEstado: jest.fn(),
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
    createTarjetaService: jest.fn(() => mockTarjetaService),
  };
});

const request = require('supertest');
const app = require('../src/app');
const ApiError = require('../src/utils/ApiError');

const CONJUNTO = {
  id: CONJUNTO_ID,
  materia_id: MATERIA_ID,
  materia_nombre: 'Cálculo Diferencial',
  documento_id: DOCUMENTO_ID,
  titulo: 'Tarjetas de cálculo',
  cantidad_tarjetas: 5,
  cantidad_conocidas: 1,
  cantidad_pendientes: 4,
  modelo: 'gemini-3.5-flash-lite',
  tokens_entrada: 500,
  tokens_salida: 300,
  fecha_creacion: '2026-11-19T10:00:00.000Z',
  tarjetas: [
    {
      id: TARJETA_ID,
      conjunto_id: CONJUNTO_ID,
      orden: 1,
      frente: '¿Qué mide la derivada?',
      reverso: 'La tasa de cambio instantánea.',
      estado: 'sin_revisar',
      fecha_actualizacion: '2026-11-19T10:00:00.000Z',
    },
  ],
};

const TARJETA = CONJUNTO.tarjetas[0];

describe('rutas de tarjetas de memoria (HU14)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTarjetaService.generar.mockResolvedValue(CONJUNTO);
    mockTarjetaService.listar.mockResolvedValue({ items: [CONJUNTO], total: 1 });
    mockTarjetaService.obtener.mockResolvedValue(CONJUNTO);
    mockTarjetaService.eliminar.mockResolvedValue(undefined);
    mockTarjetaService.actualizarEstado.mockResolvedValue({
      ...TARJETA,
      estado: 'conocida',
    });
  });

  it('POST /api/asistente/tarjetas usa los valores por defecto', async () => {
    const response = await request(app)
      .post('/api/asistente/tarjetas')
      .send({ materia_id: MATERIA_ID })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(CONJUNTO);
    expect(mockTarjetaService.generar).toHaveBeenCalledWith({
      materiaId: MATERIA_ID,
      documentoId: null,
      cantidadTarjetas: 10,
    });
  });

  it('POST /api/asistente/tarjetas acepta un documento opcional', async () => {
    await request(app)
      .post('/api/asistente/tarjetas')
      .send({ materia_id: MATERIA_ID, documento_id: DOCUMENTO_ID, cantidad_tarjetas: 12 })
      .expect(201);

    expect(mockTarjetaService.generar).toHaveBeenCalledWith({
      materiaId: MATERIA_ID,
      documentoId: DOCUMENTO_ID,
      cantidadTarjetas: 12,
    });
  });

  it('POST /api/asistente/tarjetas rechaza una materia que no es UUID', async () => {
    const response = await request(app)
      .post('/api/asistente/tarjetas')
      .send({ materia_id: '123' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(mockTarjetaService.generar).not.toHaveBeenCalled();
  });

  it('POST /api/asistente/tarjetas rechaza cantidades fuera de rango', async () => {
    await request(app)
      .post('/api/asistente/tarjetas')
      .send({ materia_id: MATERIA_ID, cantidad_tarjetas: 4 })
      .expect(400);

    await request(app)
      .post('/api/asistente/tarjetas')
      .send({ materia_id: MATERIA_ID, cantidad_tarjetas: 31 })
      .expect(400);

    expect(mockTarjetaService.generar).not.toHaveBeenCalled();
  });

  it('POST /api/asistente/tarjetas devuelve 422 sin material procesado', async () => {
    mockTarjetaService.generar.mockRejectedValue(
      ApiError.unprocessable('La materia no tiene documentos procesados.'),
    );

    const response = await request(app)
      .post('/api/asistente/tarjetas')
      .send({ materia_id: MATERIA_ID })
      .expect(422);

    expect(response.body.error.message).toMatch(/documentos procesados/);
  });

  it('POST /api/asistente/tarjetas devuelve 429 con el codigo de cuota', async () => {
    mockTarjetaService.generar.mockRejectedValue(
      ApiError.rateLimited('Alcanzaste el limite diario de tarjetas.', {
        code: 'AI_QUOTA_EXCEEDED',
      }),
    );

    const response = await request(app)
      .post('/api/asistente/tarjetas')
      .send({ materia_id: MATERIA_ID })
      .expect(429);

    expect(response.body.error.details.code).toBe('AI_QUOTA_EXCEEDED');
  });

  it('GET /api/asistente/tarjetas/conjuntos pagina los resultados', async () => {
    const response = await request(app)
      .get('/api/asistente/tarjetas/conjuntos')
      .query({ limit: 10, offset: 10 })
      .expect(200);

    expect(response.body.meta).toEqual({ page: 2, limit: 10, total: 1, totalPages: 1 });
    expect(mockTarjetaService.listar).toHaveBeenCalledWith({
      limite: 10,
      desplazamiento: 10,
    });
  });

  it('GET /api/asistente/tarjetas/conjuntos/:id aplica el filtro de pendientes', async () => {
    await request(app)
      .get(`/api/asistente/tarjetas/conjuntos/${CONJUNTO_ID}`)
      .query({ estado: 'pendientes' })
      .expect(200);

    expect(mockTarjetaService.obtener).toHaveBeenCalledWith(CONJUNTO_ID, {
      estado: 'pendientes',
    });
  });

  it('GET /api/asistente/tarjetas/conjuntos/:id rechaza un UUID invalido', async () => {
    await request(app).get('/api/asistente/tarjetas/conjuntos/123').expect(400);
    expect(mockTarjetaService.obtener).not.toHaveBeenCalled();
  });

  it('GET /api/asistente/tarjetas/conjuntos/:id rechaza un filtro desconocido', async () => {
    await request(app)
      .get(`/api/asistente/tarjetas/conjuntos/${CONJUNTO_ID}`)
      .query({ estado: 'otro' })
      .expect(400);
  });

  it('DELETE /api/asistente/tarjetas/conjuntos/:id elimina el conjunto', async () => {
    const response = await request(app)
      .delete(`/api/asistente/tarjetas/conjuntos/${CONJUNTO_ID}`)
      .expect(200);

    expect(response.body.data).toEqual({ id: CONJUNTO_ID });
    expect(mockTarjetaService.eliminar).toHaveBeenCalledWith(CONJUNTO_ID);
  });

  it('PATCH /api/asistente/tarjetas/:id/estado registra la marca de estudio', async () => {
    const response = await request(app)
      .patch(`/api/asistente/tarjetas/${TARJETA_ID}/estado`)
      .send({ estado: 'conocida' })
      .expect(200);

    expect(response.body.data.estado).toBe('conocida');
    expect(mockTarjetaService.actualizarEstado).toHaveBeenCalledWith(TARJETA_ID, 'conocida');
  });

  it('PATCH /api/asistente/tarjetas/:id/estado rechaza un estado desconocido', async () => {
    await request(app)
      .patch(`/api/asistente/tarjetas/${TARJETA_ID}/estado`)
      .send({ estado: 'aprobada' })
      .expect(400);

    expect(mockTarjetaService.actualizarEstado).not.toHaveBeenCalled();
  });
});
