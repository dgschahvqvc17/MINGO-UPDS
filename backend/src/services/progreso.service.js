/**
 * Servicio de progreso academico (HU17). Agrega registros ya existentes
 * (materias, tareas, sesiones, cuestionarios y objetivos) con reglas
 * deterministas: no consume IA ni almacena estado propio.
 */

const DIAS_ACTIVIDAD_SEMANAL = 7;
const DIAS_RACHA = 60;
const DIAS_PROXIMOS = 7;
const LIMITE_ATENCIONES = 5;
const LIMITE_RECOMENDACIONES = 4;
const LIMITE_TEMAS_REFORZAR = 3;
const UMBRAL_DOMINIO = 70;

const ETIQUETAS_DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const ESTADOS_OBJETIVO_ACTIVOS = ['pendiente', 'en_progreso'];

function claveDia(fecha) {
  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${año}-${mes}-${dia}`;
}

function aFecha(valor) {
  if (!valor) {
    return null;
  }

  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function redondear(valor, decimales = 2) {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

function porcentaje(parte, total) {
  return total === 0 ? 0 : redondear(parte / total);
}

function esVencida(fecha, fechaReferencia) {
  return Boolean(fecha) && fecha.getTime() < fechaReferencia.getTime();
}

class ProgresoService {
  /**
   * @param {{
   *   progresoRepository: import('../repositories/progreso.repository'),
   *   objetivoRepository: import('../repositories/objetivo.repository'),
   *   usuarioActualId: string
   * }} dependencias
   */
  constructor({ progresoRepository, objetivoRepository, usuarioActualId }) {
    this.progresoRepository = progresoRepository;
    this.objetivoRepository = objetivoRepository;
    this.usuarioActualId = usuarioActualId;
  }

  async obtener() {
    const [materias, tareas, sesiones, intentos, objetivos] = await Promise.all([
      this.progresoRepository.listarMaterias(this.usuarioActualId),
      this.progresoRepository.listarTareas(this.usuarioActualId),
      this.progresoRepository.listarSesiones(this.usuarioActualId),
      this.progresoRepository.listarIntentos(this.usuarioActualId),
      this.objetivoRepository.listarParaProgreso(this.usuarioActualId, 200),
    ]);

    const ahora = new Date();
    const resumen = this.calcularResumen({ materias, tareas, sesiones, intentos, objetivos }, ahora);
    const actividadesAtencion = this.calcularAtenciones({ tareas, sesiones, objetivos }, ahora);

    return {
      ...resumen,
      por_estado: {
        tareas: this.contarEstados(tareas, 'pendiente', 'en_progreso', 'completada'),
        objetivos: this.contarEstados(objetivos, 'pendiente', 'en_progreso', 'completada'),
        sesiones: this.contarEstados(sesiones, 'pendiente', 'completada'),
      },
      actividad_semanal: this.calcularActividadSemanal(tareas, sesiones, ahora),
      actividades_atencion: actividadesAtencion,
      recomendaciones: this.calcularRecomendaciones(resumen, actividadesAtencion, intentos),
      generado_en: ahora.toISOString(),
    };
  }

  /**
   * @param {object} registros
   * @param {Date} ahora
   */
  calcularResumen({ materias, tareas, sesiones, intentos, objetivos }, ahora) {
    const tareasCompletadas = tareas.filter((tarea) => tarea.estado === 'completada');
    const sesionesCompletadas = sesiones.filter((sesion) => sesion.estado === 'completada');
    const objetivosCompletados = objetivos.filter(
      (objetivo) => objetivo.estado === 'completada',
    );
    const puntuaciones = intentos
      .map((intento) => Number(intento.puntuacion))
      .filter((puntuacion) => Number.isFinite(puntuacion));
    const fechasActividad = [
      ...tareasCompletadas.map((tarea) => aFecha(tarea.fecha_actualizacion)),
      ...sesionesCompletadas.map((sesion) => aFecha(sesion.fecha_actualizacion)),
      ...intentos.map((intento) => aFecha(intento.fecha_finalizacion)),
    ].filter(Boolean);

    return {
      materias_activas: materias.filter((materia) => materia.estado === 'activo').length,
      tareas_pendientes: tareas.length - tareasCompletadas.length,
      tareas_completadas: tareasCompletadas.length,
      cumplimiento_tareas: porcentaje(tareasCompletadas.length, tareas.length),
      sesiones_totales: sesiones.length,
      sesiones_completadas: sesionesCompletadas.length,
      cumplimiento_sesiones: porcentaje(sesionesCompletadas.length, sesiones.length),
      minutos_estudiados: sesionesCompletadas.reduce(
        (total, sesion) => total + (Number(sesion.duracion_minutos) || 0),
        0,
      ),
      cuestionarios_completados: intentos.length,
      promedio_cuestionarios:
        puntuaciones.length === 0
          ? null
          : redondear(
              puntuaciones.reduce((total, puntuacion) => total + puntuacion, 0) /
                puntuaciones.length,
              1,
            ),
      objetivos_activos: objetivos.length - objetivosCompletados.length,
      objetivos_completados: objetivosCompletados.length,
      cumplimiento_objetivos: porcentaje(objetivosCompletados.length, objetivos.length),
      racha_dias: this.calcularRacha(fechasActividad, ahora),
    };
  }

  /**
   * @param {Array<object>} registros
   * @param {...string} estados
   */
  contarEstados(registros, ...estados) {
    return estados.map((estado) => ({
      estado,
      total: registros.filter((registro) => registro.estado === estado).length,
    }));
  }

  /**
   * Cuenta dias consecutivos con actividad. Si hoy no tiene actividad se empieza
   * desde ayer, para no perder la racha mientras el dia aun esta en curso.
   *
   * @param {Array<Date>} fechas
   * @param {Date} ahora
   */
  calcularRacha(fechas, ahora) {
    const diasConActividad = new Set(fechas.map(claveDia));
    const cursor = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

    if (!diasConActividad.has(claveDia(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }

    let racha = 0;
    while (diasConActividad.has(claveDia(cursor)) && racha < DIAS_RACHA) {
      racha += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return racha;
  }

  /**
   * @param {Array<object>} tareas
   * @param {Array<object>} sesiones
   * @param {Date} ahora
   */
  calcularActividadSemanal(tareas, sesiones, ahora) {
    const dias = [];

    for (let indice = DIAS_ACTIVIDAD_SEMANAL - 1; indice >= 0; indice -= 1) {
      const fecha = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - indice);
      dias.push({
        fecha: claveDia(fecha),
        etiqueta: ETIQUETAS_DIA[fecha.getDay()],
        tareas: 0,
        sesiones: 0,
      });
    }

    const porClave = new Map(dias.map((dia) => [dia.fecha, dia]));

    for (const tarea of tareas) {
      if (tarea.estado !== 'completada') {
        continue;
      }

      const fecha = aFecha(tarea.fecha_actualizacion);
      const dia = fecha && porClave.get(claveDia(fecha));
      if (dia) {
        dia.tareas += 1;
      }
    }

    for (const sesion of sesiones) {
      if (sesion.estado !== 'completada') {
        continue;
      }

      const fecha = aFecha(sesion.fecha_actualizacion);
      const dia = fecha && porClave.get(claveDia(fecha));
      if (dia) {
        dia.sesiones += 1;
      }
    }

    return dias;
  }

  /**
   * @param {object} registros
   * @param {Date} ahora
   */
  calcularAtenciones({ tareas, sesiones, objetivos }, ahora) {
    const atenciones = [];
    const limiteProximo = new Date(ahora);
    limiteProximo.setDate(limiteProximo.getDate() + DIAS_PROXIMOS);

    for (const tarea of tareas) {
      if (tarea.estado === 'completada') {
        continue;
      }

      const fecha = aFecha(tarea.fecha_entrega);
      if (!fecha) {
        continue;
      }

      const vencida = esVencida(fecha, ahora);
      if (vencida || fecha <= limiteProximo) {
        atenciones.push({
          tipo: 'tarea',
          id: tarea.id,
          titulo: tarea.titulo,
          materia: tarea.materias?.nombre ?? null,
          motivo: vencida ? 'Vencida' : 'Vence pronto',
          fecha: fecha.toISOString(),
          urgencia: vencida ? 0 : 1,
        });
      }
    }

    for (const sesion of sesiones) {
      const fecha = aFecha(sesion.fecha_inicio);
      if (sesion.estado !== 'pendiente' || !fecha || fecha >= ahora) {
        continue;
      }

      atenciones.push({
        tipo: 'sesion',
        id: sesion.id,
        titulo: sesion.tema,
        materia: null,
        motivo: 'Sesión pendiente',
        fecha: fecha.toISOString(),
        urgencia: 0,
      });
    }

    const claveHoy = claveDia(ahora);
    for (const objetivo of objetivos) {
      if (
        ESTADOS_OBJETIVO_ACTIVOS.includes(objetivo.estado) &&
        objetivo.fecha_limite &&
        claveDia(aFecha(objetivo.fecha_limite) ?? ahora) < claveHoy
      ) {
        atenciones.push({
          tipo: 'objetivo',
          id: objetivo.id,
          titulo: objetivo.titulo,
          materia: objetivo.materias?.nombre ?? null,
          motivo: 'Objetivo vencido',
          fecha: aFecha(objetivo.fecha_limite).toISOString(),
          urgencia: 0,
        });
      }
    }

    return atenciones
      .sort((primera, segunda) => primera.urgencia - segunda.urgencia ||
        nuevaFecha(primera.fecha) - nuevaFecha(segunda.fecha))
      .slice(0, LIMITE_ATENCIONES)
      .map(({ urgencia: _urgencia, ...atencion }) => atencion);
  }

  /**
   * @param {object} resumen
   * @param {Array<object>} atenciones
   * @param {Array<object>} intentos
   */
  calcularRecomendaciones(resumen, atenciones, intentos) {
    const recomendaciones = [];
    const porTipo = (tipo) => atenciones.filter((atencion) => atencion.tipo === tipo).length;

    if (porTipo('objetivo') > 0) {
      recomendaciones.push({
        tipo: 'objetivos',
        prioridad: 'alta',
        mensaje: 'Revisa tus objetivos vencidos: reactúalos, reprograma la fecha o márcalos como completados.',
      });
    }

    if (porTipo('tarea') > 0) {
      recomendaciones.push({
        tipo: 'tareas',
        prioridad: 'alta',
        mensaje: 'Prioriza las tareas vencidas o próximas a vencer antes de iniciar nuevas actividades.',
      });
    }

    if (porTipo('sesion') > 0) {
      recomendaciones.push({
        tipo: 'sesiones',
        prioridad: 'alta',
        mensaje: 'Retoma las sesiones de estudio pendientes para no perder el ritmo de tu plan.',
      });
    }

    const temas = this.temasARepasar(intentos);
    if (resumen.promedio_cuestionarios !== null && resumen.promedio_cuestionarios < UMBRAL_DOMINIO) {
      recomendaciones.push({
        tipo: 'cuestionarios',
        prioridad: 'media',
        mensaje: temas.length > 0
          ? `Repasa ${temas.join(', ')}: tus últimos cuestionarios muestran menor dominio en esos temas.`
          : 'Repasa los temas de tus últimos cuestionarios: tu promedio está por debajo del 70 %.',
      });
    }

    if (resumen.objetivos_activos + resumen.objetivos_completados === 0) {
      recomendaciones.push({
        tipo: 'objetivos',
        prioridad: 'media',
        mensaje: 'Registra un objetivo académico para seguir tus avances con una meta concreta.',
      });
    }

    if (recomendaciones.length === 0) {
      recomendaciones.push({
        tipo: 'general',
        prioridad: 'baja',
        mensaje: 'Todo está al día. Mantén tu ritmo y registra un nuevo objetivo cuando lo necesites.',
      });
    }

    return recomendaciones.slice(0, LIMITE_RECOMENDACIONES);
  }

  /**
   * @param {Array<object>} intentos
   */
  temasARepasar(intentos) {
    const conteo = new Map();

    for (const intento of intentos) {
      const puntuacion = Number(intento.puntuacion);
      if (!Number.isFinite(puntuacion) || puntuacion >= UMBRAL_DOMINIO) {
        continue;
      }

      for (const tema of Array.isArray(intento.temas_reforzar) ? intento.temas_reforzar : []) {
        if (typeof tema === 'string' && tema.trim().length > 0) {
          conteo.set(tema, (conteo.get(tema) ?? 0) + 1);
        }
      }
    }

    return [...conteo.entries()]
      .sort((primero, segundo) => segundo[1] - primero[1])
      .slice(0, LIMITE_TEMAS_REFORZAR)
      .map(([tema]) => tema);
  }
}

function nuevaFecha(valor) {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? 0 : fecha.getTime();
}

module.exports = ProgresoService;
module.exports.claveDia = claveDia;
module.exports.redondear = redondear;
