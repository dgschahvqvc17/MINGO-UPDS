const CambioClaveService = require('../src/services/cambio-clave.service');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';

function construirServicio({ credencialesValidas = true } = {}) {
  const authAdminRepository = {
    obtenerCorreoPorId: jest.fn().mockResolvedValue('docente@mingo.test'),
    verificarCredenciales: jest.fn().mockResolvedValue(credencialesValidas),
    cambiarClave: jest.fn().mockResolvedValue(undefined),
  };
  const usuarioAdminRepository = {
    marcarClaveCambiada: jest.fn().mockResolvedValue(undefined),
  };

  return {
    service: new CambioClaveService({ authAdminRepository, usuarioAdminRepository }),
    authAdminRepository,
    usuarioAdminRepository,
  };
}

describe('CambioClaveService', () => {
  it('cambia la clave y libera el bloqueo de clave temporal', async () => {
    const { service, authAdminRepository, usuarioAdminRepository } = construirServicio();

    const resultado = await service.cambiarClave({
      usuarioId: USUARIO_ID,
      claveActual: 'temporal123',
      claveNueva: 'definitiva123',
    });

    expect(authAdminRepository.cambiarClave).toHaveBeenCalledWith(USUARIO_ID, 'definitiva123');
    expect(usuarioAdminRepository.marcarClaveCambiada).toHaveBeenCalledWith(USUARIO_ID);
    expect(resultado.mensaje).toContain('Contraseña actualizada');
  });

  it('rechaza una contraseña temporal incorrecta sin cambiar nada', async () => {
    const { service, authAdminRepository, usuarioAdminRepository } = construirServicio({
      credencialesValidas: false,
    });

    await expect(
      service.cambiarClave({
        usuarioId: USUARIO_ID,
        claveActual: 'incorrecta123',
        claveNueva: 'definitiva123',
      }),
    ).rejects.toMatchObject({ statusCode: 401 });

    expect(authAdminRepository.cambiarClave).not.toHaveBeenCalled();
    expect(usuarioAdminRepository.marcarClaveCambiada).not.toHaveBeenCalled();
  });

  it('rechaza una clave nueva igual a la temporal', async () => {
    const { service, authAdminRepository } = construirServicio();

    await expect(
      service.cambiarClave({
        usuarioId: USUARIO_ID,
        claveActual: 'temporal123',
        claveNueva: 'temporal123',
      }),
    ).rejects.toThrow();

    expect(authAdminRepository.cambiarClave).not.toHaveBeenCalled();
  });
});
