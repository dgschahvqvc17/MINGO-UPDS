/**
 * Acceso a datos de planes y sesiones de estudio (HU15). Usa el cliente de
 * Supabase del usuario para que RLS se aplique en cada consulta. No conoce HTTP
 * ni reglas de negocio.
 */

const PLAN_COLUMNS = `
  id,
  usuario_id,
  materia_id,
  objetivo,
  fecha_examen,
  minutos_por_dia,
  dias_disponibles,
  estado,
  modelo,
  tokens_entrada,
  tokens_salida,
  fecha_creacion,
  fecha_actualizacion,
  materias ( nombre, codigo, color )
`;

const SESION_COLUMNS = `
  id,
  usuario_id,
  plan_id,
  evento_calendario_id,
  tema,
  actividades,
  tipo,
  fecha_inicio,
  duracion_minutos,
  orden,
  estado,
  fecha_creacion,
  fecha_actualizacion
`;

class PlanEstudioRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * Guarda un plan con sus sesiones. Si falla el detalle se elimina el plan
   * recien creado; la cascada limpia las sesiones.
   *
   * @param {object} plan Columnas de `planes_estudio` sin id.
   * @param {Array<object>} sesiones Filas de `sesiones_estudio` sin id.
   * @returns {Promise<object>} Plan con sus sesiones guardadas.
   */
  async crearPlan(plan, sesiones) {
    const { data: guardado, error } = await this.requireClient()
      .from('planes_estudio')
      .insert(plan)
      .select(PLAN_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    try {
      const filas = await this.insertarSesiones(guardado.id, plan.usuario_id, sesiones);
      return { ...guardado, sesiones: filas };
    } catch (errorInsercion) {
      await this.eliminarPlan(plan.usuario_id, guardado.id).catch(() => {});
      throw errorInsercion;
    }
  }

  /**
   * @param {string} planId
   * @param {string} usuarioId
   * @param {Array<object>} sesiones
   * @returns {Promise<Array<object>>}
   */
  async insertarSesiones(planId, usuarioId, sesiones) {
    const filas = sesiones.map((sesion, indice) => ({
      usuario_id: usuarioId,
      plan_id: planId,
      tema: sesion.tema,
      actividades: sesion.actividades,
      tipo: sesion.tipo ?? null,
      fecha_inicio: sesion.fecha_inicio instanceof Date
        ? sesion.fecha_inicio.toISOString()
        : sesion.fecha_inicio,
      duracion_minutos: sesion.duracion_minutos,
      orden: sesion.orden ?? indice + 1,
      estado: 'pendiente',
    }));

    const { data, error } = await this.requireClient()
      .from('sesiones_estudio')
      .insert(filas)
      .select(SESION_COLUMNS)
      .order('orden', { ascending: true });

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * Inserta una sesion suelta en un plan existente.
   *
   * @param {string} usuarioId
   * @param {object} sesion
   * @returns {Promise<object>}
   */
  async crearSesion(usuarioId, sesion) {
    const { data, error } = await this.requireClient()
      .from('sesiones_estudio')
      .insert({
        usuario_id: usuarioId,
        plan_id: sesion.plan_id,
        tema: sesion.tema,
        actividades: sesion.actividades,
        tipo: sesion.tipo ?? null,
        fecha_inicio: sesion.fecha_inicio instanceof Date
          ? sesion.fecha_inicio.toISOString()
          : sesion.fecha_inicio,
        duracion_minutos: sesion.duracion_minutos,
        orden: sesion.orden,
        estado: 'pendiente',
      })
      .select(SESION_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Lista los planes del usuario, del mas reciente al mas antiguo.
   *
   * @param {string} usuarioId
   * @param {{ limit: number, offset: number }} paginacion
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listarPlanes(usuarioId, { limit, offset }) {
    const { data, error, count } = await this.requireClient()
      .from('planes_estudio')
      .select(PLAN_COLUMNS, { count: 'exact' })
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
   * @param {string} planId
   * @returns {Promise<object | null>}
   */
  async obtenerPlanPorId(usuarioId, planId) {
    const { data, error } = await this.requireClient()
      .from('planes_estudio')
      .select(PLAN_COLUMNS)
      .eq('usuario_id', usuarioId)
      .eq('id', planId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * @param {string} planId
   * @returns {Promise<Array<object>>}
   */
  async listarSesiones(planId) {
    const { data, error } = await this.requireClient()
      .from('sesiones_estudio')
      .select(SESION_COLUMNS)
      .eq('plan_id', planId)
      .order('orden', { ascending: true });

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * @param {string} usuarioId
   * @param {string} sesionId
   * @returns {Promise<object | null>}
   */
  async obtenerSesionPorId(usuarioId, sesionId) {
    const { data, error } = await this.requireClient()
      .from('sesiones_estudio')
      .select(SESION_COLUMNS)
      .eq('usuario_id', usuarioId)
      .eq('id', sesionId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * @param {string} usuarioId
   * @param {string} planId
   * @param {object} cambios
   * @returns {Promise<object>}
   */
  async actualizarPlan(usuarioId, planId, cambios) {
    const { data, error } = await this.requireClient()
      .from('planes_estudio')
      .update({ ...cambios, fecha_actualizacion: new Date().toISOString() })
      .eq('usuario_id', usuarioId)
      .eq('id', planId)
      .select(PLAN_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * @param {string} usuarioId
   * @param {string} sesionId
   * @param {object} cambios
   * @returns {Promise<object>}
   */
  async actualizarSesion(usuarioId, sesionId, cambios) {
    const actualizacion = { ...cambios, fecha_actualizacion: new Date().toISOString() };

    if (actualizacion.fecha_inicio instanceof Date) {
      actualizacion.fecha_inicio = actualizacion.fecha_inicio.toISOString();
    }

    const { data, error } = await this.requireClient()
      .from('sesiones_estudio')
      .update(actualizacion)
      .eq('usuario_id', usuarioId)
      .eq('id', sesionId)
      .select(SESION_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * @param {string} usuarioId
   * @param {string} sesionId
   * @returns {Promise<void>}
   */
  async eliminarSesion(usuarioId, sesionId) {
    const { error } = await this.requireClient()
      .from('sesiones_estudio')
      .delete()
      .eq('usuario_id', usuarioId)
      .eq('id', sesionId);

    if (error) {
      throw error;
    }
  }

  /**
   * @param {string} usuarioId
   * @param {string} planId
   * @returns {Promise<void>}
   */
  async eliminarPlan(usuarioId, planId) {
    const { error } = await this.requireClient()
      .from('planes_estudio')
      .delete()
      .eq('usuario_id', usuarioId)
      .eq('id', planId);

    if (error) {
      throw error;
    }
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('PlanEstudioRepository requiere un cliente de Supabase.');
    }

    return this.supabase;
  }
}

module.exports = PlanEstudioRepository;
module.exports.PLAN_COLUMNS = PLAN_COLUMNS;
module.exports.SESION_COLUMNS = SESION_COLUMNS;
