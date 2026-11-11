const DashboardService = require('../src/services/dashboard.service');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';

function crearDependencias({
  materias = { total: 0, activas: 0, archivadas: 0 },
  tareas = {
    total: 0,
    pendientes: 0,
    en_progreso: 0,
    completadas: 0,
    vencidas: 0,
  },
  actividades = [],
  examenes = [],
  eventos = [],
} = {}) {
  const materiaRepository = {
    obtenerEstadisticas: jest.fn().mockResolvedValue(materias),
  };
  const tareaRepository = {
    obtenerEstadisticas: jest.fn().mockResolvedValue(tareas),
    listarProximas: jest.fn().mockResolvedValue(actividades),
    listarExamenesProximos: jest.fn().mockResolvedValue(examenes),
  };
  const calendarioRepository = {
    listarProximos: jest.fn().mockResolvedValue(eventos),
  };

  return {
    servicio: new DashboardService({
      materiaRepository,
      tareaRepository,
      calendarioRepository,
      usuarioActualId: USUARIO_ID,
    }),
    materiaRepository,
    tareaRepository,
    calendarioRepository,
  };
}

describe('DashboardService (HU06)', () => {
  it('agrega los contadores y calcula el progreso del usuario', async () => {
    const { servicio, materiaRepository, tareaRepository, calendarioRepository } =
      crearDependencias({
        materias: { total: 5, activas: 4, archivadas: 1, por_periodo: {} },
        tareas: {
          total: 20,
          pendientes: 6,
          en_progreso: 4,
          completadas: 10,
          vencidas: 2,
          prioridad_alta: 3,
        },
        actividades: [{ id: 'tarea-1', titulo: 'Taller' }],
        examenes: [{ id: 'tarea-2', titulo: 'Parcial' }],
      });

    const resumen = await servicio.obtenerResumen();

    expect(resumen.materias).toEqual({ total: 5, activas: 4, archivadas: 1 });
    expect(resumen.tareas).toEqual({
      total: 20,
      pendientes: 6,
      en_progreso: 4,
      completadas: 10,
      vencidas: 2,
    });
    expect(resumen.progreso).toEqual({
      tareas_totales: 20,
      tareas_completadas: 10,
      porcentaje_completado: 50,
      materias_activas: 4,
    });
    expect(resumen.proximas_actividades).toEqual([{ id: 'tarea-1', titulo: 'Taller' }]);
    expect(resumen.proximos_examenes).toEqual([{ id: 'tarea-2', titulo: 'Parcial' }]);
    expect(resumen.notificaciones).toEqual([]);

    expect(materiaRepository.obtenerEstadisticas).toHaveBeenCalledWith(USUARIO_ID);
    expect(tareaRepository.obtenerEstadisticas).toHaveBeenCalledWith(USUARIO_ID);
    expect(tareaRepository.listarProximas).toHaveBeenCalledWith(
      USUARIO_ID,
      expect.objectContaining({ limit: 6 }),
    );
    expect(tareaRepository.listarExamenesProximos).toHaveBeenCalledWith(
      USUARIO_ID,
      expect.objectContaining({ limit: 5 }),
    );
    expect(calendarioRepository.listarProximos).toHaveBeenCalledWith(
      USUARIO_ID,
      expect.objectContaining({ dias: 14 }),
    );
  });

  it('devuelve ceros y listas vacías cuando el usuario no tiene datos', async () => {
    const { servicio } = crearDependencias();

    const resumen = await servicio.obtenerResumen();

    expect(resumen.materias).toEqual({ total: 0, activas: 0, archivadas: 0 });
    expect(resumen.tareas).toEqual({
      total: 0,
      pendientes: 0,
      en_progreso: 0,
      completadas: 0,
      vencidas: 0,
    });
    expect(resumen.progreso.porcentaje_completado).toBe(0);
    expect(resumen.proximas_actividades).toEqual([]);
    expect(resumen.proximos_examenes).toEqual([]);
    expect(resumen.proximos_eventos).toEqual([]);
    expect(resumen.notificaciones).toEqual([]);
  });

  it('normaliza la materia del calendario y descarta las entregas automáticas', async () => {
    const { servicio } = crearDependencias({
      eventos: [
        {
          id: 'evento-1',
          titulo: 'Examen parcial',
          tipo_evento: 'examen',
          materia_nombre: 'Cálculo Diferencial',
          materia_codigo: 'MAT-101',
          materia_color: '#3B82F6',
        },
        {
          id: 'evento-2',
          titulo: 'Entrega: Taller',
          tipo_evento: 'entrega',
          materia_nombre: 'Cálculo Diferencial',
          materia_codigo: 'MAT-101',
          materia_color: '#3B82F6',
        },
        {
          id: 'evento-3',
          titulo: 'Clase de refuerzo',
          tipo_evento: 'clase',
          materias: { nombre: 'Álgebra', codigo: 'MAT-102', color: '#10B981' },
        },
      ],
    });

    const resumen = await servicio.obtenerResumen();

    expect(resumen.proximos_eventos).toHaveLength(2);
    expect(resumen.proximos_eventos[0]).toEqual({
      id: 'evento-1',
      titulo: 'Examen parcial',
      tipo_evento: 'examen',
      materias: {
        nombre: 'Cálculo Diferencial',
        codigo: 'MAT-101',
        color: '#3B82F6',
      },
    });
    expect(resumen.proximos_eventos[0]).not.toHaveProperty('materia_nombre');
    expect(resumen.proximos_eventos[1].materias).toEqual({
      nombre: 'Álgebra',
      codigo: 'MAT-102',
      color: '#10B981',
    });
  });

  it('limita los próximos eventos al máximo configurado', async () => {
    const eventos = Array.from({ length: 12 }, (_, indice) => ({
      id: `evento-${indice}`,
      titulo: `Evento ${indice}`,
      tipo_evento: 'clase',
    }));
    const { servicio } = crearDependencias({ eventos });

    const resumen = await servicio.obtenerResumen();

    expect(resumen.proximos_eventos).toHaveLength(5);
  });
});
