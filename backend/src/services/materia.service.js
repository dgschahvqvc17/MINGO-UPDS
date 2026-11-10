/**
 * Servicio de gestión de materias académicas.
 * Implementa lógica de negocio para CRUD de materias.
 * Valida que cada usuario solo acceda a sus propias materias.
 */
const ApiError = require('../utils/ApiError');
const { 
  materiaCrearSchema, 
  materiaActualizarSchema,
  materiaBusquedaSchema,
  materiaCambiarEstadoSchema,
  COLORES_DISPONIBLES 
} = require('../models/materia.model');

class MateriaService {
  constructor(repository, usuarioActualId) {
    this.repository = repository;
    this.usuarioActualId = usuarioActualId; // ID del usuario que realiza la operación
  }

  /**
   * Lista materias del usuario con opciones de búsqueda y paginación.
   * @param {Object} filtros - Filtros de búsqueda
   * @returns {Promise<Object>} Lista paginada de materias
   */
  async listarMaterias(filtros = {}) {
    try {
      // Validar filtros
      const filtrosValidados = materiaBusquedaSchema.parse(filtros);
      
      const materias = await this.repository.listarMaterias(this.usuarioActualId, filtrosValidados);
      const estadisticas = await this.repository.obtenerEstadisticas(this.usuarioActualId);
      const periodos = await this.repository.obtenerPeriodosAcademicos(this.usuarioActualId);

      return {
        materias,
        paginacion: {
          limit: filtrosValidados.limit,
          offset: filtrosValidados.offset,
          total: parseInt(estadisticas.total || 0)
        },
        estadisticas: {
          total: parseInt(estadisticas.total || 0),
          activas: parseInt(estadisticas.activas || 0),
          archivadas: parseInt(estadisticas.archivadas || 0),
          por_periodo: estadisticas.por_periodo || {}
        },
        periodos_academicos: periodos,
        colores_disponibles: COLORES_DISPONIBLES
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Error al listar materias: ${error.message}`);
    }
  }

  /**
   * Obtiene una materia por ID con validación de propiedad.
   * @param {string} materiaId - UUID de la materia
   * @returns {Promise<Object>} Materia con detalles
   */
  async obtenerMateria(materiaId) {
    const materia = await this.repository.obtenerMateriaPorId(this.usuarioActualId, materiaId);

    if (!materia) {
      throw ApiError.notFound('Materia no encontrada o no tienes permisos para acceder a ella');
    }

    return materia;
  }

  /**
   * Crea una nueva materia para el usuario actual.
   * @param {Object} materiaData - Datos de la materia
   * @returns {Promise<Object>} Materia creada
   */
  async crearMateria(materiaData) {
    try {
      // Validar datos de entrada
      const datosValidados = materiaCrearSchema.parse(materiaData);

      // Verificar límite de materias activas (opcional, para prevenir abuso)
      const estadisticas = await this.repository.obtenerEstadisticas(this.usuarioActualId);
      const materiasActivas = parseInt(estadisticas.activas || 0);
      
      if (materiasActivas >= 50) { // Límite razonable
        throw ApiError.forbidden('Has alcanzado el límite máximo de materias activas (50)');
      }

      // Crear la materia
      const materiaCreada = await this.repository.crearMateria(this.usuarioActualId, datosValidados);
      
      // Registrar la operación
      const operacion = {
        tipo: 'CREACION_MATERIA',
        usuarioId: this.usuarioActualId,
        materiaId: materiaCreada.id,
        datos: datosValidados,
        fecha: new Date().toISOString()
      };

      return {
        mensaje: 'Materia creada exitosamente',
        materia: materiaCreada,
        operacion
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      if (error.message.includes('Ya existe una materia con el código')) {
        throw ApiError.conflict(error.message);
      }
      
      throw new ApiError(500, `Error al crear materia: ${error.message}`);
    }
  }

  /**
   * Actualiza una materia existente.
   * @param {string} materiaId - UUID de la materia
   * @param {Object} materiaData - Datos a actualizar
   * @returns {Promise<Object>} Materia actualizada
   */
  async actualizarMateria(materiaId, materiaData) {
    try {
      // Validar datos de entrada
      const datosValidados = materiaActualizarSchema.parse(materiaData);

      if (Object.keys(datosValidados).length === 0) {
        throw ApiError.badRequest('No se proporcionaron datos para actualizar');
      }

      // Verificar que la materia existe y pertenece al usuario
      const existe = await this.repository.existeMateria(this.usuarioActualId, materiaId);
      if (!existe) {
        throw ApiError.notFound('Materia no encontrada o no tienes permisos para modificarla');
      }

      // Obtener datos actuales para el registro
      const materiaActual = await this.repository.obtenerMateriaPorId(this.usuarioActualId, materiaId);
      
      // Actualizar la materia
      const materiaActualizada = await this.repository.actualizarMateria(
        this.usuarioActualId, 
        materiaId, 
        datosValidados
      );
      
      // Registrar la operación
      const cambios = Object.keys(datosValidados).reduce((acc, key) => {
        if (materiaActual[key] !== datosValidados[key]) {
          acc[key] = {
            anterior: materiaActual[key],
            nuevo: datosValidados[key]
          };
        }
        return acc;
      }, {});

      const operacion = {
        tipo: 'ACTUALIZACION_MATERIA',
        usuarioId: this.usuarioActualId,
        materiaId,
        cambios,
        fecha: new Date().toISOString()
      };

      return {
        mensaje: 'Materia actualizada exitosamente',
        materia: materiaActualizada,
        operacion
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      if (error.message.includes('Ya existe una materia con el código')) {
        throw ApiError.conflict(error.message);
      }
      
      throw new ApiError(500, `Error al actualizar materia: ${error.message}`);
    }
  }

  /**
   * Cambia el estado de una materia (activar/archivar).
   * @param {string} materiaId - UUID de la materia
   * @param {string} estado - 'activo' o 'archivado'
   * @returns {Promise<Object>} Resultado de la operación
   */
  async cambiarEstadoMateria(materiaId, estado) {
    try {
      // Validar estado
      const { estado: estadoValidado } = materiaCambiarEstadoSchema.parse({ estado });

      // Verificar que la materia existe y pertenece al usuario
      const materia = await this.repository.obtenerMateriaPorId(this.usuarioActualId, materiaId);
      if (!materia) {
        throw ApiError.notFound('Materia no encontrada o no tienes permisos para modificarla');
      }

      // No hacer nada si ya está en el estado solicitado
      if (materia.estado === estadoValidado) {
        return {
          mensaje: `La materia ya está en estado "${estadoValidado}"`,
          materia,
          estado: estadoValidado
        };
      }

      // Cambiar estado
      await this.repository.cambiarEstadoMateria(this.usuarioActualId, materiaId, estadoValidado);
      
      // Registrar la operación
      const operacion = {
        tipo: 'CAMBIO_ESTADO_MATERIA',
        usuarioId: this.usuarioActualId,
        materiaId,
        estado_anterior: materia.estado,
        estado_nuevo: estadoValidado,
        fecha: new Date().toISOString()
      };

      return {
        mensaje: `Materia ${estadoValidado === 'archivado' ? 'archivada' : 'activada'} exitosamente`,
        materiaId,
        estado: estadoValidado,
        operacion
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Error al cambiar estado de materia: ${error.message}`);
    }
  }

  /**
   * Busca materias por término (nombre, código o docente).
   * @param {string} termino - Término de búsqueda
   * @param {number} limit - Límite de resultados
   * @returns {Promise<Array>} Resultados de búsqueda
   */
  async buscarMaterias(termino, limit = 10) {
    try {
      return await this.repository.listarMaterias(this.usuarioActualId, {
        query: termino,
        limit,
        offset: 0
      });
    } catch (error) {
      throw new ApiError(500, `Error al buscar materias: ${error.message}`);
    }
  }

  /**
   * Obtiene estadísticas detalladas de materias.
   * @returns {Promise<Object>} Estadísticas
   */
  async obtenerEstadisticasDetalladas() {
    try {
      const estadisticas = await this.repository.obtenerEstadisticas(this.usuarioActualId);
      const periodos = await this.repository.obtenerPeriodosAcademicos(this.usuarioActualId);

      return {
        total: parseInt(estadisticas.total || 0),
        activas: parseInt(estadisticas.activas || 0),
        archivadas: parseInt(estadisticas.archivadas || 0),
        por_periodo: estadisticas.por_periodo || {},
        periodos_academicos: periodos
      };
    } catch (error) {
      throw new ApiError(500, `Error al obtener estadísticas: ${error.message}`);
    }
  }

  /**
   * Valida que el usuario pueda acceder a una materia específica.
   * @param {string} materiaId - UUID de la materia
   * @returns {Promise<boolean>} True si tiene acceso, false si no
   */
  async validarAccesoMateria(materiaId) {
    try {
      return await this.repository.existeMateria(this.usuarioActualId, materiaId);
    } catch {
      return false;
    }
  }

  /**
   * Obtiene los colores disponibles para materias.
   * @returns {Array<string>} Lista de colores hexadecimales
   */
  obtenerColoresDisponibles() {
    return COLORES_DISPONIBLES;
  }
}

// Métodos estáticos para validaciones comunes
MateriaService.validarPeriodoAcademico = (periodo) => {
  const regex = /^\d{4}-[12]$/;
  return regex.test(periodo);
};

MateriaService.generarPeriodoSiguiente = (periodoActual) => {
  if (!MateriaService.validarPeriodoAcademico(periodoActual)) {
    throw new Error('Periodo académico inválido');
  }
  
  const [anio, semestre] = periodoActual.split('-');
  
  if (semestre === '1') {
    return `${anio}-2`;
  } else {
    return `${(parseInt(anio) + 1).toString()}-1`;
  }
};

module.exports = MateriaService;