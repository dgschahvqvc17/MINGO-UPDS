/**
 * Acceso a datos de los eventos del calendario academico.
 * Usa el cliente de Supabase del usuario para que RLS se aplique en cada consulta.
 * No conoce HTTP ni reglas de negocio.
 */
const EVENTO_COLUMNS = `
  id,
  usuario_id,
  materia_id,
  tarea_id,
  titulo,
  descripcion,
  tipo_evento,
  fecha_inicio,
  fecha_fin,
  recordatorio,
  fecha_creacion,
  fecha_actualizacion,
  materias ( nombre, codigo, color )
`;

const ORDEN_POR_CAMPO = {
  fecha_inicio: 'fecha_inicio',
  fecha_creacion: 'fecha_creacion',
  titulo: 'titulo',
};

class CalendarioRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * Lista los eventos del usuario en un rango de fechas.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {object} filtros Filtros validados (desde, hasta, materia_id, tipo_evento, query, sort, order, limit, offset).
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listarEventos(usuarioId, filtros = {}) {
    const { limit = 50, offset = 0, sort = 'fecha_inicio', order = 'asc' } = filtros;

    let builder = this.requireClient()
      .from('eventos_calendario')
      .select(EVENTO_COLUMNS, { count: 'exact' })
      .eq('usuario_id', usuarioId);

    // Filtro obligatorio: rango de fechas
    if (filtros.desde) {
      builder = builder.gte('fecha_inicio', filtros.desde.toISOString());
    }
    if (filtros.hasta) {
      builder = builder.lte('fecha_inicio', filtros.hasta.toISOString());
    }

    if (filtros.materia_id) {
      builder = builder.eq('materia_id', filtros.materia_id);
    }

    if (filtros.tipo_evento) {
      builder = builder.eq('tipo_evento', filtros.tipo_evento);
    }

    if (filtros.query) {
      const terminoSeguro = String(filtros.query).replace(/[,()%]/g, ' ').trim();

      if (terminoSeguro) {
        builder = builder.ilike('titulo', `%${terminoSeguro}%`);
      }
    }

    const columnaOrden = ORDEN_POR_CAMPO[sort] ?? ORDEN_POR_CAMPO.fecha_inicio;

    const { data, error, count } = await builder
      .order(columnaOrden, { ascending: order === 'asc' })
      .order('fecha_creacion', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return { items: data ?? [], total: count ?? (data ?? []).length };
  }

  /**
   * Obtiene un evento por ID verificando la propiedad con RLS.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {string} eventoId UUID del evento.
   * @returns {Promise<object | null>}
   */
  async obtenerEventoPorId(usuarioId, eventoId) {
    const { data, error } = await this.requireClient()
      .from('eventos_calendario')
      .select(EVENTO_COLUMNS)
      .eq('id', eventoId)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Crea un evento para el usuario.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {object} eventoData Datos validados.
   * @returns {Promise<object>}
   */
  async crearEvento(usuarioId, eventoData) {
    const { data, error } = await this.requireClient()
      .from('eventos_calendario')
      .insert({
        usuario_id: usuarioId,
        materia_id: eventoData.materia_id ?? null,
        tarea_id: eventoData.tarea_id ?? null,
        titulo: eventoData.titulo,
        descripcion: eventoData.descripcion ?? null,
        tipo_evento: eventoData.tipo_evento,
        fecha_inicio: eventoData.fecha_inicio.toISOString(),
        fecha_fin: eventoData.fecha_fin ? eventoData.fecha_fin.toISOString() : null,
        recordatorio: eventoData.recordatorio ?? null,
      })
      .select(EVENTO_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Actualiza un evento existente del usuario.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {string} eventoId UUID del evento.
   * @param {object} cambios Campos validados a actualizar.
   * @returns {Promise<object | null>}
   */
  async actualizarEvento(usuarioId, eventoId, cambios) {
    const updates = { ...cambios, fecha_actualizacion: new Date().toISOString() };

    if (updates.fecha_inicio instanceof Date) {
      updates.fecha_inicio = updates.fecha_inicio.toISOString();
    }

    if (updates.fecha_fin instanceof Date) {
      updates.fecha_fin = updates.fecha_fin.toISOString();
    }

    const { data, error } = await this.requireClient()
      .from('eventos_calendario')
      .update(updates)
      .eq('id', eventoId)
      .eq('usuario_id', usuarioId)
      .select(EVENTO_COLUMNS)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Elimina un evento del usuario.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {string} eventoId UUID del evento.
   * @returns {Promise<boolean>} True si se eliminó.
   */
  async eliminarEvento(usuarioId, eventoId) {
    const { data, error } = await this.requireClient()
      .from('eventos_calendario')
      .delete()
      .eq('id', eventoId)
      .eq('usuario_id', usuarioId)
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(data);
  }

  /**
   * Obtiene los eventos no completados con inicio dentro de un rango (para vista "próximos").
   * Usa la función RPC de la migración si está disponible.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {{ dias: number, limit: number }} opciones
   * @returns {Promise<object[]>}
   */
  async listarProximos(usuarioId, { dias, limit }) {
    const client = this.requireClient();
    const { data, error } = await client.rpc('obtener_eventos_proximos', {
      p_usuario_id: usuarioId,
      p_dias: dias,
      p_limite: limit,
    });

    if (!error && data) {
      return data ?? [];
    }

    // Fallback: consulta directa
    const desde = new Date();
    const hasta = new Date(desde.getTime() + dias * 24 * 60 * 60 * 1000);

    const { data: dataDirect, error: errorDirect } = await client
      .from('eventos_calendario')
      .select(EVENTO_COLUMNS)
      .eq('usuario_id', usuarioId)
      .gte('fecha_inicio', desde.toISOString())
      .lte('fecha_inicio', hasta.toISOString())
      .order('fecha_inicio', { ascending: true })
      .limit(limit);

    if (errorDirect) {
      throw errorDirect;
    }

    return dataDirect ?? [];
  }

  /**
   * Crea un evento automáticamente desde una tarea (usado por TareaService).
   * Llama a la función RPC idempotente.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {string} tareaId UUID de la tarea.
   * @returns {Promise<string | null>} ID del evento creado/actualizado o null si no había fecha_entrega.
   */
  async crearEventoDesdeTarea(usuarioId, tareaId) {
    const client = this.requireClient();
    const { data, error } = await client.rpc('crear_evento_desde_tarea', {
      p_tarea_id: tareaId,
      p_usuario_id: usuarioId,
    });

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

module.exports = CalendarioRepository;