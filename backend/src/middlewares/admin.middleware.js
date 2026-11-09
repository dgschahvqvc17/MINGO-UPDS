/**
 * Middleware para verificar que el usuario autenticado es administrador.
 * Se debe usar después de authMiddleware.
 */
const ApiError = require('../utils/ApiError');

function adminMiddleware(req, _res, next) {
  try {
    // authMiddleware ya adjuntó req.user
    if (!req.user) {
      throw ApiError.unauthorized('Usuario no autenticado');
    }

    // Verificar que el usuario tenga rol de administrador
    const esAdministrador = req.user.role === 'administrador';
    
    if (!esAdministrador) {
      throw ApiError.forbidden('Acceso denegado. Se requiere rol de administrador');
    }

    // El usuario es administrador, continuar
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = adminMiddleware;