jest.mock('../src/middlewares/auth.middleware', () => (req, _res, next) => {
  req.user = {
    id: '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01',
    email: 'admin@mingo.test',
    nombre: 'Ana',
    apellido: 'Perez',
    correo: 'admin@mingo.test',
    estado: 'activo',
    role: 'administrador',
    roles: ['administrador'],
  };
  req.accessToken = 'token-de-prueba';
  next();
});

const request = require('supertest');
const app = require('../src/app');

describe('GET /api/auth/me', () => {
  it('devuelve el perfil y el rol resueltos por el middleware', async () => {
    const response = await request(app).get('/api/auth/me').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      email: 'admin@mingo.test',
      role: 'administrador',
      estado: 'activo',
      roles: ['administrador'],
    });
  });
});
