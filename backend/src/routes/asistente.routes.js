const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const idempotencyMiddleware = require('../middlewares/idempotency.middleware');
const validationMiddleware = require('../middlewares/validation.middleware');
const asyncHandler = require('../utils/asyncHandler');
const {
  createResumenService,
  createResumenController,
  createChatService,
  createChatController,
  createCuestionarioService,
  createCuestionarioController,
  createTarjetaService,
  createTarjetaController,
  createPlanEstudioService,
  createPlanEstudioController,
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
const {
  cuestionarioGenerarSchema,
  cuestionarioParamSchema,
  cuestionarioListarQuerySchema,
  intentoListarQuerySchema,
  intentoResponderSchema,
} = require('../models/cuestionario.model');
const {
  tarjetaGenerarSchema,
  tarjetaParamSchema,
  conjuntoListarQuerySchema,
  conjuntoDetalleQuerySchema,
  tarjetaEstadoSchema,
} = require('../models/tarjeta.model');
const { planGenerarSchema } = require('../models/plan-estudio.model');

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
 * Construye un handler que delega en el controlador de cuestionarios.
 * El servicio se compone por peticion para usar el cliente JWT del usuario.
 *
 * @param {'generar' | 'listar' | 'obtener' | 'eliminar' | 'iniciarIntento' | 'responder' | 'obtenerIntento' | 'listarIntentos'} accion
 * @returns {import('express').RequestHandler}
 */
function atenderCuestionario(accion) {
  return asyncHandler((req, res) => {
    const cuestionarioService = createCuestionarioService(req.user.id, req.accessToken);
    const controller = createCuestionarioController(cuestionarioService);
    return controller[accion](req, res);
  });
}

/**
 * Construye un handler que delega en el controlador de tarjetas de memoria.
 * El servicio se compone por peticion para usar el cliente JWT del usuario.
 *
 * @param {'generar' | 'listar' | 'obtener' | 'eliminar' | 'actualizarEstado'} accion
 * @returns {import('express').RequestHandler}
 */
function atenderTarjeta(accion) {
  return asyncHandler((req, res) => {
    const tarjetaService = createTarjetaService(req.user.id, req.accessToken);
    const controller = createTarjetaController(tarjetaService);
    return controller[accion](req, res);
  });
}

/**
 * Construye un handler que delega en el controlador de planes de estudio.
 *
 * @param {'proponer'} accion
 * @returns {import('express').RequestHandler}
 */
function atenderPlan(accion) {
  return asyncHandler((req, res) => {
    const planEstudioService = createPlanEstudioService(req.user.id, req.accessToken);
    const controller = createPlanEstudioController(planEstudioService);
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
 * Acepta la cabecera opcional Idempotency-Key para reintentos seguros.
 */
router.post(
  '/chat',
  idempotencyMiddleware,
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

/**
 * GET /asistente/intentos
 * Lista los intentos finalizados del usuario con su nota y recomendaciones.
 */
router.get(
  '/intentos',
  validationMiddleware({ query: intentoListarQuerySchema }),
  atenderCuestionario('listarIntentos'),
);

/**
 * POST /asistente/cuestionario
 * Genera y guarda un cuestionario a partir de un documento o de una materia.
 */
router.post(
  '/cuestionario',
  validationMiddleware({ body: cuestionarioGenerarSchema }),
  atenderCuestionario('generar'),
);

/**
 * GET /asistente/cuestionarios
 * Lista los cuestionarios propios paginados.
 */
router.get(
  '/cuestionarios',
  validationMiddleware({ query: cuestionarioListarQuerySchema }),
  atenderCuestionario('listar'),
);

/**
 * GET /asistente/cuestionarios/:id
 * Devuelve un cuestionario propio con sus preguntas y opciones.
 */
router.get(
  '/cuestionarios/:id',
  validationMiddleware({ params: cuestionarioParamSchema }),
  atenderCuestionario('obtener'),
);

/**
 * DELETE /asistente/cuestionarios/:id
 * Elimina un cuestionario propio y, en cascada, sus preguntas e intentos.
 */
router.delete(
  '/cuestionarios/:id',
  validationMiddleware({ params: cuestionarioParamSchema }),
  atenderCuestionario('eliminar'),
);

/**
 * POST /asistente/cuestionarios/:id/intentos
 * Inicia un intento de resolucion del cuestionario.
 */
router.post(
  '/cuestionarios/:id/intentos',
  validationMiddleware({ params: cuestionarioParamSchema }),
  atenderCuestionario('iniciarIntento'),
);

/**
 * GET /asistente/intentos/:id
 * Devuelve el intento con sus respuestas; oculta la correccion si sigue en progreso.
 */
router.get(
  '/intentos/:id',
  validationMiddleware({ params: cuestionarioParamSchema }),
  atenderCuestionario('obtenerIntento'),
);

/**
 * POST /asistente/intentos/:id/responder
 * Registra las respuestas, corrige las objetivas, evalúa las abiertas y finaliza el intento.
 */
router.post(
  '/intentos/:id/responder',
  validationMiddleware({
    params: cuestionarioParamSchema,
    body: intentoResponderSchema,
  }),
  atenderCuestionario('responder'),
);

/**
 * POST /asistente/tarjetas
 * Genera y guarda un conjunto de tarjetas a partir de un documento o materia.
 */
router.post(
  '/tarjetas',
  validationMiddleware({ body: tarjetaGenerarSchema }),
  atenderTarjeta('generar'),
);

/**
 * POST /asistente/plan
 * Genera una propuesta de plan de estudio sin guardarla ni crear eventos.
 */
router.post(
  '/plan',
  validationMiddleware({ body: planGenerarSchema }),
  atenderPlan('proponer'),
);

/**
 * GET /asistente/tarjetas/conjuntos
 * Lista los conjuntos propios paginados con su avance de estudio.
 */
router.get(
  '/tarjetas/conjuntos',
  validationMiddleware({ query: conjuntoListarQuerySchema }),
  atenderTarjeta('listar'),
);

/**
 * GET /asistente/tarjetas/conjuntos/:id
 * Devuelve un conjunto propio con sus tarjetas. `estado=pendientes` excluye
 * las ya marcadas como conocidas.
 */
router.get(
  '/tarjetas/conjuntos/:id',
  validationMiddleware({
    params: tarjetaParamSchema,
    query: conjuntoDetalleQuerySchema,
  }),
  atenderTarjeta('obtener'),
);

/**
 * DELETE /asistente/tarjetas/conjuntos/:id
 * Elimina un conjunto propio y, en cascada, sus tarjetas.
 */
router.delete(
  '/tarjetas/conjuntos/:id',
  validationMiddleware({ params: tarjetaParamSchema }),
  atenderTarjeta('eliminar'),
);

/**
 * PATCH /asistente/tarjetas/:id/estado
 * Registra el avance de estudio de una tarjeta propia.
 */
router.patch(
  '/tarjetas/:id/estado',
  validationMiddleware({
    params: tarjetaParamSchema,
    body: tarjetaEstadoSchema,
  }),
  atenderTarjeta('actualizarEstado'),
);

module.exports = router;
