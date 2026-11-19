/**
 * Servicio de busqueda semantica (HU11).
 * Genera un embedding de la consulta, recupera fragmentos propios con pgvector
 * y aplica cuota diaria. No conoce req ni res y no llama al modelo de chat.
 */
const config = require('../config/environment');
const { TOP_K_BUSQUEDA } = require('../models/documento.model');
const { ErrorProcesamiento } = require('./procesamiento/procesamiento.error');
const ApiError = require('../utils/ApiError');

const OPERACION = 'busqueda';
const LIMITE_DIARIO_BUSQUEDAS = 50;
const UMBRAL_SIMILITUD = 0.70;
const MENSAJE_SIN_RESULTADOS =
  'No encontramos fragmentos relacionados con tu consulta. Prueba con otros términos o revisa tus documentos procesados.';

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
  const fecha = new Date(inicioDelDia());
  fecha.setUTCDate(fecha.getUTCDate() + 1);
  return fecha.toISOString();
}

/**
 * Aproximacion estandar de tokens para texto en español.
 *
 * @param {string} consulta
 * @returns {number}
 */
function calcularTokens(consulta) {
  return Math.max(1, Math.ceil(consulta.length / 4));
}

/**
 * @param {object} fila Fila devuelta por la funcion RPC.
 * @returns {object} Fragmento con el contrato de la API.
 */
function aResultado(fila) {
  return {
    fragmento_id: fila.id,
    documento_id: fila.documento_id,
    documento_nombre: fila.documento_nombre,
    contenido: fila.contenido,
    numero_pagina: fila.numero_pagina ?? null,
    similitud: Number(fila.similitud),
  };
}

class BusquedaService {
  /**
   * @param {{
   *   embeddingsService: object,
   *   fragmentoRepository: object,
   *   documentoRepository: object,
   *   materiaRepository: object,
   *   consumoRepository: object,
   *   usuarioActualId: string
   * }} dependencias
   */
  constructor({
    embeddingsService,
    fragmentoRepository,
    documentoRepository,
    materiaRepository,
    consumoRepository,
    usuarioActualId,
  }) {
    this.embeddingsService = embeddingsService;
    this.fragmentoRepository = fragmentoRepository;
    this.documentoRepository = documentoRepository;
    this.materiaRepository = materiaRepository;
    this.consumoRepository = consumoRepository;
    this.usuarioActualId = usuarioActualId;
  }

  /**
   * Busca fragmentos relacionados con la consulta entre los documentos propios.
   *
   * @param {{ consulta: string, documentoId?: string | null, materiaId?: string | null, limite?: number }} entrada
   * @returns {Promise<{ resultados: object[], mensaje: string | null }>}
   */
  async buscar({
    consulta,
    documentoId = null,
    materiaId = null,
    limite = TOP_K_BUSQUEDA,
  }) {
    await this.verificarPropiedad(documentoId, materiaId);
    await this.verificarCuota();

    const embedding = await this.generarEmbedding(consulta);

    await this.consumoRepository.registrar({
      usuario_id: this.usuarioActualId,
      operacion: OPERACION,
      modelo: config.ai.embeddingModel,
      tokens_entrada: calcularTokens(consulta),
      tokens_salida: 0,
    });

    const filas = await this.fragmentoRepository.buscarSimilares(embedding, {
      limite,
      umbral: UMBRAL_SIMILITUD,
      documentoId,
      materiaId,
    });

    const resultados = filas.map(aResultado);

    return {
      resultados,
      mensaje: resultados.length === 0 ? MENSAJE_SIN_RESULTADOS : null,
    };
  }

  /**
   * Un documento o materia ajena se trata como inexistente para no filtrar su existencia.
   *
   * @param {string | null} documentoId
   * @param {string | null} materiaId
   * @returns {Promise<void>}
   */
  async verificarPropiedad(documentoId, materiaId) {
    if (documentoId) {
      const documento = await this.documentoRepository.obtenerDocumentoPorId(
        this.usuarioActualId,
        documentoId,
      );

      if (!documento) {
        throw ApiError.notFound('Documento no encontrado.');
      }

      if (documento.estado_procesamiento !== 'procesado') {
        throw ApiError.unprocessable(
          'El documento todavia no esta procesado. Espera a que termine para buscar en el.',
        );
      }
    }

    if (materiaId) {
      const materia = await this.materiaRepository.obtenerMateriaPorId(
        this.usuarioActualId,
        materiaId,
      );

      if (!materia) {
        throw ApiError.notFound('Materia no encontrada.');
      }
    }
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

    if (consumidos < LIMITE_DIARIO_BUSQUEDAS) {
      return;
    }

    throw ApiError.rateLimited(
      'Alcanzaste el limite diario de busquedas inteligentes. Vuelve a intentarlo mas tarde.',
      { code: 'AI_QUOTA_EXCEEDED', reinicio: finDelDia() },
    );
  }

  /**
   * @param {string} consulta
   * @returns {Promise<number[]>}
   */
  async generarEmbedding(consulta) {
    try {
      const vectores = await this.embeddingsService.generarEmbeddings([consulta]);
      return vectores[0];
    } catch (error) {
      if (error instanceof ErrorProcesamiento) {
        throw ApiError.serviceUnavailable(error.message);
      }

      throw error;
    }
  }
}

module.exports = BusquedaService;
module.exports.LIMITE_DIARIO_BUSQUEDAS = LIMITE_DIARIO_BUSQUEDAS;
module.exports.UMBRAL_SIMILITUD = UMBRAL_SIMILITUD;
module.exports.MENSAJE_SIN_RESULTADOS = MENSAJE_SIN_RESULTADOS;
