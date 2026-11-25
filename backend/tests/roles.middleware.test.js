const { requireRole } = require('../src/middlewares/roles.middleware');

function ejecutar(middleware, usuario) {
  const req = { user: usuario };
  const next = jest.fn();
  middleware(req, {}, next);
  return next;
}

describe('requireRole', () => {
  it('permite el acceso cuando el usuario tiene uno de los roles solicitados', () => {
    const next = ejecutar(
      requireRole('administrador', 'docente'),
      { role: 'docente', roles: ['docente', 'estudiante'] },
    );

    expect(next).toHaveBeenCalledWith();
  });

  it('rechaza el acceso cuando ninguno de sus roles coincide', () => {
    const next = ejecutar(
      requireRole('administrador', 'docente'),
      { role: 'estudiante', roles: ['estudiante'] },
    );

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('rechaza una solicitud sin usuario autenticado', () => {
    const next = ejecutar(requireRole('docente'), undefined);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });

  it('acepta el rol principal cuando no viene la lista de roles', () => {
    const next = ejecutar(requireRole('administrador'), { role: 'administrador' });

    expect(next).toHaveBeenCalledWith();
  });
});
