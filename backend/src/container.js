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
const EmbeddingsService = require('./services/ia/embeddings.service');
const AuthController = require('./controllers/auth.controller');
const UsuarioAdminController = require('./controllers/usuario-admin.controller');
const MateriaController = require('./controllers/materia.controller');
const TareaController = require('./controllers/tarea.controller');
const CalendarioController = require('./controllers/calendario.controller');
const DashboardController = require('./controllers/dashboard.controller');
const DocumentoController = require('./controllers/documento.controller');
const { s3Client, sqsClient } = require('./config/aws');
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
  createProcesamientoService,
  createTareaController,
  createCalendarioController,
  createDashboardController,
  createDocumentoController,
  authController,
  usuarioAdminController: new UsuarioAdminController(),
  materiaController: new MateriaController(),
};
