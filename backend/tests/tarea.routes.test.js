const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const MATERIA_ID = '6d1c2a53-4f7e-4b8a-9c1d-2e3f4a5b6c7d';
const TAREA_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const mockTareaService = {
  listarTareas: jest.fn(),
  listarProximas: jest.fn(),
  obtenerEstadisticas: jest.fn(),
  obtenerTarea: jest.fn(),
  crearTarea: jest.fn(),
  actualizarTarea: jest.fn(),
  cambiarEstadoTarea: jest.fn(),
  eliminarTarea: jest.fn(),
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
    createTareaService: jest.fn(() => mockTareaService),
  };
});

const request = require('supertest');
const app = require('../src/app');

describe('rutas de tareas (HU04)', () => {
  beforeEach(() => {
    mockTareaService.listarTareas.mockResolvedValue({
      tareas: [{ id: TAREA_ID, titulo: 'Parcial de cálculo', estado: 'pendiente' }],
      paginacion: { limit: 20, offset: 0, total: 1 },
    });
    mockTareaService.listarProximas.mockResolvedValue({
      tareas: [],
      rango: { dias: 7, desde: '2026-11-10T00:00:00.000Z', hasta: '2026-11-17T00:00:00.000Z' },
    });
    mockTareaService.obtenerEstadisticas.mockResolvedValue({ total: 1 });
    mockTareaService.obtenerTarea.mockResolvedValue({ id: TAREA_ID, titulo: 'Parcial' });
    mockTareaService.crearTarea.mockImplementation((datos) =>
      Promise.resolve({ id: TAREA_ID, ...datos }),
    );
    mockTareaService.actualizarTarea.mockResolvedValue({ id: TAREA_ID, titulo: 'Actualizada' });
    mockTareaService.cambiarEstadoTarea.mockResolvedValue({ id: TAREA_ID, estado: 'completada' });
    mockTareaService.eliminarTarea.mockResolvedValue(undefined);
  });

  it('GET /api/tareas devuelve la lista y la paginación', async () => {
    const response = await request(app)
      .get('/api/tareas')
      .query({ estado: 'pendiente', prioridad: 'alta' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.paginacion).toEqual({ limit: 20, offset: 0, total: 1 });
    expect(mockTareaService.listarTareas).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'pendiente', prioridad: 'alta' }),
    );
  });

  it('GET /api/tareas rechaza un límite fuera de rango', async () => {
    const response = await request(app).get('/api/tareas').query({ limit: 500 }).expect(400);

    expect(response.body.success).toBe(false);
    expect(mockTareaService.listarTareas).not.toHaveBeenCalled();
  });

  it('GET /api/tareas/proximas no se interpreta como un ID', async () => {
    const response = await request(app).get('/api/tareas/proximas').query({ dias: 5 }).expect(200);

    expect(response.body.success).toBe(true);
    expect(mockTareaService.listarProximas).toHaveBeenCalledWith(
      expect.objectContaining({ dias: 5 }),
    );
    expect(mockTareaService.obtenerTarea).not.toHaveBeenCalled();
  });

  it('GET /api/tareas/estadisticas devuelve los contadores', async () => {
    const response = await request(app).get('/api/tareas/estadisticas').expect(200);

    expect(response.body.data).toEqual({ total: 1 });
  });

  it('POST /api/tareas crea una tarea válida', async () => {
    const response = await request(app)
      .post('/api/tareas')
      .send({
        materia_id: MATERIA_ID,
        titulo: 'Parcial de cálculo',
        tipo: 'parcial',
        prioridad: 'alta',
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(mockTareaService.crearTarea).toHaveBeenCalledWith(
      expect.objectContaining({
        materia_id: MATERIA_ID,
        titulo: 'Parcial de cálculo',
        tipo: 'parcial',
        prioridad: 'alta',
        estado: 'pendiente',
      }),
    );
  });

  it('POST /api/tareas rechaza un título demasiado corto', async () => {
    const response = await request(app)
      .post('/api/tareas')
      .send({ materia_id: MATERIA_ID, titulo: 'ab' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(mockTareaService.crearTarea).not.toHaveBeenCalled();
  });

  it('GET /api/tareas/:id rechaza un UUID inválido', async () => {
    await request(app).get('/api/tareas/123').expect(400);
    expect(mockTareaService.obtenerTarea).not.toHaveBeenCalled();
  });

  it('PATCH /api/tareas/:id/estado cambia el estado', async () => {
    const response = await request(app)
      .patch(`/api/tareas/${TAREA_ID}/estado`)
      .send({ estado: 'completada' })
      .expect(200);

    expect(response.body.data.estado).toBe('completada');
    expect(mockTareaService.cambiarEstadoTarea).toHaveBeenCalledWith(TAREA_ID, 'completada');
  });

  it('PUT /api/tareas/:id actualiza la tarea', async () => {
    const response = await request(app)
      .put(`/api/tareas/${TAREA_ID}`)
      .send({ titulo: 'Título actualizado' })
      .expect(200);

    expect(response.body.data.titulo).toBe('Actualizada');
    expect(mockTareaService.actualizarTarea).toHaveBeenCalledWith(
      TAREA_ID,
      expect.objectContaining({ titulo: 'Título actualizado' }),
    );
  });

  it('DELETE /api/tareas/:id elimina la tarea', async () => {
    const response = await request(app).delete(`/api/tareas/${TAREA_ID}`).expect(200);

    expect(response.body.data).toEqual({ id: TAREA_ID });
    expect(mockTareaService.eliminarTarea).toHaveBeenCalledWith(TAREA_ID);
  });
});
