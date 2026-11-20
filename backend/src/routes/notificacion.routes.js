const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validationMiddleware = require('../middlewares/validation.middleware');
const asyncHandler = require('../utils/asyncHandler');
const {
  createNotificacionService,
  createNotificacionController,
} = require('../container');
const {
  notificacionIdSchema,
  notificacionListaQuerySchema,
  preferenciasActualizarSchema,
} = require('../models/notificacion.model');

const router = Router();

/**
 * Rutas de notificaciones (HU18). Todas requieren autenticacion; el servicio
 * compone sus repositorios con el cliente JWT para que RLS aplique.
 */
router.use(authMiddleware);

/**
 * @param {'listar' | 'marcarLeida' | 'marcarTodasLeidas' | 'obtenerPreferencias' | 'actualizarPreferencias'} accion
 * @returns {import('express').RequestHandler}
 */
function atender(accion) {
  return asyncHandler((req, res) => {
    const notificacionService = createNotificacionService(req.user.id, req.accessToken);
    const controller = createNotificacionController(notificacionService);
    return controller[accion](req, res);
  });
}

router.get('/', validationMiddleware({ query: notificacionListaQuerySchema }), atender('listar'));

router.get('/preferencias', atender('obtenerPreferencias'));

router.put(
  '/preferencias',
  validationMiddleware({ body: preferenciasActualizarSchema }),
  atender('actualizarPreferencias'),
);

router.patch('/leer-todas', atender('marcarTodasLeidas'));

router.patch(
  '/:id/leida',
  validationMiddleware({ params: notificacionIdSchema }),
  atender('marcarLeida'),
);

module.exports = router;
