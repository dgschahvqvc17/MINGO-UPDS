const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const mockDocumentoService = {
  procesarDocumento: jest.fn(),
  obtenerEstadoProcesamiento: jest.fn(),
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
    createDocumentoService: jest.fn(() => mockDocumentoService),
  };
});

const request = require('supertest');
const app = require('../src/app');
const ApiError = require('../src/utils/ApiError');

describe('rutas de documentos (HU09)', () => {
  beforeEach(() => {
    mockDocumentoService.procesarDocumento.mockResolvedValue({
      id: DOCUMENTO_ID,
      estado: 'en_cola',
    });
    mockDocumentoService.obtenerEstadoProcesamiento.mockResolvedValue({
      id: DOCUMENTO_ID,
      estado_procesamiento: 'procesado',
      motivo_error: null,
      numero_paginas: 24,
      fecha_actualizacion: '2026-11-14T10:02:00.000Z',
    });
  });

  it('POST /api/documentos/:id/procesar responde 202 y encola el documento', async () => {
    const response = await request(app)
      .post(`/api/documentos/${DOCUMENTO_ID}/procesar`)
      .expect(202);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual({ id: DOCUMENTO_ID, estado: 'en_cola' });
    expect(mockDocumentoService.procesarDocumento).toHaveBeenCalledWith(DOCUMENTO_ID);
  });

  it('POST /api/documentos/:id/procesar rechaza un identificador que no es UUID', async () => {
    const response = await request(app).post('/api/documentos/123/procesar').expect(400);

    expect(response.body.success).toBe(false);
    expect(mockDocumentoService.procesarDocumento).not.toHaveBeenCalled();
  });

  it('POST /api/documentos/:id/procesar responde 404 cuando el documento es ajeno o no existe', async () => {
    mockDocumentoService.procesarDocumento.mockRejectedValue(
      ApiError.notFound('Documento no encontrado.'),
    );

    const response = await request(app)
      .post(`/api/documentos/${DOCUMENTO_ID}/procesar`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Documento no encontrado.');
  });

  it('POST /api/documentos/:id/procesar responde 409 si el documento ya está en proceso', async () => {
    mockDocumentoService.procesarDocumento.mockRejectedValue(
      ApiError.conflict('El documento ya esta en proceso. Espera a que termine.'),
    );

    const response = await request(app)
      .post(`/api/documentos/${DOCUMENTO_ID}/procesar`)
      .expect(409);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toMatch(/ya esta en proceso/);
  });

  it('POST /api/documentos/:id/procesar responde 503 si SQS no está configurado', async () => {
    mockDocumentoService.procesarDocumento.mockRejectedValue(
      ApiError.serviceUnavailable('El servicio de procesamiento no esta disponible en este momento.'),
    );

    const response = await request(app)
      .post(`/api/documentos/${DOCUMENTO_ID}/procesar`)
      .expect(503);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toMatch(/no esta disponible/);
  });

  it('GET /api/documentos/:id/estado devuelve el estado de procesamiento', async () => {
    const response = await request(app)
      .get(`/api/documentos/${DOCUMENTO_ID}/estado`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      id: DOCUMENTO_ID,
      estado_procesamiento: 'procesado',
      numero_paginas: 24,
    });
    expect(mockDocumentoService.obtenerEstadoProcesamiento).toHaveBeenCalledWith(DOCUMENTO_ID);
  });

  it('GET /api/documentos/:id/estado responde 404 cuando el documento es ajeno o no existe', async () => {
    mockDocumentoService.obtenerEstadoProcesamiento.mockRejectedValue(
      ApiError.notFound('Documento no encontrado.'),
    );

    const response = await request(app)
      .get(`/api/documentos/${DOCUMENTO_ID}/estado`)
      .expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('Documento no encontrado.');
  });
});
