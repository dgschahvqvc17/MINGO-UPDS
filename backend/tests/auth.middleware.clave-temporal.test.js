const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';

jest.mock('../src/config/environment', () => {
  const actual = jest.requireActual('../src/config/environment');
  return {
    ...actual,
    supabase: { ...actual.supabase, isConfigured: true },
  };
});

jest.mock('../src/config/supabase', () => ({
  createSupabaseClient: jest.fn(() => ({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: USUARIO_ID } } }) },
  })),
  createSupabaseServiceRoleClient: jest.fn(),
  createSupabaseAnonClient: jest.fn(),
}));

jest.mock('../src/container', () => {
  const actual = jest.requireActual('../src/container');
  return {
    ...actual,
    createAuthService: jest.fn(() => ({
      buildAuthenticatedUser: jest.fn().mockResolvedValue({
        id: USUARIO_ID,
        email: 'docente@mingo.test',
        role: 'docente',
        roles: ['docente'],
        requiereCambioClave: true,
      }),
    })),
  };
});

const request = require('supertest');
const app = require('../src/app');

describe('bloqueo por contraseña temporal', () => {
  const token = 'Bearer token-de-prueba';

  it('permite consultar el perfil mientras la clave es temporal', async () => {
    const response = await request(app).get('/api/auth/me').set('Authorization', token).expect(200);

    expect(response.body.success).toBe(true);
  });

  it('no bloquea la ruta de cambio de clave', async () => {
    const response = await request(app)
      .post('/api/auth/cambiar-clave')
      .set('Authorization', token)
      .send({ claveActual: 'temporal123', claveNueva: 'definitiva123' });

    expect(response.status).not.toBe(403);
  });

  it('bloquea cualquier otra ruta hasta cambiar la clave', async () => {
    const response = await request(app)
      .get('/api/tareas')
      .set('Authorization', token)
      .expect(403);

    expect(response.body.error.message).toContain('contraseña temporal');
  });
});
