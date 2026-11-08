const AuthService = require('../src/services/auth.service');

const USER = { id: '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01', email: 'ana@universidad.edu' };

const PROFILE = {
  id: USER.id,
  auth_user_id: USER.id,
  nombre: 'Ana',
  apellido: 'Perez',
  correo: USER.email,
  estado: 'activo',
};

function buildService({ profile = PROFILE, roles = ['estudiante'] } = {}) {
  const usuarioRepository = {
    findById: jest.fn().mockResolvedValue(profile),
    findRoleNames: jest.fn().mockResolvedValue(roles),
  };

  return {
    service: new AuthService({ usuarioRepository }),
    usuarioRepository,
  };
}

describe('AuthService', () => {
  it('devuelve el perfil activo y el rol del usuario', async () => {
    const { service } = buildService();

    const authenticatedUser = await service.buildAuthenticatedUser(USER);

    expect(authenticatedUser).toEqual({
      id: USER.id,
      email: USER.email,
      nombre: 'Ana',
      apellido: 'Perez',
      correo: USER.email,
      estado: 'activo',
      role: 'estudiante',
      roles: ['estudiante'],
    });
  });

  it('prioriza el rol administrador cuando el usuario tiene varios roles', async () => {
    const { service } = buildService({ roles: ['estudiante', 'administrador'] });

    const authenticatedUser = await service.buildAuthenticatedUser(USER);

    expect(authenticatedUser.role).toBe('administrador');
    expect(authenticatedUser.roles).toEqual(['estudiante', 'administrador']);
  });

  it('rechaza una cuenta inactiva sin consultar sus roles', async () => {
    const { service, usuarioRepository } = buildService({
      profile: { ...PROFILE, estado: 'inactivo' },
    });

    await expect(service.buildAuthenticatedUser(USER)).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining('deshabilitada'),
    });
    expect(usuarioRepository.findRoleNames).not.toHaveBeenCalled();
  });

  it('rechaza un token cuyo usuario no tiene perfil', async () => {
    const { service } = buildService({ profile: null });

    await expect(service.buildAuthenticatedUser(USER)).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining('perfil'),
    });
  });

  it('asigna el rol estudiante cuando el usuario no tiene roles', async () => {
    const { service } = buildService({ roles: [] });

    const authenticatedUser = await service.buildAuthenticatedUser(USER);

    expect(authenticatedUser.role).toBe('estudiante');
    expect(authenticatedUser.roles).toEqual(['estudiante']);
  });

  it('ignora roles desconocidos y conserva el privilegio minimo', async () => {
    const { service } = buildService({ roles: ['superusuario'] });

    const authenticatedUser = await service.buildAuthenticatedUser(USER);

    expect(authenticatedUser.role).toBe('estudiante');
    expect(authenticatedUser.roles).toEqual(['estudiante']);
  });
});
