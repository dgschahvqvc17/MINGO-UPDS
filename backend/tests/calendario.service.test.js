const { describe, it, expect, beforeEach, jest: j } = require('@jest/globals');
const ApiError = require('../src/utils/ApiError');
const CalendarioService = require('../src/services/calendario.service');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const MATERIA_ID = '6d1c2a53-4f7e-4b8a-9c1d-2e3f4a5b6c7d';
const TAREA_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const EVENTO_ID = '5b4a3c2d-1e0f-4a9b-8c7d-6e5f4a3b2c1d';

describe('CalendarioService', () => {
  let calendarioRepository;
  let materiaRepository;
  let tareaRepository;
  let service;

  beforeEach(() => {
    calendarioRepository = {
      listarEventos: j.fn(),
      listarProximos: j.fn(),
      obtenerEventoPorId: j.fn(),
      crearEvento: j.fn(),
      actualizarEvento: j.fn(),
      eliminarEvento: j.fn(),
      crearEventoDesdeTarea: j.fn(),
    };

    materiaRepository = {
      existeMateria: j.fn(),
    };

    tareaRepository = {
      obtenerTareaPorId: j.fn(),
    };

    service = new CalendarioService({
      calendarioRepository,
      materiaRepository,
      tareaRepository,
      usuarioActualId: USUARIO_ID,
    });
  });

  describe('listarEventos', () => {
    it('normaliza la paginación y consulta solo los eventos del usuario', async () => {
      calendarioRepository.listarEventos.mockResolvedValue({
        items: [{ id: EVENTO_ID }],
        total: 1,
      });

      const resultado = await service.listarEventos({
        desde: '2026-11-01T00:00:00.000Z',
        hasta: '2026-11-30T23:59:59.999Z',
      });

      expect(calendarioRepository.listarEventos).toHaveBeenCalledWith(
        USUARIO_ID,
        expect.objectContaining({ limit: 50, offset: 0, sort: 'fecha_inicio', order: 'asc' }),
      );
      expect(resultado.paginacion).toEqual({ limit: 50, offset: 0, total: 1 });
      expect(resultado.eventos).toHaveLength(1);
    });

    it('rechaza un rango con la fecha inicial posterior a la final', async () => {
      await expect(
        service.listarEventos({
          desde: '2026-11-30T00:00:00.000Z',
          hasta: '2026-11-01T00:00:00.000Z',
        }),
      ).rejects.toThrow();

      expect(calendarioRepository.listarEventos).not.toHaveBeenCalled();
    });

    it('exige las fechas del rango', async () => {
      await expect(service.listarEventos({})).rejects.toThrow();

      expect(calendarioRepository.listarEventos).not.toHaveBeenCalled();
    });
  });

  describe('listarProximos', () => {
    it('devuelve los eventos y el rango de anticipación', async () => {
      calendarioRepository.listarProximos.mockResolvedValue([{ id: EVENTO_ID }]);

      const resultado = await service.listarProximos({ dias: 5, limit: 3 });

      expect(calendarioRepository.listarProximos).toHaveBeenCalledWith(USUARIO_ID, {
        dias: 5,
        limit: 3,
      });
      expect(resultado.eventos).toHaveLength(1);
      expect(resultado.rango.dias).toBe(5);
    });
  });

  describe('obtenerEvento', () => {
    it('devuelve el evento del usuario', async () => {
      calendarioRepository.obtenerEventoPorId.mockResolvedValue({ id: EVENTO_ID });

      const evento = await service.obtenerEvento(EVENTO_ID);

      expect(evento.id).toBe(EVENTO_ID);
      expect(calendarioRepository.obtenerEventoPorId).toHaveBeenCalledWith(
        USUARIO_ID,
        EVENTO_ID,
      );
    });

    it('responde 404 cuando el evento no existe o es de otro usuario', async () => {
      calendarioRepository.obtenerEventoPorId.mockResolvedValue(null);

      await expect(service.obtenerEvento(EVENTO_ID)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('crearEvento', () => {
    it('crea el evento cuando la materia pertenece al usuario', async () => {
      materiaRepository.existeMateria.mockResolvedValue(true);
      calendarioRepository.crearEvento.mockResolvedValue({ id: EVENTO_ID });

      const evento = await service.crearEvento({
        materia_id: MATERIA_ID,
        titulo: 'Examen parcial',
        tipo_evento: 'examen',
        fecha_inicio: '2026-11-20T14:00:00.000Z',
      });

      expect(materiaRepository.existeMateria).toHaveBeenCalledWith(USUARIO_ID, MATERIA_ID);
      expect(calendarioRepository.crearEvento).toHaveBeenCalledWith(
        USUARIO_ID,
        expect.objectContaining({ tipo_evento: 'examen', titulo: 'Examen parcial' }),
      );
      expect(evento.id).toBe(EVENTO_ID);
    });

    it('rechaza una materia ajena sin crear el evento', async () => {
      materiaRepository.existeMateria.mockResolvedValue(false);

      await expect(
        service.crearEvento({
          materia_id: MATERIA_ID,
          titulo: 'Examen parcial',
          fecha_inicio: '2026-11-20T14:00:00.000Z',
        }),
      ).rejects.toThrow(ApiError);

      expect(calendarioRepository.crearEvento).not.toHaveBeenCalled();
    });

    it('rechaza una tarea ajena sin crear el evento', async () => {
      tareaRepository.obtenerTareaPorId.mockResolvedValue(null);

      await expect(
        service.crearEvento({
          tarea_id: TAREA_ID,
          titulo: 'Entrega del proyecto',
          fecha_inicio: '2026-11-20T14:00:00.000Z',
        }),
      ).rejects.toMatchObject({ statusCode: 404 });

      expect(calendarioRepository.crearEvento).not.toHaveBeenCalled();
    });
  });

  describe('actualizarEvento', () => {
    const eventoActual = {
      id: EVENTO_ID,
      fecha_inicio: '2026-11-20T14:00:00.000Z',
      fecha_fin: '2026-11-20T16:00:00.000Z',
    };

    it('actualiza el evento del usuario', async () => {
      calendarioRepository.obtenerEventoPorId.mockResolvedValue(eventoActual);
      calendarioRepository.actualizarEvento.mockResolvedValue({
        ...eventoActual,
        titulo: 'Nuevo título',
      });

      const evento = await service.actualizarEvento(EVENTO_ID, { titulo: 'Nuevo título' });

      expect(evento.titulo).toBe('Nuevo título');
      expect(calendarioRepository.actualizarEvento).toHaveBeenCalledWith(
        USUARIO_ID,
        EVENTO_ID,
        expect.objectContaining({ titulo: 'Nuevo título' }),
      );
    });

    it('valida el rango combinando la fecha nueva con la almacenada', async () => {
      calendarioRepository.obtenerEventoPorId.mockResolvedValue(eventoActual);

      await expect(
        service.actualizarEvento(EVENTO_ID, { fecha_inicio: '2026-11-20T18:00:00.000Z' }),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(calendarioRepository.actualizarEvento).not.toHaveBeenCalled();
    });

    it('responde 404 cuando el evento no existe', async () => {
      calendarioRepository.obtenerEventoPorId.mockResolvedValue(null);

      await expect(
        service.actualizarEvento(EVENTO_ID, { titulo: 'Nuevo título' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('responde 404 si el repositorio no devuelve el evento actualizado', async () => {
      calendarioRepository.obtenerEventoPorId.mockResolvedValue(eventoActual);
      calendarioRepository.actualizarEvento.mockResolvedValue(null);

      await expect(
        service.actualizarEvento(EVENTO_ID, { titulo: 'Nuevo título' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('eliminarEvento', () => {
    it('elimina el evento del usuario', async () => {
      calendarioRepository.eliminarEvento.mockResolvedValue(true);

      await service.eliminarEvento(EVENTO_ID);

      expect(calendarioRepository.eliminarEvento).toHaveBeenCalledWith(USUARIO_ID, EVENTO_ID);
    });

    it('responde 404 cuando el evento no existe', async () => {
      calendarioRepository.eliminarEvento.mockResolvedValue(false);

      await expect(service.eliminarEvento(EVENTO_ID)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('crearEventoDesdeTarea', () => {
    it('delega en el repositorio con el usuario actual', async () => {
      calendarioRepository.crearEventoDesdeTarea.mockResolvedValue(EVENTO_ID);

      const eventoId = await service.crearEventoDesdeTarea(TAREA_ID);

      expect(eventoId).toBe(EVENTO_ID);
      expect(calendarioRepository.crearEventoDesdeTarea).toHaveBeenCalledWith(
        USUARIO_ID,
        TAREA_ID,
      );
    });
  });
});
