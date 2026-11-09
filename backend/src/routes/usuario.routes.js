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
  validationMiddleware({ schema: usuarioBusquedaSchema, source: 'query' }),
  asyncHandler(async (req, res) => {
    // Usar el servicio inyectado en el middleware
    const controller = new (require('../controllers/usuario-admin.controller'))(req.usuarioAdminService);
    await controller.listarUsuarios(req, res);
  })
);

/**
 * GET /usuarios/buscar
 * Búsqueda rápida de usuarios por nombre, apellido o correo
 */
router.get(
  '/buscar',
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/usuario-admin.controller'))(req.usuarioAdminService);
    await controller.buscarUsuarios(req, res);
  })
);

/**
 * GET /usuarios/roles
 * Obtiene todos los roles disponibles en el sistema
 */
router.get(
  '/roles',
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/usuario-admin.controller'))(req.usuarioAdminService);
    await controller.obtenerRolesDisponibles(req, res);
  })
);

/**
 * GET /usuarios/:id
 * Obtiene un usuario específico por ID
 */
router.get(
  '/:id',
  validationMiddleware({ schema: usuarioIdParamSchema, source: 'params' }),
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/usuario-admin.controller'))(req.usuarioAdminService);
    await controller.obtenerUsuario(req, res);
  })
);

/**
 * PATCH /usuarios/:id/roles
 * Actualiza los roles de un usuario
 */
router.patch(
  '/:id/roles',
  validationMiddleware({ schema: usuarioIdParamSchema, source: 'params' }),
  validationMiddleware({ schema: usuarioActualizarRolesSchema, source: 'body' }),
  noSelfModificationMiddleware,
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/usuario-admin.controller'))(req.usuarioAdminService);
    await controller.actualizarRolesUsuario(req, res);
  })
);

/**
 * PATCH /usuarios/:id/estado
 * Actualiza el estado (activo/inactivo) de un usuario
 */
router.patch(
  '/:id/estado',
  validationMiddleware({ schema: usuarioIdParamSchema, source: 'params' }),
  validationMiddleware({ schema: usuarioActualizarEstadoSchema, source: 'body' }),
  noSelfModificationMiddleware,
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/usuario-admin.controller'))(req.usuarioAdminService);
    await controller.actualizarEstadoUsuario(req, res);
  })
);

/**
 * Rutas de perfil de usuario (no administrativas)
 * Estas rutas solo requieren autenticación
 */
router.use(authMiddleware);

// TODO Sprint 1 (HU01): GET/PUT /perfil.

module.exports = router;
