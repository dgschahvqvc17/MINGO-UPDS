/**
 * Acceso a datos de las tareas académicas.
 * Usa el cliente de Supabase del usuario para que RLS se aplique en cada consulta.
 * No conoce HTTP ni reglas de negocio.
 */
const TAREA_COLUMNS = `
  id,
  usuario_id,
  materia_id,
  titulo,
  descripcion,
  tipo,
  prioridad,
  fecha_asignacion,
  fecha_entrega,
  estado,
  fecha_creacion,
  fecha_actualizacion,
  materias ( nombre, codigo, color )
`;

const ORDEN_POR_CAMPO = {
  fecha_entrega: 'fecha_entrega',
  fecha_creacion: 'fecha_creacion',
  titulo: 'titulo',
};

class TareaRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * Lista las tareas del usuario con filtros y paginación.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {object} filtros Filtros validados.
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listarTareas(usuarioId, filtros = {}) {
    const { limit = 20, offset = 0, sort = 'fecha_entrega', order = 'asc' } = filtros;

    let builder = this.requireClient()
      .from('tareas')
      .select(TAREA_COLUMNS, { count: 'exact' })
      .eq('usuario_id', usuarioId);

    if (filtros.materia_id) {
      builder = builder.eq('materia_id', filtros.materia_id);
    }

    if (filtros.estado) {
      builder = builder.eq('estado', filtros.estado);
    }

    if (filtros.prioridad) {
      builder = builder.eq('prioridad', filtros.prioridad);
    }

    if (filtros.tipo) {
      builder = builder.eq('tipo', filtros.tipo);
    }

    if (filtros.query) {
      const terminoSeguro = String(filtros.query).replace(/[,()%]/g, ' ').trim();

      if (terminoSeguro) {
        builder = builder.ilike('titulo', `%${terminoSeguro}%`);
      }
    }

    if (filtros.desde) {
      builder = builder.gte('fecha_entrega', filtros.desde.toISOString());
    }

    if (filtros.hasta) {
      builder = builder.lte('fecha_entrega', filtros.hasta.toISOString());
    }

    if (filtros.vencidas === 'true') {
      builder = builder
        .lt('fecha_entrega', new Date().toISOString())
        .neq('estado', 'completada');
    }

    const columnaOrden = ORDEN_POR_CAMPO[sort] ?? ORDEN_POR_CAMPO.fecha_entrega;

    const { data, error, count } = await builder
      .order(columnaOrden, { ascending: order === 'asc', nullsFirst: false })
      .order('fecha_creacion', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return { items: data ?? [], total: count ?? (data ?? []).length };
  }

  /**
   * Obtiene una tarea por ID verificando la propiedad con RLS.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {string} tareaId UUID de la tarea.
   * @returns {Promise<object | null>}
   */
  async obtenerTareaPorId(usuarioId, tareaId) {
    const { data, error } = await this.requireClient()
      .from('tareas')
      .select(TAREA_COLUMNS)
      .eq('id', tareaId)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Crea una tarea para el usuario.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {object} tareaData Datos validados.
   * @returns {Promise<object>}
   */
  async crearTarea(usuarioId, tareaData) {
    const { data, error } = await this.requireClient()
      .from('tareas')
      .insert({
        usuario_id: usuarioId,
        materia_id: tareaData.materia_id,
        titulo: tareaData.titulo,
        descripcion: tareaData.descripcion ?? null,
        tipo: tareaData.tipo,
        prioridad: tareaData.prioridad,
        fecha_asignacion: tareaData.fecha_asignacion.toISOString(),
        fecha_entrega: tareaData.fecha_entrega ? tareaData.fecha_entrega.toISOString() : null,
        estado: tareaData.estado,
      })
      .select(TAREA_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Actualiza una tarea existente del usuario.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {string} tareaId UUID de la tarea.
   * @param {object} cambios Campos validados a actualizar.
   * @returns {Promise<object | null>}
   */
  async actualizarTarea(usuarioId, tareaId, cambios) {
    const updates = { ...cambios, fecha_actualizacion: new Date().toISOString() };

    if (updates.fecha_asignacion instanceof Date) {
      updates.fecha_asignacion = updates.fecha_asignacion.toISOString();
    }

    if (updates.fecha_entrega instanceof Date) {
      updates.fecha_entrega = updates.fecha_entrega.toISOString();
    }

    const { data, error } = await this.requireClient()
      .from('tareas')
      .update(updates)
      .eq('id', tareaId)
      .eq('usuario_id', usuarioId)
      .select(TAREA_COLUMNS)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Cambia únicamente el estado de una tarea.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {string} tareaId UUID de la tarea.
   * @param {string} estado Nuevo estado.
   * @returns {Promise<object | null>}
   */
  async cambiarEstadoTarea(usuarioId, tareaId, estado) {
    const { data, error } = await this.requireClient()
      .from('tareas')
      .update({ estado, fecha_actualizacion: new Date().toISOString() })
      .eq('id', tareaId)
      .eq('usuario_id', usuarioId)
      .select(TAREA_COLUMNS)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Elimina una tarea del usuario.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {string} tareaId UUID de la tarea.
   * @returns {Promise<boolean>} True si se eliminó.
   */
  async eliminarTarea(usuarioId, tareaId) {
    const { data, error } = await this.requireClient()
      .from('tareas')
      .delete()
      .eq('id', tareaId)
      .eq('usuario_id', usuarioId)
      .select('id')
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(data);
  }

  /**
   * Obtiene las tareas no completadas con entrega dentro de un rango.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {{ desde: Date, hasta: Date, limit: number }} rango Rango de fechas.
   * @returns {Promise<object[]>}
   */
  async listarProximas(usuarioId, { desde, hasta, limit }) {
    const { data, error } = await this.requireClient()
      .from('tareas')
      .select(TAREA_COLUMNS)
      .eq('usuario_id', usuarioId)
      .neq('estado', 'completada')
      .gte('fecha_entrega', desde.toISOString())
      .lte('fecha_entrega', hasta.toISOString())
      .order('fecha_entrega', { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * Obtiene estadísticas agregadas de las tareas del usuario.
   * Usa la función RPC de la migración de HU04; si no está disponible
   * calcula los contadores con consultas acotadas.
   *
   * @param {string} usuarioId UUID del usuario.
   * @returns {Promise<object>}
   */
  async obtenerEstadisticas(usuarioId) {
    const client = this.requireClient();
    const { data, error } = await client.rpc('obtener_estadisticas_tareas', {
      p_usuario_id: usuarioId,
    });

    if (!error && data) {
      const fila = Array.isArray(data) ? data[0] : data;
      return this.normalizarEstadisticas(fila);
    }

    return this.calcularEstadisticasConConsultas(client, usuarioId);
  }

  async calcularEstadisticasConConsultas(client, usuarioId) {
    const contar = (configurar) => {
      let builder = client
        .from('tareas')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', usuarioId);

      builder = configurar(builder);
      return builder;
    };

    const [totalResult, pendientesResult, enProgresoResult, completadasResult, vencidasResult] =
      await Promise.all([
        contar((builder) => builder),
        contar((builder) => builder.eq('estado', 'pendiente')),
        contar((builder) => builder.eq('estado', 'en_progreso')),
        contar((builder) => builder.eq('estado', 'completada')),
        contar((builder) =>
          builder.lt('fecha_entrega', new Date().toISOString()).neq('estado', 'completada'),
        ),
      ]);

    const resultados = [
      totalResult,
      pendientesResult,
      enProgresoResult,
      completadasResult,
      vencidasResult,
    ];

    const conError = resultados.find((resultado) => resultado.error);

    if (conError) {
      throw conError.error;
    }

    return this.normalizarEstadisticas({
      total: totalResult.count,
      pendientes: pendientesResult.count,
      en_progreso: enProgresoResult.count,
      completadas: completadasResult.count,
      vencidas: vencidasResult.count,
    });
  }

  normalizarEstadisticas(fila = {}) {
    const numero = (valor) => Number(valor ?? 0);

    return {
      total: numero(fila.total),
      pendientes: numero(fila.pendientes),
      en_progreso: numero(fila.en_progreso),
      completadas: numero(fila.completadas),
      vencidas: numero(fila.vencidas),
      prioridad_alta: numero(fila.prioridad_alta),
      prioridad_media: numero(fila.prioridad_media),
      prioridad_baja: numero(fila.prioridad_baja),
    };
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('Supabase no esta configurado en el servidor.');
    }

    return this.supabase;
  }
}

module.exports = TareaRepository;
