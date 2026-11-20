const request = require('supertest');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const MATERIA_ID = '6d1c2a53-4f7e-4b8a-9c1d-2e3f4a5b6c7d';
const OBJETIVO_ID = 'b7e3a2c1-9d4f-4e6a-8b2c-3d1f5a7e9c02';

const mockObjetivoService = {
  listar: jest.fn(),
  obtener: jest.fn(),
  crear: jest.fn(),
  actualizar: jest.fn(),
  eliminar: jest.fn(),
};
const mockProgresoService = {
  obtener: jest.fn(),
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
    createObjetivoService: jest.fn(() => mockObjetivoService),
    createObjetivoController: jest.fn((objetivoService) => {
      const ObjetivoController = jest.requireActual('../src/controllers/objetivo.controller');
      return new ObjetivoController({ objetivoService });
    }),
    createProgresoService: jest.fn(() => mockProgresoService),
    createProgresoController: jest.fn((progresoService) => {
      const ProgresoController = jest.requireActual('../src/controllers/progreso.controller');
      return new ProgresoController({ progresoService });
    }),
  };
});

const app = require('../src/app');

describe('rutas de objetivos y progreso (HU17)', () => {
  beforeEach(() => {
    mockObjetivoService.listar.mockResolvedValue({ items: [], total: 0 });
    mockObjetivoService.obtener.mockResolvedValue({ id: OBJETIVO_ID });
    mockObjetivoService.crear.mockResolvedValue({ id: OBJETIVO_ID, titulo: 'Aprobar el parcial' });
    mockObjetivoService.actualizar.mockResolvedValue({ id: OBJETIVO_ID, estado: 'completada' });
    mockObjetivoService.eliminar.mockResolvedValue(undefined);
    mockProgresoService.obtener.mockResolvedValue({ cumplimiento_tareas: 0.5 });
  });

  it('GET /api/estudio/progreso devuelve el progreso del usuario', async () => {
    const respuesta = await request(app).get('/api/estudio/progreso');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      success: true,
      data: { cumplimiento_tareas: 0.5 },
    });
  });

  it('GET /api/estudio/objetivos responde con paginación por defecto', async () => {
    const respuesta = await request(app).get('/api/estudio/objetivos');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      success: true,
      data: [],
      meta: { limit: 20, offset: 0, total: 0 },
    });
  });

  it('GET /api/estudio/objetivos valida el filtro de estado', async () => {
    const respuesta = await request(app).get('/api/estudio/objetivos?estado=invalido');

    expect(respuesta.status).toBe(400);
    expect(mockObjetivoService.listar).not.toHaveBeenCalled();
  });

  it('POST /api/estudio/objetivos crea el objetivo con el sobre estándar', async () => {
    const respuesta = await request(app).post('/api/estudio/objetivos').send({
      titulo: 'Aprobar el parcial de cálculo',
      descripcion: 'Repasar derivadas',
      materia_id: MATERIA_ID,
      fecha_limite: '2026-12-10',
    });

    expect(respuesta.status).toBe(201);
    expect(mockObjetivoService.crear).toHaveBeenCalledWith({
      titulo: 'Aprobar el parcial de cálculo',
      descripcion: 'Repasar derivadas',
      materiaId: MATERIA_ID,
      fechaLimite: '2026-12-10',
    });
  });

  it('POST /api/estudio/objetivos rechaza un título corto', async () => {
    const respuesta = await request(app)
      .post('/api/estudio/objetivos')
      .send({ titulo: 'abc' });

    expect(respuesta.status).toBe(400);
    expect(mockObjetivoService.crear).not.toHaveBeenCalled();
  });

  it('GET /api/estudio/objetivos/:id valida el UUID', async () => {
    const respuesta = await request(app).get('/api/estudio/objetivos/no-uuid');

    expect(respuesta.status).toBe(400);
    expect(mockObjetivoService.obtener).not.toHaveBeenCalled();
  });

  it('PUT /api/estudio/objetivos/:id actualiza el estado', async () => {
    const respuesta = await request(app)
      .put(`/api/estudio/objetivos/${OBJETIVO_ID}`)
      .send({ estado: 'completada' });

    expect(respuesta.status).toBe(200);
    expect(mockObjetivoService.actualizar).toHaveBeenCalledWith(OBJETIVO_ID, {
      estado: 'completada',
    });
  });

  it('PUT /api/estudio/objetivos/:id rechaza un cuerpo vacío', async () => {
    const respuesta = await request(app)
      .put(`/api/estudio/objetivos/${OBJETIVO_ID}`)
      .send({});

    expect(respuesta.status).toBe(400);
    expect(mockObjetivoService.actualizar).not.toHaveBeenCalled();
  });

  it('DELETE /api/estudio/objetivos/:id responde 204', async () => {
    const respuesta = await request(app).delete(`/api/estudio/objetivos/${OBJETIVO_ID}`);

    expect(respuesta.status).toBe(204);
    expect(mockObjetivoService.eliminar).toHaveBeenCalledWith(OBJETIVO_ID);
  });
});
