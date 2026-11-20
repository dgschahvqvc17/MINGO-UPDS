const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validationMiddleware = require('../middlewares/validation.middleware');
const asyncHandler = require('../utils/asyncHandler');
const {
  createPlanEstudioService,
  createPlanEstudioController,
} = require('../container');
const {
  planListarQuerySchema,
  planConfirmarSchema,
  planIdSchema,
  planActualizarSchema,
  planAgregarSesionSchema,
  sesionIdSchema,
  sesionActualizarSchema,
} = require('../models/plan-estudio.model');

const router = Router();

/**
 * Rutas de planes y sesiones de estudio (HU15).
 * Todas requieren autenticacion; el servicio filtra por el usuario del token.
 */
router.use(authMiddleware);

/**
 * Construye un handler que delega en el controlador de planes de estudio.
 * El servicio se compone por peticion para usar el cliente JWT del usuario.
 *
 * @param {'confirmar' | 'listar' | 'obtener' | 'actualizar' | 'descartar' | 'agregarSesion' | 'actualizarSesion' | 'eliminarSesion'} accion
 * @returns {import('express').RequestHandler}
 */
function atender(accion) {
  return asyncHandler((req, res) => {
    const planEstudioService = createPlanEstudioService(req.user.id, req.accessToken);
    const controller = createPlanEstudioController(planEstudioService);
    return controller[accion](req, res);
  });
}

/**
 * GET /estudio/planes
 * Lista los planes del usuario con paginacion.
 */
router.get(
  '/planes',
  validationMiddleware({ query: planListarQuerySchema }),
  atender('listar'),
);

/**
 * POST /estudio/planes
 * Persiste un plan propuesto y confirmado, creando sus eventos de calendario.
 */
router.post(
  '/planes',
  validationMiddleware({ body: planConfirmarSchema }),
  atender('confirmar'),
);

/**
 * GET /estudio/planes/:id
 * Devuelve un plan propio con sus sesiones.
 */
router.get(
  '/planes/:id',
  validationMiddleware({ params: planIdSchema }),
  atender('obtener'),
);

/**
 * PUT /estudio/planes/:id
 * Actualiza los parametros editables de un plan propio.
 */
router.put(
  '/planes/:id',
  validationMiddleware({ params: planIdSchema, body: planActualizarSchema }),
  atender('actualizar'),
);

/**
 * DELETE /estudio/planes/:id
 * Descarta un plan propio y elimina sus eventos de calendario.
 */
router.delete(
  '/planes/:id',
  validationMiddleware({ params: planIdSchema }),
  atender('descartar'),
);

/**
 * POST /estudio/planes/:id/sesiones
 * Agrega una sesion a un plan propio y la muestra en el calendario.
 */
router.post(
  '/planes/:id/sesiones',
  validationMiddleware({ params: planIdSchema, body: planAgregarSesionSchema }),
  atender('agregarSesion'),
);

/**
 * PATCH /estudio/sesiones/:id
 * Edita una sesion propia o cambia su estado.
 */
router.patch(
  '/sesiones/:id',
  validationMiddleware({ params: sesionIdSchema, body: sesionActualizarSchema }),
  atender('actualizarSesion'),
);

/**
 * DELETE /estudio/sesiones/:id
 * Elimina una sesion propia junto con su evento de calendario.
 */
router.delete(
  '/sesiones/:id',
  validationMiddleware({ params: sesionIdSchema }),
  atender('eliminarSesion'),
);

module.exports = router;
