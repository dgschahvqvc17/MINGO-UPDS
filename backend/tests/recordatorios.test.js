const {
  crearHandler,
  extraerUsuarios,
  MAXIMO_USUARIOS_EN_EVENTO,
} = require('../src/lambda/recordatorios');

describe('Lambda de recordatorios (HU18)', () => {
  it('extrae la lista opcional de usuarios del detalle del schedule', () => {
    const usuarios = ['u-1', 'u-2', '', 42];

    expect(extraerUsuarios({ detail: { usuarios } })).toEqual(['u-1', 'u-2']);
    expect(extraerUsuarios({})).toBeUndefined();
  });

  it('limita el numero de usuarios de una ejecucion dirigida', () => {
    const usuarios = Array.from({ length: MAXIMO_USUARIOS_EN_EVENTO + 5 }, (_, indice) => `u-${indice}`);

    expect(extraerUsuarios({ detail: { usuarios } })).toHaveLength(MAXIMO_USUARIOS_EN_EVENTO);
  });

  it('ejecuta el servicio con la hora actual y devuelve el resumen', async () => {
    const resumen = { usuarios: 1, creadas: 2, duplicadas: 0, enviadas: 0 };
    const servicio = { ejecutarRecordatorios: jest.fn().mockResolvedValue(resumen) };
    const logger = { info: jest.fn() };
    const handler = crearHandler({ crearServicio: () => servicio, logger });

    await expect(handler({ version: '0' })).resolves.toEqual(resumen);
    expect(servicio.ejecutarRecordatorios).toHaveBeenCalledWith({
      ahora: expect.any(Date),
      usuarios: undefined,
    });
    expect(logger.info).toHaveBeenCalledWith('Recordatorios HU18 ejecutados', expect.any(Object));
  });

  it('propaga los errores para que Lambda marque la ejecucion como fallida', async () => {
    const servicio = {
      ejecutarRecordatorios: jest.fn().mockRejectedValue(new Error('Supabase no disponible')),
    };
    const handler = crearHandler({ crearServicio: () => servicio, logger: {} });

    await expect(handler({})).rejects.toThrow('Supabase no disponible');
  });
});
