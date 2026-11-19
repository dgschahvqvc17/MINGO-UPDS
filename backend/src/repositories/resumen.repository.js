/**
 * Acceso a datos de los resumenes academicos (HU10).
 * Usa el cliente de Supabase del usuario para que RLS se aplique en cada consulta.
 * No conoce HTTP ni reglas de negocio.
 */

const RESUMEN_COLUMNS = `
  id,
  usuario_id,
  documento_id,
  profundidad,
  hash_contenido,
  resumen_general,
  temas_principales,
  conceptos_importantes,
  modelo,
  tokens_entrada,
  tokens_salida,
  contenido_truncado,
  fecha_creacion,
  fecha_actualizacion
`;

/** Codigo de Postgres cuando dos peticiones generan el mismo resumen a la vez. */
const CODIGO_UNICIDAD = '23505';

class ResumenRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * Busca el resumen cacheado para una version concreta del documento.
   *
   * @param {string} usuarioId
   * @param {string} documentoId
   * @param {string} hashContenido
   * @param {string} profundidad
   * @returns {Promise<object | null>}
   */
  async obtenerPorClave(usuarioId, documentoId, hashContenido, profundidad) {
    const { data, error } = await this.requireClient()
      .from('resumenes')
      .select(RESUMEN_COLUMNS)
      .eq('usuario_id', usuarioId)
      .eq('documento_id', documentoId)
      .eq('hash_contenido', hashContenido)
      .eq('profundidad', profundidad)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Devuelve el ultimo resumen guardado de un documento.
   *
   * @param {string} usuarioId
   * @param {string} documentoId
   * @returns {Promise<object | null>}
   */
  async obtenerUltimo(usuarioId, documentoId) {
    const { data, error } = await this.requireClient()
      .from('resumenes')
      .select(RESUMEN_COLUMNS)
      .eq('usuario_id', usuarioId)
      .eq('documento_id', documentoId)
      .order('fecha_creacion', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Guarda un resumen. Si otra peticion guardo el mismo registro mientras se
   * generaba, devuelve el existente para no duplicar la cache.
   *
   * @param {object} resumen Fila con las columnas de `resumenes`.
   * @returns {Promise<object>}
   */
  async guardar(resumen) {
    const fila = {
      usuario_id: resumen.usuario_id,
      documento_id: resumen.documento_id,
      profundidad: resumen.profundidad,
      hash_contenido: resumen.hash_contenido,
      resumen_general: resumen.resumen_general,
      temas_principales: resumen.temas_principales,
      conceptos_importantes: resumen.conceptos_importantes,
      modelo: resumen.modelo,
      tokens_entrada: resumen.tokens_entrada,
      tokens_salida: resumen.tokens_salida,
      contenido_truncado: resumen.contenido_truncado,
    };

    const { data, error } = await this.requireClient()
      .from('resumenes')
      .insert(fila)
      .select(RESUMEN_COLUMNS)
      .single();

    if (error) {
      if (error.code === CODIGO_UNICIDAD) {
        const existente = await this.obtenerPorClave(
          fila.usuario_id,
          fila.documento_id,
          fila.hash_contenido,
          fila.profundidad,
        );

        if (existente) {
          return existente;
        }
      }

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

module.exports = ResumenRepository;
