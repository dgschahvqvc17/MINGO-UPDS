/**
 * Acceso a datos de objetivos academicos (HU17). Usa el cliente de Supabase
 * del usuario para que RLS se aplique en cada consulta. No conoce HTTP ni
 * reglas de negocio.
 */

const OBJETIVO_COLUMNS = `
  id,
  usuario_id,
  materia_id,
  titulo,
  descripcion,
  fecha_limite,
  estado,
  fecha_creacion,
  fecha_actualizacion,
  materias ( nombre, codigo, color )
`;

const COLUMNAS_ESCRITURA = [
  'usuario_id',
  'materia_id',
  'titulo',
  'descripcion',
  'fecha_limite',
  'estado',
];

class ObjetivoRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * Lista los objetivos del usuario. El estado es opcional y se pagina.
   *
   * @param {string} usuarioId
   * @param {{ estado?: string, limit: number, offset: number }} opciones
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listar(usuarioId, { estado, limit, offset }) {
    let consulta = this.requireClient()
      .from('objetivos_estudio')
      .select(OBJETIVO_COLUMNS, { count: 'exact' })
      .eq('usuario_id', usuarioId);

    if (estado) {
      consulta = consulta.eq('estado', estado);
    }

    const { data, error, count } = await consulta
      .order('estado', { ascending: true })
      .order('fecha_limite', { ascending: true, nullsFirst: false })
      .order('fecha_creacion', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return { items: data ?? [], total: count ?? 0 };
  }

  /**
   * @param {string} usuarioId
   * @param {string} objetivoId
   * @returns {Promise<object | null>}
   */
  async obtenerPorId(usuarioId, objetivoId) {
    const { data, error } = await this.requireClient()
      .from('objetivos_estudio')
      .select(OBJETIVO_COLUMNS)
      .eq('usuario_id', usuarioId)
      .eq('id', objetivoId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * @param {object} objetivo Columnas de `objetivos_estudio` sin id.
   * @returns {Promise<object>}
   */
  async crear(objetivo) {
    const { data, error } = await this.requireClient()
      .from('objetivos_estudio')
      .insert(this.aColumnasEscritura(objetivo))
      .select(OBJETIVO_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * @param {string} usuarioId
   * @param {string} objetivoId
   * @param {object} cambios
   * @returns {Promise<object>}
   */
  async actualizar(usuarioId, objetivoId, cambios) {
    const { data, error } = await this.requireClient()
      .from('objetivos_estudio')
      .update(this.aColumnasEscritura(cambios))
      .eq('usuario_id', usuarioId)
      .eq('id', objetivoId)
      .select(OBJETIVO_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * @param {string} usuarioId
   * @param {string} objetivoId
   * @returns {Promise<void>}
   */
  async eliminar(usuarioId, objetivoId) {
    const { error } = await this.requireClient()
      .from('objetivos_estudio')
      .delete()
      .eq('usuario_id', usuarioId)
      .eq('id', objetivoId);

    if (error) {
      throw error;
    }
  }

  /**
   * Devuelve los objetivos del usuario para calcular el progreso. Se limita el
   * tamano porque el agregado se hace en memoria y no en la base de datos.
   *
   * @param {string} usuarioId
   * @param {number} limite
   * @returns {Promise<Array<object>>}
   */
  async listarParaProgreso(usuarioId, limite) {
    const { data, error } = await this.requireClient()
      .from('objetivos_estudio')
      .select('id, titulo, materia_id, fecha_limite, estado, materias ( nombre )')
      .eq('usuario_id', usuarioId)
      .limit(limite);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  aColumnasEscritura(datos) {
    return Object.fromEntries(
      Object.entries(datos).filter(
        ([clave, valor]) => COLUMNAS_ESCRITURA.includes(clave) && valor !== undefined,
      ),
    );
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('ObjetivoRepository requiere un cliente de Supabase.');
    }

    return this.supabase;
  }
}

module.exports = ObjetivoRepository;
module.exports.OBJETIVO_COLUMNS = OBJETIVO_COLUMNS;
