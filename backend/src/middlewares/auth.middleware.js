/**
 * Verifica el token JWT emitido por Supabase Auth.
 * Adjunta el usuario autenticado en req.user.
 */
const config = require('../config/environment');
const { supabaseAdmin } = require('../config/supabase');
const ApiError = require('../utils/ApiError');

async function authMiddleware(req, _res, next) {
  try {
    const header = req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Se requiere un token Bearer.');
    }

    const token = header.slice('Bearer '.length).trim();

    if (!token) {
      throw ApiError.unauthorized('El token de acceso esta vacio.');
    }

    if (!config.supabase.isConfigured) {
      throw ApiError.serviceUnavailable('Supabase Auth no esta configurado en el servidor.');
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      throw ApiError.unauthorized('Token invalido o expirado.');
    }

    const user = data.user;

    req.user = {
      id: user.id,
      email: user.email,
      role: user.app_metadata?.role || user.user_metadata?.role || 'estudiante',
      appMetadata: user.app_metadata || {},
      userMetadata: user.user_metadata || {},
    };
    req.accessToken = token;

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = authMiddleware;
