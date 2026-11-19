const { describe, it, expect, beforeEach, jest: j } = require('@jest/globals');
const { crearHandler, extraerTareas, decodificarClave, esReintentoDeCola } = require('../src/lambda/procesador');

const MENSAJE_INTERNO = JSON.stringify({
  tipo: 'procesar_documento',
  documentoId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
  usuarioId: '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01',
  forzar: true,
});

describe('procesador (Lambda)', () => {
  describe('decodificarClave', () => {
    it('decodifica espacios y caracteres escapados de la clave de S3', () => {
      expect(decodificarClave('usuarios/a/documentos/mi+archivo.pdf')).toBe(
        'usuarios/a/documentos/mi archivo.pdf',
      );
      expect(decodificarClave('usuarios/a/documentos/c%C3%A1lculo.pdf')).toBe(
        'usuarios/a/documentos/cálculo.pdf',
      );
    });
  });

  describe('esReintentoDeCola', () => {
    it('trata la primera entrega como intento inicial', () => {
      expect(esReintentoDeCola({ attributes: { ApproximateReceiveCount: '1' } })).toBe(false);
      expect(esReintentoDeCola({})).toBe(false);
      expect(esReintentoDeCola({ attributes: {} })).toBe(false);
    });

    it('reconoce las entregas posteriores como reintento', () => {
      expect(esReintentoDeCola({ attributes: { ApproximateReceiveCount: '2' } })).toBe(true);
      expect(esReintentoDeCola({ attributes: { ApproximateReceiveCount: 4 } })).toBe(true);
    });
  });

  describe('extraerTareas', () => {
    it('extrae el mensaje interno de la API', () => {
      expect(extraerTareas(MENSAJE_INTERNO)).toEqual([
        {
          tipo: 'procesar_documento',
          documentoId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
          usuarioId: '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01',
          forzar: true,
        },
      ]);
    });

    it('rechaza un mensaje interno sin identificadores', () => {
      expect(() => extraerTareas(JSON.stringify({ tipo: 'procesar_documento' }))).toThrow(
        /documentoId o usuarioId/,
      );
    });

    it('extrae y decodifica los registros de un evento de S3', () => {
      const evento = {
        Records: [
          {
            s3: {
              object: { key: 'usuarios/u/documentos/mi+documento.pdf' },
            },
          },
          {
            s3: {
              object: { key: 'tmp/ignorado.pdf' },
            },
          },
        ],
      };

      expect(extraerTareas(JSON.stringify(evento))).toEqual([
        { tipo: 's3', ruta: 'usuarios/u/documentos/mi documento.pdf', forzar: false },
      ]);
    });

    it('rechaza un JSON inválido', () => {
      expect(() => extraerTareas('{no-es-json')).toThrow(/JSON invalido/);
    });

    it('devuelve una lista vacía para un evento sin registros', () => {
      expect(extraerTareas(JSON.stringify({ hola: 'mundo' }))).toEqual([]);
    });
  });

  describe('crearHandler', () => {
    let servicio;
    let crearServicio;
    let logger;
    let handler;

    beforeEach(() => {
      servicio = {
        procesarDocumento: j.fn().mockResolvedValue({ estado: 'procesado' }),
        procesarPorRuta: j.fn().mockResolvedValue({ estado: 'procesado' }),
      };

      crearServicio = j.fn().mockReturnValue(servicio);
      logger = { error: j.fn(), warn: j.fn() };
      handler = crearHandler({ crearServicio, logger });
    });

    it('devuelve una lista de fallos vacía cuando el lote está vacío', async () => {
      await expect(handler({ Records: [] })).resolves.toEqual({ batchItemFailures: [] });
      expect(crearServicio).not.toHaveBeenCalled();
    });

    it('procesa los mensajes internos de la API', async () => {
      const evento = {
        Records: [{ messageId: 'm-1', body: MENSAJE_INTERNO }],
      };

      const resultado = await handler(evento);

      expect(servicio.procesarDocumento).toHaveBeenCalledWith({
        tipo: 'procesar_documento',
        documentoId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
        usuarioId: '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01',
        forzar: true,
        esReintento: false,
      });
      expect(resultado).toEqual({ batchItemFailures: [] });
    });

    it('marca como reintento el mensaje que SQS entrega por segunda vez', async () => {
      const evento = {
        Records: [
          {
            messageId: 'm-1',
            body: MENSAJE_INTERNO,
            attributes: { ApproximateReceiveCount: '2' },
          },
        ],
      };

      await handler(evento);

      expect(servicio.procesarDocumento).toHaveBeenCalledWith(
        expect.objectContaining({ esReintento: true }),
      );
    });

    it('marca como reintento un evento de S3 que SQS entrega de nuevo', async () => {
      const evento = {
        Records: [
          {
            messageId: 'm-2',
            attributes: { ApproximateReceiveCount: '3' },
            body: JSON.stringify({
              Records: [{ s3: { object: { key: 'usuarios/u/documentos/calculo.pdf' } } }],
            }),
          },
        ],
      };

      await handler(evento);

      expect(servicio.procesarPorRuta).toHaveBeenCalledWith(
        'usuarios/u/documentos/calculo.pdf',
        { forzar: false, esReintento: true },
      );
    });

    it('procesa los eventos automáticos de S3', async () => {
      const evento = {
        Records: [
          {
            messageId: 'm-2',
            body: JSON.stringify({
              Records: [
                { s3: { object: { key: 'usuarios/u/documentos/calculo.pdf' } } },
              ],
            }),
          },
        ],
      };

      const resultado = await handler(evento);

      expect(servicio.procesarPorRuta).toHaveBeenCalledWith(
        'usuarios/u/documentos/calculo.pdf',
        { forzar: false, esReintento: false },
      );
      expect(resultado).toEqual({ batchItemFailures: [] });
    });

    it('reporta solo los mensajes que fallaron para que SQS los reintente', async () => {
      servicio.procesarDocumento
        .mockRejectedValueOnce(new Error('temporal'))
        .mockResolvedValueOnce({ estado: 'procesado' });

      const evento = {
        Records: [
          { messageId: 'm-1', body: MENSAJE_INTERNO },
          { messageId: 'm-2', body: MENSAJE_INTERNO },
        ],
      };

      const resultado = await handler(evento);

      expect(resultado).toEqual({ batchItemFailures: [{ itemIdentifier: 'm-1' }] });
      expect(logger.error).toHaveBeenCalledWith(
        'Fallo al procesar un mensaje de la cola.',
        expect.objectContaining({ messageId: 'm-1' }),
      );
    });

    it('reporta el mensaje cuando su cuerpo no es JSON válido', async () => {
      const evento = { Records: [{ messageId: 'm-roto', body: 'no-json' }] };

      const resultado = await handler(evento);

      expect(resultado).toEqual({
        batchItemFailures: [{ itemIdentifier: 'm-roto' }],
      });
    });
  });
});
