/**
 * Acceso al historial de notificaciones (HU18). Usa el cliente del usuario
 * para que RLS limite cada consulta a sus propios registros. El worker usa el
 * mismo repositorio con service_role para insertar avisos.
 */

const NOTIFICACION_COLUMNS = `
  id,
  usuario_id,
  tipo,
  titulo,
  mensaje,
  tarea_id,
  evento_calendario_id,
  sesion_estudio_id,
  clave_idempotencia,
  fecha_actividad,
  fecha_programada,
  leida,
  fecha_envio,
  fecha_creacion,
  fecha_actualizacion
`;

/** Codigo PostgreSQL de violacion de restriccion unica. */
const CODIGO_UNICIDAD = '23505';

class NotificacionRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * @param {string} usuarioId
   * @param {{ leida?: boolean, tipo?: string, limit: number, offset: number }} filtros
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listar(usuarioId, { leida, tipo, limit, offset }) {
    let consulta = this.requireClient()
      .from('notificaciones')
      .select(NOTIFICACION_COLUMNS, { count: 'exact' })
      .eq('usuario_id', usuarioId);

    if (typeof leida === 'boolean') {
      consulta = consulta.eq('leida', leida);
    }

    if (tipo) {
      consulta = consulta.eq('tipo', tipo);
    }

    const { data, error, count } = await consulta
      .order('fecha_creacion', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return { items: data ?? [], total: count ?? 0 };
  }

  /**
   * @param {string} usuarioId
   * @returns {Promise<number>}
   */
  async contarNoLeidas(usuarioId) {
    const { count, error } = await this.requireClient()
      .from('notificaciones')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', usuarioId)
      .eq('leida', false);

    if (error) {
      throw error;
    }

    return count ?? 0;
  }

  /**
   * Cuenta los correos publicados desde una fecha, para acotar el cupo diario
   * aunque el schedule se ejecute varias veces al dia.
   *
   * @param {string} desde ISO 8601.
   * @returns {Promise<number>}
   */
  async contarEnviosDesde(desde) {
    const { count, error } = await this.requireClient()
      .from('notificaciones')
      .select('id', { count: 'exact', head: true })
      .gte('fecha_envio', desde);

    if (error) {
      throw error;
    }

    return count ?? 0;
  }

  /**
   * @param {string} usuarioId
   * @param {string} notificacionId
   * @returns {Promise<object | null>}
   */
  async obtenerPorId(usuarioId, notificacionId) {
    const { data, error } = await this.requireClient()
      .from('notificaciones')
      .select(NOTIFICACION_COLUMNS)
      .eq('id', notificacionId)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * @param {string} usuarioId
   * @param {string} notificacionId
   * @returns {Promise<object | null>}
   */
  async marcarLeida(usuarioId, notificacionId) {
    const { data, error } = await this.requireClient()
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', notificacionId)
      .eq('usuario_id', usuarioId)
      .select(NOTIFICACION_COLUMNS)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * @param {string} usuarioId
   * @returns {Promise<number>}
   */
  async marcarTodasLeidas(usuarioId) {
    const { data, error } = await this.requireClient()
      .from('notificaciones')
      .update({ leida: true })
      .eq('usuario_id', usuarioId)
      .eq('leida', false)
      .select('id');

    if (error) {
      throw error;
    }

    return (data ?? []).length;
  }

  /**
   * Inserta una notificacion. Devuelve null si la clave ya existia, para no
   * duplicar ni reenviar un aviso ya generado.
   *
   * @param {object} notificacion Columnas de `notificaciones` sin id.
   * @returns {Promise<object | null>}
   */
  async crearSiNoExiste(notificacion) {
    const { data, error } = await this.requireClient()
      .from('notificaciones')
      .upsert(notificacion, {
        onConflict: 'usuario_id,clave_idempotencia',
        ignoreDuplicates: true,
      })
      .select(NOTIFICACION_COLUMNS)
      .maybeSingle();

    if (error) {
      if (error.code === CODIGO_UNICIDAD) {
        return null;
      }

      throw error;
    }

    return data;
  }

  /**
   * @param {string} notificacionId
   * @param {string} fechaEnvio ISO 8601.
   * @returns {Promise<void>}
   */
  async marcarEnviada(notificacionId, fechaEnvio) {
    const { error } = await this.requireClient()
      .from('notificaciones')
      .update({ fecha_envio: fechaEnvio })
      .eq('id', notificacionId);

    if (error) {
      throw error;
    }
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('NotificacionRepository requiere un cliente de Supabase.');
    }

    return this.supabase;
  }
}

module.exports = NotificacionRepository;
module.exports.NOTIFICACION_COLUMNS = NOTIFICACION_COLUMNS;
module.exports.CODIGO_UNICIDAD = CODIGO_UNICIDAD;
