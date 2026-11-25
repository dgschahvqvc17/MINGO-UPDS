/**
 * Acceso a datos de la administración de usuarios.
 *
 * Se ejecuta con el cliente service_role porque el panel necesita leer y
 * escribir perfiles de otros usuarios, algo que RLS no permite al cliente
 * autenticado. No conoce HTTP ni reglas de negocio.
 */
const PERFIL_COLUMNS =
  'id, nombre, apellido, correo, carrera, estado, requiere_cambio_clave, fecha_creacion';

const ROL_EMBED = 'id, nombre, descripcion';

/**
 * Supabase no permite combinar en un solo filtro columnas de una relación
 * embebida sin usar `!inner`. Sin el join interno, filtrar por rol devolvería
 * todos los perfiles.
 */
function construirSelect({ conFiltroRol }) {
  const usuarioRoles = conFiltroRol
    ? `usuario_roles!inner ( roles ( ${ROL_EMBED} ) )`
    : `usuario_roles ( roles ( ${ROL_EMBED} ) )`;

  return `${PERFIL_COLUMNS}, ${usuarioRoles}`;
}

/**
 * PostgREST interpreta comas, paréntesis y comodines en el filtro `or`.
 * Se eliminan para que un término de búsqueda no rompa la consulta.
 */
function sanearTerminoBusqueda(termino) {
  return String(termino)
    .replace(/[,()%*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extraerRoles(asignaciones = []) {
  return asignaciones.map((asignacion) => asignacion?.roles).filter(Boolean);
}

class UsuarioAdminRepository {
  /**
   * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
   */
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * Lista usuarios con sus roles, opcionalmente filtrados por búsqueda.
   *
   * @param {{ query?: string, estado?: string, rol?: string, limit?: number, offset?: number }} filtros
   * @returns {Promise<object[]>} Usuarios con `roles` como arreglo de nombres.
   */
  async listarUsuarios({ query, estado, rol, limit = 50, offset = 0 } = {}) {
    let builder = this.requireClient()
      .from('perfiles')
      .select(construirSelect({ conFiltroRol: Boolean(rol) }));

    if (query) {
      const termino = sanearTerminoBusqueda(query);

      if (termino) {
        builder = builder.or(
          `nombre.ilike.%${termino}%,apellido.ilike.%${termino}%,correo.ilike.%${termino}%`,
        );
      }
    }

    if (estado) {
      builder = builder.eq('estado', estado);
    }

    if (rol) {
      builder = builder.eq('usuario_roles.roles.nombre', rol);
    }

    const { data, error } = await builder
      .order('fecha_creacion', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Error al listar usuarios: ${error.message}`, { cause: error });
    }

    return (data ?? []).map(({ usuario_roles: asignaciones, ...perfil }) => ({
      ...perfil,
      roles: extraerRoles(asignaciones).map((rolEncontrado) => rolEncontrado.nombre),
    }));
  }

  /**
   * Obtiene un usuario por ID con el detalle de sus roles.
   *
   * @param {string} id UUID del usuario.
   * @returns {Promise<object | null>}
   */
  async obtenerUsuarioPorId(id) {
    const { data, error } = await this.requireClient()
      .from('perfiles')
      .select(`${PERFIL_COLUMNS}, usuario_roles ( roles ( ${ROL_EMBED} ) )`)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new Error(`Error al obtener usuario: ${error.message}`, { cause: error });
    }

    if (!data) {
      return null;
    }

    const { usuario_roles: asignaciones, ...perfil } = data;

    return {
      ...perfil,
      roles_detalle: extraerRoles(asignaciones),
    };
  }

  /**
   * Obtiene todos los roles disponibles en el sistema.
   *
   * @returns {Promise<Array<{ id: number, nombre: string, descripcion: string | null }>>}
   */
  async obtenerRolesDisponibles() {
    const { data, error } = await this.requireClient()
      .from('roles')
      .select(ROL_EMBED)
      .order('nombre', { ascending: true });

    if (error) {
      throw new Error(`Error al obtener roles: ${error.message}`, { cause: error });
    }

    return data ?? [];
  }

  /**
   * Reemplaza los roles de un usuario por los indicados.
   *
   * Supabase no expone transacciones multi-tabla desde el cliente REST, así que
   * se aplican primero las altas y luego las bajas, y ante cualquier fallo se
   * restauran exactamente las asignaciones anteriores.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {string[]} roles Nombres de los roles solicitados.
   * @returns {Promise<void>}
   */
  async actualizarRolesUsuario(usuarioId, roles) {
    const client = this.requireClient();
    const rolesSolicitados = await this.obtenerRolesPorNombre(client, roles);
    const idsPrevios = await this.obtenerIdsRolesUsuario(client, usuarioId);
    const idsNuevos = rolesSolicitados.map((rol) => rol.id);

    try {
      await this.aplicarCambiosDeRoles(client, usuarioId, idsPrevios, idsNuevos);
    } catch (error) {
      await this.restaurarRoles(client, usuarioId, idsPrevios);
      throw new Error(`Error al actualizar roles: ${error.message}`, { cause: error });
    }
  }

  /**
   * Actualiza el estado de un usuario.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {'activo' | 'inactivo'} estado Nuevo estado.
   * @returns {Promise<void>}
   */
  async actualizarEstadoUsuario(usuarioId, estado) {
    const { error } = await this.requireClient()
      .from('perfiles')
      .update({ estado })
      .eq('id', usuarioId);

    if (error) {
      throw new Error(`Error al actualizar estado: ${error.message}`, { cause: error });
    }
  }

  /**
   * Actualiza los datos del perfil creado por el administrador.
   *
   * @param {string} usuarioId UUID del usuario.
   * @param {{ nombre: string, apellido: string, carrera?: string | null }} datos
   * @returns {Promise<void>}
   */
  async actualizarPerfil(usuarioId, datos) {
    const { error } = await this.requireClient()
      .from('perfiles')
      .update({
        nombre: datos.nombre,
        apellido: datos.apellido,
        carrera: datos.carrera ?? null,
        requiere_cambio_clave: true,
      })
      .eq('id', usuarioId);

    if (error) {
      throw new Error(`Error al actualizar el perfil: ${error.message}`, { cause: error });
    }
  }

  /**
   * Marca la contraseña temporal como ya cambiada.
   *
   * @param {string} usuarioId UUID del usuario.
   * @returns {Promise<void>}
   */
  async marcarClaveCambiada(usuarioId) {
    const { error } = await this.requireClient()
      .from('perfiles')
      .update({ requiere_cambio_clave: false })
      .eq('id', usuarioId);

    if (error) {
      throw new Error(`Error al registrar el cambio de clave: ${error.message}`, { cause: error });
    }
  }

  /**
   * Verifica si un usuario existe.
   *
   * @param {string} usuarioId UUID del usuario.
   * @returns {Promise<boolean>}
   */
  async existeUsuario(usuarioId) {
    const { count, error } = await this.requireClient()
      .from('perfiles')
      .select('id', { count: 'exact', head: true })
      .eq('id', usuarioId);

    if (error) {
      throw new Error(`Error al verificar usuario: ${error.message}`, { cause: error });
    }

    return (count ?? 0) > 0;
  }

  /**
   * Obtiene las estadísticas del panel administrativo.
   *
   * @returns {Promise<{ total_usuarios: number, usuarios_activos: number, usuarios_inactivos: number, total_administradores: number, total_docentes: number, total_estudiantes: number }>}
   */
  async obtenerEstadisticas() {
    const client = this.requireClient();

    const contarPerfiles = (configurar = (builder) => builder) =>
      configurar(
        client.from('perfiles').select('id', { count: 'exact', head: true }),
      );

    const contarPorRol = (rol) =>
      client
        .from('usuario_roles')
        .select('usuario_id, roles!inner ( nombre )', { count: 'exact', head: true })
        .eq('roles.nombre', rol);

    const [total, activos, inactivos, administradores, docentes, estudiantes] = await Promise.all([
      contarPerfiles(),
      contarPerfiles((builder) => builder.eq('estado', 'activo')),
      contarPerfiles((builder) => builder.eq('estado', 'inactivo')),
      contarPorRol('administrador'),
      contarPorRol('docente'),
      contarPorRol('estudiante'),
    ]);

    const resultados = [total, activos, inactivos, administradores, docentes, estudiantes];
    const fallo = resultados.find((resultado) => resultado.error);

    if (fallo) {
      throw new Error(`Error al obtener estadísticas: ${fallo.error.message}`, {
        cause: fallo.error,
      });
    }

    return {
      total_usuarios: total.count ?? 0,
      usuarios_activos: activos.count ?? 0,
      usuarios_inactivos: inactivos.count ?? 0,
      total_administradores: administradores.count ?? 0,
      total_docentes: docentes.count ?? 0,
      total_estudiantes: estudiantes.count ?? 0,
    };
  }

  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} client
   * @param {string[]} roles Nombres de roles solicitados.
   * @returns {Promise<Array<{ id: number, nombre: string }>>}
   */
  async obtenerRolesPorNombre(client, roles) {
    const { data, error } = await client.from('roles').select('id, nombre').in('nombre', roles);

    if (error) {
      throw new Error(`Error al obtener IDs de roles: ${error.message}`, { cause: error });
    }

    const encontrados = (data ?? []).map((rol) => rol.nombre);
    const noEncontrados = roles.filter((rol) => !encontrados.includes(rol));

    if (noEncontrados.length > 0) {
      throw new Error(`Roles no encontrados: ${noEncontrados.join(', ')}`);
    }

    return data;
  }

  /**
   * @param {import('@supabase/supabase-js').SupabaseClient} client
   * @param {string} usuarioId UUID del usuario.
   * @returns {Promise<number[]>} IDs de los roles asignados.
   */
  async obtenerIdsRolesUsuario(client, usuarioId) {
    const { data, error } = await client
      .from('usuario_roles')
      .select('rol_id')
      .eq('usuario_id', usuarioId);

    if (error) {
      throw new Error(`Error al leer roles del usuario: ${error.message}`, { cause: error });
    }

    return (data ?? []).map((asignacion) => asignacion.rol_id);
  }

  /**
   * Aplica la diferencia entre los roles actuales y los solicitados.
   * Las altas van primero para no dejar al usuario sin roles si algo falla.
   *
   * @param {import('@supabase/supabase-js').SupabaseClient} client
   * @param {string} usuarioId UUID del usuario.
   * @param {number[]} idsActuales
   * @param {number[]} idsNuevos
   * @returns {Promise<void>}
   */
  async aplicarCambiosDeRoles(client, usuarioId, idsActuales, idsNuevos) {
    const idsAgregar = idsNuevos.filter((id) => !idsActuales.includes(id));
    const idsQuitar = idsActuales.filter((id) => !idsNuevos.includes(id));

    if (idsAgregar.length > 0) {
      const { error } = await client
        .from('usuario_roles')
        .insert(idsAgregar.map((rolId) => ({ usuario_id: usuarioId, rol_id: rolId })));

      if (error) throw error;
    }

    if (idsQuitar.length > 0) {
      const { error } = await client
        .from('usuario_roles')
        .delete()
        .eq('usuario_id', usuarioId)
        .in('rol_id', idsQuitar);

      if (error) throw error;
    }
  }

  /**
   * Compensación ante un fallo parcial: vuelve a dejar los roles previos.
   *
   * @param {import('@supabase/supabase-js').SupabaseClient} client
   * @param {string} usuarioId UUID del usuario.
   * @param {number[]} idsPrevios
   * @returns {Promise<void>}
   */
  async restaurarRoles(client, usuarioId, idsPrevios) {
    const { error: errorBorrado } = await client
      .from('usuario_roles')
      .delete()
      .eq('usuario_id', usuarioId);

    if (errorBorrado) {
      throw new Error(`Error al restaurar roles: ${errorBorrado.message}`, { cause: errorBorrado });
    }

    if (idsPrevios.length === 0) {
      return;
    }

    const { error: errorInsercion } = await client
      .from('usuario_roles')
      .insert(idsPrevios.map((rolId) => ({ usuario_id: usuarioId, rol_id: rolId })));

    if (errorInsercion) {
      throw new Error(`Error al restaurar roles: ${errorInsercion.message}`, {
        cause: errorInsercion,
      });
    }
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('Supabase no esta configurado en el servidor.');
    }

    return this.supabase;
  }
}

module.exports = UsuarioAdminRepository;
