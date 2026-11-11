const { describe, it, expect, beforeEach, jest: j } = require('@jest/globals');
const ApiError = require('../src/utils/ApiError');
const TareaService = require('../src/services/tarea.service');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const MATERIA_ID = '6d1c2a53-4f7e-4b8a-9c1d-2e3f4a5b6c7d';
const TAREA_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('TareaService', () => {
  let tareaRepository;
  let materiaRepository;
  let service;

  beforeEach(() => {
    tareaRepository = {
      listarTareas: j.fn(),
      listarProximas: j.fn(),
      obtenerTareaPorId: j.fn(),
      crearTarea: j.fn(),
      actualizarTarea: j.fn(),
      cambiarEstadoTarea: j.fn(),
      eliminarTarea: j.fn(),
      obtenerEstadisticas: j.fn(),
    };

    materiaRepository = {
      existeMateria: j.fn(),
    };

    service = new TareaService({
      tareaRepository,
      materiaRepository,
      usuarioActualId: USUARIO_ID,
    });
  });

  describe('listarTareas', () => {
    it('devuelve las tareas y la paginación calculada', async () => {
      tareaRepository.listarTareas.mockResolvedValue({
        items: [{ id: TAREA_ID, titulo: 'Parcial de cálculo' }],
        total: 1,
      });

      const resultado = await service.listarTareas({ limit: 10, offset: 20 });

      expect(tareaRepository.listarTareas).toHaveBeenCalledWith(
        USUARIO_ID,
        expect.objectContaining({ limit: 10, offset: 20, sort: 'fecha_entrega', order: 'asc' }),
      );
      expect(resultado.tareas).toHaveLength(1);
      expect(resultado.paginacion).toEqual({ limit: 10, offset: 20, total: 1 });
    });
  });

  describe('listarProximas', () => {
    it('consulta el rango de días solicitado', async () => {
      tareaRepository.listarProximas.mockResolvedValue([]);

      const resultado = await service.listarProximas({ dias: 5, limit: 3 });

      const [usuarioId, rango] = tareaRepository.listarProximas.mock.calls[0];
      expect(usuarioId).toBe(USUARIO_ID);
      expect(rango.limit).toBe(3);
      expect(rango.hasta.getTime()).toBeGreaterThan(rango.desde.getTime());
      expect(resultado.rango.dias).toBe(5);
    });
  });

  describe('obtenerTarea', () => {
    it('lanza 404 cuando la tarea no existe o es de otro usuario', async () => {
      tareaRepository.obtenerTareaPorId.mockResolvedValue(null);

      await expect(service.obtenerTarea(TAREA_ID)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('crearTarea', () => {
    const datosBase = {
      materia_id: MATERIA_ID,
      titulo: 'Parcial de cálculo',
      tipo: 'parcial',
      prioridad: 'alta',
    };

    it('rechaza una materia que no pertenece al usuario y no crea la tarea', async () => {
      materiaRepository.existeMateria.mockResolvedValue(false);

      await expect(service.crearTarea(datosBase)).rejects.toBeInstanceOf(ApiError);
      expect(tareaRepository.crearTarea).not.toHaveBeenCalled();
    });

    it('crea la tarea con fecha de asignación por defecto y entrega nula', async () => {
      materiaRepository.existeMateria.mockResolvedValue(true);
      tareaRepository.crearTarea.mockImplementation((_usuarioId, datos) =>
        Promise.resolve({ id: TAREA_ID, ...datos }),
      );

      const tarea = await service.crearTarea(datosBase);

      expect(materiaRepository.existeMateria).toHaveBeenCalledWith(USUARIO_ID, MATERIA_ID);
      expect(tarea.fecha_asignacion).toBeInstanceOf(Date);
      expect(tarea.fecha_entrega).toBeNull();
      expect(tarea.estado).toBe('pendiente');
      expect(tarea.prioridad).toBe('alta');
    });

    it('registra una actividad vencida sin fecha de asignación de forma coherente', async () => {
      materiaRepository.existeMateria.mockResolvedValue(true);
      tareaRepository.crearTarea.mockImplementation((_usuarioId, datos) =>
        Promise.resolve({ id: TAREA_ID, ...datos }),
      );

      const tarea = await service.crearTarea({
        ...datosBase,
        fecha_entrega: '2026-01-10T23:59:00.000Z',
      });

      expect(tarea.fecha_asignacion.toISOString()).toBe('2026-01-10T23:59:00.000Z');
      expect(tarea.fecha_entrega.toISOString()).toBe('2026-01-10T23:59:00.000Z');
    });
  });

  describe('actualizarTarea', () => {
    it('lanza 404 cuando la tarea no existe', async () => {
      tareaRepository.obtenerTareaPorId.mockResolvedValue(null);

      await expect(service.actualizarTarea(TAREA_ID, { titulo: 'Nuevo' })).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(tareaRepository.actualizarTarea).not.toHaveBeenCalled();
    });

    it('valida el rango de fechas contra la fecha de asignación existente', async () => {
      tareaRepository.obtenerTareaPorId.mockResolvedValue({
        id: TAREA_ID,
        materia_id: MATERIA_ID,
        fecha_asignacion: '2026-11-10T10:00:00.000Z',
        fecha_entrega: '2026-11-12T10:00:00.000Z',
      });

      await expect(
        service.actualizarTarea(TAREA_ID, { fecha_entrega: '2026-11-09T10:00:00.000Z' }),
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(tareaRepository.actualizarTarea).not.toHaveBeenCalled();
    });

    it('verifica la nueva materia cuando cambia', async () => {
      const nuevaMateria = '11111111-2222-4333-8444-555555555555';
      tareaRepository.obtenerTareaPorId.mockResolvedValue({
        id: TAREA_ID,
        materia_id: MATERIA_ID,
        fecha_asignacion: '2026-11-10T10:00:00.000Z',
        fecha_entrega: null,
      });
      materiaRepository.existeMateria.mockResolvedValue(false);

      await expect(
        service.actualizarTarea(TAREA_ID, { materia_id: nuevaMateria }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('sincronización con el calendario', () => {
    let calendarioService;
    let servicioConCalendario;

    beforeEach(() => {
      calendarioService = { crearEventoDesdeTarea: j.fn().mockResolvedValue(TAREA_ID) };
      servicioConCalendario = new TareaService({
        tareaRepository,
        materiaRepository,
        calendarioService,
        usuarioActualId: USUARIO_ID,
      });
    });

    it('crea el evento cuando la tarea se crea con fecha de entrega', async () => {
      materiaRepository.existeMateria.mockResolvedValue(true);
      tareaRepository.crearTarea.mockResolvedValue({ id: TAREA_ID });

      await servicioConCalendario.crearTarea({
        materia_id: MATERIA_ID,
        titulo: 'Parcial de cálculo',
        fecha_entrega: '2026-11-20T23:59:00.000Z',
      });

      expect(calendarioService.crearEventoDesdeTarea).toHaveBeenCalledWith(TAREA_ID);
    });

    it('no llama al calendario cuando la tarea se crea sin fecha de entrega', async () => {
      materiaRepository.existeMateria.mockResolvedValue(true);
      tareaRepository.crearTarea.mockResolvedValue({ id: TAREA_ID });

      await servicioConCalendario.crearTarea({
        materia_id: MATERIA_ID,
        titulo: 'Parcial de cálculo',
      });

      expect(calendarioService.crearEventoDesdeTarea).not.toHaveBeenCalled();
    });

    it('sincroniza al actualizar aunque la fecha de entrega se elimine', async () => {
      tareaRepository.obtenerTareaPorId.mockResolvedValue({
        id: TAREA_ID,
        materia_id: MATERIA_ID,
        fecha_asignacion: '2026-11-10T10:00:00.000Z',
        fecha_entrega: '2026-11-12T10:00:00.000Z',
      });
      tareaRepository.actualizarTarea.mockResolvedValue({ id: TAREA_ID });

      await servicioConCalendario.actualizarTarea(TAREA_ID, { fecha_entrega: null });

      expect(calendarioService.crearEventoDesdeTarea).toHaveBeenCalledWith(TAREA_ID);
    });

    it('devuelve la tarea aunque falle la sincronización con el calendario', async () => {
      materiaRepository.existeMateria.mockResolvedValue(true);
      tareaRepository.crearTarea.mockResolvedValue({ id: TAREA_ID });
      calendarioService.crearEventoDesdeTarea.mockRejectedValue(new Error('RPC no disponible'));

      const tarea = await servicioConCalendario.crearTarea({
        materia_id: MATERIA_ID,
        titulo: 'Parcial de cálculo',
        fecha_entrega: '2026-11-20T23:59:00.000Z',
      });

      expect(tarea.id).toBe(TAREA_ID);
    });
  });

  describe('cambiarEstadoTarea', () => {
    it('lanza 404 cuando el repositorio no encuentra la tarea', async () => {
      tareaRepository.cambiarEstadoTarea.mockResolvedValue(null);

      await expect(service.cambiarEstadoTarea(TAREA_ID, 'completada')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('devuelve la tarea actualizada', async () => {
      tareaRepository.cambiarEstadoTarea.mockResolvedValue({ id: TAREA_ID, estado: 'completada' });

      const tarea = await service.cambiarEstadoTarea(TAREA_ID, 'completada');

      expect(tarea.estado).toBe('completada');
    });
  });

  describe('eliminarTarea', () => {
    it('lanza 404 cuando no se eliminó ninguna fila', async () => {
      tareaRepository.eliminarTarea.mockResolvedValue(false);

      await expect(service.eliminarTarea(TAREA_ID)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('obtenerEstadisticas', () => {
    it('devuelve los contadores del repositorio', async () => {
      const estadisticas = {
        total: 4,
        pendientes: 2,
        en_progreso: 1,
        completadas: 1,
        vencidas: 1,
        prioridad_alta: 1,
        prioridad_media: 2,
        prioridad_baja: 1,
      };
      tareaRepository.obtenerEstadisticas.mockResolvedValue(estadisticas);

      await expect(service.obtenerEstadisticas()).resolves.toEqual(estadisticas);
    });
  });
});
