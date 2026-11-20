const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validationMiddleware = require('../middlewares/validation.middleware');
const asyncHandler = require('../utils/asyncHandler');
const {
  createPlanEstudioService,
  createPlanEstudioController,
  createObjetivoService,
  createObjetivoController,
  createProgresoService,
  createProgresoController,
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
const {
  objetivoCrearSchema,
  objetivoActualizarSchema,
  objetivoListarQuerySchema,
  objetivoIdSchema,
} = require('../models/objetivo.model');

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
 * Delega en el controlador de objetivos (HU17).
 * El servicio se compone por peticion para usar el cliente JWT del usuario.
 *
 * @param {'listar' | 'obtener' | 'crear' | 'actualizar' | 'eliminar'} accion
 * @returns {import('express').RequestHandler}
 */
function atenderObjetivo(accion) {
  return asyncHandler((req, res) => {
    const objetivoService = createObjetivoService(req.user.id, req.accessToken);
    const controller = createObjetivoController(objetivoService);
    return controller[accion](req, res);
  });
}

/** @returns {import('express').RequestHandler} */
function atenderProgreso() {
  return asyncHandler((req, res) => {
    const progresoService = createProgresoService(req.user.id, req.accessToken);
    const controller = createProgresoController(progresoService);
    return controller.obtener(req, res);
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

/**
 * GET /estudio/progreso
 * Devuelve estadisticas agregadas de progreso academico (HU17).
 */
router.get('/progreso', atenderProgreso());

/**
 * GET /estudio/objetivos
 * Lista los objetivos del usuario, con filtro opcional por estado.
 */
router.get(
  '/objetivos',
  validationMiddleware({ query: objetivoListarQuerySchema }),
  atenderObjetivo('listar'),
);

/**
 * POST /estudio/objetivos
 * Registra un objetivo academico.
 */
router.post(
  '/objetivos',
  validationMiddleware({ body: objetivoCrearSchema }),
  atenderObjetivo('crear'),
);

/**
 * GET /estudio/objetivos/:id
 * Devuelve un objetivo propio.
 */
router.get(
  '/objetivos/:id',
  validationMiddleware({ params: objetivoIdSchema }),
  atenderObjetivo('obtener'),
);

/**
 * PUT /estudio/objetivos/:id
 * Modifica un objetivo propio, incluido su estado.
 */
router.put(
  '/objetivos/:id',
  validationMiddleware({ params: objetivoIdSchema, body: objetivoActualizarSchema }),
  atenderObjetivo('actualizar'),
);

/**
 * DELETE /estudio/objetivos/:id
 * Elimina un objetivo propio.
 */
router.delete(
  '/objetivos/:id',
  validationMiddleware({ params: objetivoIdSchema }),
  atenderObjetivo('eliminar'),
);

module.exports = router;
