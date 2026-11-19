/**
 * Validacion de la cabecera Idempotency-Key (HU12).
 * La cabecera es opcional; si viene, se valida y queda en req.idempotencyKey
 * para que el controlador la entregue al servicio.
 */
const { z } = require('zod');
const ApiError = require('../utils/ApiError');

const MINIMO_CARACTERES_CLAVE = 8;
const MAXIMO_CARACTERES_CLAVE = 100;
const PATRON_CLAVE = /^[A-Za-z0-9._:-]+$/;

const idempotencyKeySchema = z
  .string()
  .trim()
  .min(
    MINIMO_CARACTERES_CLAVE,
    `La cabecera Idempotency-Key debe tener al menos ${MINIMO_CARACTERES_CLAVE} caracteres`,
  )
  .max(
    MAXIMO_CARACTERES_CLAVE,
    `La cabecera Idempotency-Key no puede superar ${MAXIMO_CARACTERES_CLAVE} caracteres`,
  )
  .regex(
    PATRON_CLAVE,
    'La cabecera Idempotency-Key solo admite letras, numeros y los signos . _ : -',
  );

/**
 * @type {import('express').RequestHandler}
 */
function idempotencyMiddleware(req, _res, next) {
  const valor = req.get('Idempotency-Key');

  if (!valor) {
    next();
    return;
  }

  const resultado = idempotencyKeySchema.safeParse(valor);

  if (!resultado.success) {
    next(
      ApiError.badRequest('La cabecera Idempotency-Key no es valida.', {
        source: 'headers',
        issues: resultado.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }),
    );
    return;
  }

  req.idempotencyKey = resultado.data;
  next();
}

module.exports = idempotencyMiddleware;
module.exports.idempotencyKeySchema = idempotencyKeySchema;
module.exports.MINIMO_CARACTERES_CLAVE = MINIMO_CARACTERES_CLAVE;
module.exports.MAXIMO_CARACTERES_CLAVE = MAXIMO_CARACTERES_CLAVE;
