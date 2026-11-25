/**
 * Regla de negocio del primer cambio de contraseña temporal.
 * No conoce req ni res: recibe el usuario autenticado y datos ya validados.
 */
const ApiError = require('../utils/ApiError');
const { cambiarClaveSchema } = require('../models/auth.model');

class CambioClaveService {
  /**
   * @param {{
   *   authAdminRepository: import('../repositories/auth-admin.repository'),
   *   usuarioAdminRepository: import('../repositories/usuario-admin.repository')
   * }} dependencies
   */
  constructor({ authAdminRepository, usuarioAdminRepository }) {
    this.authAdminRepository = authAdminRepository;
    this.usuarioAdminRepository = usuarioAdminRepository;
  }

  /**
   * Cambia la clave temporal despues de verificar la actual.
   *
   * @param {{ usuarioId: string, claveActual: string, claveNueva: string }} datos
   * @returns {Promise<{ mensaje: string }>}
   */
  async cambiarClave({ usuarioId, claveActual, claveNueva }) {
    const datos = cambiarClaveSchema.parse({ claveActual, claveNueva });
    const correo = await this.authAdminRepository.obtenerCorreoPorId(usuarioId);
    const credencialesValidas = await this.authAdminRepository.verificarCredenciales(
      correo,
      datos.claveActual,
    );

    if (!credencialesValidas) {
      throw ApiError.unauthorized('La contraseña temporal no es correcta.');
    }

    await this.authAdminRepository.cambiarClave(usuarioId, datos.claveNueva);
    await this.usuarioAdminRepository.marcarClaveCambiada(usuarioId);

    return { mensaje: 'Contraseña actualizada correctamente.' };
  }
}

module.exports = CambioClaveService;
