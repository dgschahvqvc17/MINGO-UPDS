/**
 * Acceso a datos de los documentos academicos (HU07).
 * Usa el cliente de Supabase del usuario para que RLS se aplique en cada consulta.
 * No conoce HTTP ni reglas de negocio.
 */
const DOCUMENTO_COLUMNS = `
  id,
  usuario_id,
  materia_id,
  unidad_id,
  nombre,
  nombre_archivo,
  ruta_almacenamiento,
  tipo_archivo,
  tamano,
  estado_procesamiento,
  motivo_error,
  numero_paginas,
  fecha_carga,
  fecha_actualizacion,
  materias ( nombre, codigo, color )
`;

class DocumentoRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * Registra los metadatos de un documento ya subido a S3.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {object} documento Datos normalizados por el servicio.
   * @returns {Promise<object>}
   */
  async crearDocumento(usuarioId, documento) {
    const { data, error } = await this.requireClient()
      .from('documentos')
      .insert({
        usuario_id: usuarioId,
        materia_id: documento.materia_id,
        unidad_id: documento.unidad_id ?? null,
        nombre: documento.nombre,
        nombre_archivo: documento.nombre_archivo,
        ruta_almacenamiento: documento.ruta_almacenamiento,
        tipo_archivo: documento.tipo_archivo,
        tamano: documento.tamano,
        estado_procesamiento: 'pendiente',
      })
      .select(DOCUMENTO_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Busca un documento por su ruta en S3.
   * Sirve para evitar registrar dos veces el mismo objeto.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {string} rutaAlmacenamiento Clave del objeto en S3.
   * @returns {Promise<object | null>}
   */
  async obtenerPorRuta(usuarioId, rutaAlmacenamiento) {
    const { data, error } = await this.requireClient()
      .from('documentos')
      .select(DOCUMENTO_COLUMNS)
      .eq('usuario_id', usuarioId)
      .eq('ruta_almacenamiento', rutaAlmacenamiento)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Lista los documentos del usuario, del mas reciente al mas antiguo.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {{ materia_id?: string, limit: number, offset: number }} filtros
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listarDocumentos(usuarioId, { materia_id: materiaId, limit, offset }) {
    const desde = offset;
    const hasta = offset + limit - 1;

    let consulta = this.requireClient()
      .from('documentos')
      .select(DOCUMENTO_COLUMNS, { count: 'exact' })
      .eq('usuario_id', usuarioId);

    if (materiaId) {
      consulta = consulta.eq('materia_id', materiaId);
    }

    const { data, error, count } = await consulta
      .order('fecha_carga', { ascending: false })
      .range(desde, hasta);

    if (error) {
      throw error;
    }

    return { items: data ?? [], total: count ?? 0 };
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('Supabase no esta configurado en el servidor.');
    }

    return this.supabase;
  }
}

module.exports = DocumentoRepository;
