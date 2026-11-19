const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validationMiddleware = require('../middlewares/validation.middleware');
const asyncHandler = require('../utils/asyncHandler');
const {
  createDocumentoService,
  createDocumentoController,
  createBusquedaService,
  createBusquedaController,
} = require('../container');
const {
  documentoUrlCargaSchema,
  documentoRegistroSchema,
  documentoFiltrosSchema,
  documentoBuscarSchema,
  documentoIdParamSchema,
} = require('../models/documento.model');

const router = Router();

/**
 * Rutas de documentos academicos (HU07 y HU08).
 * Todas requieren autenticacion y RLS: cada usuario accede solo a sus documentos.
 */
router.use(authMiddleware);

/**
 * Construye el servicio indicado por petición y lo expone en `req`.
 *
 * @param {(usuarioId: string, accessToken: string) => object} fabrica
 * @param {string} propiedad
 * @returns {import('express').RequestHandler}
 */
function prepararServicio(fabrica, propiedad) {
  return (req, _res, next) => {
    try {
      req[propiedad] = fabrica(req.user.id, req.accessToken);
      next();
    } catch (error) {
      next(error);
    }
  };
}

router.use(prepararServicio(createDocumentoService, 'documentoService'));

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
 * @returns {import('express').RequestHandler}
 */
function atenderBusqueda() {
  return asyncHandler((req, res) =>
    createBusquedaController(req.busquedaService).buscar(req, res),
  );
}

/**
 * GET /documentos
 * Lista los documentos del usuario con filtros y paginación.
 */
router.get('/', validationMiddleware({ query: documentoFiltrosSchema }), atender('listarDocumentos'));

/**
 * GET /documentos/buscar
 * Busqueda semantica (HU11). Se declara antes de /:id para que Express no
 * interprete "buscar" como el identificador de un documento.
 */
router.get(
  '/buscar',
  validationMiddleware({ query: documentoBuscarSchema }),
  prepararServicio(createBusquedaService, 'busquedaService'),
  atenderBusqueda(),
);

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

/**
 * GET /documentos/:id/descarga
 * Firma una URL de descarga directa desde S3.
 */
router.get(
  '/:id/descarga',
  validationMiddleware({ params: documentoIdParamSchema }),
  atender('obtenerUrlDescarga'),
);

/**
 * POST /documentos/:id/procesar
 * Encola el procesamiento del documento en SQS y responde 202.
 */
router.post(
  '/:id/procesar',
  validationMiddleware({ params: documentoIdParamSchema }),
  atender('procesarDocumento'),
);

/**
 * GET /documentos/:id/estado
 * Devuelve el estado de procesamiento para refrescar la UI.
 */
router.get(
  '/:id/estado',
  validationMiddleware({ params: documentoIdParamSchema }),
  atender('obtenerEstadoProcesamiento'),
);

/**
 * GET /documentos/:id
 * Devuelve el detalle de un documento propio.
 */
router.get(
  '/:id',
  validationMiddleware({ params: documentoIdParamSchema }),
  atender('obtenerDocumento'),
);

/**
 * DELETE /documentos/:id
 * Elimina el objeto de S3 y los metadatos del documento.
 */
router.delete(
  '/:id',
  validationMiddleware({ params: documentoIdParamSchema }),
  atender('eliminarDocumento'),
);

module.exports = router;
