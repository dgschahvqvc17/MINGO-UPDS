/**
 * Repositorio para operaciones CRUD de materias académicas.
 * Cada usuario solo puede acceder a sus propias materias (controlado por RLS).
 */
class MateriaRepository {
  constructor(dbClient) {
    this.db = dbClient;
  }

  /**
   * Lista materias de un usuario con opciones de búsqueda y paginación.
   * @param {string} usuarioId - UUID del usuario
   * @param {Object} options - Opciones de búsqueda
   * @returns {Promise<Array>} Lista de materias
   */
  async listarMaterias(usuarioId, { query, periodo_academico, estado, limit = 20, offset = 0 }) {
    const params = [usuarioId];
    let whereClauses = ['m.usuario_id = $1'];
    let paramCount = 2;

    // Construir condiciones WHERE dinámicamente
    if (query) {
      whereClauses.push(
        `(m.nombre ILIKE $${paramCount} OR m.codigo ILIKE $${paramCount} OR m.docente ILIKE $${paramCount})`
      );
      params.push(`%${query}%`);
      paramCount++;
    }

    if (periodo_academico) {
      whereClauses.push(`m.periodo_academico = $${paramCount}`);
      params.push(periodo_academico);
      paramCount++;
    }

    if (estado) {
      whereClauses.push(`m.estado = $${paramCount}`);
      params.push(estado);
      paramCount++;
    }

    // Construir la consulta principal
    let sql = `
      SELECT 
        m.id,
        m.usuario_id,
        m.nombre,
        m.codigo,
        m.docente,
        m.descripcion,
        m.periodo_academico,
        m.color,
        m.estado,
        m.fecha_creacion,
        m.fecha_actualizacion,
        COUNT(t.id) as total_tareas,
        COUNT(t.id) FILTER (WHERE t.estado = 'pendiente') as tareas_pendientes,
        COUNT(d.id) as total_documentos
      FROM public.materias m
      LEFT JOIN public.tareas t ON m.id = t.materia_id AND t.estado != 'eliminado'
      LEFT JOIN public.documentos d ON m.id = d.materia_id AND d.estado != 'eliminado'
    `;

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    sql += `
      GROUP BY m.id, m.usuario_id, m.nombre, m.codigo, m.docente, m.descripcion, 
               m.periodo_academico, m.color, m.estado, m.fecha_creacion, m.fecha_actualizacion
      ORDER BY 
        CASE WHEN m.estado = 'activo' THEN 1 ELSE 2 END,
        m.periodo_academico DESC,
        m.nombre ASC
      LIMIT $${paramCount}
      OFFSET $${paramCount + 1}
    `;

    params.push(limit, offset);

    const { data, error } = await this.db.query(sql, params);

    if (error) {
      throw new Error(`Error al listar materias: ${error.message}`, { cause: error });
    }

    return data;
  }

  /**
   * Obtiene una materia específica por ID verificando propiedad.
   * @param {string} usuarioId - UUID del usuario
   * @param {string} materiaId - UUID de la materia
   * @returns {Promise<Object|null>} Materia con detalles o null si no existe/no pertenece
   */
  async obtenerMateriaPorId(usuarioId, materiaId) {
    const { data, error } = await this.db.query(
      `
      SELECT 
        m.id,
        m.usuario_id,
        m.nombre,
        m.codigo,
        m.docente,
        m.descripcion,
        m.periodo_academico,
        m.color,
        m.estado,
        m.fecha_creacion,
        m.fecha_actualizacion,
        COUNT(t.id) as total_tareas,
        COUNT(t.id) FILTER (WHERE t.estado = 'pendiente') as tareas_pendientes,
        COUNT(d.id) as total_documentos
      FROM public.materias m
      LEFT JOIN public.tareas t ON m.id = t.materia_id AND t.estado != 'eliminado'
      LEFT JOIN public.documentos d ON m.id = d.materia_id AND d.estado != 'eliminado'
      WHERE m.id = $1 AND m.usuario_id = $2
      GROUP BY m.id, m.usuario_id, m.nombre, m.codigo, m.docente, m.descripcion, 
               m.periodo_academico, m.color, m.estado, m.fecha_creacion, m.fecha_actualizacion
      `,
      [materiaId, usuarioId]
    );

    if (error) {
      throw new Error(`Error al obtener materia: ${error.message}`, { cause: error });
    }

    if (data.length === 0) {
      return null;
    }

    return data[0];
  }

  /**
   * Crea una nueva materia para un usuario.
   * @param {string} usuarioId - UUID del usuario
   * @param {Object} materiaData - Datos de la materia
   * @returns {Promise<Object>} Materia creada
   */
  async crearMateria(usuarioId, materiaData) {
    const { nombre, codigo, docente, descripcion, periodo_academico, color } = materiaData;

    const { data, error } = await this.db.query(
      `
      INSERT INTO public.materias (
        usuario_id, nombre, codigo, docente, descripcion, 
        periodo_academico, color, estado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'activo')
      RETURNING 
        id, usuario_id, nombre, codigo, docente, descripcion, 
        periodo_academico, color, estado, fecha_creacion, fecha_actualizacion
      `,
      [usuarioId, nombre, codigo, docente, descripcion, periodo_academico, color]
    );

    if (error) {
      // Verificar si es error de duplicado (mismo código para el mismo usuario)
      if (error.code === '23505') {
        throw new Error(`Ya existe una materia con el código "${codigo}"`, { cause: error });
      }
      throw new Error(`Error al crear materia: ${error.message}`, { cause: error });
    }

    return data[0];
  }

  /**
   * Actualiza una materia existente.
   * @param {string} usuarioId - UUID del usuario
   * @param {string} materiaId - UUID de la materia
   * @param {Object} materiaData - Datos a actualizar
   * @returns {Promise<Object>} Materia actualizada
   */
  async actualizarMateria(usuarioId, materiaId, materiaData) {
    const updates = [];
    const params = [];
    let paramCount = 1;

    // Construir SET dinámicamente
    if (materiaData.nombre !== undefined) {
      updates.push(`nombre = $${paramCount}`);
      params.push(materiaData.nombre);
      paramCount++;
    }

    if (materiaData.codigo !== undefined) {
      updates.push(`codigo = $${paramCount}`);
      params.push(materiaData.codigo);
      paramCount++;
    }

    if (materiaData.docente !== undefined) {
      updates.push(`docente = $${paramCount}`);
      params.push(materiaData.docente);
      paramCount++;
    }

    if (materiaData.descripcion !== undefined) {
      updates.push(`descripcion = $${paramCount}`);
      params.push(materiaData.descripcion);
      paramCount++;
    }

    if (materiaData.periodo_academico !== undefined) {
      updates.push(`periodo_academico = $${paramCount}`);
      params.push(materiaData.periodo_academico);
      paramCount++;
    }

    if (materiaData.color !== undefined) {
      updates.push(`color = $${paramCount}`);
      params.push(materiaData.color);
      paramCount++;
    }

    if (materiaData.estado !== undefined) {
      updates.push(`estado = $${paramCount}`);
      params.push(materiaData.estado);
      paramCount++;
    }

    if (updates.length === 0) {
      throw new Error('No se proporcionaron datos para actualizar');
    }

    // Añadir fecha de actualización
    updates.push(`fecha_actualizacion = NOW()`);

    // Añadir parámetros de WHERE
    params.push(materiaId, usuarioId);

    const sql = `
      UPDATE public.materias
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND usuario_id = $${paramCount + 1}
      RETURNING 
        id, usuario_id, nombre, codigo, docente, descripcion, 
        periodo_academico, color, estado, fecha_creacion, fecha_actualizacion
    `;

    const { data, error } = await this.db.query(sql, params);

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Ya existe una materia con el código "${materiaData.codigo}"`, { cause: error });
      }
      throw new Error(`Error al actualizar materia: ${error.message}`, { cause: error });
    }

    if (data.length === 0) {
      throw new Error('Materia no encontrada o no tienes permisos para modificarla');
    }

    return data[0];
  }

  /**
   * Cambia el estado de una materia (activar/archivar).
   * @param {string} usuarioId - UUID del usuario
   * @param {string} materiaId - UUID de la materia
   * @param {string} estado - Nuevo estado ('activo' o 'archivado')
   * @returns {Promise<void>}
   */
  async cambiarEstadoMateria(usuarioId, materiaId, estado) {
    const { error } = await this.db.query(
      `
      UPDATE public.materias
      SET estado = $1, fecha_actualizacion = NOW()
      WHERE id = $2 AND usuario_id = $3
      `,
      [estado, materiaId, usuarioId]
    );

    if (error) {
      throw new Error(`Error al cambiar estado de materia: ${error.message}`, { cause: error });
    }
  }

  /**
   * Verifica si una materia existe y pertenece al usuario.
   * @param {string} usuarioId - UUID del usuario
   * @param {string} materiaId - UUID de la materia
   * @returns {Promise<boolean>}
   */
  async existeMateria(usuarioId, materiaId) {
    const { data, error } = await this.db.query(
      'SELECT 1 FROM public.materias WHERE id = $1 AND usuario_id = $2',
      [materiaId, usuarioId]
    );

    if (error) {
      throw new Error(`Error al verificar materia: ${error.message}`, { cause: error });
    }

    return data.length > 0;
  }

  /**
   * Obtiene estadísticas de materias para un usuario.
   * @param {string} usuarioId - UUID del usuario
   * @returns {Promise<Object>} Estadísticas
   */
  async obtenerEstadisticas(usuarioId) {
    const { data, error } = await this.db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE estado = 'activo') as activas,
        COUNT(*) FILTER (WHERE estado = 'archivado') as archivadas,
        JSON_OBJECT_AGG(
          COALESCE(periodo_academico, 'sin-periodo'),
          COUNT(*)
        ) FILTER (WHERE periodo_academico IS NOT NULL) as por_periodo
      FROM public.materias
      WHERE usuario_id = $1
    `, [usuarioId]);

    if (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`, { cause: error });
    }

    return data[0];
  }

  /**
   * Obtiene los periodos académicos únicos de un usuario.
   * @param {string} usuarioId - UUID del usuario
   * @returns {Promise<Array>} Lista de periodos académicos
   */
  async obtenerPeriodosAcademicos(usuarioId) {
    const { data, error } = await this.db.query(
      `
      SELECT DISTINCT periodo_academico
      FROM public.materias
      WHERE usuario_id = $1 AND periodo_academico IS NOT NULL
      ORDER BY periodo_academico DESC
      `,
      [usuarioId]
    );

    if (error) {
      throw new Error(`Error al obtener periodos académicos: ${error.message}`, { cause: error });
    }

    return data.map(row => row.periodo_academico);
  }
}

module.exports = MateriaRepository;