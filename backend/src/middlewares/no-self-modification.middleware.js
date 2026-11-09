/**
 * Middleware para prevenir que un usuario modifique sus propios privilegios.
 * Compara el ID del usuario autenticado con el ID del usuario a modificar.
 */
const ApiError = require('../utils/ApiError');

function noSelfModificationMiddleware(req, _res, next) {
  try {
    const usuarioActualId = req.user?.id;
    const usuarioModificadoId = req.params?.id;

    if (!usuarioActualId || !usuarioModificadoId) {
      return next(); // Si falta información, dejar que otros middlewares manejen la validación
    }

    // Comparar IDs para prevenir auto-modificación
    if (usuarioActualId === usuarioModificadoId) {
      throw ApiError.forbidden('No puedes modificar tus propios privilegios');
    }

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = noSelfModificationMiddleware;