/**
 * Servicio de gestión de eventos del calendario académico (HU05).
 * Aplica las reglas de negocio y la autorización de dominio.
 * No conoce req ni res: recibe datos ya validados por la capa HTTP.
 */
const ApiError = require('../utils/ApiError');
const {
  eventoCrearSchema,
  eventoActualizarSchema,
  eventoBusquedaSchema,
  eventosProximosSchema,
} = require('../models/calendario.model');

const MENSAJE_FECHAS = 'La fecha de fin no puede ser anterior a la fecha de inicio';

class CalendarioService {
  /**
   * @param {{
   *   calendarioRepository: import('../repositories/calendario.repository'),
   *   materiaRepository: import('../repositories/materia.repository'),
   *   tareaRepository: import('../repositories/tarea.repository'),
   *   usuarioActualId: string
   * }} dependencies
   */
  constructor({ calendarioRepository, materiaRepository, tareaRepository, usuarioActualId }) {
    this.calendarioRepository = calendarioRepository;
    this.materiaRepository = materiaRepository;
    this.tareaRepository = tareaRepository;
    this.usuarioActualId = usuarioActualId;
  }

  /**
   * Lista los eventos del usuario con filtros y paginación.
   *
   * @param {object} filtros Filtros de búsqueda (desde y hasta obligatorios).
   * @returns {Promise<{ eventos: object[], paginacion: { limit: number, offset: number, total: number } }>}
   */
  async listarEventos(filtros = {}) {
    const filtrosValidados = eventoBusquedaSchema.parse(filtros);

    const { items, total } = await this.calendarioRepository.listarEventos(
      this.usuarioActualId,
      filtrosValidados,
    );

    return {
      eventos: items,
      paginacion: {
        limit: filtrosValidados.limit,
        offset: filtrosValidados.offset,
        total: Number(total ?? 0),
      },
    };
  }

  /**
   * Obtiene los eventos próximos (siguientes N días).
   *
   * @param {object} filtros Días de anticipación y límite.
   * @returns {Promise<{ eventos: object[], rango: { dias: number, desde: string, hasta: string } }>}
   */
  async listarProximos(filtros = {}) {
    const { dias, limit } = eventosProximosSchema.parse(filtros);
    const desde = new Date();
    const hasta = new Date(desde.getTime() + dias * 24 * 60 * 60 * 1000);

    const eventos = await this.calendarioRepository.listarProximos(this.usuarioActualId, {
      dias,
      limit,
    });

    return {
      eventos,
      rango: {
        dias,
        desde: desde.toISOString(),
        hasta: hasta.toISOString(),
      },
    };
  }

  /**
   * Obtiene un evento del usuario o lanza 404.
   *
   * @param {string} eventoId UUID del evento.
   * @returns {Promise<object>}
   */
  async obtenerEvento(eventoId) {
    const evento = await this.calendarioRepository.obtenerEventoPorId(
      this.usuarioActualId,
      eventoId,
    );

    if (!evento) {
      throw ApiError.notFound('Evento no encontrado.');
    }

    return evento;
  }

  /**
   * Crea un evento para el usuario actual.
   *
   * @param {object} datos Datos validados.
   * @returns {Promise<object>}
   */
  async crearEvento(datos) {
    const datosValidados = eventoCrearSchema.parse(datos);

    if (datosValidados.materia_id) {
      await this.verificarMateria(datosValidados.materia_id);
    }

    if (datosValidados.tarea_id) {
      await this.verificarTarea(datosValidados.tarea_id);
    }

    return this.calendarioRepository.crearEvento(this.usuarioActualId, datosValidados);
  }

  /**
   * Actualiza total o parcialmente un evento del usuario.
   *
   * @param {string} eventoId UUID del evento.
   * @param {object} datos Campos a actualizar.
   * @returns {Promise<object>}
   */
  async actualizarEvento(eventoId, datos) {
    const datosValidados = eventoActualizarSchema.parse(datos);
    const eventoActual = await this.obtenerEvento(eventoId);

    if (datosValidados.materia_id && datosValidados.materia_id !== eventoActual.materia_id) {
      await this.verificarMateria(datosValidados.materia_id);
    }

    if (datosValidados.tarea_id && datosValidados.tarea_id !== eventoActual.tarea_id) {
      await this.verificarTarea(datosValidados.tarea_id);
    }

    this.validarFechasActualizadas(eventoActual, datosValidados);

    const evento = await this.calendarioRepository.actualizarEvento(
      this.usuarioActualId,
      eventoId,
      datosValidados,
    );

    if (!evento) {
      throw ApiError.notFound('Evento no encontrado.');
    }

    return evento;
  }

  /**
   * Elimina un evento del usuario.
   *
   * @param {string} eventoId UUID del evento.
   * @returns {Promise<void>}
   */
  async eliminarEvento(eventoId) {
    const eliminado = await this.calendarioRepository.eliminarEvento(
      this.usuarioActualId,
      eventoId,
    );

    if (!eliminado) {
      throw ApiError.notFound('Evento no encontrado.');
    }
  }

  /**
   * Crea o actualiza el evento automático de una tarea con fecha de entrega.
   * Lo invoca TareaService; no se expone como endpoint.
   *
   * @param {string} tareaId UUID de la tarea.
   * @returns {Promise<string | null>} ID del evento o null si la tarea no tiene fecha de entrega.
   */
  async crearEventoDesdeTarea(tareaId) {
    return this.calendarioRepository.crearEventoDesdeTarea(this.usuarioActualId, tareaId);
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
   * Verifica que la tarea exista y pertenezca al usuario.
   *
   * @param {string} tareaId UUID de la tarea.
   * @returns {Promise<void>}
   */
  async verificarTarea(tareaId) {
    const tarea = await this.tareaRepository.obtenerTareaPorId(this.usuarioActualId, tareaId);

    if (!tarea) {
      throw ApiError.notFound('Tarea no encontrada.');
    }
  }

  /**
   * Valida el rango cuando la actualización solo envía una de las dos fechas.
   * La comparación completa (fecha nueva contra fecha existente) no puede
   * hacerse en Zod porque depende del registro almacenado.
   *
   * @param {object} eventoActual Evento existente.
   * @param {object} datosValidados Cambios validados.
   * @returns {void}
   */
  validarFechasActualizadas(eventoActual, datosValidados) {
    const fechaInicio =
      datosValidados.fecha_inicio ?? this.convertirFecha(eventoActual.fecha_inicio);
    const fechaFin =
      datosValidados.fecha_fin !== undefined
        ? datosValidados.fecha_fin
        : this.convertirFecha(eventoActual.fecha_fin);

    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
      throw ApiError.badRequest(MENSAJE_FECHAS, {
        source: 'body',
        issues: [{ path: 'fecha_fin', message: MENSAJE_FECHAS }],
      });
    }
  }

  /**
   * Convierte un valor de fecha de la base de datos a Date.
   *
   * @param {string | Date | null | undefined} valor
   * @returns {Date | null}
   */
  convertirFecha(valor) {
    if (!valor) {
      return null;
    }

    return valor instanceof Date ? valor : new Date(valor);
  }
}

module.exports = CalendarioService;
