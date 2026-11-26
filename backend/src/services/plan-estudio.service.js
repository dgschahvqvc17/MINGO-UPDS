/**
 * Servicio de planes de estudio (HU15). Aplica las reglas de negocio:
 * propiedad de la materia y del plan, contexto academico acotado, cuota
 * diaria de IA, validacion de la salida del modelo, persistencia solo tras
 * confirmacion y sincronizacion de las sesiones con el calendario. No conoce
 * req ni res.
 */
const ApiError = require('../utils/ApiError');
const config = require('../config/environment');
const { PlanIaError } = require('./ia/plan.ia.service');
const { MAXIMO_SESIONES } = require('../models/plan-estudio.model');

const OPERACION = 'plan';
const LIMITE_DIARIO_PLANES = 5;

/** 6000 tokens a ~4 caracteres por token. */
const MAXIMO_CARACTERES_CONTENIDO = 24_000;
const MAXIMO_FRAGMENTOS = 40;
const MAXIMO_TAREAS = 20;
const MAXIMO_EVALUACIONES = 10;
const MAXIMO_CARACTERES_TAREA = 300;
const TIPO_EVENTO_EXAMEN = 'examen';

const ESTADO_CONFIRMADO = 'confirmado';
const ESTADO_DESCARTADO = 'descartado';
const TIPO_EVENTO_ESTUDIO = 'estudio';

/**
 * @returns {string} Inicio del dia en UTC, en formato ISO 8601.
 */
function inicioDelDia() {
  const fecha = new Date();
  fecha.setUTCHours(0, 0, 0, 0);
  return fecha.toISOString();
}

/**
 * @returns {string} Fin del dia en UTC, en formato ISO 8601.
 */
function finDelDia() {
  return new Date(Date.parse(inicioDelDia()) + 86_400_000).toISOString();
}

/**
 * Devuelve la fecha de calendario de una fecha ISO 8601. Si la fecha lleva
 * desplazamiento, los primeros diez caracteres son la fecha local del
 * estudiante; si termina en Z, son la fecha UTC.
 *
 * @param {unknown} valor
 * @returns {string | null}
 */
function fechaCalendario(valor) {
  const texto =
    typeof valor === 'string' ? valor : valor instanceof Date ? valor.toISOString() : '';
  const coincidencia = /^\d{4}-\d{2}-\d{2}/.exec(texto);
  return coincidencia ? coincidencia[0] : null;
}

/**
 * Traslada al dia de la evaluacion las sesiones que el proveedor programo
 * despues de esa fecha, conservando la hora y la zona horaria originales.
 * Evita que una propuesta generada por IA no se pueda confirmar despues.
 *
 * @param {Array<object>} sesiones
 * @param {string} fechaExamen
 * @returns {Array<object>}
 */
function limitarSesionesAFechaExamen(sesiones, fechaExamen) {
  return sesiones.map((sesion) => {
    const fechaSesion = fechaCalendario(sesion.fecha_inicio);

    if (!fechaSesion || fechaSesion <= fechaExamen) {
      return sesion;
    }

    return { ...sesion, fecha_inicio: `${fechaExamen}${sesion.fecha_inicio.slice(10)}` };
  });
}

/**
 * @param {Array<object>} tareas
 * @returns {string}
 */
function resumirTareas(tareas) {
  const resumen = tareas
    .map((tarea) => `- ${tarea.titulo} (${tarea.tipo}, ${tarea.fecha_entrega ?? 'sin fecha'})`)
    .join('\n')
    .slice(0, MAXIMO_CARACTERES_TAREA * MAXIMO_TAREAS);

  return resumen || 'No hay tareas registradas para esta materia.';
}

/**
 * @param {Array<object>} evaluaciones
 * @returns {string}
 */
function resumirEvaluaciones(evaluaciones) {
  const resumen = evaluaciones
    .map((evento) => {
      const fecha = new Date(evento.fecha_inicio);
      const fechaTexto = Number.isNaN(fecha.getTime())
        ? 'sin fecha'
        : fecha.toISOString().slice(0, 10);

      return `- ${evento.titulo} (${fechaTexto})`;
    })
    .join('\n');

  return resumen || 'No hay evaluaciones registradas en el calendario para esta materia.';
}

/**
 * Compone el material de estudio respetando el presupuesto de caracteres.
 *
 * @param {Array<{ numero_pagina: number | null, contenido: string }>} fragmentos
 * @returns {string}
 */
function armarTexto(fragmentos) {
  const bloques = [];
  let longitud = 0;

  for (const fragmento of fragmentos) {
    const pagina = fragmento.numero_pagina ? ` [Pagina ${fragmento.numero_pagina}]` : '';
    const encabezado = `Fragmento${pagina}:\n`;
    const espacioRestante = MAXIMO_CARACTERES_CONTENIDO - longitud - encabezado.length;

    if (espacioRestante <= 0) {
      break;
    }

    const contenidoFragmento = fragmento.contenido.slice(0, espacioRestante);
    bloques.push(`${encabezado}${contenidoFragmento}`);
    longitud += encabezado.length + contenidoFragmento.length;

    if (contenidoFragmento.length < fragmento.contenido.length) {
      break;
    }
  }

  return bloques.join('\n\n');
}

/**
 * Calcula el siguiente orden sin reutilizar huecos de sesiones eliminadas.
 * El indice unico (plan_id, orden) de la base exige que sea monotonico.
 *
 * @param {Array<{ orden: number }>} sesiones
 * @returns {number}
 */
function siguienteOrden(sesiones) {
  return sesiones.reduce((maximo, sesion) => Math.max(maximo, sesion.orden), 0) + 1;
}

/**
 * @param {object} fila Fila de `planes_estudio` con la relacion `materias`.
 * @returns {object}
 */
function aPlan(fila) {
  const materia = Array.isArray(fila.materias) ? fila.materias[0] : fila.materias;

  return {
    id: fila.id,
    usuario_id: fila.usuario_id,
    materia_id: fila.materia_id,
    materia_nombre: materia?.nombre ?? null,
    materia_codigo: materia?.codigo ?? null,
    objetivo: fila.objetivo,
    fecha_examen: fila.fecha_examen,
    minutos_por_dia: fila.minutos_por_dia,
    dias_disponibles: fila.dias_disponibles,
    estado: fila.estado,
    modelo: fila.modelo,
    tokens_entrada: fila.tokens_entrada,
    tokens_salida: fila.tokens_salida,
    fecha_creacion: fila.fecha_creacion,
    fecha_actualizacion: fila.fecha_actualizacion,
  };
}

/**
 * @param {object} sesion
 * @returns {object}
 */
function aSesion(sesion) {
  return {
    id: sesion.id,
    plan_id: sesion.plan_id,
    evento_calendario_id: sesion.evento_calendario_id ?? null,
    tema: sesion.tema,
    actividades: sesion.actividades,
    tipo: sesion.tipo ?? null,
    fecha_inicio: sesion.fecha_inicio,
    duracion_minutos: sesion.duracion_minutos,
    orden: sesion.orden,
    estado: sesion.estado,
    fecha_creacion: sesion.fecha_creacion,
    fecha_actualizacion: sesion.fecha_actualizacion,
  };
}

class PlanEstudioService {
  /**
   * @param {{
   *   materiaRepository: object,
   *   tareaRepository: object,
   *   fragmentoRepository: object,
   *   planRepository: object,
   *   calendarioRepository: object,
   *   consumoRepository: object,
   *   iaService: object,
   *   usuarioActualId: string
   * }} dependencias
   */
  constructor({
    materiaRepository,
    tareaRepository,
    fragmentoRepository,
    planRepository,
    calendarioRepository,
    consumoRepository,
    iaService,
    usuarioActualId,
  }) {
    this.materiaRepository = materiaRepository;
    this.tareaRepository = tareaRepository;
    this.fragmentoRepository = fragmentoRepository;
    this.planRepository = planRepository;
    this.calendarioRepository = calendarioRepository;
    this.consumoRepository = consumoRepository;
    this.iaService = iaService;
    this.usuarioActualId = usuarioActualId;
  }

  /**
   * Genera una propuesta de plan sin guardarla ni crear eventos.
   *
   * @param {object} entrada Datos validados del formulario.
   * @returns {Promise<object>}
   */
  async proponer(entrada) {
    const materia = await this.verificarMateria(entrada.materiaId);
    this.validarRangoFechas(entrada.fechaExamen);

    const { tareas, evaluaciones, documentos } = await this.obtenerContexto(entrada.materiaId);
    await this.verificarCuota();

    const generado = await this.generarConIa({
      materia: materia.nombre,
      ...entrada,
      tareas,
      evaluaciones,
      documentos,
      contexto: `${tareas}\n\n${evaluaciones}\n\n${documentos}`,
    });

    await this.consumoRepository.registrar({
      usuario_id: this.usuarioActualId,
      operacion: OPERACION,
      modelo: generado.modelo,
      tokens_entrada: generado.tokensEntrada,
      tokens_salida: generado.tokensSalida,
    });

    return {
      es_propuesta: true,
      materia_id: entrada.materiaId,
      materia_nombre: materia.nombre,
      objetivo: entrada.objetivo,
      fecha_examen: entrada.fechaExamen,
      minutos_por_dia: entrada.minutosPorDia,
      dias_disponibles: entrada.diasDisponibles,
      resumen: generado.contenido.resumen,
      sesiones: limitarSesionesAFechaExamen(
        generado.contenido.sesiones,
        entrada.fechaExamen,
      ).map((sesion, indice) => ({
        ...sesion,
        orden: indice + 1,
      })),
      modelo: generado.modelo,
      tokens_entrada: generado.tokensEntrada,
      tokens_salida: generado.tokensSalida,
    };
  }

  /**
   * Persiste un plan confirmado y sincroniza sus sesiones con el calendario.
   *
   * @param {object} entrada Plan confirmado y validado.
   * @returns {Promise<object>}
   */
  async confirmar(entrada) {
    await this.verificarMateria(entrada.materiaId);
    this.validarRangoFechas(entrada.fechaExamen);
    this.validarSesiones(entrada.sesiones, entrada.fechaExamen);

    const guardado = await this.planRepository.crearPlan(
      {
        usuario_id: this.usuarioActualId,
        materia_id: entrada.materiaId,
        objetivo: entrada.objetivo,
        fecha_examen: entrada.fechaExamen,
        minutos_por_dia: entrada.minutosPorDia,
        dias_disponibles: entrada.diasDisponibles,
        estado: ESTADO_CONFIRMADO,
        modelo: entrada.modelo ?? null,
        tokens_entrada: entrada.tokensEntrada,
        tokens_salida: entrada.tokensSalida,
      },
      entrada.sesiones.map((sesion, indice) => ({
        ...sesion,
        fecha_inicio: new Date(sesion.fechaInicio),
        duracion_minutos: sesion.duracionMinutos,
        orden: indice + 1,
      })),
    );

    const sesiones = await this.sincronizarCalendario(guardado);

    return {
      ...aPlan(guardado),
      sesiones,
    };
  }

  /**
   * Lista los planes propios con paginacion.
   *
   * @param {{ limite: number, desplazamiento: number }} paginacion
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listar({ limite, desplazamiento }) {
    const { items, total } = await this.planRepository.listarPlanes(this.usuarioActualId, {
      limit: limite,
      offset: desplazamiento,
    });

    return {
      items: items.map(aPlan),
      total,
    };
  }

  /**
   * Devuelve un plan propio con sus sesiones.
   *
   * @param {string} planId
   * @returns {Promise<object>}
   */
  async obtener(planId) {
    const plan = await this.obtenerPlan(planId);
    const sesiones = await this.planRepository.listarSesiones(planId);

    return {
      ...aPlan(plan),
      sesiones: sesiones.map(aSesion),
    };
  }

  /**
   * Actualiza los parametros editables de un plan propio.
   *
   * @param {string} planId
   * @param {object} cambios
   * @returns {Promise<object>}
   */
  async actualizar(planId, cambios) {
    await this.obtenerPlan(planId);

    const fila = await this.planRepository.actualizarPlan(
      this.usuarioActualId,
      planId,
      cambios,
    );

    return aPlan(fila);
  }

  /**
   * Descarta un plan propio y elimina sus eventos de calendario.
   *
   * @param {string} planId
   * @returns {Promise<void>}
   */
  async descartar(planId) {
    await this.obtenerPlan(planId);
    const sesiones = await this.planRepository.listarSesiones(planId);
    await this.eliminarEventos(sesiones);

    await this.planRepository.actualizarPlan(this.usuarioActualId, planId, {
      estado: ESTADO_DESCARTADO,
    });
  }

  /**
   * Agrega una sesion a un plan propio y la muestra en el calendario.
   *
   * @param {string} planId
   * @param {object} sesion
   * @returns {Promise<object>}
   */
  async agregarSesion(planId, sesion) {
    const plan = await this.obtenerPlan(planId);
    const sesiones = await this.planRepository.listarSesiones(planId);

    if (sesiones.length >= MAXIMO_SESIONES) {
      throw ApiError.conflict(`El plan ya tiene el maximo de ${MAXIMO_SESIONES} sesiones.`);
    }

    this.validarSesiones(
      [{ ...sesion, fechaInicio: sesion.fechaInicio, duracionMinutos: sesion.duracionMinutos }],
      plan.fecha_examen,
    );

    const guardada = await this.planRepository.crearSesion(this.usuarioActualId, {
      ...sesion,
      plan_id: planId,
      fecha_inicio: new Date(sesion.fechaInicio),
      duracion_minutos: sesion.duracionMinutos,
      orden: siguienteOrden(sesiones),
    });

    const conEvento = await this.sincronizarSesion(plan, guardada);
    return aSesion(conEvento);
  }

  /**
   * Edita una sesion propia, recalcula su evento de calendario y permite
   * marcarla como completada.
   *
   * @param {string} sesionId
   * @param {object} cambios
   * @returns {Promise<object>}
   */
  async actualizarSesion(sesionId, cambios) {
    const sesion = await this.obtenerSesion(sesionId);
    const plan = await this.obtenerPlan(sesion.plan_id);
    const datos = { ...cambios };

    if (datos.fechaInicio !== undefined) {
      const fechaSesion = fechaCalendario(datos.fechaInicio);

      if (fechaSesion && fechaSesion > plan.fecha_examen) {
        throw ApiError.badRequest('La sesion no puede programarse despues de la evaluacion.');
      }

      datos.fecha_inicio = new Date(datos.fechaInicio);
      delete datos.fechaInicio;
    }
    if (datos.duracionMinutos !== undefined) {
      datos.duracion_minutos = datos.duracionMinutos;
      delete datos.duracionMinutos;
    }

    const actualizada = await this.planRepository.actualizarSesion(
      this.usuarioActualId,
      sesionId,
      datos,
    );

    if (
      datos.fecha_inicio !== undefined
      || datos.duracion_minutos !== undefined
      || datos.tema !== undefined
    ) {
      await this.sincronizarSesion(plan, actualizada, sesion);
    }

    return aSesion(await this.planRepository.obtenerSesionPorId(this.usuarioActualId, sesionId));
  }

  /**
   * Elimina una sesion propia junto con su evento de calendario.
   *
   * @param {string} sesionId
   * @returns {Promise<void>}
   */
  async eliminarSesion(sesionId) {
    const sesion = await this.obtenerSesion(sesionId);
    await this.eliminarEventos([sesion]);
    await this.planRepository.eliminarSesion(this.usuarioActualId, sesionId);
  }

  /**
   * @param {string} materiaId
   * @returns {Promise<object>}
   */
  async verificarMateria(materiaId) {
    const materia = await this.materiaRepository.obtenerMateriaPorId(
      this.usuarioActualId,
      materiaId,
    );

    if (!materia) {
      throw ApiError.notFound('Materia no encontrada.');
    }

    return materia;
  }

  /**
   * @param {string} fechaExamen ISO AAAA-MM-DD.
   */
  validarRangoFechas(fechaExamen) {
    const hoy = new Date().toISOString().slice(0, 10);

    if (fechaExamen < hoy) {
      throw ApiError.badRequest('La fecha de la evaluacion no puede ser pasada.');
    }
  }

  /**
   * @param {Array<object>} sesiones
   * @param {string} fechaExamen
   */
  validarSesiones(sesiones, fechaExamen) {
    if (sesiones.length > MAXIMO_SESIONES) {
      throw ApiError.badRequest(`El plan puede tener como maximo ${MAXIMO_SESIONES} sesiones.`);
    }

    for (const sesion of sesiones) {
      const fechaInicio = sesion.fechaInicio ?? sesion.fecha_inicio;
      const inicio = new Date(fechaInicio);

      if (Number.isNaN(inicio.getTime())) {
        throw ApiError.badRequest('La fecha de una sesion no es valida.');
      }

      const fechaSesion = fechaCalendario(fechaInicio);
      if (fechaSesion && fechaSesion > fechaExamen) {
        throw ApiError.badRequest('Una sesion no puede programarse despues de la evaluacion.');
      }
    }
  }

  /**
   * @param {string} materiaId
   * @returns {Promise<{ tareas: string, evaluaciones: string, documentos: string }>}
   */
  async obtenerContexto(materiaId) {
    const [tareas, evaluaciones, fragmentos] = await Promise.all([
      this.tareaRepository.listarTareas(this.usuarioActualId, {
        materia_id: materiaId,
        limit: MAXIMO_TAREAS,
      }),
      this.calendarioRepository.listarEventos({
        materia_id: materiaId,
        tipo_evento: TIPO_EVENTO_EXAMEN,
        limit: MAXIMO_EVALUACIONES,
      }),
      this.fragmentoRepository.listarPorMateriaParaCuestionario(
        materiaId,
        MAXIMO_FRAGMENTOS,
      ),
    ]);

    return {
      tareas: resumirTareas(tareas.items ?? []),
      evaluaciones: resumirEvaluaciones(evaluaciones.items ?? []),
      documentos: fragmentos.length > 0
        ? armarTexto(fragmentos)
        : 'No hay documentos procesados para esta materia.',
    };
  }

  /**
   * @returns {Promise<void>}
   */
  async verificarCuota() {
    const consumidos = await this.consumoRepository.contar(
      this.usuarioActualId,
      OPERACION,
      inicioDelDia(),
    );

    if (consumidos < LIMITE_DIARIO_PLANES) {
      return;
    }

    throw ApiError.rateLimited(
      'Alcanzaste el limite diario de planes de estudio. Vuelve a intentarlo mas tarde.',
      { code: 'AI_QUOTA_EXCEEDED', reinicio: finDelDia() },
    );
  }

  /**
   * @param {object} parametros
   * @returns {Promise<object>}
   */
  async generarConIa(parametros) {
    try {
      return await this.iaService.generarPlan(parametros);
    } catch (error) {
      if (error instanceof PlanIaError) {
        throw ApiError.serviceUnavailable(error.message);
      }

      throw error;
    }
  }

  /**
   * @param {string} planId
   * @returns {Promise<object>}
   */
  async obtenerPlan(planId) {
    const plan = await this.planRepository.obtenerPlanPorId(this.usuarioActualId, planId);

    if (!plan) {
      throw ApiError.notFound('Plan de estudio no encontrado.');
    }

    return plan;
  }

  /**
   * @param {string} sesionId
   * @returns {Promise<object>}
   */
  async obtenerSesion(sesionId) {
    const sesion = await this.planRepository.obtenerSesionPorId(
      this.usuarioActualId,
      sesionId,
    );

    if (!sesion) {
      throw ApiError.notFound('Sesion de estudio no encontrada.');
    }

    return sesion;
  }

  /**
   * Crea los eventos de calendario de un plan recien guardado.
   *
   * @param {object} plan
   * @returns {Promise<Array<object>>}
   */
  async sincronizarCalendario(plan) {
    const sesiones = [];

    for (const sesion of plan.sesiones ?? []) {
      sesiones.push(await this.sincronizarSesion(plan, sesion));
    }

    return sesiones;
  }

  /**
   * Crea o actualiza el evento de una sesion. Un fallo no invalida la sesion:
   * el plan sigue siendo util aunque el calendario este temporalmente caido.
   *
   * @param {object} plan
   * @param {object} sesion
   * @param {object} [sesionAnterior]
   * @returns {Promise<object>}
   */
  async sincronizarSesion(plan, sesion, sesionAnterior = sesion) {
    const inicio = new Date(sesion.fecha_inicio);
    const fin = new Date(inicio.getTime() + sesion.duracion_minutos * 60_000);
    const datosEvento = {
      titulo: `Estudio: ${sesion.tema}`.slice(0, 200),
      descripcion: sesion.actividades,
      tipo_evento: TIPO_EVENTO_ESTUDIO,
      fecha_inicio: inicio,
      fecha_fin: fin,
      materia_id: plan.materia_id,
    };

    try {
      let eventoId = sesionAnterior.evento_calendario_id ?? sesion.evento_calendario_id;

      if (eventoId) {
        await this.calendarioRepository.actualizarEvento(
          this.usuarioActualId,
          eventoId,
          datosEvento,
        );
      } else {
        const evento = await this.calendarioRepository.crearEvento(
          this.usuarioActualId,
          datosEvento,
        );
        eventoId = evento.id;
      }

      const actualizada = await this.planRepository.actualizarSesion(
        this.usuarioActualId,
        sesion.id,
        { evento_calendario_id: eventoId },
      );

      return aSesion(actualizada ?? { ...sesion, evento_calendario_id: eventoId });
    } catch (error) {
      if (!config.isProd) {
        // eslint-disable-next-line no-console
        console.warn('No se pudo sincronizar la sesion con el calendario:', error.message);
      }

      return aSesion(sesion);
    }
  }

  /**
   * @param {Array<object>} sesiones
   * @returns {Promise<void>}
   */
  async eliminarEventos(sesiones) {
    for (const sesion of sesiones) {
      if (!sesion.evento_calendario_id) {
        continue;
      }

      try {
        await this.calendarioRepository.eliminarEvento(
          this.usuarioActualId,
          sesion.evento_calendario_id,
        );
      } catch (error) {
        if (!config.isProd) {
          // eslint-disable-next-line no-console
          console.warn('No se pudo eliminar el evento de la sesion:', error.message);
        }
      }
    }
  }
}

module.exports = PlanEstudioService;
module.exports.LIMITE_DIARIO_PLANES = LIMITE_DIARIO_PLANES;
module.exports.MAXIMO_CARACTERES_CONTENIDO = MAXIMO_CARACTERES_CONTENIDO;
module.exports.MAXIMO_FRAGMENTOS = MAXIMO_FRAGMENTOS;
module.exports.armarTexto = armarTexto;
module.exports.aPlan = aPlan;
module.exports.aSesion = aSesion;
