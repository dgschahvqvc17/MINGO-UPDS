const { describe, it, expect, beforeEach, jest: j } = require('@jest/globals');
const EmbeddingsService = require('../src/services/ia/embeddings.service');

/**
 * @param {number} [dimensiones]
 * @returns {number[]}
 */
function crearVector(dimensiones = 1536) {
  return new Array(dimensiones).fill(0.01);
}

/**
 * Cliente de IA simulado: no hace red y conserva las llamadas recibidas.
 *
 * @param {(parametros: object) => Promise<object>} [respuesta]
 * @returns {{ embeddings: { create: jest.Mock } }}
 */
function crearClienteSimulado(respuesta) {
  const create =
    respuesta ??
    (async ({ input }) => ({
      data: input.map((_, indice) => ({ index: indice, embedding: crearVector() })),
    }));

  return { embeddings: { create: j.fn(create) } };
}

describe('EmbeddingsService', () => {
  describe('configuración', () => {
    it('no está disponible cuando no hay cliente ni clave', () => {
      const service = new EmbeddingsService({ client: null, apiKey: '', dimensiones: 1536 });

      expect(service.estaDisponible()).toBe(false);
    });

    it('falla de forma permanente si no está configurado y se piden embeddings', async () => {
      const service = new EmbeddingsService({ client: null, dimensiones: 1536 });

      await expect(service.generarEmbeddings(['texto'])).rejects.toMatchObject({
        permanente: true,
      });
    });

    it('devuelve una lista vacía cuando no hay textos', async () => {
      const service = new EmbeddingsService({ client: crearClienteSimulado(), dimensiones: 1536 });

      await expect(service.generarEmbeddings([])).resolves.toEqual([]);
    });
  });

  describe('generarEmbeddings', () => {
    let cliente;

    beforeEach(() => {
      cliente = crearClienteSimulado();
    });

    it('genera un embedding por texto', async () => {
      const service = new EmbeddingsService({ client: cliente, dimensiones: 1536 });

      const resultado = await service.generarEmbeddings(['uno', 'dos']);

      expect(resultado).toHaveLength(2);
      expect(resultado[0]).toHaveLength(1536);
      expect(cliente.embeddings.create).toHaveBeenCalledWith({
        model: expect.any(String),
        input: ['uno', 'dos'],
        dimensions: 1536,
        encoding_format: 'float',
      });
    });

    it('envía al proveedor la dimensión configurada', async () => {
      const cliente1024 = crearClienteSimulado(async ({ input }) => ({
        data: input.map((_, indice) => ({ index: indice, embedding: crearVector(1024) })),
      }));
      const service = new EmbeddingsService({ client: cliente1024, dimensiones: 1024 });

      await service.generarEmbeddings(['uno']);

      expect(cliente1024.embeddings.create).toHaveBeenCalledWith({
        model: expect.any(String),
        input: ['uno'],
        dimensions: 1024,
        encoding_format: 'float',
      });
    });

    it('divide las solicitudes en lotes de 64', async () => {
      const service = new EmbeddingsService({ client: cliente, dimensiones: 1536 });
      const textos = Array.from({ length: 65 }, (_, indice) => `texto ${indice}`);

      const resultado = await service.generarEmbeddings(textos);

      expect(resultado).toHaveLength(65);
      expect(cliente.embeddings.create).toHaveBeenCalledTimes(2);
      expect(cliente.embeddings.create.mock.calls[0][0].input).toHaveLength(64);
      expect(cliente.embeddings.create.mock.calls[1][0].input).toHaveLength(1);
    });

    it('ordena los vectores por el índice devuelto por el proveedor', async () => {
      const clienteDesordenado = crearClienteSimulado(async ({ input }) => ({
        data: input
          .map((texto, indice) => ({
            index: indice,
            embedding: new Array(1536).fill(indice),
          }))
          .reverse(),
      }));
      const service = new EmbeddingsService({
        client: clienteDesordenado,
        dimensiones: 1536,
      });

      const resultado = await service.generarEmbeddings(['a', 'b']);

      expect(resultado[0][0]).toBe(0);
      expect(resultado[1][0]).toBe(1);
    });

    it('rechaza una cantidad de embeddings inesperada como error temporal', async () => {
      const clienteIncompleto = crearClienteSimulado(async () => ({
        data: [{ index: 0, embedding: crearVector() }],
      }));
      const service = new EmbeddingsService({ client: clienteIncompleto, dimensiones: 1536 });

      await expect(service.generarEmbeddings(['a', 'b'])).rejects.toMatchObject({
        permanente: false,
      });
    });

    it('rechaza un vector con dimensiones distintas a la columna', async () => {
      const clienteCorto = crearClienteSimulado(async () => ({
        data: [{ index: 0, embedding: crearVector(10) }],
      }));
      const service = new EmbeddingsService({ client: clienteCorto, dimensiones: 1536 });

      await expect(service.generarEmbeddings(['a'])).rejects.toMatchObject({
        permanente: true,
      });
    });

    it('traduce una clave inválida como error permanente', async () => {
      const clienteError = crearClienteSimulado(async () => {
        throw Object.assign(new Error('unauthorized'), { status: 401 });
      });
      const service = new EmbeddingsService({ client: clienteError, dimensiones: 1536 });

      await expect(service.generarEmbeddings(['a'])).rejects.toMatchObject({
        permanente: true,
        message: 'La clave del proveedor de IA no es valida.',
      });
    });

    it('traduce un 429 como error temporal', async () => {
      const clienteError = crearClienteSimulado(async () => {
        throw Object.assign(new Error('rate limit'), { status: 429 });
      });
      const service = new EmbeddingsService({ client: clienteError, dimensiones: 1536 });

      await expect(service.generarEmbeddings(['a'])).rejects.toMatchObject({
        permanente: false,
      });
    });

    it('traduce un timeout como error temporal', async () => {
      const clienteError = crearClienteSimulado(async () => {
        throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
      });
      const service = new EmbeddingsService({ client: clienteError, dimensiones: 1536 });

      await expect(service.generarEmbeddings(['a'])).rejects.toMatchObject({
        permanente: false,
      });
    });

    it('traduce un 400 como error permanente', async () => {
      const clienteError = crearClienteSimulado(async () => {
        throw Object.assign(new Error('bad request'), { status: 400 });
      });
      const service = new EmbeddingsService({ client: clienteError, dimensiones: 1536 });

      await expect(service.generarEmbeddings(['a'])).rejects.toMatchObject({
        permanente: true,
      });
    });
  });
});
