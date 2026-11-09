/**
 * Repositorio para operaciones de administración de usuarios.
 * Requiere privilegios de administrador y ejecución con service_role para operaciones de RLS.
 */
class UsuarioAdminRepository {
  constructor(dbClient) {
    this.db = dbClient;
  }

  /**
   * Lista usuarios con sus roles, opcionalmente filtrados por búsqueda.
   * @param {Object} options - Opciones de búsqueda
   * @returns {Promise<Array>} Lista de usuarios con roles
   */
  async listarUsuarios({ query, estado, rol, limit = 50, offset = 0 }) {
    const params = [];
    let whereClauses = [];
    let paramCount = 1;

    // Construir condiciones WHERE dinámicamente
    if (query) {
      whereClauses.push(
        `(p.nombre ILIKE $${paramCount} OR p.apellido ILIKE $${paramCount} OR p.correo ILIKE $${paramCount})`
      );
      params.push(`%${query}%`);
      paramCount++;
    }

    if (estado) {
      whereClauses.push(`p.estado = $${paramCount}`);
      params.push(estado);
      paramCount++;
    }

    if (rol) {
      whereClauses.push(`r.nombre = $${paramCount}`);
      params.push(rol);
      paramCount++;
    }

    // Construir la consulta principal
    let sql = `
      SELECT 
        p.id,
        p.nombre,
        p.apellido,
        p.correo,
        p.carrera,
        p.estado,
        p.fecha_creacion,
        ARRAY_AGG(r.nombre ORDER BY r.nombre) as roles
      FROM public.perfiles p
      LEFT JOIN public.usuario_roles ur ON p.id = ur.usuario_id
      LEFT JOIN public.roles r ON ur.rol_id = r.id
    `;

    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    sql += `
      GROUP BY p.id, p.nombre, p.apellido, p.correo, p.carrera, p.estado, p.fecha_creacion
      ORDER BY p.fecha_creacion DESC
      LIMIT $${paramCount}
      OFFSET $${paramCount + 1}
    `;

    params.push(limit, offset);

    const { data, error } = await this.db.query(sql, params);

    if (error) {
      throw new Error(`Error al listar usuarios: ${error.message}`, { cause: error });
    }

    // Transformar NULL en array vacío para usuarios sin roles
    return data.map(user => ({
      ...user,
      roles: user.roles[0] ? user.roles.filter(Boolean) : []
    }));
  }

  /**
   * Obtiene un usuario por ID con detalles completos incluyendo roles.
   * @param {string} id - UUID del usuario
   * @returns {Promise<Object|null>} Usuario con detalles o null si no existe
   */
  async obtenerUsuarioPorId(id) {
    const { data, error } = await this.db.query(
      `
      SELECT 
        p.id,
        p.nombre,
        p.apellido,
        p.correo,
        p.carrera,
        p.estado,
        p.fecha_creacion,
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', r.id,
            'nombre', r.nombre,
            'descripcion', r.descripcion
          ) ORDER BY r.nombre
        ) as roles_detalle
      FROM public.perfiles p
      LEFT JOIN public.usuario_roles ur ON p.id = ur.usuario_id
      LEFT JOIN public.roles r ON ur.rol_id = r.id
      WHERE p.id = $1
      GROUP BY p.id, p.nombre, p.apellido, p.correo, p.carrera, p.estado, p.fecha_creacion
      `,
      [id]
    );

    if (error) {
      throw new Error(`Error al obtener usuario: ${error.message}`);
    }

    if (data.length === 0) {
      return null;
    }

    const usuario = data[0];
    // Filtrar NULLs del JSON_AGG cuando no hay roles
    usuario.roles_detalle = usuario.roles_detalle.filter(role => role.id !== null);
    
    return usuario;
  }

  /**
   * Obtiene todos los roles disponibles en el sistema.
   * @returns {Promise<Array>} Lista de roles
   */
  async obtenerRolesDisponibles() {
    const { data, error } = await this.db.query(
      'SELECT id, nombre, descripcion FROM public.roles ORDER BY nombre'
    );

    if (error) {
      throw new Error(`Error al obtener roles: ${error.message}`);
    }

    return data;
  }

  /**
   * Actualiza los roles de un usuario.
   * @param {string} usuarioId - UUID del usuario
   * @param {Array<string>} roles - Array de nombres de roles
   * @returns {Promise<void>}
   */
  async actualizarRolesUsuario(usuarioId, roles) {
    // Primero obtenemos los IDs de los roles solicitados
    const { data: rolesData, error: rolesError } = await this.db.query(
      'SELECT id, nombre FROM public.roles WHERE nombre = ANY($1::varchar[])',
      [roles]
    );

    if (rolesError) {
      throw new Error(`Error al obtener IDs de roles: ${rolesError.message}`);
    }

    // Verificamos que todos los roles solicitados existan
    if (rolesData.length !== roles.length) {
      const rolesEncontrados = rolesData.map(r => r.nombre);
      const rolesNoEncontrados = roles.filter(r => !rolesEncontrados.includes(r));
      throw new Error(`Roles no encontrados: ${rolesNoEncontrados.join(', ')}`);
    }

    // Comenzamos transacción para mantener consistencia
    const { error: beginError } = await this.db.query('BEGIN');
    if (beginError) throw new Error(`Error al iniciar transacción: ${beginError.message}`);

    try {
      // Eliminar todos los roles actuales del usuario
      const { error: deleteError } = await this.db.query(
        'DELETE FROM public.usuario_roles WHERE usuario_id = $1',
        [usuarioId]
      );

      if (deleteError) throw deleteError;

      // Insertar los nuevos roles
      for (const role of rolesData) {
        const { error: insertError } = await this.db.query(
          'INSERT INTO public.usuario_roles (usuario_id, rol_id) VALUES ($1, $2)',
          [usuarioId, role.id]
        );

        if (insertError) throw insertError;
      }

      // Commit de la transacción
      const { error: commitError } = await this.db.query('COMMIT');
      if (commitError) throw commitError;

    } catch (error) {
      // Rollback en caso de error
      await this.db.query('ROLLBACK');
      throw new Error(`Error al actualizar roles: ${error.message}`, { cause: error });
    }
  }

  /**
   * Actualiza el estado de un usuario.
   * @param {string} usuarioId - UUID del usuario
   * @param {string} estado - 'activo' o 'inactivo'
   * @returns {Promise<void>}
   */
  async actualizarEstadoUsuario(usuarioId, estado) {
    const { error } = await this.db.query(
      'UPDATE public.perfiles SET estado = $1 WHERE id = $2',
      [estado, usuarioId]
    );

    if (error) {
      throw new Error(`Error al actualizar estado: ${error.message}`);
    }
  }

  /**
   * Verifica si un usuario existe.
   * @param {string} usuarioId - UUID del usuario
   * @returns {Promise<boolean>}
   */
  async existeUsuario(usuarioId) {
    const { data, error } = await this.db.query(
      'SELECT 1 FROM public.perfiles WHERE id = $1',
      [usuarioId]
    );

    if (error) {
      throw new Error(`Error al verificar usuario: ${error.message}`);
    }

    return data.length > 0;
  }

  /**
   * Obtiene estadísticas de usuarios para el dashboard administrativo.
   * @returns {Promise<Object>} Estadísticas
   */
  async obtenerEstadisticas() {
    const { data, error } = await this.db.query(`
      SELECT 
        COUNT(*) as total_usuarios,
        COUNT(*) FILTER (WHERE estado = 'activo') as usuarios_activos,
        COUNT(*) FILTER (WHERE estado = 'inactivo') as usuarios_inactivos,
        COUNT(DISTINCT ur.usuario_id) FILTER (WHERE r.nombre = 'administrador') as total_administradores,
        COUNT(DISTINCT ur.usuario_id) FILTER (WHERE r.nombre = 'estudiante') as total_estudiantes
      FROM public.perfiles p
      LEFT JOIN public.usuario_roles ur ON p.id = ur.usuario_id
      LEFT JOIN public.roles r ON ur.rol_id = r.id
    `);

    if (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }

    return data[0];
  }
}

module.exports = UsuarioAdminRepository;