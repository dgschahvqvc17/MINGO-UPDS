/**
 * Acceso a datos de conjuntos de tarjetas y tarjetas (HU14). Usa el cliente de
 * Supabase del usuario para que RLS se aplique en cada consulta. No conoce HTTP
 * ni reglas de negocio.
 */

const CONJUNTO_COLUMNS = `
  id,
  usuario_id,
  materia_id,
  documento_id,
  titulo,
  cantidad_tarjetas,
  modelo,
  tokens_entrada,
  tokens_salida,
  fecha_creacion,
  materias ( nombre, codigo, color )
`;

const TARJETA_COLUMNS = `
  id,
  usuario_id,
  conjunto_id,
  orden,
  frente,
  reverso,
  estado,
  fecha_actualizacion
`;

class TarjetaRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * Guarda un conjunto con sus tarjetas.
   *
   * Supabase no expone transacciones multi-tabla desde el cliente REST, asi que
   * si falla el detalle se elimina el conjunto recien creado; el borrado en
   * cascada limpia las tarjetas.
   *
   * @param {object} conjunto Columnas de `conjuntos_tarjetas` sin id.
   * @param {Array<{ frente: string, reverso: string }>} tarjetas
   * @returns {Promise<object>} Conjunto con sus tarjetas guardadas.
   */
  async crearConjunto(conjunto, tarjetas) {
    const { data: guardado, error } = await this.requireClient()
      .from('conjuntos_tarjetas')
      .insert(conjunto)
      .select(CONJUNTO_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    try {
      const filas = await this.insertarTarjetas(guardado.id, conjunto.usuario_id, tarjetas);
      return { ...guardado, tarjetas: filas };
    } catch (errorInsercion) {
      await this.eliminarConjunto(conjunto.usuario_id, guardado.id).catch(() => {});
      throw errorInsercion;
    }
  }

  /**
   * @param {string} conjuntoId
   * @param {string} usuarioId
   * @param {Array<{ frente: string, reverso: string }>} tarjetas
   * @returns {Promise<Array<object>>}
   */
  async insertarTarjetas(conjuntoId, usuarioId, tarjetas) {
    const filas = tarjetas.map((tarjeta, indice) => ({
      usuario_id: usuarioId,
      conjunto_id: conjuntoId,
      orden: indice + 1,
      frente: tarjeta.frente,
      reverso: tarjeta.reverso,
      estado: 'sin_revisar',
    }));

    const { data, error } = await this.requireClient()
      .from('tarjetas')
      .insert(filas)
      .select(TARJETA_COLUMNS)
      .order('orden', { ascending: true });

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * Lista los conjuntos del usuario, del mas reciente al mas antiguo.
   *
   * @param {string} usuarioId
   * @param {{ limit: number, offset: number }} paginacion
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listarConjuntos(usuarioId, { limit, offset }) {
    const { data, error, count } = await this.requireClient()
      .from('conjuntos_tarjetas')
      .select(CONJUNTO_COLUMNS, { count: 'exact' })
      .eq('usuario_id', usuarioId)
      .order('fecha_creacion', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return { items: data ?? [], total: count ?? 0 };
  }

  /**
   * @param {string} usuarioId
   * @param {string} conjuntoId
   * @returns {Promise<object | null>}
   */
  async obtenerConjuntoPorId(usuarioId, conjuntoId) {
    const { data, error } = await this.requireClient()
      .from('conjuntos_tarjetas')
      .select(CONJUNTO_COLUMNS)
      .eq('usuario_id', usuarioId)
      .eq('id', conjuntoId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Lista las tarjetas de un conjunto en orden. Con `soloPendientes` se
   * excluyen las ya marcadas como conocidas.
   *
   * @param {string} conjuntoId
   * @param {{ soloPendientes?: boolean }} [opciones]
   * @returns {Promise<Array<object>>}
   */
  async listarTarjetas(conjuntoId, { soloPendientes = false } = {}) {
    let consulta = this.requireClient()
      .from('tarjetas')
      .select(TARJETA_COLUMNS)
      .eq('conjunto_id', conjuntoId)
      .order('orden', { ascending: true });

    if (soloPendientes) {
      consulta = consulta.neq('estado', 'conocida');
    }

    const { data, error } = await consulta;

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * Cuenta las tarjetas por conjunto y estado en una sola consulta.
   *
   * @param {string[]} conjuntoIds
   * @returns {Promise<Array<{ conjunto_id: string, estado: string }>>}
   */
  async contarEstados(conjuntoIds) {
    if (conjuntoIds.length === 0) {
      return [];
    }

    const { data, error } = await this.requireClient()
      .from('tarjetas')
      .select('conjunto_id, estado')
      .in('conjunto_id', conjuntoIds);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * @param {string} usuarioId
   * @param {string} conjuntoId
   * @returns {Promise<void>}
   */
  async eliminarConjunto(usuarioId, conjuntoId) {
    const { error } = await this.requireClient()
      .from('conjuntos_tarjetas')
      .delete()
      .eq('usuario_id', usuarioId)
      .eq('id', conjuntoId);

    if (error) {
      throw error;
    }
  }

  /**
   * @param {string} usuarioId
   * @param {string} tarjetaId
   * @returns {Promise<object | null>}
   */
  async obtenerTarjetaPorId(usuarioId, tarjetaId) {
    const { data, error } = await this.requireClient()
      .from('tarjetas')
      .select(TARJETA_COLUMNS)
      .eq('usuario_id', usuarioId)
      .eq('id', tarjetaId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * @param {string} usuarioId
   * @param {string} tarjetaId
   * @param {string} estado
   * @returns {Promise<object | null>}
   */
  async actualizarEstado(usuarioId, tarjetaId, estado) {
    const { data, error } = await this.requireClient()
      .from('tarjetas')
      .update({ estado, fecha_actualizacion: new Date().toISOString() })
      .eq('usuario_id', usuarioId)
      .eq('id', tarjetaId)
      .select(TARJETA_COLUMNS)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('Supabase no esta configurado en el servidor.');
    }

    return this.supabase;
  }
}

module.exports = TarjetaRepository;
module.exports.CONJUNTO_COLUMNS = CONJUNTO_COLUMNS;
module.exports.TARJETA_COLUMNS = TARJETA_COLUMNS;
