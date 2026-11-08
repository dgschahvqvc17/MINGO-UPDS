/**
 * Reglas de autenticacion y control de acceso.
 */
const ApiError = require('../utils/ApiError');

const ROLE_ADMINISTRADOR = 'administrador';
const ROLE_ESTUDIANTE = 'estudiante';
const VALID_ROLES = new Set([ROLE_ADMINISTRADOR, ROLE_ESTUDIANTE]);
const ACTIVE_STATE = 'activo';

class AuthService {
  /**
   * @param {{ usuarioRepository: import('../repositories/usuario.repository') }} dependencies
   */
  constructor({ usuarioRepository }) {
    this.usuarioRepository = usuarioRepository;
  }

  /**
   * Construye el usuario de sesion a partir del token validado.
   * La fuente de verdad del rol es la base de datos, no los metadatos del JWT.
   *
   * @param {{ id: string, email?: string }} user Usuario devuelto por Supabase Auth.
   * @returns {Promise<object>}
   */
  async buildAuthenticatedUser(user) {
    if (!user?.id) {
      throw ApiError.unauthorized('El token no contiene un usuario valido.');
    }

    const profile = await this.usuarioRepository.findById(user.id);

    if (!profile) {
      throw ApiError.forbidden(
        'La cuenta no tiene un perfil asociado. Contacte al administrador.',
      );
    }

    if (profile.estado !== ACTIVE_STATE) {
      throw ApiError.forbidden('La cuenta esta deshabilitada. Contacte al administrador.');
    }

    const roles = await this.resolveRoles(user.id);

    return {
      id: profile.id,
      email: user.email ?? profile.correo,
      nombre: profile.nombre,
      apellido: profile.apellido,
      correo: profile.correo,
      estado: profile.estado,
      role: roles.includes(ROLE_ADMINISTRADOR) ? ROLE_ADMINISTRADOR : roles[0],
      roles,
    };
  }

  /**
   * Normaliza los roles. Un usuario sin roles validos conserva el privilegio minimo.
   *
   * @param {string} userId UUID del usuario.
   * @returns {Promise<string[]>}
   */
  async resolveRoles(userId) {
    const roleNames = await this.usuarioRepository.findRoleNames(userId);
    const validRoles = [...new Set(roleNames.filter((name) => VALID_ROLES.has(name)))];

    return validRoles.length > 0 ? validRoles : [ROLE_ESTUDIANTE];
  }
}

module.exports = AuthService;
