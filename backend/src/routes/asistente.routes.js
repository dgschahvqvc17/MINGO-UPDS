const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validationMiddleware = require('../middlewares/validation.middleware');
const asyncHandler = require('../utils/asyncHandler');
const {
  createResumenService,
  createResumenController,
  createChatService,
  createChatController,
} = require('../container');
const {
  resumenGenerarSchema,
  resumenDocumentoParamSchema,
} = require('../models/resumen.model');
const {
  chatEnviarSchema,
  conversacionParamSchema,
  conversacionListarQuerySchema,
} = require('../models/chat.model');

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
 * Construye un handler que delega en el controlador de resumenes.
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
 * Construye un handler que delega en el controlador del chat.
 * El servicio se compone por peticion para usar el cliente JWT del usuario.
 *
 * @param {'enviar' | 'listar' | 'obtener' | 'eliminar'} accion
 * @returns {import('express').RequestHandler}
 */
function atenderChat(accion) {
  return asyncHandler((req, res) => {
    const chatService = createChatService(req.user.id, req.accessToken);
    const controller = createChatController(chatService);
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

/**
 * POST /asistente/chat
 * Envia un mensaje al asistente y devuelve la respuesta con sus citas.
 */
router.post(
  '/chat',
  validationMiddleware({ body: chatEnviarSchema }),
  atenderChat('enviar'),
);

/**
 * GET /asistente/conversaciones
 * Lista las conversaciones propias paginadas.
 */
router.get(
  '/conversaciones',
  validationMiddleware({ query: conversacionListarQuerySchema }),
  atenderChat('listar'),
);

/**
 * GET /asistente/conversaciones/:id
 * Devuelve el historial completo de una conversacion propia.
 */
router.get(
  '/conversaciones/:id',
  validationMiddleware({ params: conversacionParamSchema }),
  atenderChat('obtener'),
);

/**
 * DELETE /asistente/conversaciones/:id
 * Elimina una conversacion propia y, en cascada, sus mensajes y citas.
 */
router.delete(
  '/conversaciones/:id',
  validationMiddleware({ params: conversacionParamSchema }),
  atenderChat('eliminar'),
);

// TODO Sprint 2-3 (HU13-HU16): cuestionarios, tarjetas, planes y evaluador.

module.exports = router;
