/**
 * Servicio del chat academico con RAG (HU12).
 * Orquesta intencion, recuperacion de fragmentos propios, prompt, persistencia
 * y cuota. No conoce req ni res y nunca usa service_role para datos privados.
 */
const config = require('../config/environment');
const ApiError = require('../utils/ApiError');
const {
  ErrorProcesamiento,
} = require('./procesamiento/procesamiento.error');
const { AgenteIaError } = require('./ia/agente.service');
const { UMBRAL_SIMILITUD } = require('./busqueda.service');
const { TOP_K_BUSQUEDA } = require('../models/documento.model');

const OPERACION = 'chat';
const LIMITE_CHAT_POR_HORA = 30;
const LIMITE_CHAT_POR_DIA = 200;

/** Aproximacion de tokens para texto en espanol, alineada con HU11. */
const CARACTERES_POR_TOKEN = 4;
const MAXIMO_TOKENS_CONTEXTO = 6000;
const MAXIMO_CARACTERES_FRAGMENTO = MAXIMO_TOKENS_CONTEXTO * CARACTERES_POR_TOKEN;
const MAXIMO_CARACTERES_EXTRACTO = 300;
const MAXIMO_CARACTERES_TITULO = 60;

/** Mapa entre el valor almacenado y el contrato frontend. */
const ROLES_RESPUESTA = Object.freeze({
  usuario: 'user',
  asistente: 'assistant',
  sistema: 'system',
});

const MENSAJE_SIN_INFORMACION = [
  'No encontre informacion suficiente en tus documentos para responder esa pregunta.',
  'Prueba con otros terminos, selecciona otra materia o desactiva el filtro de documentos para usar conocimiento general.',
].join(' ');

/**
 * @returns {string} Inicio de la hora en UTC, en formato ISO 8601.
 */
function inicioDeLaHora() {
  const fecha = new Date();
  fecha.setUTCMinutes(0, 0, 0);
  return fecha.toISOString();
}

/**
 * @returns {string} Fin de la hora en UTC, en formato ISO 8601.
 */
function finDeLaHora() {
  return new Date(Date.parse(inicioDeLaHora()) + 3_600_000).toISOString();
}

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
 * @param {string} texto
 * @returns {number}
 */
function calcularTokens(texto) {
  return Math.max(1, Math.ceil(texto.length / CARACTERES_POR_TOKEN));
}

/**
 * @param {string} rolAlmacenado
 * @returns {string}
 */
function aRolRespuesta(rolAlmacenado) {
  return ROLES_RESPUESTA[rolAlmacenado] ?? 'user';
}

/**
 * @param {object} referencia
 * @returns {object}
 */
function aReferencia(referencia) {
  return {
    documento_id: referencia.documento_id,
    documento_nombre: referencia.documento_nombre,
    fragmento_id: referencia.fragmento_id,
    numero_pagina: referencia.numero_pagina ?? null,
    extracto: referencia.extracto,
  };
}

/**
 * @param {object} mensaje
 * @returns {object}
 */
function aMensaje(mensaje) {
  return {
    id: mensaje.id,
    conversacion_id: mensaje.conversacion_id,
    rol_mensaje: aRolRespuesta(mensaje.rol_mensaje),
    contenido: mensaje.contenido,
    modelo_utilizado: mensaje.modelo_utilizado ?? null,
    fecha_creacion: mensaje.fecha_creacion,
    referencias: (mensaje.referencias ?? []).map(aReferencia),
  };
}

/**
 * @param {string} mensaje
 * @returns {string}
 */
function crearTitulo(mensaje) {
  const unaLinea = mensaje.replace(/\s+/g, ' ').trim();
  return unaLinea.length > MAXIMO_CARACTERES_TITULO
    ? `${unaLinea.slice(0, MAXIMO_CARACTERES_TITULO)}…`
    : unaLinea;
}

/**
 * Deduplica, ordena por similitud y acota el contexto al presupuesto de tokens.
 *
 * @param {object[]} filas
 * @returns {object[]}
 */
function seleccionarFragmentos(filas) {
  const vistos = new Set();

  const unicos = filas
    .filter((fila) => {
      const clave = fila.id ?? fila.contenido?.trim();
      if (!clave || vistos.has(clave)) {
        return false;
      }

      vistos.add(clave);
      return true;
    })
    .sort((primero, segundo) => Number(segundo.similitud) - Number(primero.similitud));

  const seleccionados = [];
  let tokens = 0;

  for (const fila of unicos) {
    if (seleccionados.length >= TOP_K_BUSQUEDA) {
      break;
    }

    const contenido = String(fila.contenido ?? '').slice(0, MAXIMO_CARACTERES_FRAGMENTO);
    const estimados = calcularTokens(contenido);

    if (tokens + estimados > MAXIMO_TOKENS_CONTEXTO) {
      continue;
    }

    seleccionados.push({
      fragmento_id: fila.id,
      documento_id: fila.documento_id,
      documento_nombre: fila.documento_nombre,
      numero_pagina: fila.numero_pagina ?? null,
      contenido,
    });
    tokens += estimados;
  }

  return seleccionados;
}

class ChatService {
  /**
   * @param {{
   *   conversacionRepository: object,
   *   documentoRepository: object,
   *   materiaRepository: object,
   *   fragmentoRepository: object,
   *   consumoRepository: object,
   *   embeddingsService: object,
   *   agenteIaService: object,
   *   usuarioActualId: string
   * }} dependencias
   */
  constructor({
    conversacionRepository,
    documentoRepository,
    materiaRepository,
    fragmentoRepository,
    consumoRepository,
    embeddingsService,
    agenteIaService,
    usuarioActualId,
  }) {
    this.conversacionRepository = conversacionRepository;
    this.documentoRepository = documentoRepository;
    this.materiaRepository = materiaRepository;
    this.fragmentoRepository = fragmentoRepository;
    this.consumoRepository = consumoRepository;
    this.embeddingsService = embeddingsService;
    this.agenteIaService = agenteIaService;
    this.usuarioActualId = usuarioActualId;
  }

  /**
   * Envia un mensaje y devuelve la respuesta del asistente con sus citas.
   *
   * @param {{
   *   conversacionId?: string | null,
   *   mensaje: string,
   *   materiaId?: string | null,
   *   documentoIds?: string[],
   *   usarDocumentos?: boolean
   * }} entrada
   * @returns {Promise<object>}
   */
  async enviar({
    conversacionId = null,
    mensaje,
    materiaId = null,
    documentoIds = [],
    usarDocumentos = true,
  }) {
    const conversacion = conversacionId
      ? await this.obtenerOMostrar404(conversacionId)
      : null;

    await this.verificarPropiedad(materiaId, documentoIds);
    await this.verificarCuota();

    const historial = conversacion
      ? await this.conversacionRepository.obtenerHistorialReciente(conversacion.id)
      : [];

    const fragmentos = usarDocumentos
      ? await this.recuperarFragmentos({ pregunta: mensaje, materiaId, documentoIds })
      : [];

    const intencion = !usarDocumentos
      ? 'general'
      : fragmentos.length > 0
        ? 'documental'
        : 'sin_informacion';

    const generado = intencion === 'sin_informacion'
      ? null
      : await this.generarRespuesta({
        pregunta: mensaje,
        fragmentos,
        historial,
      });

    const conversacionFinal = conversacion ?? await this.crearConversacion(mensaje);
    const respuesta = generado?.respuesta ?? MENSAJE_SIN_INFORMACION;
    const mensajes = await this.conversacionRepository.guardarMensajes([
      {
        conversacion_id: conversacionFinal.id,
        rol_mensaje: 'usuario',
        contenido: mensaje,
        intencion,
      },
      {
        conversacion_id: conversacionFinal.id,
        rol_mensaje: 'asistente',
        contenido: respuesta,
        modelo_utilizado: generado?.modelo ?? null,
        intencion,
      },
    ]);

    const mensajeAsistente = mensajes.find((item) => item.rol_mensaje === 'asistente');

    const referencias = await this.guardarReferencias(
      mensajeAsistente.id,
      intencion === 'documental' ? fragmentos : [],
    );

    await this.consumoRepository.registrar({
      usuario_id: this.usuarioActualId,
      operacion: OPERACION,
      modelo: generado?.modelo ?? config.ai.embeddingModel,
      tokens_entrada: generado?.tokensEntrada ?? 0,
      tokens_salida: generado?.tokensSalida ?? 0,
    });

    return {
      conversacion_id: conversacionFinal.id,
      mensaje_id: mensajeAsistente.id,
      respuesta,
      modelo: generado?.modelo ?? null,
      referencias: referencias.map(aReferencia),
      consumo: {
        tokens_entrada: generado?.tokensEntrada ?? 0,
        tokens_salida: generado?.tokensSalida ?? 0,
      },
    };
  }

  /**
   * Lista las conversaciones propias, mas recientes primero.
   *
   * @param {{ limite: number, desplazamiento: number }} paginacion
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listar({ limite, desplazamiento }) {
    const { items, total } = await this.conversacionRepository.listar(
      this.usuarioActualId,
      { limite, desplazamiento },
    );

    return { items, total };
  }

  /**
   * Devuelve una conversacion propia con su historial ordenado.
   *
   * @param {string} conversacionId
   * @returns {Promise<object>}
   */
  async obtener(conversacionId) {
    const conversacion = await this.obtenerOMostrar404(conversacionId);
    const mensajes = await this.conversacionRepository.obtenerMensajes(conversacion.id);

    return { ...conversacion, mensajes: mensajes.map(aMensaje) };
  }

  /**
   * @param {string} conversacionId
   * @returns {Promise<void>}
   */
  async eliminar(conversacionId) {
    const eliminada = await this.conversacionRepository.eliminar(
      this.usuarioActualId,
      conversacionId,
    );

    if (!eliminada) {
      throw ApiError.notFound('Conversacion no encontrada.');
    }
  }

  /**
   * @param {string} conversacionId
   * @returns {Promise<object>}
   */
  async obtenerOMostrar404(conversacionId) {
    const conversacion = await this.conversacionRepository.obtenerPorId(
      this.usuarioActualId,
      conversacionId,
    );

    if (!conversacion) {
      throw ApiError.notFound('Conversacion no encontrada.');
    }

    return conversacion;
  }

  /**
   * @param {string} mensaje
   * @returns {Promise<object>}
   */
  async crearConversacion(mensaje) {
    return this.conversacionRepository.crear(this.usuarioActualId, {
      titulo: crearTitulo(mensaje),
      tipo: 'academica',
    });
  }

  /**
   * Una materia o documento ajeno se trata como inexistente para no filtrar
   * su existencia.
   *
   * @param {string | null} materiaId
   * @param {string[]} documentoIds
   * @returns {Promise<void>}
   */
  async verificarPropiedad(materiaId, documentoIds) {
    if (materiaId) {
      const materia = await this.materiaRepository.obtenerMateriaPorId(
        this.usuarioActualId,
        materiaId,
      );

      if (!materia) {
        throw ApiError.notFound('Materia no encontrada.');
      }
    }

    for (const documentoId of documentoIds) {
      const documento = await this.documentoRepository.obtenerDocumentoPorId(
        this.usuarioActualId,
        documentoId,
      );

      if (!documento) {
        throw ApiError.notFound('Documento no encontrado.');
      }

      if (documento.estado_procesamiento !== 'procesado') {
        throw ApiError.unprocessable(
          'Uno de los documentos seleccionados todavia no esta procesado.',
        );
      }
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async verificarCuota() {
    const porHora = await this.consumoRepository.contar(
      this.usuarioActualId,
      OPERACION,
      inicioDeLaHora(),
    );

    if (porHora >= LIMITE_CHAT_POR_HORA) {
      throw ApiError.rateLimited(
        'Alcanzaste el limite de mensajes del asistente por hora. Vuelve a intentarlo mas tarde.',
        { code: 'AI_QUOTA_EXCEEDED', reinicio: finDeLaHora() },
      );
    }

    const porDia = await this.consumoRepository.contar(
      this.usuarioActualId,
      OPERACION,
      inicioDelDia(),
    );

    if (porDia >= LIMITE_CHAT_POR_DIA) {
      throw ApiError.rateLimited(
        'Alcanzaste el limite diario de mensajes del asistente. Vuelve manana.',
        { code: 'AI_QUOTA_EXCEEDED', reinicio: finDelDia() },
      );
    }
  }

  /**
   * Genera el embedding una sola vez y recupera fragmentos de los documentos
   * seleccionados o, en su defecto, de todos los documentos permitidos.
   *
   * @param {{ pregunta: string, materiaId: string | null, documentoIds: string[] }} entrada
   * @returns {Promise<object[]>}
   */
  async recuperarFragmentos({ pregunta, materiaId, documentoIds }) {
    let embedding;

    try {
      const vectores = await this.embeddingsService.generarEmbeddings([pregunta]);
      embedding = vectores[0];
    } catch (error) {
      if (error instanceof ErrorProcesamiento) {
        throw ApiError.serviceUnavailable(error.message);
      }

      throw error;
    }

    const objetivos = documentoIds.length > 0
      ? documentoIds.map((documentoId) => ({ documentoId, materiaId: null }))
      : [{ documentoId: null, materiaId }];

    const lotes = await Promise.all(
      objetivos.map((objetivo) => this.fragmentoRepository.buscarSimilares(embedding, {
        limite: TOP_K_BUSQUEDA,
        umbral: UMBRAL_SIMILITUD,
        ...objetivo,
      })),
    );

    return seleccionarFragmentos(lotes.flat());
  }

  /**
   * @param {{ pregunta: string, fragmentos: object[], historial: object[] }} entrada
   * @returns {Promise<object>}
   */
  async generarRespuesta({ pregunta, fragmentos, historial }) {
    const contexto = fragmentos.map((fragmento) => ({
      documento_nombre: fragmento.documento_nombre,
      numero_pagina: fragmento.numero_pagina,
      contenido: fragmento.contenido,
    }));

    try {
      return await this.agenteIaService.responder({
        pregunta,
        contexto,
        historial,
      });
    } catch (error) {
      if (error instanceof AgenteIaError) {
        throw ApiError.serviceUnavailable(error.message);
      }

      throw error;
    }
  }

  /**
   * @param {string} mensajeId
   * @param {object[]} fragmentos
   * @returns {Promise<object[]>}
   */
  async guardarReferencias(mensajeId, fragmentos) {
    return this.conversacionRepository.guardarReferencias(
      fragmentos.map((fragmento) => ({
        mensaje_id: mensajeId,
        fragmento_id: fragmento.fragmento_id,
        documento_id: fragmento.documento_id,
        documento_nombre: fragmento.documento_nombre,
        numero_pagina: fragmento.numero_pagina,
        extracto: fragmento.contenido.slice(0, MAXIMO_CARACTERES_EXTRACTO),
      })),
    );
  }
}

module.exports = ChatService;
module.exports.LIMITE_CHAT_POR_HORA = LIMITE_CHAT_POR_HORA;
module.exports.LIMITE_CHAT_POR_DIA = LIMITE_CHAT_POR_DIA;
module.exports.UMBRAL_SIMILITUD = UMBRAL_SIMILITUD;
module.exports.MENSAJE_SIN_INFORMACION = MENSAJE_SIN_INFORMACION;
module.exports.crearTitulo = crearTitulo;
module.exports.seleccionarFragmentos = seleccionarFragmentos;
