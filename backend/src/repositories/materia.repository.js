/**
 * Acceso a datos de las materias académicas.
 * Usa el cliente de Supabase del usuario para que RLS se aplique en cada consulta.
 * No conoce HTTP ni reglas de negocio.
 */
const MATERIA_COLUMNS =
  'id, usuario_id, nombre, codigo, docente, descripcion, periodo_academico, color, estado, fecha_creacion, fecha_actualizacion';

// HU07 es la historia que agrega documentos. Hasta entonces el contador es cero.
const TOTAL_DOCUMENTOS_PENDIENTE = 0;

class MateriaRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * Lista las materias del usuario con filtros y paginación.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {object} filtros Filtros validados.
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listarMaterias(usuarioId, filtros = {}) {
    const { query, periodo_academico, estado, limit = 20, offset = 0 } = filtros;

    let builder = this.requireClient()
      .from('materias')
      .select(MATERIA_COLUMNS, { count: 'exact' })
      .eq('usuario_id', usuarioId);

    if (query) {
      // PostgREST usa comas y parentesis como sintaxis: se eliminan del termino.
      const terminoSeguro = String(query).replace(/[,()]/g, ' ').trim();

      if (terminoSeguro) {
        builder = builder.or(
          `nombre.ilike.%${terminoSeguro}%,codigo.ilike.%${terminoSeguro}%,docente.ilike.%${terminoSeguro}%`,
        );
      }
    }

    if (periodo_academico) {
      builder = builder.eq('periodo_academico', periodo_academico);
    }

    if (estado) {
      builder = builder.eq('estado', estado);
    }

    const { data, error, count } = await builder
      .order('estado', { ascending: true })
      .order('periodo_academico', { ascending: false })
      .order('nombre', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    const items = await this.agregarContadores(data ?? []);

    return { items, total: count ?? items.length };
  }

  /**
   * Obtiene una materia por ID verificando la propiedad con RLS.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {string} materiaId UUID de la materia.
   * @returns {Promise<object | null>}
   */
  async obtenerMateriaPorId(usuarioId, materiaId) {
    const { data, error } = await this.requireClient()
      .from('materias')
      .select(MATERIA_COLUMNS)
      .eq('id', materiaId)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const [materia] = await this.agregarContadores([data]);
    return materia;
  }

  /**
   * Crea una materia para el usuario.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {object} materiaData Datos validados.
   * @returns {Promise<object>}
   */
  async crearMateria(usuarioId, materiaData) {
    const { nombre, codigo, docente, descripcion, periodo_academico, color } = materiaData;

    const { data, error } = await this.requireClient()
      .from('materias')
      .insert({
        usuario_id: usuarioId,
        nombre,
        codigo,
        docente,
        descripcion: descripcion ?? null,
        periodo_academico,
        color: color ?? '#3B82F6',
        estado: 'activo',
      })
      .select(MATERIA_COLUMNS)
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Ya existe una materia con el código "${codigo}"`);
      }
      throw error;
    }

    const [materia] = await this.agregarContadores([data]);
    return materia;
  }

  /**
   * Actualiza una materia existente.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {string} materiaId UUID de la materia.
   * @param {object} materiaData Datos a actualizar.
   * @returns {Promise<object>}
   */
  async actualizarMateria(usuarioId, materiaId, materiaData) {
    const updates = { ...materiaData, fecha_actualizacion: new Date().toISOString() };

    if (Object.keys(materiaData).length === 0) {
      throw new Error('No se proporcionaron datos para actualizar');
    }

    const { data, error } = await this.requireClient()
      .from('materias')
      .update(updates)
      .eq('id', materiaId)
      .eq('usuario_id', usuarioId)
      .select(MATERIA_COLUMNS)
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Ya existe una materia con el código "${materiaData.codigo}"`);
      }
      throw error;
    }

    if (!data) {
      throw new Error('Materia no encontrada o no tienes permisos para modificarla');
    }

    const [materia] = await this.agregarContadores([data]);
    return materia;
  }

  /**
   * Cambia el estado de una materia.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {string} materiaId UUID de la materia.
   * @param {'activo' | 'archivado'} estado Nuevo estado.
   * @returns {Promise<void>}
   */
  async cambiarEstadoMateria(usuarioId, materiaId, estado) {
    const { error } = await this.requireClient()
      .from('materias')
      .update({ estado, fecha_actualizacion: new Date().toISOString() })
      .eq('id', materiaId)
      .eq('usuario_id', usuarioId);

    if (error) {
      throw error;
    }
  }

  /**
   * Verifica si una materia existe y pertenece al usuario.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {string} materiaId UUID de la materia.
   * @returns {Promise<boolean>}
   */
  async existeMateria(usuarioId, materiaId) {
    const { data, error } = await this.requireClient()
      .from('materias')
      .select('id')
      .eq('id', materiaId)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(data);
  }

  /**
   * Obtiene estadísticas de las materias del usuario.
   *
   * @param {string} usuarioId UUID del usuario.
   * @returns {Promise<{ total: number, activas: number, archivadas: number, por_periodo: Record<string, number> }>}
   */
  async obtenerEstadisticas(usuarioId) {
    const client = this.requireClient();
    const contar = (estado) => {
      let builder = client
        .from('materias')
        .select('id', { count: 'exact', head: true })
        .eq('usuario_id', usuarioId);

      if (estado) {
        builder = builder.eq('estado', estado);
      }

      return builder;
    };

    const [totalResult, activasResult, archivadasResult, periodosResult] = await Promise.all([
      contar(),
      contar('activo'),
      contar('archivado'),
      client.from('materias').select('periodo_academico').eq('usuario_id', usuarioId),
    ]);

    if (totalResult.error) throw totalResult.error;
    if (activasResult.error) throw activasResult.error;
    if (archivadasResult.error) throw archivadasResult.error;
    if (periodosResult.error) throw periodosResult.error;

    const porPeriodo = (periodosResult.data ?? []).reduce((acumulado, materia) => {
      const periodo = materia.periodo_academico || 'sin-periodo';
      acumulado[periodo] = (acumulado[periodo] ?? 0) + 1;
      return acumulado;
    }, {});

    return {
      total: totalResult.count ?? 0,
      activas: activasResult.count ?? 0,
      archivadas: archivadasResult.count ?? 0,
      por_periodo: porPeriodo,
    };
  }

  /**
   * Obtiene los periodos académicos distintos del usuario.
   *
   * @param {string} usuarioId UUID del usuario.
   * @returns {Promise<string[]>}
   */
  async obtenerPeriodosAcademicos(usuarioId) {
    const { data, error } = await this.requireClient()
      .from('materias')
      .select('periodo_academico')
      .eq('usuario_id', usuarioId)
      .not('periodo_academico', 'is', null);

    if (error) {
      throw error;
    }

    return [...new Set((data ?? []).map((materia) => materia.periodo_academico))]
      .filter(Boolean)
      .sort()
      .reverse();
  }

  /**
   * Agrega los contadores que consume la interfaz de materias.
   * Si la tabla de tareas todavía no existe (antes de apply la migración de HU04)
   * se devuelven ceros para no romper la lista de materias.
   *
   * @param {object[]} materias Materias sin contadores.
   * @returns {Promise<object[]>}
   */
  async agregarContadores(materias) {
    if (materias.length === 0) {
      return [];
    }

    const ids = materias.map((materia) => materia.id);
    const { data, error } = await this.requireClient()
      .from('tareas')
      .select('materia_id, estado')
      .in('materia_id', ids);

    if (error) {
      return materias.map((materia) => ({
        ...materia,
        total_tareas: 0,
        tareas_pendientes: 0,
        total_documentos: TOTAL_DOCUMENTOS_PENDIENTE,
      }));
    }

    const contadores = new Map();

    for (const tarea of data ?? []) {
      const actual = contadores.get(tarea.materia_id) ?? { total: 0, pendientes: 0 };
      actual.total += 1;

      if (tarea.estado === 'pendiente') {
        actual.pendientes += 1;
      }

      contadores.set(tarea.materia_id, actual);
    }

    return materias.map((materia) => {
      const contador = contadores.get(materia.id) ?? { total: 0, pendientes: 0 };

      return {
        ...materia,
        total_tareas: contador.total,
        tareas_pendientes: contador.pendientes,
        total_documentos: TOTAL_DOCUMENTOS_PENDIENTE,
      };
    });
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('Supabase no esta configurado en el servidor.');
    }

    return this.supabase;
  }
}

module.exports = MateriaRepository;
