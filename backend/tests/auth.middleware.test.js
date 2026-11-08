const request = require('supertest');
const app = require('../src/app');

describe('authMiddleware', () => {
  it('rechaza una solicitud sin token Bearer', async () => {
    const response = await request(app).get('/api/auth/me').expect(401);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toContain('token Bearer');
  });

  it('responde 503 cuando Supabase Auth no esta configurado', async () => {
    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer token-de-prueba')
      .expect(503);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toContain('no esta configurado');
  });
});
