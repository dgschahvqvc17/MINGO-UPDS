/**
 * Controlador HTTP para el módulo de gestión de materias académicas.
 * Valida entradas con Zod, maneja errores y responde en formato estándar.
 * Cada usuario solo puede acceder a sus propias materias.
 */
const { 
  materiaBusquedaSchema,
  materiaCrearSchema,
  materiaActualizarSchema,
  materiaIdParamSchema,
  materiaCambiarEstadoSchema
} = require('../models/materia.model');

class MateriaController {
  constructor(service) {
    this.service = service;
  }

  /**
   * Lista materias del usuario con opciones de búsqueda y paginación.
   */
  listarMaterias = async (req, res, next) => {
    try {
      // Validar y parsear parámetros de búsqueda
      const filtrosValidados = materiaBusquedaSchema.parse(req.query);
      
      const resultado = await this.service.listarMaterias(filtrosValidados);
      
      res.status(200).json({
        success: true,
        data: resultado.materias,
        meta: {
          paginacion: resultado.paginacion,
          estadisticas: resultado.estadisticas,
          periodos_academicos: resultado.periodos_academicos,
          colores_disponibles: resultado.colores_disponibles
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtiene una materia específica por ID.
   */
  obtenerMateria = async (req, res, next) => {
    try {
      // Validar ID de la materia
      const { id: materiaId } = materiaIdParamSchema.parse(req.params);
      
      const materia = await this.service.obtenerMateria(materiaId);
      
      res.status(200).json({
        success: true,
        data: materia
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Crea una nueva materia para el usuario actual.
   */
  crearMateria = async (req, res, next) => {
    try {
      // Validar datos de entrada
      const materiaData = materiaCrearSchema.parse(req.body);
      
      const resultado = await this.service.crearMateria(materiaData);
      
      res.status(201).json({
        success: true,
        message: resultado.mensaje,
        data: resultado.materia,
        meta: {
          operacion: resultado.operacion
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Actualiza una materia existente.
   */
  actualizarMateria = async (req, res, next) => {
    try {
      // Validar ID de la materia
      const { id: materiaId } = materiaIdParamSchema.parse(req.params);
      
      // Validar datos de actualización
      const materiaData = materiaActualizarSchema.parse(req.body);
      
      const resultado = await this.service.actualizarMateria(materiaId, materiaData);
      
      res.status(200).json({
        success: true,
        message: resultado.mensaje,
        data: resultado.materia,
        meta: {
          operacion: resultado.operacion
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Cambia el estado de una materia (activar/archivar).
   */
  cambiarEstadoMateria = async (req, res, next) => {
    try {
      // Validar ID de la materia
      const { id: materiaId } = materiaIdParamSchema.parse(req.params);
      
      // Validar estado
      const { estado } = materiaCambiarEstadoSchema.parse(req.body);
      
      const resultado = await this.service.cambiarEstadoMateria(materiaId, estado);
      
      res.status(200).json({
        success: true,
        message: resultado.mensaje,
        data: {
          materiaId: resultado.materiaId,
          estado: resultado.estado
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
   * Busca materias por término (nombre, código o docente).
   */
  buscarMaterias = async (req, res, next) => {
    try {
      const { q: termino, limit = 10 } = req.query;
      
      if (!termino || termino.trim().length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          meta: {
            termino: '',
            total: 0
          }
        });
      }
      
      const materias = await this.service.buscarMaterias(termino, parseInt(limit));
      
      res.status(200).json({
        success: true,
        data: materias,
        meta: {
          termino,
          total: materias.length,
          limit: parseInt(limit)
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtiene estadísticas detalladas de materias.
   */
  obtenerEstadisticas = async (req, res, next) => {
    try {
      const estadisticas = await this.service.obtenerEstadisticasDetalladas();
      const colores = this.service.obtenerColoresDisponibles();
      
      res.status(200).json({
        success: true,
        data: estadisticas,
        meta: {
          colores_disponibles: colores
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtiene los colores disponibles para materias.
   */
  obtenerColoresDisponibles = async (req, res, next) => {
    try {
      const colores = this.service.obtenerColoresDisponibles();
      
      res.status(200).json({
        success: true,
        data: colores,
        meta: {
          total: colores.length
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Obtiene los periodos académicos del usuario.
   */
  obtenerPeriodosAcademicos = async (req, res, next) => {
    try {
      const resultado = await this.service.listarMaterias({});
      
      res.status(200).json({
        success: true,
        data: resultado.periodos_academicos,
        meta: {
          total: resultado.periodos_academicos.length
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Valida si el usuario tiene acceso a una materia específica.
   */
  validarAccesoMateria = async (req, res, next) => {
    try {
      const { id: materiaId } = materiaIdParamSchema.parse(req.params);
      
      const tieneAcceso = await this.service.validarAccesoMateria(materiaId);
      
      res.status(200).json({
        success: true,
        data: {
          tieneAcceso,
          materiaId
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = MateriaController;