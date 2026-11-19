const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validationMiddleware = require('../middlewares/validation.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { createResumenService, createResumenController } = require('../container');
const {
  resumenGenerarSchema,
  resumenDocumentoParamSchema,
} = require('../models/resumen.model');

const router = Router();

/**
 * Rutas del asistente de IA.
 * Todas requieren autenticacion; el servicio filtra por el usuario del token.
 */
router.use(authMiddleware);

router.use((req, _res, next) => {
  try {
    req.resumenService = createResumenService(req.user.id, req.accessToken);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Construye un handler que delega en el controlador correspondiente.
 *
 * @param {'generar' | 'obtenerGuardado'} accion
 * @returns {import('express').RequestHandler}
 */
function atender(accion) {
  return asyncHandler((req, res) => {
    const controller = createResumenController(req.resumenService);
    return controller[accion](req, res);
  });
}

/**
 * POST /asistente/resumen
 * Genera un resumen estructurado del documento, reutilizando la cache si aplica.
 */
router.post(
  '/resumen',
  validationMiddleware({ body: resumenGenerarSchema }),
  atender('generar'),
);

/**
 * GET /asistente/resumen/:documento_id
 * Recupera el ultimo resumen guardado del documento.
 */
router.get(
  '/resumen/:documento_id',
  validationMiddleware({ params: resumenDocumentoParamSchema }),
  atender('obtenerGuardado'),
);

// TODO Sprint 2-3 (HU12-HU16): chat RAG, cuestionarios, tutor y evaluador.

module.exports = router;
