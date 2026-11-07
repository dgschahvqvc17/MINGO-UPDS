const request = require('supertest');
const app = require('../src/app');

describe('GET /api/health', () => {
  it('responde con el estado del servicio', async () => {
    const response = await request(app).get('/api/health').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.service).toBe('MINGO API');
    expect(response.body.data.status).toBe('ok');
  });
});

describe('Rutas no encontradas', () => {
  it('devuelve 404 con formato de error consistente', async () => {
    const response = await request(app).get('/api/ruta-inexistente').expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toContain('Ruta no encontrada');
  });
});
