/**
 * Lectura de las actividades que pueden generar recordatorios (HU18):
 * tareas con fecha de entrega, evaluaciones del calendario y sesiones de
 * estudio pendientes. No decide qué avisos se envían; eso hace el servicio.
 */

const LIMITE_ACTIVIDADES = 50;

class ActividadRecordatorioRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * @param {string} usuarioId
   * @param {string} desde ISO 8601.
   * @param {string} hasta ISO 8601.
   * @returns {Promise<object[]>}
   */
  async listarTareasProximas(usuarioId, desde, hasta) {
    const { data, error } = await this.requireClient()
      .from('tareas')
      .select('id, titulo, descripcion, fecha_entrega, materias ( nombre )')
      .eq('usuario_id', usuarioId)
      .neq('estado', 'completada')
      .gte('fecha_entrega', desde)
      .lte('fecha_entrega', hasta)
      .order('fecha_entrega', { ascending: true })
      .limit(LIMITE_ACTIVIDADES);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * @param {string} usuarioId
   * @param {string} desde ISO 8601.
   * @param {string} hasta ISO 8601.
   * @returns {Promise<object[]>}
   */
  async listarEvaluacionesProximas(usuarioId, desde, hasta) {
    const { data, error } = await this.requireClient()
      .from('eventos_calendario')
      .select('id, titulo, descripcion, fecha_inicio, materias ( nombre )')
      .eq('usuario_id', usuarioId)
      .eq('tipo_evento', 'examen')
      .gte('fecha_inicio', desde)
      .lte('fecha_inicio', hasta)
      .order('fecha_inicio', { ascending: true })
      .limit(LIMITE_ACTIVIDADES);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * @param {string} usuarioId
   * @param {string} desde ISO 8601.
   * @param {string} hasta ISO 8601.
   * @returns {Promise<object[]>}
   */
  async listarSesionesProximas(usuarioId, desde, hasta) {
    const { data, error } = await this.requireClient()
      .from('sesiones_estudio')
      .select('id, tema, actividades, fecha_inicio, duracion_minutos')
      .eq('usuario_id', usuarioId)
      .eq('estado', 'pendiente')
      .gte('fecha_inicio', desde)
      .lte('fecha_inicio', hasta)
      .order('fecha_inicio', { ascending: true })
      .limit(LIMITE_ACTIVIDADES);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('ActividadRecordatorioRepository requiere un cliente de Supabase.');
    }

    return this.supabase;
  }
}

module.exports = ActividadRecordatorioRepository;
module.exports.LIMITE_ACTIVIDADES = LIMITE_ACTIVIDADES;
