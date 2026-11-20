const PlanEstudioService = require('../src/services/plan-estudio.service');
const { PlanIaError } = require('../src/services/ia/plan.ia.service');
const { MAXIMO_SESIONES } = require('../src/models/plan-estudio.model');
const ApiError = require('../src/utils/ApiError');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const MATERIA_ID = '6d1c2a53-4f7e-4b8a-9c1d-2e3f4a5b6c7d';
const MATERIA = { id: MATERIA_ID, nombre: 'Sistemas Operativos' };

const PROPUESTA_IA = {
  contenido: {
    resumen: 'Plan de repaso',
    sesiones: [
      {
        tema: 'Planificacion de CPU',
        actividades: 'Leer el capitulo 3 y resolver ejercicios',
        fecha_inicio: '2026-12-01T09:00:00Z',
        duracion_minutos: 60,
        tipo: 'lectura',
      },
    ],
  },
  modelo: 'modelo-de-prueba',
  tokensEntrada: 100,
  tokensSalida: 50,
};

const ENTRADA = {
  materiaId: MATERIA_ID,
  objetivo: 'Aprobar el parcial de sistemas operativos',
  fechaExamen: '2026-12-10',
  minutosPorDia: 60,
  diasDisponibles: ['lunes', 'miercoles'],
};

function crearServicio({ consumos = 0 } = {}) {
  const materiaRepository = {
    obtenerMateriaPorId: jest.fn().mockResolvedValue(MATERIA),
  };
  const tareaRepository = {
    listarTareas: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  };
  const fragmentoRepository = {
    listarPorMateriaParaCuestionario: jest.fn().mockResolvedValue([]),
  };
  const planRepository = {
    crearPlan: jest.fn(async (plan, sesiones) => ({
      id: 'plan-id',
      ...plan,
      materias: MATERIA,
      sesiones: sesiones.map((sesion, indice) => ({
        id: `sesion-${indice}`,
        ...sesion,
        orden: indice + 1,
        estado: 'pendiente',
      })),
    })),
    listarPlanes: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    obtenerPlanPorId: jest.fn().mockResolvedValue({
      id: 'plan-id',
      usuario_id: USUARIO_ID,
      materia_id: MATERIA_ID,
      fecha_examen: '2026-12-10',
      estado: 'confirmado',
      materias: MATERIA,
    }),
    listarSesiones: jest.fn().mockResolvedValue([]),
    crearSesion: jest.fn(async (usuarioId, sesion) => ({
      id: 'sesion-nueva',
      ...sesion,
      estado: 'pendiente',
    })),
    obtenerSesionPorId: jest.fn().mockResolvedValue({
      id: 'sesion-id',
      plan_id: 'plan-id',
      tema: 'Planificacion de CPU',
      actividades: 'Leer el capitulo 3',
      fecha_inicio: '2026-12-01T09:00:00Z',
      duracion_minutos: 60,
      estado: 'pendiente',
      evento_calendario_id: 'evento-id',
    }),
    actualizarPlan: jest.fn(async (usuarioId, id, cambios) => ({
      id,
      usuario_id: USUARIO_ID,
      materia_id: MATERIA_ID,
      estado: 'confirmado',
      materias: MATERIA,
      ...cambios,
    })),
    actualizarSesion: jest.fn(async (usuarioId, id, cambios) => ({
      id,
      plan_id: 'plan-id',
      tema: 'Planificacion de CPU',
      actividades: 'Leer el capitulo 3',
      tipo: 'lectura',
      fecha_inicio: '2026-12-01T09:00:00Z',
      duracion_minutos: 60,
      estado: 'pendiente',
      ...cambios,
    })),
    eliminarSesion: jest.fn().mockResolvedValue(undefined),
    eliminarPlan: jest.fn().mockResolvedValue(undefined),
  };
  const calendarioRepository = {
    listarEventos: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    crearEvento: jest.fn().mockResolvedValue({ id: 'evento-id' }),
    actualizarEvento: jest.fn().mockResolvedValue({ id: 'evento-id' }),
    eliminarEvento: jest.fn().mockResolvedValue(undefined),
  };
  const consumoRepository = {
    contar: jest.fn().mockResolvedValue(consumos),
    registrar: jest.fn().mockResolvedValue('consumo-id'),
  };
  const iaService = {
    generarPlan: jest.fn().mockResolvedValue(PROPUESTA_IA),
  };

  const service = new PlanEstudioService({
    materiaRepository,
    tareaRepository,
    fragmentoRepository,
    planRepository,
    calendarioRepository,
    consumoRepository,
    iaService,
    usuarioActualId: USUARIO_ID,
  });

  return {
    service,
    materiaRepository,
    tareaRepository,
    planRepository,
    calendarioRepository,
    consumoRepository,
    iaService,
  };
}

describe('PlanEstudioService (HU15)', () => {
  it('genera una propuesta sin guardarla ni crear eventos', async () => {
    const { service, planRepository, calendarioRepository, consumoRepository } = crearServicio();

    const propuesta = await service.proponer(ENTRADA);

    expect(propuesta.es_propuesta).toBe(true);
    expect(propuesta.sesiones).toHaveLength(1);
    expect(propuesta.sesiones[0].orden).toBe(1);
    expect(planRepository.crearPlan).not.toHaveBeenCalled();
    expect(calendarioRepository.crearEvento).not.toHaveBeenCalled();
    expect(consumoRepository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ operacion: 'plan', usuario_id: USUARIO_ID }),
    );
  });

  it('incluye tareas y evaluaciones de la materia en el contexto de la IA', async () => {
    const { service, tareaRepository, calendarioRepository, iaService } = crearServicio();
    tareaRepository.listarTareas.mockResolvedValue({
      items: [{ titulo: 'Guia de semaforos', tipo: 'tarea', fecha_entrega: '2026-12-05' }],
      total: 1,
    });
    calendarioRepository.listarEventos.mockResolvedValue({
      items: [{ titulo: 'Parcial de sistemas operativos', fecha_inicio: '2026-12-10T10:00:00Z' }],
      total: 1,
    });

    await service.proponer(ENTRADA);

    expect(calendarioRepository.listarEventos).toHaveBeenCalledWith(USUARIO_ID, {
      materia_id: MATERIA_ID,
      tipo_evento: 'examen',
      limit: 10,
    });
    expect(iaService.generarPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        tareas: expect.stringContaining('Guia de semaforos'),
        evaluaciones: expect.stringContaining('Parcial de sistemas operativos'),
      }),
    );
  });

  it('rechaza una materia de otro usuario', async () => {
    const { service, iaService } = crearServicio();
    service.materiaRepository.obtenerMateriaPorId.mockResolvedValue(null);

    await expect(service.proponer(ENTRADA)).rejects.toThrow(ApiError);
    expect(iaService.generarPlan).not.toHaveBeenCalled();
  });

  it('rechaza una fecha de evaluacion pasada', async () => {
    const { service } = crearServicio();

    await expect(
      service.proponer({ ...ENTRADA, fechaExamen: '2020-01-01' }),
    ).rejects.toThrow(ApiError);
  });

  it('aplica la cuota diaria de planes', async () => {
    const { service, iaService } = crearServicio({ consumos: 5 });

    await expect(service.proponer(ENTRADA)).rejects.toMatchObject({
      statusCode: 429,
      details: { code: 'AI_QUOTA_EXCEEDED' },
    });
    expect(iaService.generarPlan).not.toHaveBeenCalled();
  });

  it('traduce un error del proveedor a 503', async () => {
    const { service, iaService } = crearServicio();
    iaService.generarPlan.mockRejectedValue(new PlanIaError('El proveedor fallo.'));

    await expect(service.proponer(ENTRADA)).rejects.toMatchObject({ statusCode: 503 });
  });

  it('confirma un plan y crea un evento por sesion', async () => {
    const { service, planRepository, calendarioRepository } = crearServicio();

    const plan = await service.confirmar({
      ...ENTRADA,
      modelo: 'modelo-de-prueba',
      tokensEntrada: 100,
      tokensSalida: 50,
      sesiones: PROPUESTA_IA.contenido.sesiones.map((sesion) => ({
        tema: sesion.tema,
        actividades: sesion.actividades,
        fechaInicio: sesion.fecha_inicio,
        duracionMinutos: sesion.duracion_minutos,
        tipo: sesion.tipo,
      })),
    });

    expect(planRepository.crearPlan).toHaveBeenCalledTimes(1);
    expect(plan.sesiones[0].tipo).toBe('lectura');
    expect(calendarioRepository.crearEvento).toHaveBeenCalledTimes(1);
    expect(calendarioRepository.crearEvento).toHaveBeenCalledWith(
      USUARIO_ID,
      expect.objectContaining({ tipo_evento: 'estudio' }),
    );
  });

  it('rechaza una sesion posterior a la evaluacion', async () => {
    const { service, planRepository } = crearServicio();

    await expect(
      service.confirmar({
        ...ENTRADA,
        sesiones: [
          {
            tema: 'Repaso',
            actividades: 'Repasar apuntes',
            fechaInicio: '2026-12-11T09:00:00Z',
            duracionMinutos: 60,
          },
        ],
      }),
    ).rejects.toThrow(ApiError);
    expect(planRepository.crearPlan).not.toHaveBeenCalled();
  });

  it('rechaza mas sesiones que el maximo permitido', async () => {
    const { service } = crearServicio();
    const sesiones = Array.from({ length: MAXIMO_SESIONES + 1 }, (_, indice) => ({
      tema: `Tema ${indice}`,
      actividades: 'Estudiar el tema',
      fechaInicio: '2026-12-01T09:00:00Z',
      duracionMinutos: 30,
    }));

    await expect(
      service.confirmar({ ...ENTRADA, sesiones }),
    ).rejects.toThrow(ApiError);
  });

  it('devuelve 404 para un plan ajeno', async () => {
    const { service, planRepository } = crearServicio();
    planRepository.obtenerPlanPorId.mockResolvedValue(null);

    await expect(service.obtener('plan-ajeno')).rejects.toMatchObject({ statusCode: 404 });
  });
});
