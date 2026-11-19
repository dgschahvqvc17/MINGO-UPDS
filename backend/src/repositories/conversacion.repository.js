/**
 * Acceso a datos del chat academico (HU12).
 * Usa el cliente de Supabase del usuario: RLS limita cada lectura y escritura
 * a sus propias conversaciones, mensajes y referencias.
 * No conoce HTTP ni reglas de negocio.
 */

const CONVERSACION_COLUMNS = `
  id,
  usuario_id,
  titulo,
  tipo_conversacion,
  fecha_creacion,
  fecha_actualizacion
`;

const MENSAJE_COLUMNS = `
  id,
  conversacion_id,
  rol_mensaje,
  contenido,
  modelo_utilizado,
  intencion,
  fecha_creacion
`;

const REFERENCIA_COLUMNS = `
  id,
  mensaje_id,
  fragmento_id,
  documento_id,
  documento_nombre,
  numero_pagina,
  extracto,
  fecha_creacion
`;

/** Maximo de mensajes devueltos al consultar el historial de una conversacion. */
const MAXIMO_MENSAJES_HISTORIAL = 500;

/** Maximo de turnos incluidos en el prompt del modelo. */
const MAXIMO_TURNOS_PROMPT = 6;

class ConversacionRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * Crea una conversacion nueva para el usuario.
   *
   * @param {string} usuarioId
   * @param {{ titulo: string, tipo: string }} datos
   * @returns {Promise<object>}
   */
  async crear(usuarioId, { titulo, tipo }) {
    const { data, error } = await this.requireClient()
      .from('conversaciones')
      .insert({
        usuario_id: usuarioId,
        titulo,
        tipo_conversacion: tipo,
      })
      .select(CONVERSACION_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Lista las conversaciones del usuario, mas recientes primero.
   *
   * @param {string} usuarioId
   * @param {{ limite: number, desplazamiento: number }} paginacion
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listar(usuarioId, { limite, desplazamiento }) {
    const { data, error, count } = await this.requireClient()
      .from('conversaciones')
      .select(CONVERSACION_COLUMNS, { count: 'exact' })
      .eq('usuario_id', usuarioId)
      .order('fecha_actualizacion', { ascending: false, nullsFirst: false })
      .order('fecha_creacion', { ascending: false })
      .range(desplazamiento, desplazamiento + limite - 1);

    if (error) {
      throw error;
    }

    return { items: data ?? [], total: count ?? 0 };
  }

  /**
   * Devuelve una conversacion propia o null.
   *
   * @param {string} usuarioId
   * @param {string} conversacionId
   * @returns {Promise<object | null>}
   */
  async obtenerPorId(usuarioId, conversacionId) {
    const { data, error } = await this.requireClient()
      .from('conversaciones')
      .select(CONVERSACION_COLUMNS)
      .eq('id', conversacionId)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Elimina una conversacion propia. RLS se encarga del resto en cascada.
   *
   * @param {string} usuarioId
   * @param {string} conversacionId
   * @returns {Promise<boolean>} true si existia y se elimino.
   */
  async eliminar(usuarioId, conversacionId) {
    const { data, error } = await this.requireClient()
      .from('conversaciones')
      .delete()
      .eq('id', conversacionId)
      .eq('usuario_id', usuarioId)
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(data);
  }

  /**
   * Historial completo de una conversacion, con las citas de cada mensaje.
   *
   * @param {string} conversacionId
   * @returns {Promise<object[]>}
   */
  async obtenerMensajes(conversacionId) {
    const { data: mensajes, error } = await this.requireClient()
      .from('mensajes')
      .select(MENSAJE_COLUMNS)
      .eq('conversacion_id', conversacionId)
      .order('fecha_creacion', { ascending: true })
      .limit(MAXIMO_MENSAJES_HISTORIAL);

    if (error) {
      throw error;
    }

    const porMensaje = await this.obtenerReferencias(
      (mensajes ?? []).map((mensaje) => mensaje.id),
    );

    return (mensajes ?? []).map((mensaje) => ({
      ...mensaje,
      referencias: porMensaje.get(mensaje.id) ?? [],
    }));
  }

  /**
   * Ultimos turnos de una conversacion, en orden cronologico, para el prompt.
   *
   * @param {string} conversacionId
   * @returns {Promise<Array<{ rol_mensaje: string, contenido: string }>>}
   */
  async obtenerHistorialReciente(conversacionId) {
    const { data, error } = await this.requireClient()
      .from('mensajes')
      .select('rol_mensaje, contenido')
      .eq('conversacion_id', conversacionId)
      .order('fecha_creacion', { ascending: false })
      .limit(MAXIMO_TURNOS_PROMPT);

    if (error) {
      throw error;
    }

    return (data ?? []).reverse();
  }

  /**
   * Inserta los mensajes de un turno y devuelve las filas guardadas.
   *
   * @param {Array<object>} mensajes
   * @returns {Promise<object[]>}
   */
  async guardarMensajes(mensajes) {
    const { data, error } = await this.requireClient()
      .from('mensajes')
      .insert(mensajes)
      .select(MENSAJE_COLUMNS);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * Inserta las referencias de una respuesta del asistente.
   *
   * @param {Array<object>} referencias
   * @returns {Promise<object[]>}
   */
  async guardarReferencias(referencias) {
    if (referencias.length === 0) {
      return [];
    }

    const { data, error } = await this.requireClient()
      .from('referencias_respuesta')
      .insert(referencias)
      .select(REFERENCIA_COLUMNS);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * Obtiene las referencias de varios mensajes en una sola consulta.
   *
   * @param {string[]} mensajeIds
   * @returns {Promise<Map<string, object[]>>}
   */
  async obtenerReferencias(mensajeIds) {
    const porMensaje = new Map();

    if (mensajeIds.length === 0) {
      return porMensaje;
    }

    const { data, error } = await this.requireClient()
      .from('referencias_respuesta')
      .select(REFERENCIA_COLUMNS)
      .in('mensaje_id', mensajeIds)
      .order('fecha_creacion', { ascending: true });

    if (error) {
      throw error;
    }

    for (const referencia of data ?? []) {
      const lista = porMensaje.get(referencia.mensaje_id) ?? [];
      lista.push(referencia);
      porMensaje.set(referencia.mensaje_id, lista);
    }

    return porMensaje;
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('Supabase no esta configurado en el servidor.');
    }

    return this.supabase;
  }
}

module.exports = ConversacionRepository;
module.exports.MAXIMO_TURNOS_PROMPT = MAXIMO_TURNOS_PROMPT;
