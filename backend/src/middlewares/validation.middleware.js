/**
 * Validacion de solicitudes con Zod.
 *
 * Uso:
 *   router.post('/', validate({ body: crearTareaSchema }), controller);
 *
 * Los datos validados se guardan en req.validated para que los controladores
 * no dependan de datos sin sanitizar.
 */
const ApiError = require('../utils/ApiError');

/**
 * @param {{ body?: import('zod').ZodTypeAny, params?: import('zod').ZodTypeAny, query?: import('zod').ZodTypeAny }} schemas
 */
function validate(schemas = {}) {
  return (req, _res, next) => {
    try {
      const validated = {};

      for (const [source, schema] of Object.entries(schemas)) {
        const result = schema.safeParse(req[source]);

        if (!result.success) {
          return next(
            ApiError.badRequest('Datos de entrada invalidos.', {
              source,
              issues: result.error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
              })),
            }),
          );
        }

        validated[source] = result.data;
      }

      req.validated = validated;
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = validate;
