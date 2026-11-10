const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validationMiddleware = require('../middlewares/validation.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { createTareaService, createTareaController } = require('../container');

const {
  tareaCrearSchema,
  tareaActualizarSchema,
  tareaEstadoSchema,
  tareaBusquedaSchema,
  tareasProximasSchema,
  tareaIdParamSchema,
} = require('../models/tarea.model');

const router = Router();

/**
 * Rutas de gestión de tareas académicas (HU04).
 * Todas requieren autenticación y RLS: cada usuario accede solo a sus tareas.
 */
router.use(authMiddleware);

/**
 * Inyecta el servicio con el cliente del usuario autenticado.
 */
router.use((req, _res, next) => {
  try {
    req.tareaService = createTareaService(req.user.id, req.accessToken);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Construye un handler que delega en el controlador correspondiente.
 *
 * @param {keyof import('../controllers/tarea.controller')} accion
 * @returns {import('express').RequestHandler}
 */
function atender(accion) {
  return asyncHandler((req, res) => {
    const controller = createTareaController(req.tareaService);
    return controller[accion](req, res);
  });
}

/**
 * GET /tareas/proximas
 * Tareas no completadas próximas a vencer.
 */
router.get(
  '/proximas',
  validationMiddleware({ query: tareasProximasSchema }),
  atender('listarProximas'),
);

/**
 * GET /tareas/estadisticas
 * Contadores por estado, prioridad y vencidas.
 */
router.get('/estadisticas', atender('obtenerEstadisticas'));

/**
 * GET /tareas
 * Lista con filtros por materia, estado, prioridad, tipo, texto y fechas.
 */
router.get('/', validationMiddleware({ query: tareaBusquedaSchema }), atender('listarTareas'));

/**
 * POST /tareas
 * Crea una tarea académica.
 */
router.post('/', validationMiddleware({ body: tareaCrearSchema }), atender('crearTarea'));

/**
 * GET /tareas/:id
 */
router.get(
  '/:id',
  validationMiddleware({ params: tareaIdParamSchema }),
  atender('obtenerTarea'),
);

/**
 * PUT /tareas/:id
 * Actualización total o parcial.
 */
router.put(
  '/:id',
  validationMiddleware({ params: tareaIdParamSchema }),
  validationMiddleware({ body: tareaActualizarSchema }),
  atender('actualizarTarea'),
);

/**
 * PATCH /tareas/:id/estado
 * Cambia el estado: pendiente, en_progreso o completada.
 */
router.patch(
  '/:id/estado',
  validationMiddleware({ params: tareaIdParamSchema }),
  validationMiddleware({ body: tareaEstadoSchema }),
  atender('cambiarEstadoTarea'),
);

/**
 * DELETE /tareas/:id
 */
router.delete(
  '/:id',
  validationMiddleware({ params: tareaIdParamSchema }),
  atender('eliminarTarea'),
);

module.exports = router;
