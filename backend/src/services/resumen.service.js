/**
 * Servicio de resumenes inteligentes (HU10).
 * Aplica las reglas de negocio: propiedad del documento, estado procesado,
 * cache por contenido, cuota diaria, limite de tokens y persistencia opcional.
 * No conoce req ni res.
 */
const { createHash } = require('crypto');
const ApiError = require('../utils/ApiError');
const { ResumenIaError } = require('./ia/resumen.ia.service');

const LIMITE_DIARIO_RESUMENES = 20;
const OPERACION = 'resumen';

/** 12000 tokens por documento a ~4 caracteres por token. */
const MAXIMO_CARACTERES_CONTENIDO = 48_000;
/** Tope de fragmentos leidos por resumen; evita consultas y prompts enormes. */
const MAXIMO_FRAGMENTOS = 50;
const MINIMO_CARACTERES_CONTENIDO = 40;

/**
 * Hash del contenido a partir de los hashes de los fragmentos, en orden.
 * Cambia cuando el documento se reprocesa y permite reutilizar el resumen.
 *
 * @param {Array<{ hash_contenido: string }>} fragmentos
 * @returns {string}
 */
function calcularHashContenido(fragmentos) {
  const hash = createHash('sha256');

  for (const fragmento of fragmentos) {
    hash.update(fragmento.hash_contenido);
    hash.update('\n');
  }

  return hash.digest('hex');
}

/**
 * Compone el texto del prompt respetando el presupuesto de caracteres.
 *
 * @param {Array<{ numero_pagina: number | null, contenido: string }>} fragmentos
 * @returns {{ texto: string, truncado: boolean }}
 */
function armarContenido(fragmentos) {
  const bloques = [];
  let longitud = 0;
  let truncado = false;

  for (const fragmento of fragmentos) {
    const pagina = fragmento.numero_pagina ? ` [Pagina ${fragmento.numero_pagina}]` : '';
    const encabezado = `Fragmento${pagina}:\n`;
    const espacioRestante = MAXIMO_CARACTERES_CONTENIDO - longitud - encabezado.length;

    if (espacioRestante <= 0) {
      truncado = true;
      break;
    }

    const contenidoFragmento = fragmento.contenido.slice(0, espacioRestante);
    bloques.push(`${encabezado}${contenidoFragmento}`);
    longitud += encabezado.length + contenidoFragmento.length;

    if (contenidoFragmento.length < fragmento.contenido.length) {
      truncado = true;
      break;
    }
  }

  return { texto: bloques.join('\n\n'), truncado };
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
  const fecha = new Date(inicioDelDia());
  fecha.setUTCDate(fecha.getUTCDate() + 1);
  return fecha.toISOString();
}

/**
 * @param {object} resumen Fila guardada o datos recien generados.
 * @param {{ documento: object, reutilizado?: boolean, guardado?: boolean }} opciones
 * @returns {object} Respuesta de la API.
 */
function aRespuesta(resumen, { documento, reutilizado = false, guardado = true }) {
  return {
    id: resumen.id ?? null,
    documento_id: resumen.documento_id ?? documento.id,
    documento_nombre: documento.nombre,
    profundidad: resumen.profundidad,
    resumen_general: resumen.resumen_general,
    temas_principales: resumen.temas_principales,
    conceptos_importantes: resumen.conceptos_importantes,
    modelo: resumen.modelo,
    tokens_entrada: resumen.tokens_entrada,
    tokens_salida: resumen.tokens_salida,
    contenido_truncado: Boolean(resumen.contenido_truncado),
    guardado,
    reutilizado,
    fecha_creacion: resumen.fecha_creacion ?? null,
  };
}

class ResumenService {
  /**
   * @param {{
   *   documentoRepository: object,
   *   fragmentoRepository: object,
   *   resumenRepository: object,
   *   consumoRepository: object,
   *   iaService: object,
   *   usuarioActualId: string
   * }} dependencias
   */
  constructor({
    documentoRepository,
    fragmentoRepository,
    resumenRepository,
    consumoRepository,
    iaService,
    usuarioActualId,
  }) {
    this.documentoRepository = documentoRepository;
    this.fragmentoRepository = fragmentoRepository;
    this.resumenRepository = resumenRepository;
    this.consumoRepository = consumoRepository;
    this.iaService = iaService;
    this.usuarioActualId = usuarioActualId;
  }

  /**
   * Genera (o reutiliza) el resumen de un documento propio y procesado.
   *
   * @param {{ documentoId: string, profundidad: string, guardar: boolean }} entrada
   * @returns {Promise<object>}
   */
  async generar({ documentoId, profundidad, guardar }) {
    const documento = await this.obtenerDocumento(documentoId);

    if (documento.estado_procesamiento !== 'procesado') {
      throw ApiError.unprocessable(
        'El documento todavia no esta procesado. Espera a que termine para generar el resumen.',
      );
    }

    const fragmentos = await this.fragmentoRepository.listarParaResumen(
      documentoId,
      MAXIMO_FRAGMENTOS,
    );

    if (fragmentos.length === 0) {
      throw ApiError.unprocessable(
        'El documento no tiene contenido procesado para generar el resumen.',
      );
    }

    const hashContenido = calcularHashContenido(fragmentos);
    const cache = await this.resumenRepository.obtenerPorClave(
      this.usuarioActualId,
      documentoId,
      hashContenido,
      profundidad,
    );

    if (cache) {
      return aRespuesta(cache, { documento, reutilizado: true });
    }

    await this.verificarCuota();

    const { texto, truncado } = armarContenido(fragmentos);
    if (texto.trim().length < MINIMO_CARACTERES_CONTENIDO) {
      throw ApiError.unprocessable(
        'El documento no tiene texto suficiente para generar un resumen.',
      );
    }

    const generado = await this.generarConIa({ texto, profundidad });

    await this.consumoRepository.registrar({
      usuario_id: this.usuarioActualId,
      operacion: OPERACION,
      modelo: generado.modelo,
      tokens_entrada: generado.tokensEntrada,
      tokens_salida: generado.tokensSalida,
    });

    const datos = {
      usuario_id: this.usuarioActualId,
      documento_id: documentoId,
      profundidad,
      hash_contenido: hashContenido,
      resumen_general: generado.contenido.resumen_general,
      temas_principales: generado.contenido.temas_principales,
      conceptos_importantes: generado.contenido.conceptos_importantes,
      modelo: generado.modelo,
      tokens_entrada: generado.tokensEntrada,
      tokens_salida: generado.tokensSalida,
      contenido_truncado: truncado,
    };

    const guardado = guardar ? await this.resumenRepository.guardar(datos) : null;

    return aRespuesta(guardado ?? datos, { documento, guardado: Boolean(guardado) });
  }

  /**
   * Recupera el ultimo resumen guardado de un documento propio.
   * Un documento sin resumen devuelve null para que la UI muestre un estado vacio.
   *
   * @param {string} documentoId
   * @returns {Promise<object | null>}
   */
  async obtenerGuardado(documentoId) {
    const documento = await this.obtenerDocumento(documentoId);
    const resumen = await this.resumenRepository.obtenerUltimo(
      this.usuarioActualId,
      documentoId,
    );

    return resumen ? aRespuesta(resumen, { documento }) : null;
  }

  /**
   * @param {string} documentoId
   * @returns {Promise<object>}
   */
  async obtenerDocumento(documentoId) {
    const documento = await this.documentoRepository.obtenerDocumentoPorId(
      this.usuarioActualId,
      documentoId,
    );

    if (!documento) {
      throw ApiError.notFound('Documento no encontrado.');
    }

    return documento;
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

    if (consumidos < LIMITE_DIARIO_RESUMENES) {
      return;
    }

    throw ApiError.rateLimited(
      'Alcanzaste el limite diario de resumenes. Vuelve a intentarlo mas tarde.',
      { code: 'AI_QUOTA_EXCEEDED', reinicio: finDelDia() },
    );
  }

  /**
   * @param {{ texto: string, profundidad: string }} parametros
   * @returns {Promise<object>}
   */
  async generarConIa(parametros) {
    try {
      return await this.iaService.generarResumen(parametros);
    } catch (error) {
      if (error instanceof ResumenIaError) {
        throw ApiError.serviceUnavailable(error.message);
      }

      throw error;
    }
  }
}

module.exports = ResumenService;
module.exports.LIMITE_DIARIO_RESUMENES = LIMITE_DIARIO_RESUMENES;
module.exports.MAXIMO_CARACTERES_CONTENIDO = MAXIMO_CARACTERES_CONTENIDO;
module.exports.MAXIMO_FRAGMENTOS = MAXIMO_FRAGMENTOS;
