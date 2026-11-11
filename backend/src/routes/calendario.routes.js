const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validationMiddleware = require('../middlewares/validation.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { createCalendarioService, createCalendarioController } = require('../container');

const {
  eventoCrearSchema,
  eventoActualizarSchema,
  eventoBusquedaSchema,
  eventosProximosSchema,
  eventoIdParamSchema,
} = require('../models/calendario.model');

const router = Router();

/**
 * Rutas de gestión de eventos del calendario académico (HU05).
 * Todas requieren autenticación y RLS: cada usuario accede solo a sus eventos.
 */
router.use(authMiddleware);

/**
 * Inyecta el servicio con el cliente del usuario autenticado.
 */
router.use((req, _res, next) => {
  try {
    req.calendarioService = createCalendarioService(req.user.id, req.accessToken);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Construye un handler que delega en el controlador correspondiente.
 *
 * @param {keyof import('../controllers/calendario.controller')} accion
 * @returns {import('express').RequestHandler}
 */
function atender(accion) {
  return asyncHandler((req, res) => {
    const controller = createCalendarioController(req.calendarioService);
    return controller[accion](req, res);
  });
}

/**
 * GET /calendario/proximos
 * Eventos no completados próximos a iniciar.
 * Debe ir ANTES que GET /calendario para que no se capture como parámetro.
 */
router.get(
  '/proximos',
  validationMiddleware({ query: eventosProximosSchema }),
  atender('listarProximos'),
);

/**
 * GET /calendario
 * Lista con filtros por rango de fechas, materia, tipo, texto.
 * Requiere parámetros obligatorios: desde, hasta.
 */
router.get('/', validationMiddleware({ query: eventoBusquedaSchema }), atender('listarEventos'));

/**
 * POST /calendario
 * Crea un evento académico.
 */
router.post('/', validationMiddleware({ body: eventoCrearSchema }), atender('crearEvento'));

/**
 * GET /calendario/:id
 */
router.get(
  '/:id',
  validationMiddleware({ params: eventoIdParamSchema }),
  atender('obtenerEvento'),
);

/**
 * PUT /calendario/:id
 * Actualización total o parcial.
 */
router.put(
  '/:id',
  validationMiddleware({ params: eventoIdParamSchema }),
  validationMiddleware({ body: eventoActualizarSchema }),
  atender('actualizarEvento'),
);

/**
 * DELETE /calendario/:id
 */
router.delete(
  '/:id',
  validationMiddleware({ params: eventoIdParamSchema }),
  atender('eliminarEvento'),
);

module.exports = router;