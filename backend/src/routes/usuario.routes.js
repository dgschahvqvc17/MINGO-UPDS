const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const adminMiddleware = require('../middlewares/admin.middleware');
const noSelfModificationMiddleware = require('../middlewares/no-self-modification.middleware');
const validationMiddleware = require('../middlewares/validation.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { 
  createUsuarioAdminService 
} = require('../container');

const {
  usuarioBusquedaSchema,
  usuarioActualizarRolesSchema,
  usuarioActualizarEstadoSchema,
  usuarioIdParamSchema
} = require('../models/usuario.model');

const router = Router();

/**
 * Rutas de administración de usuarios
 * Estas rutas requieren autenticación y rol de administrador
 */
router.use(authMiddleware, adminMiddleware);

/**
 * Middleware para inyectar el servicio de administración con el ID del usuario actual
 */
router.use((req, _res, next) => {
  try {
    // Crear servicio con el ID del administrador actual
    req.usuarioAdminService = createUsuarioAdminService(req.user.id);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * GET /usuarios
 * Lista todos los usuarios con opciones de búsqueda y paginación
 */
router.get(
  '/',
  validationMiddleware({ query: usuarioBusquedaSchema }),
  asyncHandler(async (req, res, next) => {
    // Usar el servicio inyectado en el middleware
    const controller = new (require('../controllers/usuario-admin.controller'))(req.usuarioAdminService);
    await controller.listarUsuarios(req, res, next);
  })
);

/**
 * GET /usuarios/buscar
 * Búsqueda rápida de usuarios por nombre, apellido o correo
 */
router.get(
  '/buscar',
  asyncHandler(async (req, res, next) => {
    const controller = new (require('../controllers/usuario-admin.controller'))(req.usuarioAdminService);
    await controller.buscarUsuarios(req, res, next);
  })
);

/**
 * GET /usuarios/roles
 * Obtiene todos los roles disponibles en el sistema
 */
router.get(
  '/roles',
  asyncHandler(async (req, res, next) => {
    const controller = new (require('../controllers/usuario-admin.controller'))(req.usuarioAdminService);
    await controller.obtenerRolesDisponibles(req, res, next);
  })
);

/**
 * GET /usuarios/:id
 * Obtiene un usuario específico por ID
 */
router.get(
  '/:id',
  validationMiddleware({ params: usuarioIdParamSchema }),
  asyncHandler(async (req, res, next) => {
    const controller = new (require('../controllers/usuario-admin.controller'))(req.usuarioAdminService);
    await controller.obtenerUsuario(req, res, next);
  })
);

/**
 * PATCH /usuarios/:id/roles
 * Actualiza los roles de un usuario
 */
router.patch(
  '/:id/roles',
  validationMiddleware({ params: usuarioIdParamSchema }),
  validationMiddleware({ body: usuarioActualizarRolesSchema }),
  noSelfModificationMiddleware,
  asyncHandler(async (req, res, next) => {
    const controller = new (require('../controllers/usuario-admin.controller'))(req.usuarioAdminService);
    await controller.actualizarRolesUsuario(req, res, next);
  })
);

/**
 * PATCH /usuarios/:id/estado
 * Actualiza el estado (activo/inactivo) de un usuario
 */
router.patch(
  '/:id/estado',
  validationMiddleware({ params: usuarioIdParamSchema }),
  validationMiddleware({ body: usuarioActualizarEstadoSchema }),
  noSelfModificationMiddleware,
  asyncHandler(async (req, res, next) => {
    const controller = new (require('../controllers/usuario-admin.controller'))(req.usuarioAdminService);
    await controller.actualizarEstadoUsuario(req, res, next);
  })
);

/**
 * Rutas de perfil de usuario (no administrativas)
 * Estas rutas solo requieren autenticación
 */
router.use(authMiddleware);

// TODO Sprint 1 (HU01): GET/PUT /perfil.

module.exports = router;
