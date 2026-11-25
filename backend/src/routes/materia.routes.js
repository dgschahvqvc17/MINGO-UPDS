const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/roles.middleware');
const validationMiddleware = require('../middlewares/validation.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { createMateriaService } = require('../container');
const inscripcionRoutes = require('./inscripcion.routes');
const { ROLE_ADMINISTRADOR } = require('../models/roles.model');

const {
  materiaBusquedaSchema,
  materiaCrearSchema,
  materiaActualizarSchema,
  materiaIdParamSchema,
  materiaCambiarEstadoSchema
} = require('../models/materia.model');

const router = Router();

/**
 * Rutas de gestión de materias académicas
 * Estas rutas requieren autenticación (cualquier usuario puede gestionar sus propias materias)
 */
router.use(authMiddleware);

/**
 * Middleware para inyectar el servicio de materias con el ID del usuario actual
 */
router.use((req, _res, next) => {
  try {
    // Crear servicio con el cliente del usuario para que RLS se aplique.
    req.materiaService = createMateriaService(req.user.id, req.accessToken, req.user.role);
    next();
  } catch (error) {
    next(error);
  }
});

/** Gestión de inscripciones: admins y docente responsable. */
router.use('/:materiaId/inscripciones', inscripcionRoutes);

/**
 * GET /materias
 * Lista todas las materias del usuario con opciones de búsqueda y paginación
 */
router.get(
  '/',
  validationMiddleware({ query: materiaBusquedaSchema }),
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/materia.controller'))(req.materiaService);
    await controller.listarMaterias(req, res);
  })
);

/**
 * GET /materias/estadisticas
 * Obtiene estadísticas detalladas de las materias del usuario
 */
router.get(
  '/estadisticas',
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/materia.controller'))(req.materiaService);
    await controller.obtenerEstadisticas(req, res);
  })
);

/**
 * GET /materias/colores
 * Obtiene los colores disponibles para materias
 */
router.get(
  '/colores',
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/materia.controller'))(req.materiaService);
    await controller.obtenerColoresDisponibles(req, res);
  })
);

/**
 * GET /materias/periodos
 * Obtiene los periodos académicos del usuario
 */
router.get(
  '/periodos',
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/materia.controller'))(req.materiaService);
    await controller.obtenerPeriodosAcademicos(req, res);
  })
);

/**
 * GET /materias/buscar
 * Búsqueda rápida de materias por nombre, código o docente
 */
router.get(
  '/buscar',
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/materia.controller'))(req.materiaService);
    await controller.buscarMaterias(req, res);
  })
);

/**
 * GET /materias/:id
 * Obtiene una materia específica por ID
 */
router.get(
  '/:id',
  validationMiddleware({ params: materiaIdParamSchema }),
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/materia.controller'))(req.materiaService);
    await controller.obtenerMateria(req, res);
  })
);

/**
 * POST /materias
 * Crea una nueva materia para el usuario
 */
router.post(
  '/',
  requireRole(ROLE_ADMINISTRADOR),
  validationMiddleware({ body: materiaCrearSchema }),
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/materia.controller'))(req.materiaService);
    await controller.crearMateria(req, res);
  })
);

/**
 * PATCH /materias/:id
 * Actualiza una materia existente
 */
router.patch(
  '/:id',
  requireRole(ROLE_ADMINISTRADOR),
  validationMiddleware({ params: materiaIdParamSchema }),
  validationMiddleware({ body: materiaActualizarSchema }),
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/materia.controller'))(req.materiaService);
    await controller.actualizarMateria(req, res);
  })
);

/**
 * PATCH /materias/:id/estado
 * Cambia el estado de una materia (activar/archivar)
 */
router.patch(
  '/:id/estado',
  requireRole(ROLE_ADMINISTRADOR),
  validationMiddleware({ params: materiaIdParamSchema }),
  validationMiddleware({ body: materiaCambiarEstadoSchema }),
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/materia.controller'))(req.materiaService);
    await controller.cambiarEstadoMateria(req, res);
  })
);

/**
 * GET /materias/:id/acceso
 * Valida si el usuario tiene acceso a una materia específica
 */
router.get(
  '/:id/acceso',
  validationMiddleware({ params: materiaIdParamSchema }),
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/materia.controller'))(req.materiaService);
    await controller.validarAccesoMateria(req, res);
  })
);

module.exports = router;