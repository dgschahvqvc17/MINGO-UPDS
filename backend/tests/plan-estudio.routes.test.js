const request = require('supertest');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const MATERIA_ID = '6d1c2a53-4f7e-4b8a-9c1d-2e3f4a5b6c7d';
const PLAN_ID = 'b7e3a2c1-9d4f-4e6a-8b2c-3d1f5a7e9c02';
const SESION_ID = 'c8f4b3d2-0e5a-4f7b-9c3d-4e2a6b8f0d13';

const mockPlanService = {
  proponer: jest.fn(),
  confirmar: jest.fn(),
  listar: jest.fn(),
  obtener: jest.fn(),
  actualizar: jest.fn(),
  descartar: jest.fn(),
  agregarSesion: jest.fn(),
  actualizarSesion: jest.fn(),
  eliminarSesion: jest.fn(),
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
    createPlanEstudioService: jest.fn(() => mockPlanService),
    createResumenService: jest.fn(() => ({})),
  };
});

const app = require('../src/app');

describe('rutas de planes de estudio (HU15)', () => {
  beforeEach(() => {
    mockPlanService.proponer.mockResolvedValue({ es_propuesta: true, sesiones: [] });
    mockPlanService.confirmar.mockResolvedValue({ id: PLAN_ID, estado: 'confirmado' });
    mockPlanService.listar.mockResolvedValue({ items: [], total: 0 });
    mockPlanService.obtener.mockResolvedValue({ id: PLAN_ID, sesiones: [] });
    mockPlanService.actualizar.mockResolvedValue({ id: PLAN_ID });
    mockPlanService.descartar.mockResolvedValue(undefined);
    mockPlanService.agregarSesion.mockResolvedValue({ id: SESION_ID });
    mockPlanService.actualizarSesion.mockResolvedValue({ id: SESION_ID });
    mockPlanService.eliminarSesion.mockResolvedValue(undefined);
  });

  it('POST /api/asistente/plan valida el cuerpo y devuelve la propuesta', async () => {
    const respuesta = await request(app).post('/api/asistente/plan').send({
      materia_id: MATERIA_ID,
      objetivo: 'Aprobar el parcial',
      fecha_examen: '2026-12-10',
      minutos_por_dia: 60,
      dias_disponibles: ['lunes'],
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.success).toBe(true);
    expect(respuesta.body.data.es_propuesta).toBe(true);
    expect(mockPlanService.proponer).toHaveBeenCalledWith({
      materiaId: MATERIA_ID,
      objetivo: 'Aprobar el parcial',
      fechaExamen: '2026-12-10',
      minutosPorDia: 60,
      diasDisponibles: ['lunes'],
    });
  });

  it('POST /api/asistente/plan rechaza una materia invalida', async () => {
    const respuesta = await request(app).post('/api/asistente/plan').send({
      materia_id: 'no-uuid',
      objetivo: 'Aprobar el parcial',
      fecha_examen: '2026-12-10',
      minutos_por_dia: 60,
      dias_disponibles: ['lunes'],
    });

    expect(respuesta.status).toBe(400);
    expect(mockPlanService.proponer).not.toHaveBeenCalled();
  });

  it('GET /api/estudio/planes responde con el sobre estandar', async () => {
    const respuesta = await request(app).get('/api/estudio/planes');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      success: true,
      data: [],
      meta: { limit: 20, offset: 0, total: 0 },
    });
  });

  it('POST /api/estudio/planes persiste el plan confirmado', async () => {
    const sesiones = [
      {
        tema: 'Planificacion de CPU',
        actividades: 'Leer el capitulo 3',
        fecha_inicio: '2026-12-01T09:00:00Z',
        duracion_minutos: 60,
      },
    ];

    const respuesta = await request(app).post('/api/estudio/planes').send({
      materia_id: MATERIA_ID,
      objetivo: 'Aprobar el parcial',
      fecha_examen: '2026-12-10',
      minutos_por_dia: 60,
      dias_disponibles: ['lunes'],
      sesiones,
    });

    expect(respuesta.status).toBe(201);
    expect(mockPlanService.confirmar).toHaveBeenCalledTimes(1);
    expect(mockPlanService.confirmar.mock.calls[0][0].sesiones).toHaveLength(1);
  });

  it('POST /api/estudio/planes rechaza un plan sin sesiones', async () => {
    const respuesta = await request(app).post('/api/estudio/planes').send({
      materia_id: MATERIA_ID,
      objetivo: 'Aprobar el parcial',
      fecha_examen: '2026-12-10',
      minutos_por_dia: 60,
      dias_disponibles: ['lunes'],
      sesiones: [],
    });

    expect(respuesta.status).toBe(400);
    expect(mockPlanService.confirmar).not.toHaveBeenCalled();
  });

  it('GET /api/estudio/planes/:id valida el UUID', async () => {
    const respuesta = await request(app).get('/api/estudio/planes/no-uuid');

    expect(respuesta.status).toBe(400);
    expect(mockPlanService.obtener).not.toHaveBeenCalled();
  });

  it('PATCH /api/estudio/sesiones/:id actualiza el estado', async () => {
    const respuesta = await request(app)
      .patch(`/api/estudio/sesiones/${SESION_ID}`)
      .send({ estado: 'completada' });

    expect(respuesta.status).toBe(200);
    expect(mockPlanService.actualizarSesion).toHaveBeenCalledWith(SESION_ID, {
      estado: 'completada',
    });
  });

  it('PATCH /api/estudio/sesiones/:id actualiza el tipo', async () => {
    const respuesta = await request(app)
      .patch(`/api/estudio/sesiones/${SESION_ID}`)
      .send({ tipo: 'repaso' });

    expect(respuesta.status).toBe(200);
    expect(mockPlanService.actualizarSesion).toHaveBeenCalledWith(SESION_ID, {
      tipo: 'repaso',
    });
  });

  it('DELETE /api/estudio/planes/:id descarta el plan', async () => {
    const respuesta = await request(app).delete(`/api/estudio/planes/${PLAN_ID}`);

    expect(respuesta.status).toBe(200);
    expect(mockPlanService.descartar).toHaveBeenCalledWith(PLAN_ID);
  });
});
