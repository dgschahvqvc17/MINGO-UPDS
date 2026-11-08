/**
 * Clientes de Supabase.
 *
 * - supabaseAdmin: usa la service role key. Solo debe utilizarse en el backend.
 * - createSupabaseClient: cliente con el token del usuario para respetar RLS.
 */
const { createClient } = require('@supabase/supabase-js');
const config = require('./environment');

const createClientOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
};

const supabaseAdmin =
  config.supabase.url && config.supabase.serviceRoleKey
    ? createClient(config.supabase.url, config.supabase.serviceRoleKey, createClientOptions)
    : null;

/**
 * Crea un cliente autenticado con el access token del usuario.
 * Permite que las politicas RLS de PostgreSQL se apliquen correctamente.
 *
 * @param {string} accessToken Token JWT del usuario.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
function createSupabaseClient(accessToken) {
  if (!config.supabase.url || !config.supabase.anonKey) {
    throw new Error('Supabase no esta configurado (SUPABASE_URL / SUPABASE_ANON_KEY).');
  }

  return createClient(config.supabase.url, config.supabase.anonKey, {
    ...createClientOptions,
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

module.exports = { supabaseAdmin, createSupabaseClient };
