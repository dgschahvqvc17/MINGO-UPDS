/**
 * Generacion de embeddings para RAG (HU09).
 * Usa un proveedor externo compatible con la API de OpenAI.
 * Aplica lotes, valida dimensiones y distingue errores temporales de permanentes.
 */
const { OpenAI } = require('openai');
const config = require('../../config/environment');
const { ErrorProcesamiento, esErrorTemporal } = require('../procesamiento/procesamiento.error');

const TAMANO_LOTE = 64;
const DIMENSION_VECTOR = 1536;

/**
 * @param {{ apiKey: string, baseUrl?: string }} parametros
 * @returns {OpenAI | null}
 */
function crearCliente({ apiKey, baseUrl }) {
  if (!apiKey) {
    return null;
  }

  return new OpenAI({
    apiKey,
    ...(baseUrl ? { baseURL: baseUrl } : {}),
  });
}

/**
 * Traduce el error del proveedor a un mensaje seguro para `motivo_error`.
 *
 * @param {unknown} error
 * @returns {ErrorProcesamiento}
 */
function traducirError(error) {
  if (error instanceof ErrorProcesamiento) {
    return error;
  }

  const estado = error?.status ?? error?.response?.status ?? null;

  if (estado === 401 || estado === 403) {
    return ErrorProcesamiento.permanente('La clave del proveedor de IA no es valida.');
  }

  if (estado === 429) {
    return ErrorProcesamiento.temporal('El proveedor de IA alcanzo su limite de uso.');
  }

  if (estado === 400) {
    return ErrorProcesamiento.permanente('El proveedor de IA rechazo la solicitud de embeddings.');
  }

  if (esErrorTemporal(error)) {
    return ErrorProcesamiento.temporal('El proveedor de IA no respondio a tiempo.');
  }

  return ErrorProcesamiento.permanente('No se pudieron generar los embeddings del documento.');
}

class EmbeddingsService {
  /**
   * @param {{
   *   client?: object | null,
   *   model?: string,
   *   dimensiones?: number,
   *   apiKey?: string,
   *   baseUrl?: string
   * }} [dependencias]
   */
  constructor({
    client,
    model = config.ai.embeddingModel,
    dimensiones = config.ai.embeddingDimensions,
    apiKey = config.ai.apiKey,
    baseUrl = config.ai.baseUrl,
  } = {}) {
    this.client = client === undefined ? crearCliente({ apiKey, baseUrl }) : client;
    this.modelo = model;
    this.dimensiones = dimensiones;
  }

  /**
   * @returns {boolean}
   */
  estaDisponible() {
    return Boolean(this.client);
  }

  /**
   * Genera embeddings para una lista de textos, en lotes acotados.
   *
   * @param {string[]} textos
   * @returns {Promise<number[][]>}
   */
  async generarEmbeddings(textos) {
    if (!Array.isArray(textos) || textos.length === 0) {
      return [];
    }

    if (!this.estaDisponible()) {
      throw ErrorProcesamiento.permanente(
        'El servicio de IA no esta configurado. Falta AI_API_KEY en el servidor.',
      );
    }

    const embeddings = [];

    for (let inicio = 0; inicio < textos.length; inicio += TAMANO_LOTE) {
      const lote = textos.slice(inicio, inicio + TAMANO_LOTE);
      const vectores = await this.generarLote(lote);
      embeddings.push(...vectores);
    }

    return embeddings;
  }

  /**
   * @param {string[]} textos
   * @returns {Promise<number[][]>}
   */
  async generarLote(textos) {
    let respuesta;

    try {
      respuesta = await this.client.embeddings.create({
        model: this.modelo,
        input: textos,
        // Sin `dimensions` el proveedor devuelve la dimension nativa del modelo,
        // que puede no coincidir con la columna vector(n) de Supabase.
        dimensions: this.dimensiones,
        // El SDK pide base64 por defecto; no todos los proveedores compatibles
        // lo implementan y aqui hacen falta los numeros para pgvector.
        encoding_format: 'float',
      });
    } catch (error) {
      throw traducirError(error);
    }

    const datos = [...(respuesta?.data ?? [])].sort(
      (primero, segundo) => (primero.index ?? 0) - (segundo.index ?? 0),
    );

    if (datos.length !== textos.length) {
      throw ErrorProcesamiento.temporal(
        'El proveedor de IA devolvio una cantidad de embeddings inesperada.',
      );
    }

    return datos.map((dato) => this.validarVector(dato.embedding));
  }

  /**
   * @param {number[]} vector
   * @returns {number[]}
   */
  validarVector(vector) {
    if (!Array.isArray(vector) || vector.length !== this.dimensiones) {
      throw ErrorProcesamiento.permanente(
        `El modelo de embeddings devolvio ${vector?.length ?? 0} dimensiones y se esperaban ${this.dimensiones}.`,
      );
    }

    return vector;
  }
}

module.exports = EmbeddingsService;
module.exports.DIMENSION_VECTOR = DIMENSION_VECTOR;
module.exports.TAMANO_LOTE = TAMANO_LOTE;
