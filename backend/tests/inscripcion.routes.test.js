const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const MATERIA_ID = '6d1c2a53-4f7e-4b8a-9c1d-2e3f4a5b6c7d';
const ESTUDIANTE_ID = 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const mockInscripcionService = {
  listar: jest.fn(),
  inscribir: jest.fn(),
  desinscribir: jest.fn(),
};

jest.mock('../src/middlewares/auth.middleware', () => (req, _res, next) => {
  req.user = { id: USUARIO_ID, email: 'docente@mingo.test', role: 'docente' };
  req.accessToken = 'token-de-prueba';
  next();
});

jest.mock('../src/container', () => {
  const actual = jest.requireActual('../src/container');
  return {
    ...actual,
    createInscripcionService: jest.fn(() => mockInscripcionService),
    createMateriaService: jest.fn(() => ({})),
  };
});

const request = require('supertest');
const app = require('../src/app');

describe('rutas de inscripciones', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInscripcionService.listar.mockResolvedValue({ items: [], total: 0 });
    mockInscripcionService.inscribir.mockResolvedValue({ id: 'inscripcion-1' });
    mockInscripcionService.desinscribir.mockResolvedValue({ id: 'inscripcion-1' });
  });

  it('GET /api/materias/:materiaId/inscripciones pasa el ID de materia al servicio', async () => {
    const response = await request(app)
      .get(`/api/materias/${MATERIA_ID}/inscripciones`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(mockInscripcionService.listar).toHaveBeenCalledWith(MATERIA_ID, expect.any(Object));
  });

  it('POST /api/materias/:materiaId/inscripciones inscribe al estudiante indicado', async () => {
    const response = await request(app)
      .post(`/api/materias/${MATERIA_ID}/inscripciones`)
      .send({ usuario_id: ESTUDIANTE_ID })
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(mockInscripcionService.inscribir).toHaveBeenCalledWith(MATERIA_ID, ESTUDIANTE_ID);
  });

  it('DELETE /api/materias/:materiaId/inscripciones/:usuarioId pasa ambos IDs', async () => {
    const response = await request(app)
      .delete(`/api/materias/${MATERIA_ID}/inscripciones/${ESTUDIANTE_ID}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(mockInscripcionService.desinscribir).toHaveBeenCalledWith(MATERIA_ID, ESTUDIANTE_ID);
  });

  it('rechaza un ID de materia que no es UUID', async () => {
    await request(app).get('/api/materias/no-uuid/inscripciones').expect(400);

    expect(mockInscripcionService.listar).not.toHaveBeenCalled();
  });
});
