/**
 * Acceso a datos de inscripciones de estudiantes en materias.
 * Usa el cliente service_role para escrituras administrativas; las lecturas
 * con RLS se realizan con el cliente del usuario autenticado.
 */
const INSCRIPCION_COLUMNS =
  'id, materia_id, estudiante_id, estado, fecha_inscripcion, fecha_actualizacion';

class InscripcionRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * Lista inscripciones visibles para el cliente inyectado.
   *
   * @param {{ materiaId?: string, estudianteId?: string, limit?: number, offset?: number }} filtros
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listar({ materiaId, estudianteId, limit = 50, offset = 0 } = {}) {
    let builder = this.supabase
      .from('inscripciones')
      .select(`${INSCRIPCION_COLUMNS}, perfiles!inscripciones_estudiante_id_fkey ( id, nombre, apellido, correo )`, { count: 'exact' });

    if (materiaId) builder = builder.eq('materia_id', materiaId);
    if (estudianteId) builder = builder.eq('estudiante_id', estudianteId);

    const { data, error, count } = await builder
      .order('fecha_inscripcion', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const items = (data ?? []).map(({ perfiles: estudiante, ...inscripcion }) => ({
      ...inscripcion,
      estudiante: estudiante ?? null,
      usuario_id: inscripcion.estudiante_id,
    }));

    return { items, total: count ?? 0 };
  }

  /**
   * Inscribe a un estudiante o reactiva una inscripción inactiva.
   *
   * @param {{ materiaId: string, estudianteId: string }} datos
   * @returns {Promise<object>}
   */
  async inscribir({ materiaId, estudianteId }) {
    const { data: existente, error: errorBusqueda } = await this.supabase
      .from('inscripciones')
      .select(INSCRIPCION_COLUMNS)
      .eq('materia_id', materiaId)
      .eq('estudiante_id', estudianteId)
      .maybeSingle();

    if (errorBusqueda) throw errorBusqueda;

    if (existente) {
      const { data, error } = await this.supabase
        .from('inscripciones')
        .update({ estado: 'activa' })
        .eq('id', existente.id)
        .select(INSCRIPCION_COLUMNS)
        .single();

      if (error) throw error;
      return data;
    }

    const { data, error } = await this.supabase
      .from('inscripciones')
      .insert({ materia_id: materiaId, estudiante_id: estudianteId, estado: 'activa' })
      .select(INSCRIPCION_COLUMNS)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Da de baja lógica a una inscripción (permite conservar el historial).
   *
   * @param {{ materiaId: string, estudianteId: string }} datos
   * @returns {Promise<object | null>}
   */
  async desinscribir({ materiaId, estudianteId }) {
    const { data, error } = await this.supabase
      .from('inscripciones')
      .update({ estado: 'inactiva' })
      .eq('materia_id', materiaId)
      .eq('estudiante_id', estudianteId)
      .select(INSCRIPCION_COLUMNS)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Comprueba si un estudiante tiene inscripción activa en una materia.
   *
   * @param {string} estudianteId
   * @param {string} materiaId
   * @returns {Promise<boolean>}
   */
  async estaInscrito(estudianteId, materiaId) {
    const { data, error } = await this.supabase
      .from('inscripciones')
      .select('id')
      .eq('estudiante_id', estudianteId)
      .eq('materia_id', materiaId)
      .eq('estado', 'activa')
      .maybeSingle();

    if (error) throw error;
    return Boolean(data);
  }
}

module.exports = InscripcionRepository;
