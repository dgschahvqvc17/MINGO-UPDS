const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';

const mockDashboardService = {
  obtenerResumen: jest.fn(),
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
    createDashboardService: jest.fn(() => mockDashboardService),
  };
});

const request = require('supertest');
const ApiError = require('../src/utils/ApiError');
const app = require('../src/app');

describe('rutas del dashboard (HU06)', () => {
  beforeEach(() => {
    mockDashboardService.obtenerResumen.mockResolvedValue({
      materias: { total: 2, activas: 2, archivadas: 0 },
      tareas: { total: 4, pendientes: 2, en_progreso: 1, completadas: 1, vencidas: 0 },
      proximas_actividades: [],
      proximos_examenes: [],
      proximos_eventos: [],
      progreso: {
        tareas_totales: 4,
        tareas_completadas: 1,
        porcentaje_completado: 25,
        materias_activas: 2,
      },
      notificaciones: [],
      generado_en: '2026-11-10T15:00:00.000Z',
    });
  });

  it('GET /api/dashboard devuelve el resumen del usuario autenticado', async () => {
    const response = await request(app).get('/api/dashboard').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.tareas.pendientes).toBe(2);
    expect(response.body.data.progreso.porcentaje_completado).toBe(25);
    expect(mockDashboardService.obtenerResumen).toHaveBeenCalledTimes(1);
  });

  it('GET /api/dashboard traduce un error del servicio al sobre estándar', async () => {
    mockDashboardService.obtenerResumen.mockRejectedValue(
      ApiError.serviceUnavailable('Supabase no está configurado.'),
    );

    const response = await request(app).get('/api/dashboard').expect(503);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Supabase no está configurado.');
  });
});
