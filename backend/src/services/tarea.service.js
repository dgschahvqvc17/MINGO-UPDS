/**
 * Servicio de gestión de tareas y actividades académicas (HU04).
 * Aplica las reglas de negocio y la autorización de dominio.
 * No conoce req ni res: recibe datos ya validados por la capa HTTP.
 */
const ApiError = require('../utils/ApiError');
const config = require('../config/environment');
const {
  tareaCrearSchema,
  tareaActualizarSchema,
  tareaEstadoSchema,
  tareaBusquedaSchema,
  tareasProximasSchema,
} = require('../models/tarea.model');

const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;
const MENSAJE_FECHAS = 'La fecha de entrega no puede ser anterior a la fecha de asignación';

class TareaService {
  /**
   * @param {{
   *   tareaRepository: import('../repositories/tarea.repository'),
   *   materiaRepository: import('../repositories/materia.repository'),
   *   calendarioService: import('../services/calendario.service') | null,
   *   usuarioActualId: string
   * }} dependencies
   */
  constructor({ tareaRepository, materiaRepository, calendarioService = null, usuarioActualId }) {
    this.tareaRepository = tareaRepository;
    this.materiaRepository = materiaRepository;
    this.calendarioService = calendarioService;
    this.usuarioActualId = usuarioActualId;
  }

  /**
   * Lista las tareas del usuario con filtros y paginación.
   *
   * @param {object} filtros Filtros de búsqueda.
   * @returns {Promise<{ tareas: object[], paginacion: { limit: number, offset: number, total: number } }>}
   */
  async listarTareas(filtros = {}) {
    const filtrosValidados = tareaBusquedaSchema.parse(filtros);
    const { items, total } = await this.tareaRepository.listarTareas(
      this.usuarioActualId,
      filtrosValidados,
    );

    return {
      tareas: items,
      paginacion: {
        limit: filtrosValidados.limit,
        offset: filtrosValidados.offset,
        total: Number(total ?? 0),
      },
    };
  }

  /**
   * Obtiene las tareas no completadas próximas a vencer.
   *
   * @param {object} filtros Días de anticipación y límite.
   * @returns {Promise<{ tareas: object[], rango: { dias: number, desde: string, hasta: string } }>}
   */
  async listarProximas(filtros = {}) {
    const { dias, limit } = tareasProximasSchema.parse(filtros);
    const desde = new Date();
    const hasta = new Date(desde.getTime() + dias * MILISEGUNDOS_POR_DIA);

    const tareas = await this.tareaRepository.listarProximas(this.usuarioActualId, {
      desde,
      hasta,
      limit,
    });

    return {
      tareas,
      rango: {
        dias,
        desde: desde.toISOString(),
        hasta: hasta.toISOString(),
      },
    };
  }

  /**
   * Obtiene una tarea del usuario o lanza 404.
   *
   * @param {string} tareaId UUID de la tarea.
   * @returns {Promise<object>}
   */
  async obtenerTarea(tareaId) {
    const tarea = await this.tareaRepository.obtenerTareaPorId(this.usuarioActualId, tareaId);

    if (!tarea) {
      throw ApiError.notFound('Tarea no encontrada.');
    }

    return tarea;
  }

  /**
   * Crea una tarea para el usuario actual.
   *
   * @param {object} datos Datos validados.
   * @returns {Promise<object>}
   */
  async crearTarea(datos) {
    const datosValidados = tareaCrearSchema.parse(datos);

    await this.verificarMateria(datosValidados.materia_id);

    const fechaAsignacion =
      datosValidados.fecha_asignacion ?? this.calcularFechaAsignacion(datosValidados.fecha_entrega);
    const fechaEntrega = datosValidados.fecha_entrega ?? null;

    this.validarRangoFechas(fechaAsignacion, fechaEntrega);

    const tarea = await this.tareaRepository.crearTarea(this.usuarioActualId, {
      ...datosValidados,
      fecha_asignacion: fechaAsignacion,
      fecha_entrega: fechaEntrega,
    });

    // Crear evento de calendario automáticamente si la tarea tiene fecha_entrega
    if (fechaEntrega) {
      await this.crearEventoCalendario(tarea.id);
    }

    return tarea;
  }

  /**
   * Actualiza total o parcialmente una tarea del usuario.
   *
   * @param {string} tareaId UUID de la tarea.
   * @param {object} datos Campos a actualizar.
   * @returns {Promise<object>}
   */
  async actualizarTarea(tareaId, datos) {
    const datosValidados = tareaActualizarSchema.parse(datos);
    const tareaActual = await this.obtenerTarea(tareaId);

    if (datosValidados.materia_id && datosValidados.materia_id !== tareaActual.materia_id) {
      await this.verificarMateria(datosValidados.materia_id);
    }

    const fechaAsignacion =
      datosValidados.fecha_asignacion ?? this.convertirFecha(tareaActual.fecha_asignacion);
    const fechaEntrega =
      datosValidados.fecha_entrega !== undefined
        ? datosValidados.fecha_entrega
        : this.convertirFecha(tareaActual.fecha_entrega);

    this.validarRangoFechas(fechaAsignacion, fechaEntrega);

    const tarea = await this.tareaRepository.actualizarTarea(
      this.usuarioActualId,
      tareaId,
      datosValidados,
    );

    if (!tarea) {
      throw ApiError.notFound('Tarea no encontrada.');
    }

    // Sincroniza el evento de calendario. Si la tarea perdió su fecha_entrega,
    // la función RPC elimina el evento automático asociado.
    await this.crearEventoCalendario(tareaId);

    return tarea;
  }

  /**
   * Cambia únicamente el estado de una tarea.
   *
   * @param {string} tareaId UUID de la tarea.
   * @param {string} estado Nuevo estado.
   * @returns {Promise<object>}
   */
  async cambiarEstadoTarea(tareaId, estado) {
    const { estado: estadoValidado } = tareaEstadoSchema.parse({ estado });

    const tarea = await this.tareaRepository.cambiarEstadoTarea(
      this.usuarioActualId,
      tareaId,
      estadoValidado,
    );

    if (!tarea) {
      throw ApiError.notFound('Tarea no encontrada.');
    }

    return tarea;
  }

  /**
   * Elimina una tarea del usuario.
   *
   * @param {string} tareaId UUID de la tarea.
   * @returns {Promise<void>}
   */
  async eliminarTarea(tareaId) {
    const eliminada = await this.tareaRepository.eliminarTarea(this.usuarioActualId, tareaId);

    if (!eliminada) {
      throw ApiError.notFound('Tarea no encontrada.');
    }
  }

  /**
   * Obtiene los contadores de tareas del usuario.
   *
   * @returns {Promise<object>}
   */
  async obtenerEstadisticas() {
    return this.tareaRepository.obtenerEstadisticas(this.usuarioActualId);
  }

  /**
   * Verifica que la materia exista y pertenezca al usuario.
   *
   * @param {string} materiaId UUID de la materia.
   * @returns {Promise<void>}
   */
  async verificarMateria(materiaId) {
    const existe = await this.materiaRepository.existeMateria(this.usuarioActualId, materiaId);

    if (!existe) {
      throw ApiError.notFound('Materia no encontrada.');
    }
  }

  /**
   * Calcula la fecha de asignación por defecto.
   * Si se registra una actividad ya vencida sin fecha de asignación, se usa
   * la fecha de entrega para mantener un rango de fechas coherente.
   *
   * @param {Date | null | undefined} fechaEntrega Fecha de entrega opcional.
   * @returns {Date}
   */
  calcularFechaAsignacion(fechaEntrega) {
    const ahora = new Date();

    if (fechaEntrega instanceof Date && fechaEntrega < ahora) {
      return fechaEntrega;
    }

    return ahora;
  }

  /**
   * @param {Date | null | undefined} valor Fecha a validar.
   * @returns {Date | null}
   */
  convertirFecha(valor) {
    if (!valor) {
      return null;
    }

    return valor instanceof Date ? valor : new Date(valor);
  }

  /**
   * Sincroniza el evento de calendario asociado a la tarea.
   * Es una operación secundaria: si falla, la tarea ya quedó guardada y no
   * se revierte. El error solo se registra fuera de producción.
   *
   * @param {string} tareaId UUID de la tarea.
   * @returns {Promise<void>}
   */
  async crearEventoCalendario(tareaId) {
    if (!this.calendarioService) {
      return;
    }

    try {
      await this.calendarioService.crearEventoDesdeTarea(tareaId);
    } catch (error) {
      if (!config.isProd) {
        // eslint-disable-next-line no-console
        console.warn('No se pudo sincronizar el evento de calendario:', error.message);
      }
    }
  }

  /**
   * @param {Date | null} fechaAsignacion Fecha de asignación.
   * @param {Date | null} fechaEntrega Fecha de entrega.
   * @returns {void}
   */
  validarRangoFechas(fechaAsignacion, fechaEntrega) {
    if (!fechaAsignacion || !fechaEntrega) {
      return;
    }

    if (fechaEntrega < fechaAsignacion) {
      throw ApiError.badRequest(MENSAJE_FECHAS, {
        source: 'body',
        issues: [{ path: 'fecha_entrega', message: MENSAJE_FECHAS }],
      });
    }
  }
}

module.exports = TareaService;
