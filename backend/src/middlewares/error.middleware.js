/**
 * Manejo centralizado de errores y rutas no encontradas.
 */
const multer = require('multer');
const { ZodError } = require('zod');
const config = require('../config/environment');
const ApiError = require('../utils/ApiError');

function notFound(req, _res, next) {
  next(ApiError.notFound(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
}

function errorMiddleware(error, req, res, _next) {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Error interno del servidor.';
  let details = error.details;

  if (error instanceof ZodError) {
    statusCode = 400;
    message = 'Datos de entrada invalidos.';
    details = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
  }

  if (error instanceof multer.MulterError) {
    statusCode = 400;
    message =
      error.code === 'LIMIT_FILE_SIZE'
        ? `El archivo supera el tamano maximo permitido (${config.uploads.maxFileSizeBytes / (1024 * 1024)} MB).`
        : `Error al procesar el archivo: ${error.message}`;
  }

  if (error.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'El cuerpo de la solicitud no contiene un JSON valido.';
  }

  if (statusCode >= 500 && !config.isTest) {
    // eslint-disable-next-line no-console
    console.error('[MINGO] Error no controlado:', error);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(details ? { details } : {}),
      ...(config.isProd ? {} : { stack: error.stack }),
    },
  });
}

module.exports = { notFound, errorMiddleware };
