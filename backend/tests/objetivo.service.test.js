const ObjetivoService = require('../src/services/objetivo.service');
const ApiError = require('../src/utils/ApiError');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const MATERIA_ID = '6d1c2a53-4f7e-4b8a-9c1d-2e3f4a5b6c7d';
const OBJETIVO_ID = 'b7e3a2c1-9d4f-4e6a-8b2c-3d1f5a7e9c02';

function crearServicio({ materia = { id: MATERIA_ID, nombre: 'Cálculo' } } = {}) {
  const objetivoRepository = {
    listar: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    obtenerPorId: jest.fn().mockResolvedValue({
      id: OBJETIVO_ID,
      usuario_id: USUARIO_ID,
      estado: 'pendiente',
    }),
    crear: jest.fn(async (objetivo) => ({ id: OBJETIVO_ID, ...objetivo })),
    actualizar: jest.fn(async (usuarioId, id, cambios) => ({ id, ...cambios })),
    eliminar: jest.fn().mockResolvedValue(undefined),
  };
  const materiaRepository = {
    obtenerMateriaPorId: jest.fn().mockResolvedValue(materia),
  };

  return {
    service: new ObjetivoService({
      objetivoRepository,
      materiaRepository,
      usuarioActualId: USUARIO_ID,
    }),
    objetivoRepository,
    materiaRepository,
  };
}

describe('ObjetivoService (HU17)', () => {
  it('crea un objetivo con el usuario del token y estado pendiente', async () => {
    const { service, objetivoRepository, materiaRepository } = crearServicio();

    const objetivo = await service.crear({
      titulo: 'Aprobar el parcial de cálculo',
      descripcion: 'Repasar derivadas',
      materiaId: MATERIA_ID,
      fechaLimite: '2026-12-10',
    });

    expect(objetivo.estado).toBe('pendiente');
    expect(objetivo.usuario_id).toBe(USUARIO_ID);
    expect(objetivoRepository.crear).toHaveBeenCalledWith({
      usuario_id: USUARIO_ID,
      materia_id: MATERIA_ID,
      titulo: 'Aprobar el parcial de cálculo',
      descripcion: 'Repasar derivadas',
      fecha_limite: '2026-12-10',
      estado: 'pendiente',
    });
    expect(materiaRepository.obtenerMateriaPorId).toHaveBeenCalledWith(USUARIO_ID, MATERIA_ID);
  });

  it('permite crear un objetivo sin materia', async () => {
    const { service, objetivoRepository, materiaRepository } = crearServicio();

    await service.crear({ titulo: 'Estudiar dos horas diarias' });

    expect(materiaRepository.obtenerMateriaPorId).not.toHaveBeenCalled();
    expect(objetivoRepository.crear.mock.calls[0][0].materia_id).toBeNull();
  });

  it('rechaza una materia ajena o inexistente', async () => {
    const { service, objetivoRepository } = crearServicio({ materia: null });

    await expect(
      service.crear({ titulo: 'Aprobar el parcial', materiaId: MATERIA_ID }),
    ).rejects.toThrow(ApiError);

    expect(objetivoRepository.crear).not.toHaveBeenCalled();
  });

  it('devuelve 404 cuando el objetivo no pertenece al usuario', async () => {
    const { service, objetivoRepository } = crearServicio();
    objetivoRepository.obtenerPorId.mockResolvedValue(null);

    await expect(service.obtener(OBJETIVO_ID)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.eliminar(OBJETIVO_ID)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('actualiza el estado y permite quitar la materia y la fecha', async () => {
    const { service, objetivoRepository } = crearServicio();

    await service.actualizar(OBJETIVO_ID, {
      estado: 'completada',
      materiaId: null,
      fechaLimite: null,
    });

    expect(objetivoRepository.actualizar).toHaveBeenCalledWith(USUARIO_ID, OBJETIVO_ID, {
      estado: 'completada',
      materia_id: null,
      fecha_limite: null,
    });
  });

  it('no valida la materia si no cambia en la actualización', async () => {
    const { service, materiaRepository } = crearServicio();

    await service.actualizar(OBJETIVO_ID, { titulo: 'Nuevo título del objetivo' });

    expect(materiaRepository.obtenerMateriaPorId).not.toHaveBeenCalled();
  });

  it('pasa el filtro y la paginación al repositorio', async () => {
    const { service, objetivoRepository } = crearServicio();

    await service.listar({ estado: 'pendiente', limite: 10, desplazamiento: 20 });

    expect(objetivoRepository.listar).toHaveBeenCalledWith(USUARIO_ID, {
      estado: 'pendiente',
      limit: 10,
      offset: 20,
    });
  });
});
