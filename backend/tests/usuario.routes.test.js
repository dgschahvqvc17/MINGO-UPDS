const ADMIN_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const USUARIO_ID = '6d1c2a53-4f7e-4b8a-9c1d-2e3f4a5b6c7d';

const mockUsuarioAdminService = {
  listarUsuarios: jest.fn(),
  obtenerUsuario: jest.fn(),
};

jest.mock('../src/middlewares/auth.middleware', () => (req, _res, next) => {
  req.user = { id: ADMIN_ID, email: 'admin@mingo.test', role: 'administrador' };
  req.accessToken = 'token-de-prueba';
  next();
});

jest.mock('../src/middlewares/admin.middleware', () => (_req, _res, next) => next());

jest.mock('../src/container', () => {
  const actual = jest.requireActual('../src/container');
  return {
    ...actual,
    createUsuarioAdminService: jest.fn(() => mockUsuarioAdminService),
  };
});

const request = require('supertest');
const app = require('../src/app');

describe('rutas de administración de usuarios', () => {
  beforeEach(() => {
    mockUsuarioAdminService.listarUsuarios.mockResolvedValue({
      usuarios: [{ id: USUARIO_ID, nombre: 'Ana', apellido: 'Quispe' }],
      paginacion: { limit: 20, offset: 0, total: 1 },
      estadisticas: { total: 1, activos: 1, inactivos: 0 },
    });
    mockUsuarioAdminService.obtenerUsuario.mockResolvedValue({ id: USUARIO_ID, nombre: 'Ana' });
  });

  it('acepta limit y offset enviados como texto en la consulta', async () => {
    const response = await request(app)
      .get('/api/usuarios')
      .query({ limit: '20', offset: '0' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(mockUsuarioAdminService.listarUsuarios).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20, offset: 0 }),
    );
  });

  it('aplica la paginación por defecto cuando no se envía', async () => {
    await request(app).get('/api/usuarios').expect(200);

    expect(mockUsuarioAdminService.listarUsuarios).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 0 }),
    );
  });

  it('rechaza un limit fuera de rango', async () => {
    const response = await request(app).get('/api/usuarios').query({ limit: '500' }).expect(400);

    expect(response.body.success).toBe(false);
    expect(mockUsuarioAdminService.listarUsuarios).not.toHaveBeenCalled();
  });

  it('rechaza un identificador que no es UUID', async () => {
    await request(app).get('/api/usuarios/no-es-uuid').expect(400);

    expect(mockUsuarioAdminService.obtenerUsuario).not.toHaveBeenCalled();
  });

  it('devuelve el detalle de un usuario con identificador válido', async () => {
    const response = await request(app).get(`/api/usuarios/${USUARIO_ID}`).expect(200);

    expect(response.body.data).toEqual({ id: USUARIO_ID, nombre: 'Ana' });
  });
});
