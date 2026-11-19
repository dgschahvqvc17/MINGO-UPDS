/**
 * Servicio de cuestionarios academicos (HU13).
 * Aplica las reglas de negocio: propiedad de materia y documento, material
 * suficiente, cuota diaria, validacion de la salida del modelo, persistencia y
 * correccion determinista de las preguntas objetivas.
 * No conoce req ni res.
 */
const ApiError = require('../utils/ApiError');
const { CuestionarioIaError } = require('./ia/cuestionario.ia.service');

const OPERACION = 'cuestionario';
const LIMITE_DIARIO_CUESTIONARIOS = 10;

/** 12000 tokens por documento a ~4 caracteres por token. */
const MAXIMO_CARACTERES_CONTENIDO = 48_000;
/** Tope de fragmentos leidos por cuestionario; evita consultas y prompts enormes. */
const MAXIMO_FRAGMENTOS = 60;
const MINIMO_CARACTERES_CONTENIDO = 40;
const MAXIMO_CARACTERES_TITULO = 200;

const ESTADO_PROCESADO = 'procesado';
const ESTADO_INTENTO_EN_PROGRESO = 'en_progreso';
const ESTADO_INTENTO_FINALIZADO = 'finalizado';
const TIPO_PREGUNTA_ABIERTA = 'abierta';

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
 * Normaliza un texto para comparar respuestas sin depender de mayusculas,
 * tildes ni espacios repetidos.
 *
 * @param {string} texto
 * @returns {string}
 */
function normalizarComparacion(texto) {
  return String(texto ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
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
 * @param {object} fila Fila de `cuestionarios` con la relacion `materias`.
 * @returns {object}
 */
function aCuestionarioResumen(fila) {
  const materia = Array.isArray(fila.materias) ? fila.materias[0] : fila.materias;

  return {
    id: fila.id,
    usuario_id: fila.usuario_id,
    materia_id: fila.materia_id,
    materia_nombre: materia?.nombre ?? null,
    documento_id: fila.documento_id,
    titulo: fila.titulo,
    dificultad: fila.dificultad,
    cantidad_preguntas: fila.cantidad_preguntas,
    tipos: fila.tipos ?? [],
    modelo: fila.modelo,
    tokens_entrada: fila.tokens_entrada,
    tokens_salida: fila.tokens_salida,
    fecha_creacion: fila.fecha_creacion,
  };
}

/**
 * @param {object} opcion
 * @param {{ incluirRespuestas: boolean }} opciones
 * @returns {object}
 */
function aOpcion(opcion, { incluirRespuestas }) {
  const base = {
    id: opcion.id,
    contenido: opcion.contenido,
    orden: opcion.orden,
  };

  return incluirRespuestas ? { ...base, es_correcta: Boolean(opcion.es_correcta) } : base;
}

/**
 * @param {object} pregunta
 * @param {{ incluirRespuestas: boolean, respuestaUsuario?: object | null }} opciones
 * @returns {object}
 */
function aPregunta(pregunta, { incluirRespuestas, respuestaUsuario = null }) {
  const base = {
    id: pregunta.id,
    cuestionario_id: pregunta.cuestionario_id,
    orden: pregunta.orden,
    enunciado: pregunta.enunciado,
    tipo_pregunta: pregunta.tipo_pregunta,
    opciones: (pregunta.opciones ?? []).map((opcion) =>
      aOpcion(opcion, { incluirRespuestas }),
    ),
    respuesta_usuario: respuestaUsuario?.respuesta ?? null,
    // La correccion solo se revela al finalizar el intento.
    es_correcta: incluirRespuestas ? respuestaUsuario?.es_correcta ?? null : null,
  };

  if (!incluirRespuestas) {
    return base;
  }

  return {
    ...base,
    respuesta_correcta: pregunta.respuesta_correcta,
    explicacion: pregunta.explicacion,
  };
}

/**
 * @param {object} intento
 * @returns {object}
 */
function aIntento(intento) {
  return {
    id: intento.id,
    cuestionario_id: intento.cuestionario_id,
    estado: intento.estado,
    total_preguntas: intento.total_preguntas,
    preguntas_objetivas: intento.preguntas_objetivas,
    respuestas_correctas: intento.respuestas_correctas,
    puntuacion: intento.puntuacion === null ? null : Number(intento.puntuacion),
    fecha_inicio: intento.fecha_inicio,
    fecha_finalizacion: intento.fecha_finalizacion,
  };
}

/**
 * @param {object} pregunta
 * @param {string} respuesta
 * @returns {boolean}
 */
function esRespuestaCorrecta(pregunta, respuesta) {
  return normalizarComparacion(respuesta) === normalizarComparacion(pregunta.respuesta_correcta);
}

/**
 * @param {string[]} tipos
 * @returns {string[]}
 */
function normalizarTipos(tipos) {
  return [...new Set(tipos)];
}

class CuestionarioService {
  /**
   * @param {{
   *   materiaRepository: object,
   *   documentoRepository: object,
   *   fragmentoRepository: object,
   *   cuestionarioRepository: object,
   *   consumoRepository: object,
   *   iaService: object,
   *   usuarioActualId: string
   * }} dependencias
   */
  constructor({
    materiaRepository,
    documentoRepository,
    fragmentoRepository,
    cuestionarioRepository,
    consumoRepository,
    iaService,
    usuarioActualId,
  }) {
    this.materiaRepository = materiaRepository;
    this.documentoRepository = documentoRepository;
    this.fragmentoRepository = fragmentoRepository;
    this.cuestionarioRepository = cuestionarioRepository;
    this.consumoRepository = consumoRepository;
    this.iaService = iaService;
    this.usuarioActualId = usuarioActualId;
  }

  /**
   * Genera un cuestionario a partir de un documento propio o de los documentos
   * procesados de una materia propia.
   *
   * @param {{
   *   materiaId: string,
   *   documentoId: string | null,
   *   cantidadPreguntas: number,
   *   dificultad: string,
   *   tipos: string[]
   * }} entrada
   * @returns {Promise<object>}
   */
  async generar({ materiaId, documentoId, cantidadPreguntas, dificultad, tipos }) {
    const materia = await this.materiaRepository.obtenerMateriaPorId(
      this.usuarioActualId,
      materiaId,
    );

    if (!materia) {
      throw ApiError.notFound('Materia no encontrada.');
    }

    const texto = documentoId
      ? await this.obtenerMaterialDeDocumento(documentoId, materiaId)
      : await this.obtenerMaterialDeMateria(materiaId);

    await this.verificarCuota();

    const generado = await this.generarConIa({
      texto,
      cantidad: cantidadPreguntas,
      dificultad,
      tipos: normalizarTipos(tipos),
    });

    await this.consumoRepository.registrar({
      usuario_id: this.usuarioActualId,
      operacion: OPERACION,
      modelo: generado.modelo,
      tokens_entrada: generado.tokensEntrada,
      tokens_salida: generado.tokensSalida,
    });

    const titulo = (generado.contenido.titulo ?? `Cuestionario de ${materia.nombre}`).slice(
      0,
      MAXIMO_CARACTERES_TITULO,
    );

    const guardado = await this.cuestionarioRepository.crearCuestionario(
      {
        usuario_id: this.usuarioActualId,
        materia_id: materiaId,
        documento_id: documentoId ?? null,
        titulo,
        dificultad,
        cantidad_preguntas: generado.contenido.preguntas.length,
        tipos: normalizarTipos(tipos),
        modelo: generado.modelo,
        tokens_entrada: generado.tokensEntrada,
        tokens_salida: generado.tokensSalida,
      },
      generado.contenido.preguntas,
    );

    return {
      ...aCuestionarioResumen({ ...guardado, materias: materia }),
      preguntas: (guardado.preguntas ?? []).map((pregunta) =>
        aPregunta(pregunta, { incluirRespuestas: false }),
      ),
    };
  }

  /**
   * Lista los cuestionarios del usuario con paginacion.
   *
   * @param {{ limite: number, desplazamiento: number }} paginacion
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listar({ limite, desplazamiento }) {
    const { items, total } = await this.cuestionarioRepository.listarCuestionarios(
      this.usuarioActualId,
      { limit: limite, offset: desplazamiento },
    );

    return { items: items.map(aCuestionarioResumen), total };
  }

  /**
   * Devuelve un cuestionario propio con sus preguntas, sin respuestas correctas.
   *
   * @param {string} cuestionarioId
   * @returns {Promise<object>}
   */
  async obtener(cuestionarioId) {
    const cuestionario = await this.obtenerCuestionario(cuestionarioId);
    const preguntas = await this.cuestionarioRepository.listarPreguntas(cuestionarioId);
    const intentos = await this.cuestionarioRepository.listarIntentos(
      this.usuarioActualId,
      cuestionarioId,
    );

    return {
      ...aCuestionarioResumen(cuestionario),
      preguntas: preguntas.map((pregunta) => aPregunta(pregunta, { incluirRespuestas: false })),
      intentos: intentos.map(aIntento),
    };
  }

  /**
   * @param {string} cuestionarioId
   * @returns {Promise<void>}
   */
  async eliminar(cuestionarioId) {
    await this.obtenerCuestionario(cuestionarioId);
    await this.cuestionarioRepository.eliminarCuestionario(this.usuarioActualId, cuestionarioId);
  }

  /**
   * Inicia un intento de resolucion de un cuestionario propio.
   *
   * @param {string} cuestionarioId
   * @returns {Promise<object>}
   */
  async iniciarIntento(cuestionarioId) {
    const cuestionario = await this.obtenerCuestionario(cuestionarioId);
    const preguntas = await this.cuestionarioRepository.listarPreguntas(cuestionarioId);

    if (preguntas.length === 0) {
      throw ApiError.unprocessable('El cuestionario no tiene preguntas para resolver.');
    }

    const preguntasObjetivas = preguntas.filter(
      (pregunta) => pregunta.tipo_pregunta !== TIPO_PREGUNTA_ABIERTA,
    ).length;

    const intento = await this.cuestionarioRepository.crearIntento({
      usuario_id: this.usuarioActualId,
      cuestionario_id: cuestionarioId,
      estado: ESTADO_INTENTO_EN_PROGRESO,
      total_preguntas: preguntas.length,
      preguntas_objetivas: preguntasObjetivas,
      respuestas_correctas: 0,
      puntuacion: null,
    });

    return {
      intento: aIntento(intento),
      cuestionario: {
        ...aCuestionarioResumen(cuestionario),
        preguntas: preguntas.map((pregunta) =>
          aPregunta(pregunta, { incluirRespuestas: false }),
        ),
      },
    };
  }

  /**
   * Registra las respuestas de un intento en progreso, corrige las preguntas
   * objetivas y finaliza el intento.
   *
   * @param {string} intentoId
   * @param {Array<{ pregunta_id: string, respuesta: string }>} respuestas
   * @returns {Promise<object>}
   */
  async responder(intentoId, respuestas) {
    const intento = await this.obtenerIntento(intentoId);

    if (intento.estado !== ESTADO_INTENTO_EN_PROGRESO) {
      throw ApiError.conflict('Este intento ya fue finalizado.');
    }

    const cuestionario = await this.obtenerCuestionario(intento.cuestionario_id);
    const preguntas = await this.cuestionarioRepository.listarPreguntas(cuestionario.id);
    const preguntasPorId = new Map(preguntas.map((pregunta) => [pregunta.id, pregunta]));

    for (const respuesta of respuestas) {
      if (!preguntasPorId.has(respuesta.pregunta_id)) {
        throw ApiError.badRequest(
          'Alguna de las respuestas no pertenece al cuestionario del intento.',
        );
      }
    }

    const filas = respuestas.map((respuesta) => {
      const pregunta = preguntasPorId.get(respuesta.pregunta_id);
      const esObjetiva = pregunta.tipo_pregunta !== TIPO_PREGUNTA_ABIERTA;

      return {
        intento_id: intentoId,
        pregunta_id: respuesta.pregunta_id,
        respuesta: respuesta.respuesta,
        es_correcta: esObjetiva ? esRespuestaCorrecta(pregunta, respuesta.respuesta) : null,
      };
    });

    await this.cuestionarioRepository.guardarRespuestas(filas);

    const respuestasCorrectas = filas.filter((fila) => fila.es_correcta === true).length;
    const preguntasObjetivas = preguntas.filter(
      (pregunta) => pregunta.tipo_pregunta !== TIPO_PREGUNTA_ABIERTA,
    ).length;
    const puntuacion =
      preguntasObjetivas > 0
        ? Math.round((respuestasCorrectas / preguntasObjetivas) * 10_000) / 100
        : null;

    const actualizado = await this.cuestionarioRepository.actualizarIntento(
      this.usuarioActualId,
      intentoId,
      {
        estado: ESTADO_INTENTO_FINALIZADO,
        respuestas_correctas: respuestasCorrectas,
        puntuacion,
        fecha_finalizacion: new Date().toISOString(),
      },
    );

    return this.armarResultado({
      intento: actualizado ?? intento,
      cuestionario,
      preguntas,
      respuestas: filas,
      incluirRespuestas: true,
    });
  }

  /**
   * Devuelve un intento propio con sus respuestas. Si sigue en progreso, no
   * revela las respuestas correctas.
   *
   * @param {string} intentoId
   * @returns {Promise<object>}
   */
  async obtenerResultadoIntento(intentoId) {
    const intento = await this.obtenerIntento(intentoId);
    const cuestionario = await this.obtenerCuestionario(intento.cuestionario_id);
    const preguntas = await this.cuestionarioRepository.listarPreguntas(cuestionario.id);
    const respuestas = await this.cuestionarioRepository.listarRespuestas(
      this.usuarioActualId,
      intentoId,
    );

    return this.armarResultado({
      intento,
      cuestionario,
      preguntas,
      respuestas,
      incluirRespuestas: intento.estado === ESTADO_INTENTO_FINALIZADO,
    });
  }

  /**
   * @param {{
   *   intento: object,
   *   cuestionario: object,
   *   preguntas: Array<object>,
   *   respuestas: Array<object>,
   *   incluirRespuestas: boolean
   * }} datos
   * @returns {object}
   */
  armarResultado({ intento, cuestionario, preguntas, respuestas, incluirRespuestas }) {
    const respuestasPorPregunta = new Map(
      respuestas.map((respuesta) => [respuesta.pregunta_id, respuesta]),
    );

    return {
      intento: aIntento(intento),
      cuestionario: aCuestionarioResumen(cuestionario),
      preguntas: preguntas.map((pregunta) =>
        aPregunta(pregunta, {
          incluirRespuestas,
          respuestaUsuario: respuestasPorPregunta.get(pregunta.id) ?? null,
        }),
      ),
    };
  }

  /**
   * @param {string} documentoId
   * @param {string} materiaId
   * @returns {Promise<string>}
   */
  async obtenerMaterialDeDocumento(documentoId, materiaId) {
    const documento = await this.documentoRepository.obtenerDocumentoPorId(
      this.usuarioActualId,
      documentoId,
    );

    if (!documento || (documento.materia_id && documento.materia_id !== materiaId)) {
      throw ApiError.notFound('Documento no encontrado.');
    }

    if (documento.estado_procesamiento !== ESTADO_PROCESADO) {
      throw ApiError.unprocessable(
        'El documento todavia no esta procesado. Espera a que termine para generar el cuestionario.',
      );
    }

    const fragmentos = await this.fragmentoRepository.listarParaCuestionario(
      documentoId,
      MAXIMO_FRAGMENTOS,
    );

    return this.validarMaterial(armarTexto(fragmentos), 'El documento');
  }

  /**
   * @param {string} materiaId
   * @returns {Promise<string>}
   */
  async obtenerMaterialDeMateria(materiaId) {
    const fragmentos = await this.fragmentoRepository.listarPorMateriaParaCuestionario(
      materiaId,
      MAXIMO_FRAGMENTOS,
    );

    if (fragmentos.length === 0) {
      throw ApiError.unprocessable(
        'La materia no tiene documentos procesados. Sube un documento o selecciona otro.',
      );
    }

    return this.validarMaterial(armarTexto(fragmentos), 'La materia');
  }

  /**
   * @param {string} texto
   * @param {string} origen
   * @returns {string}
   */
  validarMaterial(texto, origen) {
    if (texto.trim().length < MINIMO_CARACTERES_CONTENIDO) {
      throw ApiError.unprocessable(
        `${origen} no tiene contenido suficiente para generar un cuestionario.`,
      );
    }

    return texto;
  }

  /**
   * @param {string} cuestionarioId
   * @returns {Promise<object>}
   */
  async obtenerCuestionario(cuestionarioId) {
    const cuestionario = await this.cuestionarioRepository.obtenerCuestionarioPorId(
      this.usuarioActualId,
      cuestionarioId,
    );

    if (!cuestionario) {
      throw ApiError.notFound('Cuestionario no encontrado.');
    }

    return cuestionario;
  }

  /**
   * @param {string} intentoId
   * @returns {Promise<object>}
   */
  async obtenerIntento(intentoId) {
    const intento = await this.cuestionarioRepository.obtenerIntentoPorId(
      this.usuarioActualId,
      intentoId,
    );

    if (!intento) {
      throw ApiError.notFound('Intento no encontrado.');
    }

    return intento;
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

    if (consumidos < LIMITE_DIARIO_CUESTIONARIOS) {
      return;
    }

    throw ApiError.rateLimited(
      'Alcanzaste el limite diario de cuestionarios. Vuelve a intentarlo mas tarde.',
      { code: 'AI_QUOTA_EXCEEDED', reinicio: finDelDia() },
    );
  }

  /**
   * @param {{ texto: string, cantidad: number, dificultad: string, tipos: string[] }} parametros
   * @returns {Promise<object>}
   */
  async generarConIa(parametros) {
    try {
      return await this.iaService.generarCuestionario(parametros);
    } catch (error) {
      if (error instanceof CuestionarioIaError) {
        throw ApiError.serviceUnavailable(error.message);
      }

      throw error;
    }
  }
}

module.exports = CuestionarioService;
module.exports.LIMITE_DIARIO_CUESTIONARIOS = LIMITE_DIARIO_CUESTIONARIOS;
module.exports.MAXIMO_FRAGMENTOS = MAXIMO_FRAGMENTOS;
module.exports.MAXIMO_CARACTERES_CONTENIDO = MAXIMO_CARACTERES_CONTENIDO;
module.exports.MINIMO_CARACTERES_CONTENIDO = MINIMO_CARACTERES_CONTENIDO;
module.exports.normalizarComparacion = normalizarComparacion;
module.exports.armarTexto = armarTexto;
