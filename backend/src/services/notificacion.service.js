/**
 * Servicio de notificaciones y recordatorios (HU18).
 * Genera avisos deterministas a partir de tareas, evaluaciones y sesiones;
 * decide quien puede leerlos y coordina el envio opcional por SNS. No consume IA.
 */

const ApiError = require('../utils/ApiError');

const MILISEGUNDOS_POR_MINUTO = 60 * 1000;
const MAXIMO_USUARIOS_POR_EJECUCION = 100;
const MAXIMO_NOTIFICACIONES_POR_USUARIO = 20;
const MAXIMO_ENVOS_SNS_POR_EJECUCION = 100;
const LONGITUD_MAXIMA_TITULO = 200;
const LONGITUD_MAXIMA_MENSAJE = 500;
const ZONA_HORARIA_RESPALDO = 'UTC';

function aFecha(valor) {
  if (!valor) {
    return null;
  }

  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function limitar(texto, longitud) {
  return String(texto).slice(0, longitud);
}

function formatearFecha(fecha, zonaHoraria) {
  try {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: zonaHoraria,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(fecha);
  } catch {
    return new Intl.DateTimeFormat('es-CO', {
      timeZone: ZONA_HORARIA_RESPALDO,
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(fecha);
  }
}

class NotificacionService {
  /**
   * @param {{
   *   notificacionRepository: import('../repositories/notificacion.repository'),
   *   preferenciaRepository: import('../repositories/preferencia-notificacion.repository'),
   *   actividadRepository: import('../repositories/actividad-recordatorio.repository'),
   *   canalRepository: import('../repositories/canal-notificacion.repository'),
   *   usuarioActualId: string | null
   * }} dependencias
   */
  constructor({
    notificacionRepository,
    preferenciaRepository,
    actividadRepository,
    canalRepository,
    usuarioActualId,
  }) {
    this.notificacionRepository = notificacionRepository;
    this.preferenciaRepository = preferenciaRepository;
    this.actividadRepository = actividadRepository;
    this.canalRepository = canalRepository;
    this.usuarioActualId = usuarioActualId;
  }

  /**
   * @param {{ leida?: string, tipo?: string, page: number, limit: number }} filtros
   */
  async listar({ leida, tipo, page, limit }) {
    const esLeida = leida === undefined ? undefined : leida === 'true';

    const { items, total } = await this.notificacionRepository.listar(this.usuarioActualId, {
      leida: esLeida,
      tipo,
      limit,
      offset: (page - 1) * limit,
    });

    return {
      items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async contarNoLeidas() {
    return this.notificacionRepository.contarNoLeidas(this.usuarioActualId);
  }

  /**
   * @param {string} notificacionId
   */
  async marcarLeida(notificacionId) {
    const notificacion = await this.notificacionRepository.obtenerPorId(
      this.usuarioActualId,
      notificacionId,
    );

    if (!notificacion) {
      throw ApiError.notFound('Notificacion no encontrada.');
    }

    return this.notificacionRepository.marcarLeida(this.usuarioActualId, notificacionId);
  }

  async marcarTodasLeidas() {
    return this.notificacionRepository.marcarTodasLeidas(this.usuarioActualId);
  }

  async obtenerPreferencias() {
    return this.preferenciaRepository.obtenerOCrear(this.usuarioActualId);
  }

  /**
   * @param {object} cambios
   */
  async actualizarPreferencias(cambios) {
    await this.preferenciaRepository.obtenerOCrear(this.usuarioActualId);

    const preferencias = await this.preferenciaRepository.actualizar(
      this.usuarioActualId,
      cambios,
    );

    if (!preferencias) {
      throw ApiError.notFound('Preferencias de notificacion no encontradas.');
    }

    return preferencias;
  }

  /**
   * Genera los avisos de un usuario dentro de su ventana de anticipacion.
   * La clave de idempotencia evita duplicar o reenviar el mismo aviso.
   *
   * @param {string} usuarioId
   * @param {Date} ahora
   * @param {object} [preferencias]
   * @param {number} [limiteEnvios] Cupo de correos disponible en la ejecución.
   */
  async generarParaUsuario(usuarioId, ahora, preferencias, limiteEnvios) {
    const cupoEnvios = limiteEnvios ?? MAXIMO_ENVOS_SNS_POR_EJECUCION;
    const preferencia = preferencias ?? (await this.preferenciaRepository.obtenerOCrear(usuarioId));

    if (!preferencia.notificaciones_activas) {
      return { creadas: 0, duplicadas: 0, enviadas: 0, erroresEnvio: 0, desactivada: true };
    }

    const desde = ahora.toISOString();
    const hasta = new Date(
      ahora.getTime() + preferencia.anticipacion_minutos * MILISEGUNDOS_POR_MINUTO,
    ).toISOString();

    const [tareas, evaluaciones, sesiones] = await Promise.all([
      this.actividadRepository.listarTareasProximas(usuarioId, desde, hasta),
      this.actividadRepository.listarEvaluacionesProximas(usuarioId, desde, hasta),
      this.actividadRepository.listarSesionesProximas(usuarioId, desde, hasta),
    ]);

    const candidatos = [
      ...this.candidatosTareas(tareas, preferencia),
      ...this.candidatosEvaluaciones(evaluaciones, preferencia),
      ...this.candidatosSesiones(sesiones, preferencia),
    ].slice(0, MAXIMO_NOTIFICACIONES_POR_USUARIO);

    let creadas = 0;
    let duplicadas = 0;
    let enviadas = 0;
    let erroresEnvio = 0;

    for (const candidato of candidatos) {
      const notificacion = await this.notificacionRepository.crearSiNoExiste({
        usuario_id: usuarioId,
        tipo: candidato.tipo,
        titulo: candidato.titulo,
        mensaje: candidato.mensaje,
        [candidato.columnaActividad]: candidato.actividadId,
        clave_idempotencia: candidato.clave,
        fecha_actividad: candidato.fechaActividad.toISOString(),
        fecha_programada: new Date(
          candidato.fechaActividad.getTime() -
            preferencia.anticipacion_minutos * MILISEGUNDOS_POR_MINUTO,
        ).toISOString(),
        leida: false,
      });

      if (!notificacion) {
        duplicadas += 1;
        continue;
      }

      creadas += 1;

      if (
        !preferencia.canal_email ||
        !this.canalRepository.estaConfigurado ||
        enviadas >= cupoEnvios
      ) {
        continue;
      }

      try {
        const publicada = await this.canalRepository.publicar({
          tipo: candidato.tipo,
          titulo: candidato.titulo,
          mensaje: candidato.mensaje,
          fechaActividad: candidato.fechaActividad.toISOString(),
          usuarioId,
        });

        if (publicada) {
          await this.notificacionRepository.marcarEnviada(
            notificacion.id,
            new Date().toISOString(),
          );
          enviadas += 1;
        }
      } catch {
        // Un fallo del canal externo no bloquea la notificacion interna.
        erroresEnvio += 1;
      }
    }

    return { creadas, duplicadas, enviadas, erroresEnvio, desactivada: false };
  }

  /**
   * @param {object} opciones
   * @param {Date} [opciones.ahora]
   * @param {string[]} [opciones.usuarios] Limita la ejecucion a ciertos usuarios.
   */
  async ejecutarRecordatorios({ ahora = new Date(), usuarios } = {}) {
    const preferencias = usuarios
      ? await Promise.all(
          usuarios.map((usuarioId) => this.preferenciaRepository.obtenerOCrear(usuarioId)),
        )
      : await this.preferenciaRepository.listarActivas(MAXIMO_USUARIOS_POR_EJECUCION);

    const resumen = {
      usuarios: preferencias.length,
      creadas: 0,
      duplicadas: 0,
      enviadas: 0,
      erroresEnvio: 0,
      desactivadas: 0,
      ejecutado_en: ahora.toISOString(),
    };

    let cupoEnvios = MAXIMO_ENVOS_SNS_POR_EJECUCION;

    for (const preferencia of preferencias) {
      const resultado = await this.generarParaUsuario(
        preferencia.usuario_id,
        ahora,
        preferencia,
        cupoEnvios,
      );

      cupoEnvios -= resultado.enviadas;
      resumen.creadas += resultado.creadas;
      resumen.duplicadas += resultado.duplicadas;
      resumen.enviadas += resultado.enviadas;
      resumen.erroresEnvio += resultado.erroresEnvio;
      if (resultado.desactivada) {
        resumen.desactivadas += 1;
      }
    }

    return resumen;
  }

  /**
   * @param {object[]} tareas
   * @param {object} preferencia
   */
  candidatosTareas(tareas, preferencia) {
    return tareas
      .map((tarea) => {
        const fecha = aFecha(tarea.fecha_entrega);
        if (!fecha) {
          return null;
        }

        const materia = tarea.materias?.nombre;
        return {
          tipo: 'tarea',
          columnaActividad: 'tarea_id',
          actividadId: tarea.id,
          titulo: limitar(`Entrega: ${tarea.titulo}`, LONGITUD_MAXIMA_TITULO),
          mensaje: limitar(
            `La entrega "${tarea.titulo}"${materia ? ` de ${materia}` : ''} vence el ${formatearFecha(fecha, preferencia.zona_horaria)}.`,
            LONGITUD_MAXIMA_MENSAJE,
          ),
          fechaActividad: fecha,
          clave: `tarea:${tarea.id}:${fecha.toISOString()}:${preferencia.anticipacion_minutos}`,
        };
      })
      .filter(Boolean);
  }

  /**
   * @param {object[]} evaluaciones
   * @param {object} preferencia
   */
  candidatosEvaluaciones(evaluaciones, preferencia) {
    return evaluaciones
      .map((evaluacion) => {
        const fecha = aFecha(evaluacion.fecha_inicio);
        if (!fecha) {
          return null;
        }

        const materia = evaluacion.materias?.nombre;
        return {
          tipo: 'evaluacion',
          columnaActividad: 'evento_calendario_id',
          actividadId: evaluacion.id,
          titulo: limitar(`Evaluación: ${evaluacion.titulo}`, LONGITUD_MAXIMA_TITULO),
          mensaje: limitar(
            `Tienes una evaluación de "${evaluacion.titulo}"${materia ? ` (${materia})` : ''} el ${formatearFecha(fecha, preferencia.zona_horaria)}.`,
            LONGITUD_MAXIMA_MENSAJE,
          ),
          fechaActividad: fecha,
          clave: `evaluacion:${evaluacion.id}:${fecha.toISOString()}:${preferencia.anticipacion_minutos}`,
        };
      })
      .filter(Boolean);
  }

  /**
   * @param {object[]} sesiones
   * @param {object} preferencia
   */
  candidatosSesiones(sesiones, preferencia) {
    return sesiones
      .map((sesion) => {
        const fecha = aFecha(sesion.fecha_inicio);
        if (!fecha) {
          return null;
        }

        return {
          tipo: 'sesion',
          columnaActividad: 'sesion_estudio_id',
          actividadId: sesion.id,
          titulo: limitar(`Sesión de estudio: ${sesion.tema}`, LONGITUD_MAXIMA_TITULO),
          mensaje: limitar(
            `Tu sesión de estudio "${sesion.tema}" comienza el ${formatearFecha(fecha, preferencia.zona_horaria)}.`,
            LONGITUD_MAXIMA_MENSAJE,
          ),
          fechaActividad: fecha,
          clave: `sesion:${sesion.id}:${fecha.toISOString()}:${preferencia.anticipacion_minutos}`,
        };
      })
      .filter(Boolean);
  }
}

module.exports = NotificacionService;
module.exports.MAXIMO_USUARIOS_POR_EJECUCION = MAXIMO_USUARIOS_POR_EJECUCION;
module.exports.MAXIMO_NOTIFICACIONES_POR_USUARIO = MAXIMO_NOTIFICACIONES_POR_USUARIO;
module.exports.MAXIMO_ENVOS_SNS_POR_EJECUCION = MAXIMO_ENVOS_SNS_POR_EJECUCION;
