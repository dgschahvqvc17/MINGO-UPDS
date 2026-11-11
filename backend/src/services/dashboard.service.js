/**
 * Servicio del panel principal académico (HU06).
 * Agrega el resumen de materias, tareas y calendario del usuario autenticado.
 * No conoce req ni res: recibe el usuario ya autenticado desde la capa HTTP.
 */
const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

const VENTANA_ACTIVIDADES_DIAS = 7;
const LIMITE_ACTIVIDADES = 6;
const VENTANA_EXAMENES_DIAS = 30;
const LIMITE_EXAMENES = 5;
const VENTANA_EVENTOS_DIAS = 14;
const LIMITE_EVENTOS = 5;
// Se consultan eventos extra porque las entregas automáticas de tareas no se
// muestran en "próximos eventos": ya aparecen en "actividades próximas a vencer".
const EVENTOS_EXTRA_POR_ENTREGAS = 5;

const TIPO_EVENTO_ENTREGA = 'entrega';

class DashboardService {
  /**
   * @param {{
   *   materiaRepository: import('../repositories/materia.repository'),
   *   tareaRepository: import('../repositories/tarea.repository'),
   *   calendarioRepository: import('../repositories/calendario.repository'),
   *   usuarioActualId: string
   * }} dependencies
   */
  constructor({ materiaRepository, tareaRepository, calendarioRepository, usuarioActualId }) {
    this.materiaRepository = materiaRepository;
    this.tareaRepository = tareaRepository;
    this.calendarioRepository = calendarioRepository;
    this.usuarioActualId = usuarioActualId;
  }

  /**
   * Construye el resumen académico del usuario autenticado.
   * Cada consulta filtra por usuario_id y usa su cliente de Supabase (RLS).
   *
   * @returns {Promise<object>}
   */
  async obtenerResumen() {
    const ahora = new Date();

    const [materias, tareas, proximasActividades, proximosExamenes, eventos] = await Promise.all([
      this.materiaRepository.obtenerEstadisticas(this.usuarioActualId),
      this.tareaRepository.obtenerEstadisticas(this.usuarioActualId),
      this.tareaRepository.listarProximas(this.usuarioActualId, {
        desde: ahora,
        hasta: this.calcularLimite(ahora, VENTANA_ACTIVIDADES_DIAS),
        limit: LIMITE_ACTIVIDADES,
      }),
      this.tareaRepository.listarExamenesProximos(this.usuarioActualId, {
        desde: ahora,
        hasta: this.calcularLimite(ahora, VENTANA_EXAMENES_DIAS),
        limit: LIMITE_EXAMENES,
      }),
      this.calendarioRepository.listarProximos(this.usuarioActualId, {
        dias: VENTANA_EVENTOS_DIAS,
        limit: LIMITE_EVENTOS + EVENTOS_EXTRA_POR_ENTREGAS,
      }),
    ]);

    return {
      materias: this.resumirMaterias(materias),
      tareas: this.resumirTareas(tareas),
      proximas_actividades: proximasActividades ?? [],
      proximos_examenes: proximosExamenes ?? [],
      proximos_eventos: this.prepararEventos(eventos),
      progreso: this.calcularProgreso(tareas, materias),
      // HU18 incorpora el módulo de notificaciones. Hasta entonces el panel
      // mantiene el contrato y muestra un estado vacío explícito.
      notificaciones: [],
      generado_en: new Date().toISOString(),
    };
  }

  /**
   * Normaliza los contadores de materias que expone el panel.
   *
   * @param {object | null} materias
   * @returns {{ total: number, activas: number, archivadas: number }}
   */
  resumirMaterias(materias = {}) {
    return {
      total: this.aNumero(materias.total),
      activas: this.aNumero(materias.activas),
      archivadas: this.aNumero(materias.archivadas),
    };
  }

  /**
   * Normaliza los contadores de tareas que expone el panel.
   *
   * @param {object | null} tareas
   * @returns {{
   *   total: number,
   *   pendientes: number,
   *   en_progreso: number,
   *   completadas: number,
   *   vencidas: number
   * }}
   */
  resumirTareas(tareas = {}) {
    return {
      total: this.aNumero(tareas.total),
      pendientes: this.aNumero(tareas.pendientes),
      en_progreso: this.aNumero(tareas.en_progreso),
      completadas: this.aNumero(tareas.completadas),
      vencidas: this.aNumero(tareas.vencidas),
    };
  }

  /**
   * Calcula el avance académico a partir de las tareas registradas.
   *
   * @param {object} tareas Contadores de tareas.
   * @param {object} materias Contadores de materias.
   * @returns {{
   *   tareas_totales: number,
   *   tareas_completadas: number,
   *   porcentaje_completado: number,
   *   materias_activas: number
   * }}
   */
  calcularProgreso(tareas = {}, materias = {}) {
    const total = this.aNumero(tareas.total);
    const completadas = this.aNumero(tareas.completadas);
    const porcentaje = total > 0 ? Math.round((completadas / total) * 100) : 0;

    return {
      tareas_totales: total,
      tareas_completadas: completadas,
      porcentaje_completado: Math.min(100, Math.max(0, porcentaje)),
      materias_activas: this.aNumero(materias.activas),
    };
  }

  /**
   * Descarta las entregas automáticas y normaliza la materia que devuelve la
   * función RPC del calendario para que el frontend reciba una sola forma.
   *
   * @param {object[] | null} eventos
   * @returns {object[]}
   */
  prepararEventos(eventos = []) {
    return (eventos ?? [])
      .filter((evento) => evento.tipo_evento !== TIPO_EVENTO_ENTREGA)
      .slice(0, LIMITE_EVENTOS)
      .map((evento) => this.normalizarEvento(evento));
  }

  /**
   * Unifica el resumen de materia de la RPC (`materia_*`) con el de las
   * consultas directas (`materias`).
   *
   * @param {object} evento
   * @returns {object}
   */
  normalizarEvento(evento) {
    const { materia_nombre: nombre, materia_codigo: codigo, materia_color: color, ...resto } = evento;
    const materias = evento.materias ?? (nombre ? { nombre, codigo, color } : null);

    return { ...resto, materias };
  }

  /**
   * Calcula el final de una ventana de días a partir de una fecha.
   *
   * @param {Date} desde
   * @param {number} dias
   * @returns {Date}
   */
  calcularLimite(desde, dias) {
    return new Date(desde.getTime() + dias * MILISEGUNDOS_POR_DIA);
  }

  /**
   * Convierte un valor de la base de datos a número seguro.
   *
   * @param {unknown} valor
   * @returns {number}
   */
  aNumero(valor) {
    const numero = Number(valor ?? 0);
    return Number.isFinite(numero) ? numero : 0;
  }
}

module.exports = DashboardService;
