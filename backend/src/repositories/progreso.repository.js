/**
 * Consultas de solo lectura para el progreso academico (HU17). Reutiliza las
 * tablas existentes con el cliente del usuario, de modo que RLS limita cada
 * consulta a los registros propios. El agregado se calcula en el servicio.
 */

const LIMITE_MATERIAS = 200;
const LIMITE_TAREAS = 500;
const LIMITE_SESIONES = 500;
const LIMITE_INTENTOS = 100;

class ProgresoRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * @param {string} usuarioId
   * @returns {Promise<Array<{ id: string, estado: string }>>}
   */
  async listarMaterias(usuarioId) {
    return this.listar('materias', 'id, estado', usuarioId, LIMITE_MATERIAS);
  }

  /**
   * @param {string} usuarioId
   * @returns {Promise<Array<object>>}
   */
  async listarTareas(usuarioId) {
    return this.listar(
      'tareas',
      'id, titulo, estado, fecha_entrega, fecha_actualizacion, materias ( nombre )',
      usuarioId,
      LIMITE_TAREAS,
    );
  }

  /**
   * @param {string} usuarioId
   * @returns {Promise<Array<object>>}
   */
  async listarSesiones(usuarioId) {
    return this.listar(
      'sesiones_estudio',
      'id, tema, estado, fecha_inicio, fecha_actualizacion, duracion_minutos',
      usuarioId,
      LIMITE_SESIONES,
    );
  }

  /**
   * @param {string} usuarioId
   * @returns {Promise<Array<object>>}
   */
  async listarIntentos(usuarioId) {
    const { data, error } = await this.requireClient()
      .from('intentos_cuestionario')
      .select(
        'id, puntuacion, fecha_finalizacion, temas_reforzar, cuestionarios ( titulo, materias ( nombre ) )',
      )
      .eq('usuario_id', usuarioId)
      .eq('estado', 'finalizado')
      .order('fecha_finalizacion', { ascending: false })
      .limit(LIMITE_INTENTOS);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * @param {string} tabla
   * @param {string} columnas
   * @param {string} usuarioId
   * @param {number} limite
   * @returns {Promise<Array<object>>}
   */
  async listar(tabla, columnas, usuarioId, limite) {
    const { data, error } = await this.requireClient()
      .from(tabla)
      .select(columnas)
      .eq('usuario_id', usuarioId)
      .limit(limite);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('ProgresoRepository requiere un cliente de Supabase.');
    }

    return this.supabase;
  }
}

module.exports = ProgresoRepository;
