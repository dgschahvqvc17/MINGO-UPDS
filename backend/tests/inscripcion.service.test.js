const InscripcionService = require('../src/services/inscripcion.service');
const ApiError = require('../src/utils/ApiError');

const MATERIA_ID = '6d1c2a53-4f7e-4b8a-9c1d-2e3f4a5b6c7d';
const DOCENTE_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const ESTUDIANTE_ID = 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

function construirServicio({ rol = 'docente', materia = { id: MATERIA_ID, docente_id: DOCENTE_ID } } = {}) {
  const inscripcionRepository = {
    listar: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    inscribir: jest.fn().mockResolvedValue({ id: 'inscripcion-1' }),
    desinscribir: jest.fn().mockResolvedValue({ id: 'inscripcion-1' }),
  };
  const materiaRepository = {
    obtenerMateriaPorId: jest.fn().mockResolvedValue(materia),
  };

  return {
    service: new InscripcionService({
      inscripcionRepository,
      materiaRepository,
      usuarioActualId: DOCENTE_ID,
      rol,
    }),
    inscripcionRepository,
    materiaRepository,
  };
}

describe('InscripcionService', () => {
  it('permite al administrador listar inscripciones sin comprobar docencia', async () => {
    const { service, materiaRepository } = construirServicio({ rol: 'administrador' });

    await service.listar(MATERIA_ID);

    expect(materiaRepository.obtenerMateriaPorId).not.toHaveBeenCalled();
  });

  it('permite al docente responsable inscribir a un estudiante', async () => {
    const { service, inscripcionRepository } = construirServicio();

    await service.inscribir(MATERIA_ID, ESTUDIANTE_ID);

    expect(inscripcionRepository.inscribir).toHaveBeenCalledWith({
      materiaId: MATERIA_ID,
      estudianteId: ESTUDIANTE_ID,
    });
  });

  it('devuelve 404 al docente que no es responsable de la materia', async () => {
    const { service, inscripcionRepository } = construirServicio({
      materia: { id: MATERIA_ID, docente_id: ESTUDIANTE_ID },
    });

    await expect(service.inscribir(MATERIA_ID, ESTUDIANTE_ID)).rejects.toThrow(ApiError);
    expect(inscripcionRepository.inscribir).not.toHaveBeenCalled();
  });

  it('devuelve 404 cuando la materia no existe', async () => {
    const { service } = construirServicio({ materia: null });

    await expect(service.desinscribir(MATERIA_ID, ESTUDIANTE_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
