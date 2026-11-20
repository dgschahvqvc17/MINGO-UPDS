/**
 * Preferencias de notificacion (HU18). Con el cliente del usuario RLS limita
 * la lectura y escritura a su propia fila; con service_role el worker consulta
 * las preferencias activas de todos los estudiantes.
 */

const PREFERENCIA_COLUMNS = `
  usuario_id,
  notificaciones_activas,
  anticipacion_minutos,
  canal_email,
  zona_horaria,
  idioma,
  fecha_creacion,
  fecha_actualizacion
`;

const PREFERENCIAS_PREDETERMINADAS = Object.freeze({
  notificaciones_activas: true,
  anticipacion_minutos: 60,
  canal_email: false,
  zona_horaria: 'America/Bogota',
  idioma: 'es',
});

/** Codigo PostgreSQL de violacion de restriccion unica. */
const CODIGO_UNICIDAD = '23505';

class PreferenciaNotificacionRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * @param {string} usuarioId
   * @returns {Promise<object | null>}
   */
  async obtener(usuarioId) {
    const { data, error } = await this.requireClient()
      .from('preferencias_usuario')
      .select(PREFERENCIA_COLUMNS)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Devuelve las preferencias y las crea con valores por defecto si el usuario
   * nunca las ha configurado.
   *
   * @param {string} usuarioId
   * @returns {Promise<object>}
   */
  async obtenerOCrear(usuarioId) {
    const existentes = await this.obtener(usuarioId);
    if (existentes) {
      return existentes;
    }

    const { data, error } = await this.requireClient()
      .from('preferencias_usuario')
      .insert({ usuario_id: usuarioId, ...PREFERENCIAS_PREDETERMINADAS })
      .select(PREFERENCIA_COLUMNS)
      .maybeSingle();

    if (error) {
      if (error.code === CODIGO_UNICIDAD) {
        const concurrentes = await this.obtener(usuarioId);
        if (concurrentes) {
          return concurrentes;
        }
      }

      throw error;
    }

    return data;
  }

  /**
   * @param {string} usuarioId
   * @param {object} cambios Solo columnas permitidas por el esquema Zod.
   * @returns {Promise<object>}
   */
  async actualizar(usuarioId, cambios) {
    const { data, error } = await this.requireClient()
      .from('preferencias_usuario')
      .update(cambios)
      .eq('usuario_id', usuarioId)
      .select(PREFERENCIA_COLUMNS)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * @param {number} limite
   * @returns {Promise<object[]>}
   */
  async listarActivas(limite) {
    const { data, error } = await this.requireClient()
      .from('preferencias_usuario')
      .select(PREFERENCIA_COLUMNS)
      .eq('notificaciones_activas', true)
      .order('usuario_id', { ascending: true })
      .limit(limite);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('PreferenciaNotificacionRepository requiere un cliente de Supabase.');
    }

    return this.supabase;
  }
}

module.exports = PreferenciaNotificacionRepository;
module.exports.PREFERENCIAS_PREDETERMINADAS = PREFERENCIAS_PREDETERMINADAS;
