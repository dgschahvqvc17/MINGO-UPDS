/**
 * Error de aplicacion con codigo HTTP.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode Codigo HTTP.
   * @param {string} message Mensaje legible.
   * @param {unknown} [details] Detalle adicional (por ejemplo errores de validacion).
   */
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Solicitud invalida', details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'No autenticado') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'No autorizado') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Recurso no encontrado') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflicto con el estado actual del recurso') {
    return new ApiError(409, message);
  }

  static serviceUnavailable(message = 'Servicio no disponible') {
    return new ApiError(503, message);
  }
}

module.exports = ApiError;
