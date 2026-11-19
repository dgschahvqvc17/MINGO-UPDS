/**
 * Error de dominio del procesamiento de documentos (HU09).
 * Distingue fallos permanentes (no reintentar) de temporales (SQS reintenta).
 */
const LARGO_MAXIMO_MENSAJE = 300;

/**
 * @param {unknown} error
 * @returns {string}
 */
function normalizarMensaje(error) {
  const mensaje =
    error && typeof error === 'object' && 'message' in error
      ? String(error.message)
      : String(error ?? '');

  const limpio = mensaje.replace(/\s+/g, ' ').trim();
  return limpio.length > LARGO_MAXIMO_MENSAJE
    ? `${limpio.slice(0, LARGO_MAXIMO_MENSAJE)}...`
    : limpio;
}

/**
 * @param {unknown} error
 * @returns {number | null}
 */
function obtenerEstadoHttp(error) {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const candidatos = [
    error.status,
    error.statusCode,
    error.response?.status,
    error.$metadata?.httpStatusCode,
  ];

  const estado = candidatos.find((valor) => Number.isInteger(valor));
  return estado ?? null;
}

/**
 * Un error es temporal cuando depende de red, cuota o del proveedor externo.
 *
 * @param {unknown} error
 * @returns {boolean}
 */
function esErrorTemporal(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const estado = obtenerEstadoHttp(error);
  if (estado !== null && (estado === 408 || estado === 425 || estado === 429 || estado >= 500)) {
    return true;
  }

  const codigosTemporales = new Set([
    'ECONNABORTED',
    'ECONNREFUSED',
    'ECONNRESET',
    'EAI_AGAIN',
    'ENETUNREACH',
    'ENOTFOUND',
    'ETIMEDOUT',
    'TimeoutError',
    'AbortError',
  ]);

  return codigosTemporales.has(error.code) || codigosTemporales.has(error.name);
}

class ErrorProcesamiento extends Error {
  /**
   * @param {string} mensaje Mensaje apto para guardar en `motivo_error`.
   * @param {{ permanente?: boolean }} opciones
   */
  constructor(mensaje, { permanente = true } = {}) {
    super(normalizarMensaje(mensaje) || 'Error al procesar el documento.');
    this.name = 'ErrorProcesamiento';
    this.permanente = permanente;
  }

  static permanente(mensaje) {
    return new ErrorProcesamiento(mensaje, { permanente: true });
  }

  static temporal(mensaje) {
    return new ErrorProcesamiento(mensaje, { permanente: false });
  }

  /**
   * Traduce cualquier error al dominio del procesamiento.
   * Nunca conserva el stack ni el mensaje crudo del SDK en la base de datos.
   *
   * @param {unknown} error
   * @param {string} [mensajePorDefecto]
   * @returns {ErrorProcesamiento}
   */
  static desde(error, mensajePorDefecto = 'No se pudo procesar el documento.') {
    if (error instanceof ErrorProcesamiento) {
      return error;
    }

    const mensaje = normalizarMensaje(error) || mensajePorDefecto;
    return esErrorTemporal(error)
      ? ErrorProcesamiento.temporal(mensaje)
      : ErrorProcesamiento.permanente(mensaje);
  }
}

module.exports = {
  ErrorProcesamiento,
  esErrorTemporal,
  normalizarMensaje,
  obtenerEstadoHttp,
};
