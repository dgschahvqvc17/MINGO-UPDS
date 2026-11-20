const request = require('supertest');
const ApiError = require('../src/utils/ApiError');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const NOTIFICACION_ID = '9c5f0f18-d01e-4c9f-b4e6-58b24c7f9a01';

const mockNotificacionService = {
  listar: jest.fn(),
  marcarLeida: jest.fn(),
  marcarTodasLeidas: jest.fn(),
  obtenerPreferencias: jest.fn(),
  actualizarPreferencias: jest.fn(),
};

jest.mock('../src/middlewares/auth.middleware', () => (req, _res, next) => {
  req.user = { id: '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01', email: 'estudiante@mingo.test', role: 'estudiante' };
  req.accessToken = 'token-de-prueba';
  next();
});

jest.mock('../src/container', () => {
  const actual = jest.requireActual('../src/container');
  return {
    ...actual,
    createNotificacionService: jest.fn(() => mockNotificacionService),
    createNotificacionController: jest.fn((notificacionService) => {
      const NotificacionController = jest.requireActual(
        '../src/controllers/notificacion.controller',
      );
      return new NotificacionController({ notificacionService });
    }),
  };
});

const app = require('../src/app');

describe('Rutas de notificaciones (HU18)', () => {
  beforeEach(() => {
    mockNotificacionService.listar.mockReset().mockResolvedValue({
      items: [{ id: NOTIFICACION_ID }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    mockNotificacionService.marcarLeida.mockReset().mockResolvedValue({ id: NOTIFICACION_ID, leida: true });
    mockNotificacionService.marcarTodasLeidas.mockReset().mockResolvedValue(2);
    mockNotificacionService.obtenerPreferencias.mockReset().mockResolvedValue({
      usuario_id: USUARIO_ID,
      notificaciones_activas: true,
      anticipacion_minutos: 60,
    });
    mockNotificacionService.actualizarPreferencias.mockReset().mockResolvedValue({
      usuario_id: USUARIO_ID,
      anticipacion_minutos: 120,
    });
  });

  it('lista las notificaciones con filtros y paginacion', async () => {
    const respuesta = await request(app)
      .get('/api/notificaciones')
      .query({ leida: 'false', tipo: 'tarea', page: '2', limit: '10' })
      .expect(200);

    expect(respuesta.body.success).toBe(true);
    expect(respuesta.body.data).toHaveLength(1);
    expect(mockNotificacionService.listar).toHaveBeenCalledWith({
      leida: 'false',
      tipo: 'tarea',
      page: 2,
      limit: 10,
    });
  });

  it('rechaza un filtro de tipo invalido', async () => {
    await request(app).get('/api/notificaciones').query({ tipo: 'otro' }).expect(400);
    expect(mockNotificacionService.listar).not.toHaveBeenCalled();
  });

  it('marca una notificacion como leida', async () => {
    const respuesta = await request(app)
      .patch(`/api/notificaciones/${NOTIFICACION_ID}/leida`)
      .expect(200);

    expect(respuesta.body.data.leida).toBe(true);
    expect(mockNotificacionService.marcarLeida).toHaveBeenCalledWith(NOTIFICACION_ID);
  });

  it('responde 404 cuando la notificacion no pertenece al usuario', async () => {
    mockNotificacionService.marcarLeida.mockRejectedValueOnce(
      ApiError.notFound('Notificacion no encontrada.'),
    );

    await request(app)
      .patch(`/api/notificaciones/${NOTIFICACION_ID}/leida`)
      .expect(404);
  });

  it('rechaza un identificador invalido', async () => {
    await request(app).patch('/api/notificaciones/no-es-uuid/leida').expect(400);
    expect(mockNotificacionService.marcarLeida).not.toHaveBeenCalled();
  });

  it('marca todas las notificaciones como leidas', async () => {
    const respuesta = await request(app).patch('/api/notificaciones/leer-todas').expect(200);
    expect(respuesta.body.data).toEqual({ actualizadas: 2 });
  });

  it('consulta y actualiza las preferencias', async () => {
    await request(app).get('/api/notificaciones/preferencias').expect(200);

    const respuesta = await request(app)
      .put('/api/notificaciones/preferencias')
      .send({ anticipacion_minutos: 120 })
      .expect(200);

    expect(respuesta.body.data.anticipacion_minutos).toBe(120);
    expect(mockNotificacionService.actualizarPreferencias).toHaveBeenCalledWith({
      anticipacion_minutos: 120,
    });
  });

  it('rechaza una anticipacion fuera de rango', async () => {
    await request(app)
      .put('/api/notificaciones/preferencias')
      .send({ anticipacion_minutos: 1 })
      .expect(400);

    expect(mockNotificacionService.actualizarPreferencias).not.toHaveBeenCalled();
  });
});
