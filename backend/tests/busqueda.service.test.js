const BusquedaService = require('../src/services/busqueda.service');
const { UMBRAL_SIMILITUD } = BusquedaService;
const { ErrorProcesamiento } = require('../src/services/procesamiento/procesamiento.error');
const { TOP_K_BUSQUEDA } = require('../src/models/documento.model');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const MATERIA_ID = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';
const EMBEDDING = Array.from({ length: 1536 }, (_, indice) => indice / 1536);

const FILA = {
  id: 'fragmento-1',
  documento_id: DOCUMENTO_ID,
  documento_nombre: 'Apuntes de cálculo',
  numero_fragmento: 3,
  numero_pagina: 12,
  contenido: 'La derivada mide la tasa de cambio instantánea.',
  similitud: 0.873421,
  modelo_embedding: 'text-embedding-3-small',
};

/**
 * @param {object} [opciones]
 * @returns {{ servicio: BusquedaService, dependencias: object }}
 */
function crearServicio({
  fragmentos = [FILA],
  consumo = 0,
  documento = { id: DOCUMENTO_ID, estado_procesamiento: 'procesado' },
  materia = { id: MATERIA_ID },
  embeddingError = null,
} = {}) {
  const dependencias = {
    embeddingsService: {
      generarEmbeddings: jest
        .fn()
        .mockImplementation(() =>
          embeddingError ? Promise.reject(embeddingError) : Promise.resolve([EMBEDDING]),
        ),
    },
    fragmentoRepository: {
      buscarSimilares: jest.fn().mockResolvedValue(fragmentos),
    },
    documentoRepository: {
      obtenerDocumentoPorId: jest.fn().mockResolvedValue(documento),
    },
    materiaRepository: {
      obtenerMateriaPorId: jest.fn().mockResolvedValue(materia),
    },
    consumoRepository: {
      contar: jest.fn().mockResolvedValue(consumo),
      registrar: jest.fn().mockResolvedValue('consumo-id'),
    },
    usuarioActualId: USUARIO_ID,
  };

  return { servicio: new BusquedaService(dependencias), dependencias };
}

describe('BusquedaService (HU11)', () => {
  it('usa el umbral calibrado para el modelo de embeddings configurado', () => {
    expect(UMBRAL_SIMILITUD).toBe(0.55);
  });

  it('devuelve los fragmentos mapeados y sin mensaje cuando hay coincidencias', async () => {
    const { servicio, dependencias } = crearServicio();

    const resultado = await servicio.buscar({ consulta: 'derivadas de funciones' });

    expect(resultado).toEqual({
      resultados: [
        {
          fragmento_id: 'fragmento-1',
          documento_id: DOCUMENTO_ID,
          documento_nombre: 'Apuntes de cálculo',
          contenido: 'La derivada mide la tasa de cambio instantánea.',
          numero_pagina: 12,
          similitud: 0.873421,
        },
      ],
      mensaje: null,
    });
    expect(dependencias.fragmentoRepository.buscarSimilares).toHaveBeenCalledWith(EMBEDDING, {
      limite: TOP_K_BUSQUEDA,
      umbral: UMBRAL_SIMILITUD,
      documentoId: null,
      materiaId: null,
    });
  });

  it('informa de forma clara cuando no hay fragmentos relevantes', async () => {
    const { servicio, dependencias } = crearServicio({ fragmentos: [] });

    const resultado = await servicio.buscar({ consulta: 'temas sin coincidencia' });

    expect(resultado.resultados).toEqual([]);
    expect(resultado.mensaje).toMatch(/No encontramos fragmentos relacionados/);
    expect(dependencias.consumoRepository.registrar).toHaveBeenCalledTimes(1);
  });

  it('propaga el limite y los filtros de documento y materia a la RPC', async () => {
    const { servicio, dependencias } = crearServicio();

    await servicio.buscar({
      consulta: 'derivadas',
      documentoId: DOCUMENTO_ID,
      materiaId: MATERIA_ID,
      limite: 20,
    });

    expect(dependencias.documentoRepository.obtenerDocumentoPorId).toHaveBeenCalledWith(
      USUARIO_ID,
      DOCUMENTO_ID,
    );
    expect(dependencias.materiaRepository.obtenerMateriaPorId).toHaveBeenCalledWith(
      USUARIO_ID,
      MATERIA_ID,
    );
    expect(dependencias.fragmentoRepository.buscarSimilares).toHaveBeenCalledWith(EMBEDDING, {
      limite: 20,
      umbral: UMBRAL_SIMILITUD,
      documentoId: DOCUMENTO_ID,
      materiaId: MATERIA_ID,
    });
  });

  it('devuelve 404 si el documento solicitado es ajeno o no existe', async () => {
    const { servicio, dependencias } = crearServicio({ documento: null });

    await expect(
      servicio.buscar({ consulta: 'derivadas', documentoId: DOCUMENTO_ID }),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(dependencias.embeddingsService.generarEmbeddings).not.toHaveBeenCalled();
  });

  it('devuelve 422 si el documento todavía no está procesado', async () => {
    const { servicio, dependencias } = crearServicio({
      documento: { id: DOCUMENTO_ID, estado_procesamiento: 'procesando' },
    });

    await expect(
      servicio.buscar({ consulta: 'derivadas', documentoId: DOCUMENTO_ID }),
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(dependencias.fragmentoRepository.buscarSimilares).not.toHaveBeenCalled();
  });

  it('devuelve 404 si la materia solicitada es ajena o no existe', async () => {
    const { servicio, dependencias } = crearServicio({ materia: null });

    await expect(
      servicio.buscar({ consulta: 'derivadas', materiaId: MATERIA_ID }),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(dependencias.embeddingsService.generarEmbeddings).not.toHaveBeenCalled();
  });

  it('rechaza la búsqueda al agotar la cuota diaria', async () => {
    const { servicio, dependencias } = crearServicio({
      consumo: BusquedaService.LIMITE_DIARIO_BUSQUEDAS,
    });

    await expect(servicio.buscar({ consulta: 'derivadas' })).rejects.toMatchObject({
      statusCode: 429,
      details: { code: 'AI_QUOTA_EXCEEDED' },
    });

    expect(dependencias.embeddingsService.generarEmbeddings).not.toHaveBeenCalled();
    expect(dependencias.consumoRepository.registrar).not.toHaveBeenCalled();
  });

  it('traduce la falta de configuración de IA a 503 sin datos internos', async () => {
    const { servicio } = crearServicio({
      embeddingError: ErrorProcesamiento.permanente(
        'El servicio de IA no esta configurado. Falta AI_API_KEY en el servidor.',
      ),
    });

    await expect(servicio.buscar({ consulta: 'derivadas' })).rejects.toMatchObject({
      statusCode: 503,
    });
  });

  it('registra el consumo con la operación busqueda y sin tokens de salida', async () => {
    const { servicio, dependencias } = crearServicio();

    await servicio.buscar({ consulta: 'derivadas' });

    expect(dependencias.consumoRepository.contar).toHaveBeenCalledWith(
      USUARIO_ID,
      'busqueda',
      expect.any(String),
    );
    expect(dependencias.consumoRepository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario_id: USUARIO_ID,
        operacion: 'busqueda',
        tokens_salida: 0,
      }),
    );
  });

  it('propaga errores inesperados sin convertirlos en ApiError', async () => {
    const error = new Error('Fallo de red con Supabase');
    const { servicio } = crearServicio();
    servicio.fragmentoRepository.buscarSimilares.mockRejectedValue(error);

    await expect(servicio.buscar({ consulta: 'derivadas' })).rejects.toBe(error);
  });
});
