/**
 * Composicion de dependencias del backend.
 * Se instancian una sola vez para reutilizar clientes y repositorios.
 */
const UsuarioRepository = require('./repositories/usuario.repository');
const UsuarioAdminRepository = require('./repositories/usuario-admin.repository');
const MateriaRepository = require('./repositories/materia.repository');
const TareaRepository = require('./repositories/tarea.repository');
const CalendarioRepository = require('./repositories/calendario.repository');
const DocumentoRepository = require('./repositories/documento.repository');
const FragmentoRepository = require('./repositories/fragmento.repository');
const ResumenRepository = require('./repositories/resumen.repository');
const ConversacionRepository = require('./repositories/conversacion.repository');
const CuestionarioRepository = require('./repositories/cuestionario.repository');
const TarjetaRepository = require('./repositories/tarjeta.repository');
const PlanEstudioRepository = require('./repositories/plan-estudio.repository');
const IdempotenciaRepository = require('./repositories/idempotencia.repository');
const ConsumoIaRepository = require('./repositories/consumo-ia.repository');
const AlmacenamientoRepository = require('./repositories/almacenamiento.repository');
const ColaRepository = require('./repositories/cola.repository');
const AuthService = require('./services/auth.service');
const UsuarioAdminService = require('./services/usuario-admin.service');
const MateriaService = require('./services/materia.service');
const TareaService = require('./services/tarea.service');
const CalendarioService = require('./services/calendario.service');
const DashboardService = require('./services/dashboard.service');
const DocumentoService = require('./services/documento.service');
const ProcesamientoService = require('./services/procesamiento.service');
const BusquedaService = require('./services/busqueda.service');
const EmbeddingsService = require('./services/ia/embeddings.service');
const ResumenIaService = require('./services/ia/resumen.ia.service');
const AgenteIaService = require('./services/ia/agente.service');
const ResumenService = require('./services/resumen.service');
const ChatService = require('./services/chat.service');
const CuestionarioService = require('./services/cuestionario.service');
const CuestionarioIaService = require('./services/ia/cuestionario.ia.service');
const TarjetaService = require('./services/tarjeta.service');
const TarjetaIaService = require('./services/ia/tarjeta.ia.service');
const PlanEstudioService = require('./services/plan-estudio.service');
const PlanIaService = require('./services/ia/plan.ia.service');
const AuthController = require('./controllers/auth.controller');
const UsuarioAdminController = require('./controllers/usuario-admin.controller');
const MateriaController = require('./controllers/materia.controller');
const TareaController = require('./controllers/tarea.controller');
const CalendarioController = require('./controllers/calendario.controller');
const DashboardController = require('./controllers/dashboard.controller');
const DocumentoController = require('./controllers/documento.controller');
const BusquedaController = require('./controllers/busqueda.controller');
const ResumenController = require('./controllers/resumen.controller');
const ChatController = require('./controllers/chat.controller');
const CuestionarioController = require('./controllers/cuestionario.controller');
const TarjetaController = require('./controllers/tarjeta.controller');
const PlanEstudioController = require('./controllers/plan-estudio.controller');
const { s3Client, sqsClient } = require('./config/aws');

// Clientes de IA compartidos: no guardan estado por petición.
const embeddingsServiceCompartido = new EmbeddingsService();
const agenteIaServiceCompartido = new AgenteIaService();
const cuestionarioIaServiceCompartido = new CuestionarioIaService();
const tarjetaIaServiceCompartido = new TarjetaIaService();
const planIaServiceCompartido = new PlanIaService();
const {
  createSupabaseClient,
  createSupabaseServiceRoleClient,
} = require('./config/supabase');

/**
 * Crea el servicio de autenticacion con el cliente del usuario autenticado.
 * Asi RLS se aplica en la lectura del perfil y no se necesita service_role.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @returns {AuthService}
 */
function createAuthService(supabaseClient) {
  const usuarioRepository = new UsuarioRepository({ supabase: supabaseClient });
  return new AuthService({ usuarioRepository });
}

/**
 * Crea el servicio de administración de usuarios con service_role.
 * Requiere privilegios elevados para operaciones administrativas.
 *
 * @param {string} usuarioActualId - ID del administrador que realiza la operación
 * @returns {UsuarioAdminService}
 */
function createUsuarioAdminService(usuarioActualId) {
  const supabaseServiceRole = createSupabaseServiceRoleClient();
  const usuarioAdminRepository = new UsuarioAdminRepository(supabaseServiceRole);
  return new UsuarioAdminService(usuarioAdminRepository, usuarioActualId);
}

/**
 * Crea el servicio de gestión de materias con el cliente del usuario.
 * RLS se aplica a todas las consultas de materias.
 *
 * @param {string} usuarioActualId - ID del usuario que realiza la operación
 * @param {string} accessToken - JWT del usuario autenticado
 * @returns {MateriaService}
 */
function createMateriaService(usuarioActualId, accessToken) {
  const supabaseClient = createSupabaseClient(accessToken);
  const materiaRepository = new MateriaRepository({ supabase: supabaseClient });
  return new MateriaService(materiaRepository, usuarioActualId);
}

/**
 * Crea el servicio de gestión de tareas con el cliente del usuario.
 * Valida la pertenencia de la materia y de la tarea con RLS y en el servicio.
 * Incluye CalendarioService para crear eventos automáticos al crear/actualizar tareas con fecha_entrega.
 *
 * @param {string} usuarioActualId - ID del usuario que realiza la operación
 * @param {string} accessToken - JWT del usuario autenticado
 * @returns {TareaService}
 */
function createTareaService(usuarioActualId, accessToken) {
  const supabaseClient = createSupabaseClient(accessToken);
  const tareaRepository = new TareaRepository({ supabase: supabaseClient });
  const materiaRepository = new MateriaRepository({ supabase: supabaseClient });
  const calendarioService = createCalendarioService(usuarioActualId, accessToken);
  return new TareaService({ tareaRepository, materiaRepository, calendarioService, usuarioActualId });
}

function createTareaController(tareaService) {
  return new TareaController({ tareaService });
}

/**
 * Crea el servicio de gestión de calendario con el cliente del usuario.
 * RLS se aplica a todas las consultas de eventos.
 *
 * @param {string} usuarioActualId - ID del usuario que realiza la operación
 * @param {string} accessToken - JWT del usuario autenticado
 * @returns {CalendarioService}
 */
function createCalendarioService(usuarioActualId, accessToken) {
  const supabaseClient = createSupabaseClient(accessToken);
  const calendarioRepository = new CalendarioRepository({ supabase: supabaseClient });
  const materiaRepository = new MateriaRepository({ supabase: supabaseClient });
  const tareaRepository = new TareaRepository({ supabase: supabaseClient });
  return new CalendarioService({
    calendarioRepository,
    materiaRepository,
    tareaRepository,
    usuarioActualId,
  });
}

function createCalendarioController(calendarioService) {
  return new CalendarioController({ calendarioService });
}

/**
 * Crea el servicio del panel principal académico con el cliente del usuario.
 * Reutiliza los repositorios de materias, tareas y calendario con RLS.
 *
 * @param {string} usuarioActualId - ID del usuario autenticado
 * @param {string} accessToken - JWT del usuario autenticado
 * @returns {DashboardService}
 */
function createDashboardService(usuarioActualId, accessToken) {
  const supabaseClient = createSupabaseClient(accessToken);
  const materiaRepository = new MateriaRepository({ supabase: supabaseClient });
  const tareaRepository = new TareaRepository({ supabase: supabaseClient });
  const calendarioRepository = new CalendarioRepository({ supabase: supabaseClient });
  return new DashboardService({
    materiaRepository,
    tareaRepository,
    calendarioRepository,
    usuarioActualId,
  });
}

function createDashboardController(dashboardService) {
  return new DashboardController({ dashboardService });
}

/**
 * Crea el servicio de documentos academicos de HU07.
 * Usa el cliente del usuario para que RLS aplique y el cliente S3 compartido.
 *
 * @param {string} usuarioActualId - ID del usuario autenticado
 * @param {string} accessToken - JWT del usuario autenticado
 * @returns {DocumentoService}
 */
function createDocumentoService(usuarioActualId, accessToken) {
  const supabaseClient = createSupabaseClient(accessToken);
  const documentoRepository = new DocumentoRepository({ supabase: supabaseClient });
  const materiaRepository = new MateriaRepository({ supabase: supabaseClient });
  const almacenamientoRepository = new AlmacenamientoRepository({ s3Client });
  const colaRepository = new ColaRepository({ sqsClient });

  return new DocumentoService({
    documentoRepository,
    materiaRepository,
    almacenamientoRepository,
    colaRepository,
    usuarioActualId,
  });
}

function createDocumentoController(documentoService) {
  return new DocumentoController({ documentoService });
}

/**
 * Crea el servicio de busqueda semantica de HU11.
 * Usa el cliente del usuario: la RPC y RLS filtran por propietario.
 * Reutiliza el cliente de embeddings compartido.
 *
 * @param {string} usuarioActualId - ID del usuario autenticado.
 * @param {string} accessToken - JWT del usuario autenticado.
 * @returns {BusquedaService}
 */
function createBusquedaService(usuarioActualId, accessToken) {
  const supabaseClient = createSupabaseClient(accessToken);

  return new BusquedaService({
    embeddingsService: embeddingsServiceCompartido,
    fragmentoRepository: new FragmentoRepository({ supabase: supabaseClient }),
    documentoRepository: new DocumentoRepository({ supabase: supabaseClient }),
    materiaRepository: new MateriaRepository({ supabase: supabaseClient }),
    consumoRepository: new ConsumoIaRepository({ supabase: supabaseClient }),
    usuarioActualId,
  });
}

function createBusquedaController(busquedaService) {
  return new BusquedaController({ busquedaService });
}

/**
 * Crea el servicio de resumenes de HU10.
 * Usa el cliente del usuario: RLS aplica a documentos, fragmentos, resumenes
 * y consumo. El cliente de IA se reutiliza entre peticiones.
 *
 * @param {string} usuarioActualId - ID del usuario autenticado.
 * @param {string} accessToken - JWT del usuario autenticado.
 * @returns {ResumenService}
 */
function createResumenService(usuarioActualId, accessToken) {
  const supabaseClient = createSupabaseClient(accessToken);

  return new ResumenService({
    documentoRepository: new DocumentoRepository({ supabase: supabaseClient }),
    fragmentoRepository: new FragmentoRepository({ supabase: supabaseClient }),
    resumenRepository: new ResumenRepository({ supabase: supabaseClient }),
    consumoRepository: new ConsumoIaRepository({ supabase: supabaseClient }),
    iaService: new ResumenIaService(),
    usuarioActualId,
  });
}

function createResumenController(resumenService) {
  return new ResumenController({ resumenService });
}

/**
 * Crea el servicio de chat con RAG de HU12.
 * Usa el cliente del usuario: conversaciones, mensajes, citas, documentos,
 * fragmentos y consumo quedan limitados por RLS. Reutiliza los clientes de IA.
 *
 * @param {string} usuarioActualId - ID del usuario autenticado.
 * @param {string} accessToken - JWT del usuario autenticado.
 * @returns {ChatService}
 */
function createChatService(usuarioActualId, accessToken) {
  const supabaseClient = createSupabaseClient(accessToken);

  return new ChatService({
    conversacionRepository: new ConversacionRepository({ supabase: supabaseClient }),
    documentoRepository: new DocumentoRepository({ supabase: supabaseClient }),
    materiaRepository: new MateriaRepository({ supabase: supabaseClient }),
    fragmentoRepository: new FragmentoRepository({ supabase: supabaseClient }),
    consumoRepository: new ConsumoIaRepository({ supabase: supabaseClient }),
    idempotenciaRepository: new IdempotenciaRepository({ supabase: supabaseClient }),
    embeddingsService: embeddingsServiceCompartido,
    agenteIaService: agenteIaServiceCompartido,
    usuarioActualId,
  });
}

function createChatController(chatService) {
  return new ChatController({ chatService });
}

/**
 * Crea el servicio de cuestionarios de HU13.
 * Usa el cliente del usuario: materias, documentos, fragmentos, cuestionarios,
 * intentos y consumo quedan limitados por RLS. Reutiliza el cliente de IA.
 *
 * @param {string} usuarioActualId - ID del usuario autenticado.
 * @param {string} accessToken - JWT del usuario autenticado.
 * @returns {CuestionarioService}
 */
function createCuestionarioService(usuarioActualId, accessToken) {
  const supabaseClient = createSupabaseClient(accessToken);

  return new CuestionarioService({
    materiaRepository: new MateriaRepository({ supabase: supabaseClient }),
    documentoRepository: new DocumentoRepository({ supabase: supabaseClient }),
    fragmentoRepository: new FragmentoRepository({ supabase: supabaseClient }),
    cuestionarioRepository: new CuestionarioRepository({ supabase: supabaseClient }),
    consumoRepository: new ConsumoIaRepository({ supabase: supabaseClient }),
    iaService: cuestionarioIaServiceCompartido,
    usuarioActualId,
  });
}

function createCuestionarioController(cuestionarioService) {
  return new CuestionarioController({ cuestionarioService });
}

/**
 * Crea el servicio de tarjetas de memoria de HU14.
 * Usa el cliente del usuario: materias, documentos, fragmentos, conjuntos,
 * tarjetas y consumo quedan limitados por RLS. Reutiliza el cliente de IA.
 *
 * @param {string} usuarioActualId - ID del usuario autenticado.
 * @param {string} accessToken - JWT del usuario autenticado.
 * @returns {TarjetaService}
 */
function createTarjetaService(usuarioActualId, accessToken) {
  const supabaseClient = createSupabaseClient(accessToken);

  return new TarjetaService({
    materiaRepository: new MateriaRepository({ supabase: supabaseClient }),
    documentoRepository: new DocumentoRepository({ supabase: supabaseClient }),
    fragmentoRepository: new FragmentoRepository({ supabase: supabaseClient }),
    tarjetaRepository: new TarjetaRepository({ supabase: supabaseClient }),
    consumoRepository: new ConsumoIaRepository({ supabase: supabaseClient }),
    iaService: tarjetaIaServiceCompartido,
    usuarioActualId,
  });
}

function createTarjetaController(tarjetaService) {
  return new TarjetaController({ tarjetaService });
}

/**
 * Crea el servicio de planes de estudio de HU15.
 * Usa el cliente del usuario: materias, tareas, fragmentos, planes, sesiones,
 * calendario y consumo quedan limitados por RLS. Reutiliza el cliente de IA.
 *
 * @param {string} usuarioActualId - ID del usuario autenticado.
 * @param {string} accessToken - JWT del usuario autenticado.
 * @returns {PlanEstudioService}
 */
function createPlanEstudioService(usuarioActualId, accessToken) {
  const supabaseClient = createSupabaseClient(accessToken);

  return new PlanEstudioService({
    materiaRepository: new MateriaRepository({ supabase: supabaseClient }),
    tareaRepository: new TareaRepository({ supabase: supabaseClient }),
    fragmentoRepository: new FragmentoRepository({ supabase: supabaseClient }),
    planRepository: new PlanEstudioRepository({ supabase: supabaseClient }),
    calendarioRepository: new CalendarioRepository({ supabase: supabaseClient }),
    consumoRepository: new ConsumoIaRepository({ supabase: supabaseClient }),
    iaService: planIaServiceCompartido,
    usuarioActualId,
  });
}

function createPlanEstudioController(planEstudioService) {
  return new PlanEstudioController({ planEstudioService });
}

/**
 * Crea el servicio que ejecuta el worker de procesamiento.
 * Usa service_role porque no hay usuario autenticado en la Lambda; el servicio
 * valida la propiedad del documento y de la ruta antes de tocar nada.
 *
 * @param {{ supabaseClient?: import('@supabase/supabase-js').SupabaseClient }} [dependencias]
 * @returns {ProcesamientoService}
 */
function createProcesamientoService({ supabaseClient } = {}) {
  const client = supabaseClient ?? createSupabaseServiceRoleClient();
  const documentoRepository = new DocumentoRepository({ supabase: client });
  const fragmentoRepository = new FragmentoRepository({ supabase: client });
  const almacenamientoRepository = new AlmacenamientoRepository({ s3Client });
  const embeddingsService = new EmbeddingsService();

  return new ProcesamientoService({
    documentoRepository,
    fragmentoRepository,
    almacenamientoRepository,
    embeddingsService,
  });
}

const authController = new AuthController();

module.exports = {
  createAuthService,
  createUsuarioAdminService,
  createMateriaService,
  createTareaService,
  createCalendarioService,
  createDashboardService,
  createDocumentoService,
  createBusquedaService,
  createResumenService,
  createChatService,
  createCuestionarioService,
  createTarjetaService,
  createPlanEstudioService,
  createProcesamientoService,
  createTareaController,
  createCalendarioController,
  createDashboardController,
  createDocumentoController,
  createBusquedaController,
  createResumenController,
  createChatController,
  createCuestionarioController,
  createTarjetaController,
  createPlanEstudioController,
  authController,
  usuarioAdminController: new UsuarioAdminController(),
  materiaController: new MateriaController(),
};
