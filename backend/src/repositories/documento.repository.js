/**
 * Acceso a datos de los documentos academicos (HU07 y HU08).
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

/**
 * Columnas que necesita el worker de procesamiento.
 * No incluye la relacion con materias: el worker solo usa datos del archivo.
 */
const DOCUMENTO_PROCESAMIENTO_COLUMNS = `
  id,
  usuario_id,
  nombre_archivo,
  ruta_almacenamiento,
  tipo_archivo,
  estado_procesamiento,
  motivo_error,
  numero_paginas
`;

/** Estados desde los que se puede iniciar un procesamiento. */
const ESTADOS_INICIABLES = ['pendiente', 'en_cola', 'error'];

/**
 * Limpia el termino de busqueda para que no se interprete como sintaxis
 * del filtro `or` ni como comodines de ILIKE.
 *
 * @param {string} termino
 * @returns {string}
 */
function limpiarTerminoBusqueda(termino) {
  return String(termino).replace(/[,()%_]/g, ' ').trim();
}

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
   * Busca un documento del usuario por su identificador.
   * Devuelve null si no existe o pertenece a otro usuario (RLS + filtro explicito).
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {string} documentoId UUID del documento.
   * @returns {Promise<object | null>}
   */
  async obtenerDocumentoPorId(usuarioId, documentoId) {
    const { data, error } = await this.requireClient()
      .from('documentos')
      .select(DOCUMENTO_COLUMNS)
      .eq('usuario_id', usuarioId)
      .eq('id', documentoId)
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
   * @param {{ materia_id?: string, q?: string, estado?: string, limit: number, offset: number }} filtros
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listarDocumentos(usuarioId, { materia_id: materiaId, q, estado, limit, offset }) {
    const desde = offset;
    const hasta = offset + limit - 1;

    let consulta = this.requireClient()
      .from('documentos')
      .select(DOCUMENTO_COLUMNS, { count: 'exact' })
      .eq('usuario_id', usuarioId);

    if (materiaId) {
      consulta = consulta.eq('materia_id', materiaId);
    }

    if (estado) {
      consulta = consulta.eq('estado_procesamiento', estado);
    }

    const termino = q ? limpiarTerminoBusqueda(q) : '';
    if (termino) {
      consulta = consulta.ilike('nombre', `%${termino}%`);
    }

    const { data, error, count } = await consulta
      .order('fecha_carga', { ascending: false })
      .range(desde, hasta);

    if (error) {
      throw error;
    }

    return { items: data ?? [], total: count ?? 0 };
  }

  /**
   * Elimina los metadatos de un documento del usuario.
   * Devuelve la fila eliminada o null si ya no existia.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {string} documentoId UUID del documento.
   * @returns {Promise<object | null>}
   */
  async eliminarDocumento(usuarioId, documentoId) {
    const { data, error } = await this.requireClient()
      .from('documentos')
      .delete()
      .eq('usuario_id', usuarioId)
      .eq('id', documentoId)
      .select('id, ruta_almacenamiento')
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Marca un documento como encolado para su procesamiento.
   * Solo aplica desde estados iniciales para no pisar un procesamiento activo.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {string} documentoId UUID del documento.
   * @returns {Promise<object | null>} Fila actualizada o null si el estado no lo permite.
   */
  async marcarEnCola(usuarioId, documentoId) {
    const { data, error } = await this.requireClient()
      .from('documentos')
      .update({
        estado_procesamiento: 'en_cola',
        motivo_error: null,
        fecha_actualizacion: new Date().toISOString(),
      })
      .eq('usuario_id', usuarioId)
      .eq('id', documentoId)
      .in('estado_procesamiento', ESTADOS_INICIABLES)
      .select(DOCUMENTO_PROCESAMIENTO_COLUMNS)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Obtiene un documento sin filtrar por usuario.
   * Solo para el worker con service_role, que valida la propiedad por su cuenta.
   *
   * @param {string} documentoId UUID del documento.
   * @returns {Promise<object | null>}
   */
  async obtenerPorIdSinUsuario(documentoId) {
    const { data, error } = await this.requireClient()
      .from('documentos')
      .select(DOCUMENTO_PROCESAMIENTO_COLUMNS)
      .eq('id', documentoId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Obtiene un documento por la clave del objeto en S3, sin filtrar por usuario.
   * Sirve para resolver los eventos automaticos de S3.
   *
   * @param {string} rutaAlmacenamiento Clave del objeto en S3.
   * @returns {Promise<object | null>}
   */
  async obtenerPorRutaSinUsuario(rutaAlmacenamiento) {
    const { data, error } = await this.requireClient()
      .from('documentos')
      .select(DOCUMENTO_PROCESAMIENTO_COLUMNS)
      .eq('ruta_almacenamiento', rutaAlmacenamiento)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Cambia el documento a `procesando` de forma condicional.
   * La actualizacion condicional evita procesar dos veces el mismo documento
   * cuando coinciden el evento de S3 y el encolado manual.
   *
   * @param {string} documentoId UUID del documento.
   * @param {{ incluirProcesado?: boolean }} opciones
   * @returns {Promise<object | null>} Fila actualizada o null si otro proceso se adelanto.
   */
  async marcarProcesando(documentoId, { incluirProcesado = false } = {}) {
    const estados = incluirProcesado
      ? [...ESTADOS_INICIABLES, 'procesado']
      : ESTADOS_INICIABLES;

    const { data, error } = await this.requireClient()
      .from('documentos')
      .update({
        estado_procesamiento: 'procesando',
        motivo_error: null,
        fecha_actualizacion: new Date().toISOString(),
      })
      .eq('id', documentoId)
      .in('estado_procesamiento', estados)
      .select(DOCUMENTO_PROCESAMIENTO_COLUMNS)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Guarda el resultado final del procesamiento.
   *
   * @param {string} documentoId UUID del documento.
   * @param {{ estado: 'procesado' | 'error', motivoError?: string | null, numeroPaginas?: number | null }} resultado
   * @returns {Promise<object>}
   */
  async actualizarResultadoProcesamiento(
    documentoId,
    { estado, motivoError = null, numeroPaginas = null },
  ) {
    const { data, error } = await this.requireClient()
      .from('documentos')
      .update({
        estado_procesamiento: estado,
        motivo_error: estado === 'error' ? motivoError : null,
        numero_paginas: numeroPaginas,
        fecha_actualizacion: new Date().toISOString(),
      })
      .eq('id', documentoId)
      .select(DOCUMENTO_PROCESAMIENTO_COLUMNS)
      .single();

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

module.exports = DocumentoRepository;
