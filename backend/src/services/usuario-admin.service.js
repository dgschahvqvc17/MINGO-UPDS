/**
 * Servicio de administración de usuarios.
 * Implementa lógica de negocio para la gestión de usuarios y roles.
 * Requiere validación de permisos y seguridad.
 */
const ApiError = require('../utils/ApiError');

class UsuarioAdminService {
  constructor(repository, usuarioActualId) {
    this.repository = repository;
    this.usuarioActualId = usuarioActualId; // ID del administrador que realiza la operación
  }

  /**
   * Lista usuarios con opciones de búsqueda y paginación.
   * @param {Object} filtros - Filtros de búsqueda
   * @returns {Promise<Object>} Lista paginada de usuarios
   */
  async listarUsuarios(filtros = {}) {
    try {
      const usuarios = await this.repository.listarUsuarios(filtros);
      const estadisticas = await this.repository.obtenerEstadisticas();

      return {
        usuarios,
        paginacion: {
          limit: filtros.limit || 50,
          offset: filtros.offset || 0,
          total: parseInt(estadisticas.total_usuarios || 0)
        },
        estadisticas: {
          total: parseInt(estadisticas.total_usuarios || 0),
          activos: parseInt(estadisticas.usuarios_activos || 0),
          inactivos: parseInt(estadisticas.usuarios_inactivos || 0),
          administradores: parseInt(estadisticas.total_administradores || 0),
          estudiantes: parseInt(estadisticas.total_estudiantes || 0)
        }
      };
    } catch (error) {
      throw new ApiError(500, `Error al listar usuarios: ${error.message}`);
    }
  }

  /**
   * Obtiene un usuario por ID con validación de existencia.
   * @param {string} usuarioId - UUID del usuario
   * @returns {Promise<Object>} Usuario con detalles
   */
  async obtenerUsuario(usuarioId) {
    const usuario = await this.repository.obtenerUsuarioPorId(usuarioId);

    if (!usuario) {
      throw ApiError.notFound('Usuario no encontrado');
    }

    return usuario;
  }

  /**
   * Obtiene todos los roles disponibles en el sistema.
   * @returns {Promise<Array>} Lista de roles
   */
  async obtenerRolesDisponibles() {
    try {
      return await this.repository.obtenerRolesDisponibles();
    } catch (error) {
      throw new ApiError(500, `Error al obtener roles: ${error.message}`);
    }
  }

  /**
   * Actualiza los roles de un usuario con validaciones de seguridad.
   * @param {string} usuarioId - UUID del usuario a modificar
   * @param {Array<string>} roles - Array de nombres de roles
   * @returns {Promise<Object>} Resultado de la operación
   */
  async actualizarRolesUsuario(usuarioId, roles) {
    // Validación de seguridad: un usuario no puede modificar sus propios roles
    if (usuarioId === this.usuarioActualId) {
      throw ApiError.forbidden('No puedes modificar tus propios privilegios');
    }

    // Verificar que el usuario existe
    const usuarioExiste = await this.repository.existeUsuario(usuarioId);
    if (!usuarioExiste) {
      throw ApiError.notFound('Usuario no encontrado');
    }

    // Validar que no se remuevan todos los administradores del sistema
    if (!roles.includes('administrador')) {
      const estadisticas = await this.repository.obtenerEstadisticas();
      const totalAdministradores = parseInt(estadisticas.total_administradores || 0);
      
      // Si este usuario es administrador y sería el único admin en el sistema
      const usuario = await this.repository.obtenerUsuarioPorId(usuarioId);
      const esAdministrador = usuario.roles_detalle.some(r => r.nombre === 'administrador');
      
      if (esAdministrador && totalAdministradores <= 1) {
        throw ApiError.forbidden('No se puede remover al único administrador del sistema');
      }
    }

    try {
      await this.repository.actualizarRolesUsuario(usuarioId, roles);
      
      // Registrar la operación (en un sistema real, se guardaría en una tabla de logs)
      const operacion = {
        tipo: 'ACTUALIZACION_ROLES',
        administradorId: this.usuarioActualId,
        usuarioId,
        rolesAnteriores: await this.obtenerRolesUsuario(usuarioId),
        rolesNuevos: roles,
        fecha: new Date().toISOString()
      };

      // Aquí normalmente se guardaría en una tabla de logs administrativos
      // Por ahora, solo retornamos la información

      return {
        mensaje: 'Roles actualizados exitosamente',
        usuarioId,
        roles,
        operacion
      };
    } catch (error) {
      throw new ApiError(500, `Error al actualizar roles: ${error.message}`);
    }
  }

  /**
   * Actualiza el estado de un usuario con validaciones de seguridad.
   * @param {string} usuarioId - UUID del usuario a modificar
   * @param {string} estado - 'activo' o 'inactivo'
   * @returns {Promise<Object>} Resultado de la operación
   */
  async actualizarEstadoUsuario(usuarioId, estado) {
    // Validación de seguridad: un usuario no puede modificar su propio estado
    if (usuarioId === this.usuarioActualId) {
      throw ApiError.forbidden('No puedes modificar tu propio estado');
    }

    // Verificar que el usuario existe
    const usuarioExiste = await this.repository.existeUsuario(usuarioId);
    if (!usuarioExiste) {
      throw ApiError.notFound('Usuario no encontrado');
    }

    // Validar que no se desactive al único administrador del sistema
    if (estado === 'inactivo') {
      const usuario = await this.repository.obtenerUsuarioPorId(usuarioId);
      const esAdministrador = usuario.roles_detalle.some(r => r.nombre === 'administrador');
      
      if (esAdministrador) {
        const estadisticas = await this.repository.obtenerEstadisticas();
        const totalAdministradores = parseInt(estadisticas.total_administradores || 0);
        
        if (totalAdministradores <= 1) {
          throw ApiError.forbidden('No se puede desactivar al único administrador del sistema');
        }
      }
    }

    try {
      await this.repository.actualizarEstadoUsuario(usuarioId, estado);
      
      // Registrar la operación
      const operacion = {
        tipo: 'ACTUALIZACION_ESTADO',
        administradorId: this.usuarioActualId,
        usuarioId,
        estadoAnterior: await this.obtenerEstadoUsuario(usuarioId),
        estadoNuevo: estado,
        fecha: new Date().toISOString()
      };

      return {
        mensaje: `Usuario ${estado === 'activo' ? 'activado' : 'desactivado'} exitosamente`,
        usuarioId,
        estado,
        operacion
      };
    } catch (error) {
      throw new ApiError(500, `Error al actualizar estado: ${error.message}`);
    }
  }

  /**
   * Métodos auxiliares internos
   */

  async obtenerRolesUsuario(usuarioId) {
    const usuario = await this.repository.obtenerUsuarioPorId(usuarioId);
    return usuario ? usuario.roles_detalle.map(r => r.nombre) : [];
  }

  async obtenerEstadoUsuario(usuarioId) {
    const usuario = await this.repository.obtenerUsuarioPorId(usuarioId);
    return usuario ? usuario.estado : null;
  }

  /**
   * Busca usuarios por nombre, apellido o correo.
   * @param {string} termino - Término de búsqueda
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>} Resultados de búsqueda
   */
  async buscarUsuarios(termino, limit = 10) {
    try {
      return await this.repository.listarUsuarios({
        query: termino,
        limit
      });
    } catch (error) {
      throw new ApiError(500, `Error al buscar usuarios: ${error.message}`);
    }
  }
}

module.exports = UsuarioAdminService;