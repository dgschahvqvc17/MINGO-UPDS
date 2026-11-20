const NotificacionRepository = require('../src/repositories/notificacion.repository');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';

function crearBuilder(resultado) {
  const builder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockResolvedValue(resultado),
    maybeSingle: jest.fn().mockResolvedValue(resultado),
    upsert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
  };
  builder.then = (resolve, reject) => Promise.resolve(resultado).then(resolve, reject);
  return builder;
}

describe('NotificacionRepository (HU18)', () => {
  it('lista solo las notificaciones del usuario con filtros y paginacion', async () => {
    const builder = crearBuilder({ data: [{ id: 'n-1' }], error: null, count: 7 });
    const supabase = { from: jest.fn().mockReturnValue(builder) };
    const repository = new NotificacionRepository({ supabase });

    const resultado = await repository.listar(USUARIO_ID, {
      leida: false,
      tipo: 'tarea',
      limit: 10,
      offset: 20,
    });

    expect(supabase.from).toHaveBeenCalledWith('notificaciones');
    expect(builder.eq).toHaveBeenCalledWith('usuario_id', USUARIO_ID);
    expect(builder.eq).toHaveBeenCalledWith('leida', false);
    expect(builder.eq).toHaveBeenCalledWith('tipo', 'tarea');
    expect(builder.range).toHaveBeenCalledWith(20, 29);
    expect(resultado).toEqual({ items: [{ id: 'n-1' }], total: 7 });
  });

  it('cuenta los correos enviados desde el inicio del dia', async () => {
    const builder = crearBuilder({ data: null, error: null, count: 12 });
    const supabase = { from: jest.fn().mockReturnValue(builder) };
    const repository = new NotificacionRepository({ supabase });

    await expect(
      repository.contarEnviosDesde('2026-11-20T00:00:00.000Z'),
    ).resolves.toBe(12);

    expect(builder.gte).toHaveBeenCalledWith('fecha_envio', '2026-11-20T00:00:00.000Z');
  });

  it('inserta con idempotencia por usuario y clave', async () => {
    const datos = {
      usuario_id: USUARIO_ID,
      clave_idempotencia: 'tarea:t1:2026-11-20:60',
    };
    const builder = crearBuilder({ data: { id: 'n-1' }, error: null });
    const supabase = { from: jest.fn().mockReturnValue(builder) };
    const repository = new NotificacionRepository({ supabase });

    await expect(repository.crearSiNoExiste(datos)).resolves.toEqual({ id: 'n-1' });
    expect(builder.upsert).toHaveBeenCalledWith(datos, {
      onConflict: 'usuario_id,clave_idempotencia',
      ignoreDuplicates: true,
    });
  });

  it('devuelve null si la clave ya existia', async () => {
    const builder = crearBuilder({ data: null, error: { code: '23505' } });
    const supabase = { from: jest.fn().mockReturnValue(builder) };
    const repository = new NotificacionRepository({ supabase });

    await expect(
      repository.crearSiNoExiste({ usuario_id: USUARIO_ID, clave_idempotencia: 'x' }),
    ).resolves.toBeNull();
  });

  it('registra la fecha de envio del canal externo', async () => {
    const builder = crearBuilder({ error: null });
    const supabase = { from: jest.fn().mockReturnValue(builder) };
    const repository = new NotificacionRepository({ supabase });

    await repository.marcarEnviada('n-1', '2026-11-20T12:00:00.000Z');

    expect(builder.update).toHaveBeenCalledWith({ fecha_envio: '2026-11-20T12:00:00.000Z' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'n-1');
  });

  it('falla temprano si no hay cliente de Supabase', async () => {
    const repository = new NotificacionRepository({ supabase: null });

    await expect(repository.contarNoLeidas(USUARIO_ID)).rejects.toThrow(
      'NotificacionRepository requiere un cliente de Supabase.',
    );
  });
});
