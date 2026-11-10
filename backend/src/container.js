/**
 * Composicion de dependencias del backend.
 * Se instancian una sola vez para reutilizar clientes y repositorios.
 */
const UsuarioRepository = require('./repositories/usuario.repository');
const UsuarioAdminRepository = require('./repositories/usuario-admin.repository');
const MateriaRepository = require('./repositories/materia.repository');
const TareaRepository = require('./repositories/tarea.repository');
const AuthService = require('./services/auth.service');
const UsuarioAdminService = require('./services/usuario-admin.service');
const MateriaService = require('./services/materia.service');
const TareaService = require('./services/tarea.service');
const AuthController = require('./controllers/auth.controller');
const UsuarioAdminController = require('./controllers/usuario-admin.controller');
const MateriaController = require('./controllers/materia.controller');
const TareaController = require('./controllers/tarea.controller');
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
 *
 * @param {string} usuarioActualId - ID del usuario que realiza la operación
 * @param {string} accessToken - JWT del usuario autenticado
 * @returns {TareaService}
 */
function createTareaService(usuarioActualId, accessToken) {
  const supabaseClient = createSupabaseClient(accessToken);
  const tareaRepository = new TareaRepository({ supabase: supabaseClient });
  const materiaRepository = new MateriaRepository({ supabase: supabaseClient });
  return new TareaService({ tareaRepository, materiaRepository, usuarioActualId });
}

function createTareaController(tareaService) {
  return new TareaController({ tareaService });
}

const authController = new AuthController();

module.exports = {
  createAuthService,
  createUsuarioAdminService,
  createMateriaService,
  createTareaService,
  createTareaController,
  authController,
  usuarioAdminController: new UsuarioAdminController(),
  materiaController: new MateriaController(),
};
