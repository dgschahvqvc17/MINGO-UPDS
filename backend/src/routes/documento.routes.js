const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validationMiddleware = require('../middlewares/validation.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { createDocumentoService, createDocumentoController } = require('../container');
const {
  documentoUrlCargaSchema,
  documentoRegistroSchema,
  documentoFiltrosSchema,
} = require('../models/documento.model');

const router = Router();

/**
 * Rutas de documentos academicos (HU07).
 * Todas requieren autenticacion y RLS: cada usuario accede solo a sus documentos.
 */
router.use(authMiddleware);

router.use((req, _res, next) => {
  try {
    req.documentoService = createDocumentoService(req.user.id, req.accessToken);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Construye un handler que delega en el controlador correspondiente.
 *
 * @param {keyof import('../controllers/documento.controller')} accion
 * @returns {import('express').RequestHandler}
 */
function atender(accion) {
  return asyncHandler((req, res) => {
    const controller = createDocumentoController(req.documentoService);
    return controller[accion](req, res);
  });
}

/**
 * GET /documentos
 * Lista los documentos del usuario con filtros y paginación.
 */
router.get('/', validationMiddleware({ query: documentoFiltrosSchema }), atender('listarDocumentos'));

/**
 * POST /documentos/url-carga
 * Devuelve la URL prefirmada para subir el archivo directamente a S3.
 */
router.post(
  '/url-carga',
  validationMiddleware({ body: documentoUrlCargaSchema }),
  atender('solicitarUrlCarga'),
);

/**
 * POST /documentos
 * Registra los metadatos despues de subir el archivo.
 */
router.post('/', validationMiddleware({ body: documentoRegistroSchema }), atender('registrarDocumento'));

module.exports = router;
