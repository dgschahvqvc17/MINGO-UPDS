/**
 * Acceso a datos del perfil y los roles del usuario autenticado.
 * No conoce HTTP ni reglas de negocio.
 */
class UsuarioRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * Busca el perfil por el identificador de Supabase Auth.
   *
   * @param {string} userId UUID del usuario.
   * @returns {Promise<object | null>}
   */
  async findById(userId) {
    const { data, error } = await this.requireClient()
      .from('perfiles')
      .select('id, auth_user_id, nombre, apellido, correo, estado')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Devuelve los nombres de rol asignados al usuario.
   *
   * @param {string} userId UUID del usuario.
   * @returns {Promise<string[]>}
   */
  async findRoleNames(userId) {
    const { data, error } = await this.requireClient()
      .from('usuario_roles')
      .select('roles ( nombre )')
      .eq('usuario_id', userId);

    if (error) {
      throw error;
    }

    return (data ?? [])
      .map((row) => row.roles?.nombre)
      .filter((nombre) => typeof nombre === 'string');
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('Supabase no esta configurado en el servidor.');
    }

    return this.supabase;
  }
}

module.exports = UsuarioRepository;
