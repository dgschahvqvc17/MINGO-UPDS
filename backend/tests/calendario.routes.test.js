const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const MATERIA_ID = '6d1c2a53-4f7e-4b8a-9c1d-2e3f4a5b6c7d';
const EVENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const mockCalendarioService = {
  listarEventos: jest.fn(),
  listarProximos: jest.fn(),
  obtenerEvento: jest.fn(),
  crearEvento: jest.fn(),
  actualizarEvento: jest.fn(),
  eliminarEvento: jest.fn(),
  crearEventoDesdeTarea: jest.fn(),
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
    createCalendarioService: jest.fn(() => mockCalendarioService),
  };
});

const request = require('supertest');
const ApiError = require('../src/utils/ApiError');
const app = require('../src/app');

const RANGO = {
  desde: '2026-11-01T00:00:00.000Z',
  hasta: '2026-11-30T23:59:59.999Z',
};

describe('rutas de calendario (HU05)', () => {
  beforeEach(() => {
    mockCalendarioService.listarEventos.mockResolvedValue({
      eventos: [{ id: EVENTO_ID, titulo: 'Examen parcial', tipo_evento: 'examen' }],
      paginacion: { limit: 50, offset: 0, total: 1 },
    });
    mockCalendarioService.listarProximos.mockResolvedValue({
      eventos: [],
      rango: {
        dias: 7,
        desde: '2026-11-10T00:00:00.000Z',
        hasta: '2026-11-17T00:00:00.000Z',
      },
    });
    mockCalendarioService.obtenerEvento.mockResolvedValue({ id: EVENTO_ID, titulo: 'Examen' });
    mockCalendarioService.crearEvento.mockImplementation((datos) =>
      Promise.resolve({ id: EVENTO_ID, ...datos }),
    );
    mockCalendarioService.actualizarEvento.mockResolvedValue({
      id: EVENTO_ID,
      titulo: 'Evento actualizado',
    });
    mockCalendarioService.eliminarEvento.mockResolvedValue(undefined);
  });

  it('GET /api/calendario/proximos devuelve los eventos y el rango', async () => {
    const response = await request(app)
      .get('/api/calendario/proximos')
      .query({ dias: 7 })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.meta).toHaveProperty('rango');
    expect(mockCalendarioService.listarProximos).toHaveBeenCalledWith(
      expect.objectContaining({ dias: 7, limit: 10 }),
    );
  });

  it('GET /api/calendario/proximos no se interpreta como un ID', async () => {
    await request(app).get('/api/calendario/proximos').expect(200);

    expect(mockCalendarioService.obtenerEvento).not.toHaveBeenCalled();
  });

  it('GET /api/calendario exige el rango de fechas', async () => {
    const response = await request(app).get('/api/calendario').expect(400);

    expect(response.body.success).toBe(false);
    expect(mockCalendarioService.listarEventos).not.toHaveBeenCalled();
  });

  it('GET /api/calendario devuelve la lista y la paginación', async () => {
    const response = await request(app).get('/api/calendario').query(RANGO).expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.meta.paginacion).toEqual({ limit: 50, offset: 0, total: 1 });
    expect(mockCalendarioService.listarEventos).toHaveBeenCalledWith(
      expect.objectContaining({
        desde: expect.any(Date),
        hasta: expect.any(Date),
        limit: 50,
        offset: 0,
      }),
    );
  });

  it('GET /api/calendario rechaza un rango invertido', async () => {
    const response = await request(app)
      .get('/api/calendario')
      .query({ desde: RANGO.hasta, hasta: RANGO.desde })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(mockCalendarioService.listarEventos).not.toHaveBeenCalled();
  });

  it('GET /api/calendario rechaza un tipo de evento desconocido', async () => {
    await request(app)
      .get('/api/calendario')
      .query({ ...RANGO, tipo_evento: 'invalido' })
      .expect(400);
  });

  it('POST /api/calendario crea un evento válido', async () => {
    const response = await request(app)
      .post('/api/calendario')
      .send({
        titulo: 'Examen parcial',
        tipo_evento: 'examen',
        fecha_inicio: '2026-11-20T14:00:00.000Z',
        fecha_fin: '2026-11-20T16:00:00.000Z',
        materia_id: MATERIA_ID,
        recordatorio: 60,
      })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.titulo).toBe('Examen parcial');
    expect(mockCalendarioService.crearEvento).toHaveBeenCalledWith(
      expect.objectContaining({
        titulo: 'Examen parcial',
        tipo_evento: 'examen',
        materia_id: MATERIA_ID,
        recordatorio: 60,
      }),
    );
  });

  it('POST /api/calendario aplica el tipo "otro" por defecto', async () => {
    await request(app)
      .post('/api/calendario')
      .send({ titulo: 'Evento libre', fecha_inicio: '2026-11-20T14:00:00.000Z' })
      .expect(201);

    expect(mockCalendarioService.crearEvento).toHaveBeenCalledWith(
      expect.objectContaining({ tipo_evento: 'otro' }),
    );
  });

  it('POST /api/calendario rechaza un título demasiado corto', async () => {
    const response = await request(app)
      .post('/api/calendario')
      .send({ titulo: 'ab', fecha_inicio: '2026-11-20T14:00:00.000Z' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(mockCalendarioService.crearEvento).not.toHaveBeenCalled();
  });

  it('POST /api/calendario rechaza fecha_fin anterior a fecha_inicio', async () => {
    const response = await request(app)
      .post('/api/calendario')
      .send({
        titulo: 'Evento inválido',
        fecha_inicio: '2026-11-20T16:00:00.000Z',
        fecha_fin: '2026-11-20T14:00:00.000Z',
      })
      .expect(400);

    expect(response.body.success).toBe(false);
  });

  it('POST /api/calendario rechaza un recordatorio fuera de rango', async () => {
    await request(app)
      .post('/api/calendario')
      .send({
        titulo: 'Evento con recordatorio inválido',
        fecha_inicio: '2026-11-20T14:00:00.000Z',
        recordatorio: 20000,
      })
      .expect(400);
  });

  it('GET /api/calendario/:id rechaza un UUID inválido', async () => {
    await request(app).get('/api/calendario/123').expect(400);

    expect(mockCalendarioService.obtenerEvento).not.toHaveBeenCalled();
  });

  it('GET /api/calendario/:id responde 404 si el evento no existe', async () => {
    mockCalendarioService.obtenerEvento.mockRejectedValueOnce(
      ApiError.notFound('Evento no encontrado.'),
    );

    const response = await request(app).get(`/api/calendario/${EVENTO_ID}`).expect(404);

    expect(response.body.success).toBe(false);
  });

  it('GET /api/calendario/:id devuelve el detalle', async () => {
    const response = await request(app).get(`/api/calendario/${EVENTO_ID}`).expect(200);

    expect(response.body.data.id).toBe(EVENTO_ID);
    expect(mockCalendarioService.obtenerEvento).toHaveBeenCalledWith(EVENTO_ID);
  });

  it('PUT /api/calendario/:id actualiza parcialmente', async () => {
    const response = await request(app)
      .put(`/api/calendario/${EVENTO_ID}`)
      .send({ titulo: 'Evento actualizado' })
      .expect(200);

    expect(response.body.data.titulo).toBe('Evento actualizado');
    expect(mockCalendarioService.actualizarEvento).toHaveBeenCalledWith(
      EVENTO_ID,
      expect.objectContaining({ titulo: 'Evento actualizado' }),
    );
  });

  it('PUT /api/calendario/:id rechaza una actualización sin campos', async () => {
    const response = await request(app).put(`/api/calendario/${EVENTO_ID}`).send({}).expect(400);

    expect(response.body.success).toBe(false);
    expect(mockCalendarioService.actualizarEvento).not.toHaveBeenCalled();
  });

  it('DELETE /api/calendario/:id elimina el evento', async () => {
    const response = await request(app).delete(`/api/calendario/${EVENTO_ID}`).expect(200);

    expect(response.body.data).toEqual({ id: EVENTO_ID });
    expect(mockCalendarioService.eliminarEvento).toHaveBeenCalledWith(EVENTO_ID);
  });
});
