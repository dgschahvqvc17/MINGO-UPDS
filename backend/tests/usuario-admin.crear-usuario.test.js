const UsuarioAdminService = require('../src/services/usuario-admin.service');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';

function construirServicio({ fallaAlAsignarRol = false } = {}) {
  const repository = {
    actualizarPerfil: jest.fn().mockResolvedValue(undefined),
    actualizarRolesUsuario: jest.fn().mockImplementation(() =>
      fallaAlAsignarRol ? Promise.reject(new Error('DB Error')) : Promise.resolve(),
    ),
  };
  const authAdminRepository = {
    crearUsuario: jest.fn().mockResolvedValue({ id: USUARIO_ID, correo: 'docente@mingo.test' }),
    eliminarUsuario: jest.fn().mockResolvedValue(undefined),
  };

  return {
    service: new UsuarioAdminService({ repository, authAdminRepository, usuarioActualId: USUARIO_ID }),
    repository,
    authAdminRepository,
  };
}

const datos = {
  nombre: 'Ana',
  apellido: 'Pérez',
  correo: 'docente@mingo.test',
  rol: 'docente',
  claveTemporal: 'temporal123',
};

describe('UsuarioAdminService.crearUsuario', () => {
  it('asigna el rol solicitado desde el backend y no desde metadatos', async () => {
    const { service, authAdminRepository, repository } = construirServicio();

    const resultado = await service.crearUsuario(datos);

    expect(authAdminRepository.crearUsuario).toHaveBeenCalledWith({
      correo: datos.correo,
      claveTemporal: datos.claveTemporal,
      metadata: { nombre: datos.nombre, apellido: datos.apellido },
    });
    expect(repository.actualizarRolesUsuario).toHaveBeenCalledWith(USUARIO_ID, ['docente']);
    expect(resultado.requiereCambioClave).toBe(true);
  });

  it('elimina la cuenta si falla la asignacion del rol', async () => {
    const { service, authAdminRepository } = construirServicio({ fallaAlAsignarRol: true });

    await expect(service.crearUsuario(datos)).rejects.toThrow('Error al crear el usuario');

    expect(authAdminRepository.eliminarUsuario).toHaveBeenCalledWith(USUARIO_ID);
  });
});
