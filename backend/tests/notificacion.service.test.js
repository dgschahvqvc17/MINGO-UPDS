const NotificacionService = require('../src/services/notificacion.service');
const ApiError = require('../src/utils/ApiError');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const TAREA_ID = '9c5f0f18-d01e-4c9f-b4e6-58b24c7f9a01';
const EVALUACION_ID = '9c5f0f18-d01e-4c9f-b4e6-58b24c7f9a02';
const SESION_ID = '9c5f0f18-d01e-4c9f-b4e6-58b24c7f9a03';

const PREFERENCIA = Object.freeze({
  usuario_id: USUARIO_ID,
  notificaciones_activas: true,
  anticipacion_minutos: 60,
  canal_email: false,
  zona_horaria: 'America/Bogota',
  idioma: 'es',
});

const AHORA = new Date('2026-11-20T12:00:00.000Z');
const FECHA_ACTIVIDAD = '2026-11-20T12:30:00.000Z';

function crearDependencias({
  preferencia = PREFERENCIA,
  tareas = [],
  evaluaciones = [],
  sesiones = [],
  crear,
  publicar,
  estaConfigurado = true,
} = {}) {
  const notificacionRepository = {
    listar: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    contarNoLeidas: jest.fn().mockResolvedValue(0),
    obtenerPorId: jest.fn().mockResolvedValue(null),
    marcarLeida: jest.fn().mockResolvedValue({ id: 'n-1', leida: true }),
    marcarTodasLeidas: jest.fn().mockResolvedValue(2),
    contarEnviosDesde: jest.fn().mockResolvedValue(0),
    crearSiNoExiste:
      crear ?? jest.fn().mockImplementation(async (datos) => ({ id: 'n-1', ...datos })),
    marcarEnviada: jest.fn().mockResolvedValue(undefined),
  };
  const preferenciaRepository = {
    obtenerOCrear: jest.fn().mockResolvedValue(preferencia),
    actualizar: jest.fn().mockResolvedValue(preferencia),
    listarActivas: jest.fn().mockResolvedValue([preferencia]),
  };
  const actividadRepository = {
    listarTareasProximas: jest.fn().mockResolvedValue(tareas),
    listarEvaluacionesProximas: jest.fn().mockResolvedValue(evaluaciones),
    listarSesionesProximas: jest.fn().mockResolvedValue(sesiones),
  };
  const canalRepository = {
    estaConfigurado,
    publicar: publicar ?? jest.fn().mockResolvedValue(true),
  };

  const servicio = new NotificacionService({
    notificacionRepository,
    preferenciaRepository,
    actividadRepository,
    canalRepository,
    usuarioActualId: USUARIO_ID,
  });

  return { servicio, notificacionRepository, preferenciaRepository, actividadRepository, canalRepository };
}

describe('NotificacionService (HU18)', () => {
  it('lista con pagina, filtros y metadatos', async () => {
    const { servicio, notificacionRepository } = crearDependencias();
    notificacionRepository.listar.mockResolvedValue({ items: [{ id: 'n-1' }], total: 21 });

    const resultado = await servicio.listar({ leida: 'false', tipo: 'tarea', page: 2, limit: 20 });

    expect(notificacionRepository.listar).toHaveBeenCalledWith(USUARIO_ID, {
      leida: false,
      tipo: 'tarea',
      limit: 20,
      offset: 20,
    });
    expect(resultado.meta).toEqual({ page: 2, limit: 20, total: 21, totalPages: 2 });
  });

  it('no permite marcar como leida una notificacion ajena', async () => {
    const { servicio } = crearDependencias();

    await expect(servicio.marcarLeida('notificacion-ajena')).rejects.toThrow(ApiError);
  });

  it('crea las preferencias por defecto cuando el usuario no las tiene', async () => {
    const { servicio, preferenciaRepository } = crearDependencias();

    await expect(servicio.obtenerPreferencias()).resolves.toEqual(PREFERENCIA);
    expect(preferenciaRepository.obtenerOCrear).toHaveBeenCalledWith(USUARIO_ID);
  });

  it('no genera avisos cuando el usuario desactivo las notificaciones', async () => {
    const { servicio, actividadRepository } = crearDependencias({
      preferencia: { ...PREFERENCIA, notificaciones_activas: false },
    });

    const resumen = await servicio.generarParaUsuario(USUARIO_ID, AHORA);

    expect(resumen).toEqual({
      creadas: 0,
      duplicadas: 0,
      enviadas: 0,
      erroresEnvio: 0,
      desactivada: true,
    });
    expect(actividadRepository.listarTareasProximas).not.toHaveBeenCalled();
  });

  it('genera avisos de tarea, evaluacion y sesion con clave idempotente', async () => {
    const { servicio, notificacionRepository } = crearDependencias({
      tareas: [
        {
          id: TAREA_ID,
          titulo: 'Ensayo',
          fecha_entrega: FECHA_ACTIVIDAD,
          materias: { nombre: 'Literatura' },
        },
      ],
      evaluaciones: [
        {
          id: EVALUACION_ID,
          titulo: 'Parcial',
          fecha_inicio: FECHA_ACTIVIDAD,
          materias: { nombre: 'Historia' },
        },
      ],
      sesiones: [
        { id: SESION_ID, tema: 'Repaso de formulas', fecha_inicio: FECHA_ACTIVIDAD },
      ],
    });

    const resumen = await servicio.generarParaUsuario(USUARIO_ID, AHORA);

    expect(resumen.creadas).toBe(3);
    const insertadas = notificacionRepository.crearSiNoExiste.mock.calls.map(([datos]) => datos);
    expect(insertadas.map((datos) => datos.tipo)).toEqual(['tarea', 'evaluacion', 'sesion']);
    expect(insertadas[0].tarea_id).toBe(TAREA_ID);
    expect(insertadas[1].evento_calendario_id).toBe(EVALUACION_ID);
    expect(insertadas[2].sesion_estudio_id).toBe(SESION_ID);
    expect(insertadas[0].clave_idempotencia).toContain(TAREA_ID);
    expect(insertadas[0].fecha_programada).toBe('2026-11-20T11:30:00.000Z');
  });

  it('publica en SNS y registra el envio solo cuando el canal esta activo', async () => {
    const { servicio, canalRepository, notificacionRepository } = crearDependencias({
      preferencia: { ...PREFERENCIA, canal_email: true },
      tareas: [{ id: TAREA_ID, titulo: 'Ensayo', fecha_entrega: FECHA_ACTIVIDAD }],
    });

    const resumen = await servicio.generarParaUsuario(USUARIO_ID, AHORA);

    expect(resumen.enviadas).toBe(1);
    expect(canalRepository.publicar).toHaveBeenCalledTimes(1);
    expect(notificacionRepository.marcarEnviada).toHaveBeenCalledWith('n-1', expect.any(String));
  });

  it('no reenvia una notificacion duplicada', async () => {
    const crear = jest.fn().mockResolvedValue(null);
    const { servicio, canalRepository } = crearDependencias({
      preferencia: { ...PREFERENCIA, canal_email: true },
      tareas: [{ id: TAREA_ID, titulo: 'Ensayo', fecha_entrega: FECHA_ACTIVIDAD }],
      crear,
    });

    const resumen = await servicio.generarParaUsuario(USUARIO_ID, AHORA);

    expect(resumen).toMatchObject({ creadas: 0, duplicadas: 1, enviadas: 0 });
    expect(canalRepository.publicar).not.toHaveBeenCalled();
  });

  it('un error de SNS no bloquea la notificacion interna', async () => {
    const publicar = jest.fn().mockRejectedValue(new Error('SNS caido'));
    const { servicio, notificacionRepository } = crearDependencias({
      preferencia: { ...PREFERENCIA, canal_email: true },
      tareas: [{ id: TAREA_ID, titulo: 'Ensayo', fecha_entrega: FECHA_ACTIVIDAD }],
      publicar,
    });

    const resumen = await servicio.generarParaUsuario(USUARIO_ID, AHORA);

    expect(resumen).toMatchObject({ creadas: 1, enviadas: 0, erroresEnvio: 1 });
    expect(notificacionRepository.marcarEnviada).not.toHaveBeenCalled();
  });

  it('rescata actividades caidas justo despues de la ventana anterior', async () => {
    const { servicio, actividadRepository, notificacionRepository } = crearDependencias({
      preferencia: { ...PREFERENCIA, anticipacion_minutos: 5 },
      tareas: [{ id: TAREA_ID, titulo: 'Ensayo', fecha_entrega: '2026-11-20T11:45:00.000Z' }],
    });

    const resumen = await servicio.generarParaUsuario(USUARIO_ID, AHORA);

    expect(resumen.creadas).toBe(1);
    expect(actividadRepository.listarTareasProximas).toHaveBeenCalledWith(
      USUARIO_ID,
      '2026-11-20T11:00:00.000Z',
      '2026-11-20T12:05:00.000Z',
    );
    expect(notificacionRepository.crearSiNoExiste).toHaveBeenCalledWith(
      expect.objectContaining({ fecha_programada: '2026-11-20T11:40:00.000Z' }),
    );
  });

  it('no supera el limite de 30 correos por dia', async () => {
    const publicar = jest.fn().mockResolvedValue(true);
    const tareas = Array.from({ length: 20 }, (_, indice) => ({
      id: `tarea-${indice}`,
      titulo: `Tarea ${indice}`,
      fecha_entrega: FECHA_ACTIVIDAD,
    }));
    const preferencias = Array.from({ length: 6 }, (_, indice) => ({
      ...PREFERENCIA,
      usuario_id: `usuario-${indice}`,
      canal_email: true,
    }));
    const { servicio, preferenciaRepository } = crearDependencias({ publicar, tareas });
    preferenciaRepository.listarActivas.mockResolvedValue(preferencias);

    const resumen = await servicio.ejecutarRecordatorios({ ahora: AHORA });

    expect(resumen.usuarios).toBe(6);
    expect(resumen.creadas).toBe(120);
    expect(resumen.enviadas).toBe(NotificacionService.MAXIMO_ENVOS_SNS_POR_DIA);
    expect(publicar).toHaveBeenCalledTimes(30);
  });

  it('descuenta el cupo ya enviado en ejecuciones anteriores del mismo dia', async () => {
    const publicar = jest.fn().mockResolvedValue(true);
    const preferencias = Array.from({ length: 2 }, (_, indice) => ({
      ...PREFERENCIA,
      usuario_id: `usuario-${indice}`,
      canal_email: true,
    }));
    const tareas = Array.from({ length: 20 }, (_, indice) => ({
      id: `tarea-${indice}`,
      titulo: `Tarea ${indice}`,
      fecha_entrega: FECHA_ACTIVIDAD,
    }));
    const { servicio, notificacionRepository, preferenciaRepository } = crearDependencias({
      publicar,
      tareas,
    });
    preferenciaRepository.listarActivas.mockResolvedValue(preferencias);
    notificacionRepository.contarEnviosDesde.mockResolvedValue(25);

    const resumen = await servicio.ejecutarRecordatorios({ ahora: AHORA });

    expect(notificacionRepository.contarEnviosDesde).toHaveBeenCalledWith(
      '2026-11-20T00:00:00.000Z',
    );
    expect(resumen.enviadasHoy).toBe(25);
    expect(resumen.enviadas).toBe(5);
    expect(publicar).toHaveBeenCalledTimes(5);
  });

  it('usa las preferencias activas para la ejecucion programada', async () => {
    const { servicio, preferenciaRepository } = crearDependencias();

    const resumen = await servicio.ejecutarRecordatorios({ ahora: AHORA });

    expect(preferenciaRepository.listarActivas).toHaveBeenCalledWith(100);
    expect(resumen.usuarios).toBe(1);
    expect(resumen.ejecutado_en).toBe(AHORA.toISOString());
  });
});
