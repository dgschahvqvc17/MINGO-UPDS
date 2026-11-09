/**
 * Controlador HTTP para el módulo de administración de usuarios.
 * Valida entradas con Zod, maneja errores y responde en formato estándar.
 */
const {
  usuarioBusquedaSchema,
  usuarioActualizarRolesSchema,
  usuarioActualizarEstadoSchema,
  usuarioIdParamSchema
} = require('../models/usuario.model');

class UsuarioAdminController {
  constructor(service) {
    this.service = service;
  }

  /**
   * Lista usuarios con opciones de búsqueda y paginación.
   */
  listarUsuarios = async (req, res, next) => {
    try {
      // Validar y parsear parámetros de búsqueda
      const filtrosValidados = usuarioBusquedaSchema.parse(req.query);
      
      const resultado = await this.service.listarUsuarios(filtrosValidados);
      
      res.json({
        success: true,
        data: resultado.usuarios,
        meta: {
          paginacion: resultado.paginacion,
          estadisticas: resultado.estadisticas
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtiene un usuario específico por ID.
   */
  obtenerUsuario = async (req, res, next) => {
    try {
      // Validar ID del usuario
      const { id: usuarioId } = usuarioIdParamSchema.parse(req.params);
      
      const usuario = await this.service.obtenerUsuario(usuarioId);
      
      res.json({
        success: true,
        data: usuario
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtiene todos los roles disponibles en el sistema.
   */
  obtenerRolesDisponibles = async (req, res, next) => {
    try {
      const roles = await this.service.obtenerRolesDisponibles();
      
      res.json({
        success: true,
        data: roles
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Actualiza los roles de un usuario.
   */
  actualizarRolesUsuario = async (req, res, next) => {
    try {
      // Validar parámetros
      const { id: usuarioId } = usuarioIdParamSchema.parse(req.params);
      const { roles } = usuarioActualizarRolesSchema.parse(req.body);
      
      const resultado = await this.service.actualizarRolesUsuario(usuarioId, roles);
      
      res.json({
        success: true,
        data: {
          usuarioId: resultado.usuarioId,
          roles: resultado.roles,
          mensaje: resultado.mensaje
        },
        meta: {
          operacion: resultado.operacion
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Actualiza el estado (activo/inactivo) de un usuario.
   */
  actualizarEstadoUsuario = async (req, res, next) => {
    try {
      // Validar parámetros
      const { id: usuarioId } = usuarioIdParamSchema.parse(req.params);
      const { estado } = usuarioActualizarEstadoSchema.parse(req.body);
      
      const resultado = await this.service.actualizarEstadoUsuario(usuarioId, estado);
      
      res.json({
        success: true,
        data: {
          usuarioId: resultado.usuarioId,
          estado: resultado.estado,
          mensaje: resultado.mensaje
        },
        meta: {
          operacion: resultado.operacion
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Busca usuarios por término (nombre, apellido o correo).
   */
  buscarUsuarios = async (req, res, next) => {
    try {
      const { termino } = req.query;
      
      if (!termino || termino.trim().length < 2) {
        return res.json({
          success: true,
          data: [],
          meta: { mensaje: 'Término de búsqueda muy corto' }
        });
      }
      
      const usuarios = await this.service.buscarUsuarios(termino.trim(), 20);
      
      res.json({
        success: true,
        data: usuarios
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = UsuarioAdminController;