const ProgresoService = require('../src/services/progreso.service');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';

function dia(local, desplazamiento) {
  const fecha = new Date(local.getFullYear(), local.getMonth(), local.getDate() + desplazamiento, 12);
  return fecha.toISOString();
}

function crearServicio(registros) {
  const progresoRepository = {
    listarMaterias: jest.fn().mockResolvedValue(registros.materias ?? []),
    listarTareas: jest.fn().mockResolvedValue(registros.tareas ?? []),
    listarSesiones: jest.fn().mockResolvedValue(registros.sesiones ?? []),
    listarIntentos: jest.fn().mockResolvedValue(registros.intentos ?? []),
  };
  const objetivoRepository = {
    listarParaProgreso: jest.fn().mockResolvedValue(registros.objetivos ?? []),
  };

  return new ProgresoService({
    progresoRepository,
    objetivoRepository,
    usuarioActualId: USUARIO_ID,
  });
}

describe('ProgresoService (HU17)', () => {
  const hoy = new Date(2026, 10, 19, 12);

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(hoy);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('devuelve ceros y una recomendación de alta cuando no hay registros', async () => {
    const progreso = await crearServicio({}).obtener();

    expect(progreso.cumplimiento_tareas).toBe(0);
    expect(progreso.cumplimiento_sesiones).toBe(0);
    expect(progreso.cumplimiento_objetivos).toBe(0);
    expect(progreso.promedio_cuestionarios).toBeNull();
    expect(progreso.actividad_semanal).toHaveLength(7);
    expect(progreso.actividades_atencion).toEqual([]);
    expect(progreso.recomendaciones[0].tipo).toBe('objetivos');
    expect(progreso.generado_en).toBe(hoy.toISOString());
  });

  it('calcula porcentajes, minutos, promedio y racha a partir de los registros', async () => {
    const service = crearServicio({
      materias: [
        { id: 'm1', estado: 'activo' },
        { id: 'm2', estado: 'activo' },
        { id: 'm3', estado: 'archivado' },
      ],
      tareas: [
        { id: 't1', estado: 'completada', fecha_actualizacion: dia(hoy, 0) },
        { id: 't2', estado: 'completada', fecha_actualizacion: dia(hoy, -5) },
        { id: 't3', estado: 'pendiente', fecha_entrega: dia(hoy, -9) },
        { id: 't4', estado: 'en_progreso', fecha_entrega: dia(hoy, 3) },
      ],
      sesiones: [
        {
          id: 's1',
          estado: 'completada',
          duracion_minutos: 60,
          fecha_actualizacion: dia(hoy, -1),
        },
        {
          id: 's2',
          estado: 'completada',
          duracion_minutos: 30,
          fecha_actualizacion: dia(hoy, -4),
        },
        { id: 's3', estado: 'pendiente', fecha_inicio: dia(hoy, -2) },
      ],
      intentos: [
        {
          id: 'i1',
          puntuacion: 80,
          temas_reforzar: [],
          fecha_finalizacion: dia(hoy, -2),
        },
        {
          id: 'i2',
          puntuacion: 60,
          temas_reforzar: ['Derivadas'],
          fecha_finalizacion: dia(hoy, -3),
        },
      ],
      objetivos: [
        { id: 'o1', estado: 'completada', fecha_limite: null },
        { id: 'o2', estado: 'en_progreso', fecha_limite: '2026-12-10' },
        { id: 'o3', estado: 'pendiente', fecha_limite: '2026-11-15' },
      ],
    });

    const progreso = await service.obtener();

    expect(progreso.materias_activas).toBe(2);
    expect(progreso.tareas_completadas).toBe(2);
    expect(progreso.tareas_pendientes).toBe(2);
    expect(progreso.cumplimiento_tareas).toBe(0.5);
    expect(progreso.sesiones_completadas).toBe(2);
    expect(progreso.cumplimiento_sesiones).toBe(0.67);
    expect(progreso.minutos_estudiados).toBe(90);
    expect(progreso.cuestionarios_completados).toBe(2);
    expect(progreso.promedio_cuestionarios).toBe(70);
    expect(progreso.objetivos_completados).toBe(1);
    expect(progreso.objetivos_activos).toBe(2);
    expect(progreso.cumplimiento_objetivos).toBe(0.33);
    expect(progreso.racha_dias).toBe(6);
    expect(progreso.por_estado.tareas).toEqual([
      { estado: 'pendiente', total: 1 },
      { estado: 'en_progreso', total: 1 },
      { estado: 'completada', total: 2 },
    ]);
  });

  it('identifica actividades que necesitan atención ordenadas por urgencia', async () => {
    const service = crearServicio({
      tareas: [
        {
          id: 't-vencida',
          titulo: 'Ensayo',
          estado: 'pendiente',
          fecha_entrega: dia(hoy, -9),
          materias: { nombre: 'Lenguaje' },
        },
        {
          id: 't-proxima',
          titulo: 'Quiz',
          estado: 'en_progreso',
          fecha_entrega: dia(hoy, 3),
          materias: { nombre: 'Historia' },
        },
      ],
      sesiones: [{ id: 's-pendiente', tema: 'Repaso', estado: 'pendiente', fecha_inicio: dia(hoy, -2) }],
      objetivos: [
        {
          id: 'o-vencido',
          titulo: 'Terminar el tema 4',
          estado: 'pendiente',
          fecha_limite: '2026-11-15',
          materias: { nombre: 'Cálculo' },
        },
      ],
    });

    const { actividades_atencion } = await service.obtener();

    expect(actividades_atencion).toHaveLength(4);
    expect(actividades_atencion.map((atencion) => atencion.id)).toEqual([
      't-vencida',
      'o-vencido',
      's-pendiente',
      't-proxima',
    ]);
    expect(actividades_atencion[0]).toMatchObject({
      motivo: 'Vencida',
      materia: 'Lenguaje',
    });
    expect(actividades_atencion[0]).not.toHaveProperty('urgencia');
  });

  it('recomienda repasar temas cuando el promedio está por debajo del umbral', async () => {
    const service = crearServicio({
      intentos: [
        {
          id: 'i1',
          puntuacion: 55,
          temas_reforzar: ['Derivadas', 'Límites'],
          fecha_finalizacion: dia(hoy, -1),
        },
      ],
      objetivos: [{ id: 'o1', estado: 'completada' }],
    });

    const { recomendaciones } = await service.obtener();
    const cuestionarios = recomendaciones.find((item) => item.tipo === 'cuestionarios');

    expect(cuestionarios).toBeDefined();
    expect(cuestionarios.mensaje).toContain('Derivadas');
    expect(cuestionarios.mensaje).toContain('Límites');
  });

  it('mantiene la actividad semanal en siete días con su etiqueta', async () => {
    const progreso = await crearServicio({}).obtener();

    expect(progreso.actividad_semanal).toHaveLength(7);
    expect(progreso.actividad_semanal[6].fecha).toBe('2026-11-19');
    expect(progreso.actividad_semanal[6]).toMatchObject({ etiqueta: 'jue', tareas: 0, sesiones: 0 });
  });
});
