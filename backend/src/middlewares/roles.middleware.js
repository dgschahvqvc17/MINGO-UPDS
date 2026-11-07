/**
 * Control de acceso basado en roles.
 *
 * Uso:
 *   router.get('/admin', authMiddleware, requireRole('administrador'), controller);
 */
const ApiError = require('../utils/ApiError');

/**
 * @param {...string} allowedRoles Roles autorizados.
 */
function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('No tiene permisos para realizar esta operacion.'));
    }

    return next();
  };
}

module.exports = { requireRole };
