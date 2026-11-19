const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const mockBusquedaService = {
  buscar: jest.fn(),
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
    createDocumentoService: jest.fn(() => ({})),
    createBusquedaService: jest.fn(() => mockBusquedaService),
  };
});

const request = require('supertest');
const app = require('../src/app');
const ApiError = require('../src/utils/ApiError');
const { createBusquedaService } = require('../src/container');

const RESULTADO = {
  fragmento_id: 'fragmento-1',
  documento_id: DOCUMENTO_ID,
  documento_nombre: 'Apuntes de cálculo',
  contenido: 'La derivada mide la tasa de cambio instantánea.',
  numero_pagina: 12,
  similitud: 0.873421,
};

describe('GET /api/documentos/buscar (HU11)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBusquedaService.buscar.mockResolvedValue({ resultados: [RESULTADO], mensaje: null });
  });

  it('devuelve los fragmentos con el sobre estándar', async () => {
    const response = await request(app)
      .get('/api/documentos/buscar')
      .query({ q: 'derivadas de funciones' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual([RESULTADO]);
    expect(response.body.meta).toEqual({ mensaje: null });
    expect(createBusquedaService).toHaveBeenCalledWith(USUARIO_ID, 'token-de-prueba');
    expect(mockBusquedaService.buscar).toHaveBeenCalledWith({
      consulta: 'derivadas de funciones',
      documentoId: null,
      materiaId: null,
      limite: 8,
    });
  });

  it('acepta filtros por documento, materia y limit en texto', async () => {
    const MATERIA_ID = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';

    await request(app)
      .get('/api/documentos/buscar')
      .query({ q: 'derivadas', documento_id: DOCUMENTO_ID, materia_id: MATERIA_ID, limit: '5' })
      .expect(200);

    expect(mockBusquedaService.buscar).toHaveBeenCalledWith({
      consulta: 'derivadas',
      documentoId: DOCUMENTO_ID,
      materiaId: MATERIA_ID,
      limite: 5,
    });
  });

  it('recorta un limit mayor al máximo permitido', async () => {
    await request(app)
      .get('/api/documentos/buscar')
      .query({ q: 'derivadas', limit: '100' })
      .expect(200);

    expect(mockBusquedaService.buscar).toHaveBeenCalledWith(
      expect.objectContaining({ limite: 20 }),
    );
  });

  it('devuelve 400 si falta la consulta', async () => {
    const response = await request(app).get('/api/documentos/buscar').expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error.details.source).toBe('query');
    expect(mockBusquedaService.buscar).not.toHaveBeenCalled();
  });

  it('devuelve 400 si la consulta es demasiado corta', async () => {
    await request(app).get('/api/documentos/buscar').query({ q: 'a' }).expect(400);

    expect(mockBusquedaService.buscar).not.toHaveBeenCalled();
  });

  it('devuelve 400 si el documento enviado no es UUID', async () => {
    await request(app)
      .get('/api/documentos/buscar')
      .query({ q: 'derivadas', documento_id: '123' })
      .expect(400);

    expect(mockBusquedaService.buscar).not.toHaveBeenCalled();
  });

  it('devuelve 200 con lista vacía y mensaje cuando no hay coincidencias', async () => {
    mockBusquedaService.buscar.mockResolvedValue({
      resultados: [],
      mensaje: 'No hay resultados relevantes.',
    });

    const response = await request(app)
      .get('/api/documentos/buscar')
      .query({ q: 'temas sin coincidencia' })
      .expect(200);

    expect(response.body.data).toEqual([]);
    expect(response.body.meta.mensaje).toBe('No hay resultados relevantes.');
  });

  it('propaga el error del servicio con su código HTTP', async () => {
    mockBusquedaService.buscar.mockRejectedValue(
      ApiError.serviceUnavailable('El servicio de IA no esta disponible.'),
    );

    const response = await request(app)
      .get('/api/documentos/buscar')
      .query({ q: 'derivadas' })
      .expect(503);

    expect(response.body.success).toBe(false);
    expect(response.body.error.message).toBe('El servicio de IA no esta disponible.');
  });
});
