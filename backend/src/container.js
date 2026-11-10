/**
 * Composicion de dependencias del backend.
 * Se instancian una sola vez para reutilizar clientes y repositorios.
 */
const UsuarioRepository = require('./repositories/usuario.repository');
const UsuarioAdminRepository = require('./repositories/usuario-admin.repository');
const MateriaRepository = require('./repositories/materia.repository');
const AuthService = require('./services/auth.service');
const UsuarioAdminService = require('./services/usuario-admin.service');
const MateriaService = require('./services/materia.service');
const AuthController = require('./controllers/auth.controller');
const UsuarioAdminController = require('./controllers/usuario-admin.controller');
const MateriaController = require('./controllers/materia.controller');
const { createSupabaseServiceRoleClient, supabase } = require('./config/supabase');

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
 * Crea el servicio de gestión de materias.
 * Usa el cliente estándar de Supabase con RLS habilitado.
 *
 * @param {string} usuarioActualId - ID del usuario que realiza la operación
 * @returns {MateriaService}
 */
function createMateriaService(usuarioActualId) {
  const materiaRepository = new MateriaRepository(supabase);
  return new MateriaService(materiaRepository, usuarioActualId);
}

const authController = new AuthController();
const materiaController = new MateriaController();

module.exports = {
  createAuthService,
  createUsuarioAdminService,
  createMateriaService,
  authController,
  usuarioAdminController: new UsuarioAdminController(),
  materiaController,
};
