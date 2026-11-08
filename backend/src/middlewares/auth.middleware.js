/**
 * Verifica el token JWT emitido por Supabase Auth.
 * Adjunta el usuario autenticado en req.user.
 */
const config = require('../config/environment');
const { createSupabaseClient } = require('../config/supabase');
const { createAuthService } = require('../container');
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

    const client = createSupabaseClient(token);
    const { data, error } = await client.auth.getUser(token);

    if (error || !data?.user) {
      throw ApiError.unauthorized('Token invalido o expirado.');
    }

    // El perfil y el rol se leen de la base de datos: es la fuente de verdad
    // y permite rechazar cuentas deshabilitadas en cada solicitud.
    // Se usa el cliente del usuario para que RLS se aplique tambien aqui.
    req.user = await createAuthService(client).buildAuthenticatedUser(data.user);
    req.accessToken = token;

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = authMiddleware;
