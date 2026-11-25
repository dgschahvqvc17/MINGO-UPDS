/**
 * Control de acceso basado en roles.
 *
 * Uso:
 *   router.get('/admin', authMiddleware, requireRole('administrador'), controller);
 */
const ApiError = require('../utils/ApiError');

/**
 * Verifica que el usuario autenticado tenga al menos uno de los roles dados.
 * Debe usarse después de authMiddleware.
 *
 * @param {...string} allowedRoles Roles autorizados.
 */
function requireRole(...allowedRoles) {
  const rolesPermitidos = new Set(allowedRoles);

  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Usuario no autenticado.'));
    }

    const rolesUsuario = Array.isArray(req.user.roles)
      ? req.user.roles
      : [req.user.role].filter(Boolean);

    if (!rolesUsuario.some((rol) => rolesPermitidos.has(rol))) {
      return next(ApiError.forbidden('No tienes permiso para realizar esta acción.'));
    }

    return next();
  };
}

module.exports = { requireRole };
