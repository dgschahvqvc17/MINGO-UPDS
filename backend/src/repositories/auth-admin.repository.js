/**
 * Operaciones administrativas sobre Supabase Auth.
 * Usa service_role solo en el backend y nunca expone tokens ni claves al cliente.
 * No conoce HTTP ni reglas de negocio.
 */
class AuthAdminRepository {
  /**
   * @param {{
   *   supabase: import('@supabase/supabase-js').SupabaseClient | null,
   *   createAnonClient?: () => import('@supabase/supabase-js').SupabaseClient
   * }} dependencies
   */
  constructor({ supabase, createAnonClient }) {
    this.supabase = supabase;
    this.createAnonClient = createAnonClient;
  }

  /**
   * Crea una cuenta confirmada con contraseña temporal.
   *
   * @param {{ correo: string, claveTemporal: string, metadata: object }} datos
   * @returns {Promise<{ id: string, correo: string }>}
   */
  async crearUsuario({ correo, claveTemporal, metadata }) {
    const { data, error } = await this.requireClient().auth.admin.createUser({
      email: correo,
      password: claveTemporal,
      email_confirm: true,
      user_metadata: metadata,
    });

    if (error) throw error;
    if (!data?.user?.id) throw new Error('Supabase no devolvio el usuario creado.');

    return { id: data.user.id, correo: data.user.email ?? correo };
  }

  /**
   * Devuelve el correo de una cuenta a partir de su identificador.
   *
   * @param {string} userId
   * @returns {Promise<string>}
   */
  async obtenerCorreoPorId(userId) {
    const { data, error } = await this.requireClient().auth.admin.getUserById(userId);

    if (error) throw error;
    if (!data?.user?.email) throw new Error('La cuenta no tiene un correo asociado.');

    return data.user.email;
  }

  /**
   * Verifica la contraseña actual sin reutilizar el cliente service_role.
   *
   * @param {string} correo
   * @param {string} clave
   * @returns {Promise<boolean>}
   */
  async verificarCredenciales(correo, clave) {
    const client = this.createAnonClient();
    const { error } = await client.auth.signInWithPassword({ email: correo, password: clave });
    return !error;
  }

  /**
   * Cambia la contraseña de una cuenta por su identificador.
   *
   * @param {string} userId
   * @param {string} claveNueva
   * @returns {Promise<void>}
   */
  async cambiarClave(userId, claveNueva) {
    const { error } = await this.requireClient()
      .auth.admin.updateUserById(userId, { password: claveNueva });

    if (error) throw error;
  }

  /**
   * Elimina una cuenta creada parcialmente cuando falla el alta administrativa.
   *
   * @param {string} userId
   * @returns {Promise<void>}
   */
  async eliminarUsuario(userId) {
    const { error } = await this.requireClient().auth.admin.deleteUser(userId);
    if (error) throw error;
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('Supabase service role no esta configurado en el servidor.');
    }

    return this.supabase;
  }
}

module.exports = AuthAdminRepository;
