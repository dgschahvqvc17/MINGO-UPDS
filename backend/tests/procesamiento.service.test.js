const { describe, it, expect, beforeEach, jest: j } = require('@jest/globals');
const ProcesamientoService = require('../src/services/procesamiento.service');
const FragmentadorService = require('../src/services/procesamiento/fragmentador.service');
const { ErrorProcesamiento } = require('../src/services/procesamiento/procesamiento.error');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const OTRO_USUARIO_ID = '11111111-2222-4333-8444-555555555555';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const OBJECT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const RUTA = `usuarios/${USUARIO_ID}/documentos/${OBJECT_ID}/calculo.pdf`;

const TEXTO_CORTO = 'Contenido de prueba del documento académico.';

/**
 * @param {number} dimensiones
 * @returns {number[]}
 */
function crearVector(dimensiones = 1536) {
  return new Array(dimensiones).fill(0.01);
}

/**
 * @param {object} [sobrescrituras]
 * @returns {object}
 */
function crearDocumento(sobrescrituras = {}) {
  return {
    id: DOCUMENTO_ID,
    usuario_id: USUARIO_ID,
    nombre_archivo: 'calculo.pdf',
    ruta_almacenamiento: RUTA,
    tipo_archivo: 'application/pdf',
    estado_procesamiento: 'pendiente',
    motivo_error: null,
    numero_paginas: null,
    ...sobrescrituras,
  };
}

describe('ProcesamientoService', () => {
  let documentoRepository;
  let fragmentoRepository;
  let almacenamientoRepository;
  let embeddingsService;
  let extractorService;
  let logger;
  let service;

  beforeEach(() => {
    documentoRepository = {
      obtenerPorIdSinUsuario: j.fn(),
      obtenerPorRutaSinUsuario: j.fn(),
      marcarProcesando: j.fn(),
      marcarReintento: j.fn().mockResolvedValue({}),
      actualizarResultadoProcesamiento: j.fn().mockResolvedValue({}),
    };

    fragmentoRepository = {
      reemplazarFragmentos: j.fn().mockResolvedValue(1),
    };

    almacenamientoRepository = {
      estaDisponible: j.fn().mockReturnValue(true),
      obtenerObjeto: j.fn().mockResolvedValue(Buffer.from('%PDF-1.4 contenido')),
    };

    embeddingsService = {
      estaDisponible: j.fn().mockReturnValue(true),
      dimensiones: 1536,
      modelo: 'text-embedding-3-small',
      generarEmbeddings: j.fn().mockResolvedValue([crearVector()]),
    };

    extractorService = {
      extraer: j.fn().mockResolvedValue({
        paginas: [{ numero: 1, texto: TEXTO_CORTO }],
        numeroPaginas: 1,
      }),
    };

    logger = { error: j.fn(), warn: j.fn() };

    service = new ProcesamientoService({
      documentoRepository,
      fragmentoRepository,
      almacenamientoRepository,
      embeddingsService,
      extractorService,
      fragmentadorService: new FragmentadorService(),
      logger,
    });
  });

  describe('procesarDocumento', () => {
    it('extrae, fragmenta, guarda embeddings y marca el documento como procesado', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(crearDocumento());
      documentoRepository.marcarProcesando.mockResolvedValue(crearDocumento());

      const resultado = await service.procesarDocumento({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
        forzar: true,
      });

      expect(almacenamientoRepository.obtenerObjeto).toHaveBeenCalledWith(RUTA);
      expect(extractorService.extraer).toHaveBeenCalledWith({
        buffer: expect.any(Buffer),
        nombreArchivo: 'calculo.pdf',
        tipoArchivo: 'application/pdf',
      });

      const [documentoId, fragmentos, opciones] =
        fragmentoRepository.reemplazarFragmentos.mock.calls[0];

      expect(documentoId).toBe(DOCUMENTO_ID);
      expect(fragmentos).toHaveLength(1);
      expect(fragmentos[0]).toEqual(
        expect.objectContaining({
          numero_fragmento: 1,
          numero_pagina: 1,
          contenido: TEXTO_CORTO,
          embedding: crearVector(),
        }),
      );
      expect(fragmentos[0].hash_contenido).toMatch(/^[a-f0-9]{64}$/);
      expect(opciones).toEqual({ modeloEmbedding: 'text-embedding-3-small' });

      expect(documentoRepository.actualizarResultadoProcesamiento).toHaveBeenCalledWith(
        DOCUMENTO_ID,
        { estado: 'procesado', numeroPaginas: 1 },
      );
      expect(resultado).toEqual({
        documentoId: DOCUMENTO_ID,
        estado: 'procesado',
        fragmentos: 1,
        numeroPaginas: 1,
        truncado: false,
      });
    });

    it('omite un documento ya procesado cuando no se fuerza el reproceso', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(
        crearDocumento({ estado_procesamiento: 'procesado' }),
      );

      const resultado = await service.procesarDocumento({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
      });

      expect(resultado).toEqual({
        documentoId: DOCUMENTO_ID,
        omitido: true,
        motivo: 'ya_procesado',
      });
      expect(documentoRepository.marcarProcesando).not.toHaveBeenCalled();
      expect(almacenamientoRepository.obtenerObjeto).not.toHaveBeenCalled();
    });

    it('reprocesa un documento procesado cuando se fuerza', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(
        crearDocumento({ estado_procesamiento: 'procesado' }),
      );
      documentoRepository.marcarProcesando.mockResolvedValue(
        crearDocumento({ estado_procesamiento: 'procesando' }),
      );

      const resultado = await service.procesarDocumento({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
        forzar: true,
      });

      expect(documentoRepository.marcarProcesando).toHaveBeenCalledWith(DOCUMENTO_ID, {
        incluirProcesado: true,
        incluirEnProceso: false,
        actualizadoAntesDe: null,
      });
      expect(resultado.estado).toBe('procesado');
    });

    it('omite un documento que ya está en proceso', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(
        crearDocumento({
          estado_procesamiento: 'procesando',
          fecha_actualizacion: new Date().toISOString(),
        }),
      );

      const resultado = await service.procesarDocumento({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
      });

      expect(resultado).toEqual({
        documentoId: DOCUMENTO_ID,
        omitido: true,
        motivo: 'procesamiento_en_curso',
      });
      expect(documentoRepository.marcarProcesando).not.toHaveBeenCalled();
    });

    it('recupera un documento atascado aunque no sea un reintento de SQS', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(
        crearDocumento({
          estado_procesamiento: 'procesando',
          fecha_actualizacion: '2026-01-01T00:00:00.000Z',
        }),
      );
      documentoRepository.marcarProcesando.mockResolvedValue(crearDocumento());

      const resultado = await service.procesarDocumento({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
      });

      expect(documentoRepository.marcarProcesando).toHaveBeenCalledWith(
        DOCUMENTO_ID,
        expect.objectContaining({
          incluirEnProceso: true,
          actualizadoAntesDe: expect.any(String),
        }),
      );
      expect(resultado.estado).toBe('procesado');
    });

    it('recupera el documento en un reintento de SQS sin esperar a que se atasque', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(
        crearDocumento({
          estado_procesamiento: 'procesando',
          fecha_actualizacion: new Date().toISOString(),
        }),
      );
      documentoRepository.marcarProcesando.mockResolvedValue(crearDocumento());

      const resultado = await service.procesarDocumento({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
        esReintento: true,
      });

      expect(documentoRepository.marcarProcesando).toHaveBeenCalledWith(
        DOCUMENTO_ID,
        expect.objectContaining({
          incluirEnProceso: true,
          actualizadoAntesDe: expect.any(String),
        }),
      );
      expect(resultado.estado).toBe('procesado');
    });

    it('omite el procesamiento si otro worker se adelantó en el cambio de estado', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(crearDocumento());
      documentoRepository.marcarProcesando.mockResolvedValue(null);

      const resultado = await service.procesarDocumento({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
      });

      expect(resultado).toEqual({
        documentoId: DOCUMENTO_ID,
        omitido: true,
        motivo: 'estado_no_iniciable',
      });
      expect(almacenamientoRepository.obtenerObjeto).not.toHaveBeenCalled();
    });

    it('devuelve error permanente cuando el documento no existe', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(null);

      const resultado = await service.procesarDocumento({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
      });

      expect(resultado).toEqual(
        expect.objectContaining({ estado: 'error', permanente: true }),
      );
      expect(documentoRepository.marcarProcesando).not.toHaveBeenCalled();
    });

    it('rechaza un mensaje de otro usuario con error permanente', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(crearDocumento());

      const resultado = await service.procesarDocumento({
        documentoId: DOCUMENTO_ID,
        usuarioId: OTRO_USUARIO_ID,
      });

      expect(resultado).toEqual(
        expect.objectContaining({ estado: 'error', permanente: true }),
      );
      expect(resultado.motivo).toContain('no pertenece al usuario');
      expect(almacenamientoRepository.obtenerObjeto).not.toHaveBeenCalled();
    });

    it('rechaza un documento cuya ruta no coincide con su propietario', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(
        crearDocumento({ ruta_almacenamiento: `usuarios/${OTRO_USUARIO_ID}/documentos/x.pdf` }),
      );

      const resultado = await service.procesarDocumento({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
      });

      expect(resultado.estado).toBe('error');
      expect(resultado.motivo).toContain('ruta del documento');
    });

    it('rechaza un evento de S3 cuya ruta no coincide con la registrada', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(crearDocumento());

      const resultado = await service.procesarDocumento({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
        rutaEsperada: 'usuarios/otro/documentos/x.pdf',
      });

      expect(resultado.estado).toBe('error');
      expect(resultado.motivo).toContain('ruta del evento');
    });

    it('marca error permanente sin relanzar cuando la extracción falla de forma definitiva', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(crearDocumento());
      documentoRepository.marcarProcesando.mockResolvedValue(crearDocumento());
      extractorService.extraer.mockRejectedValue(
        ErrorProcesamiento.permanente('El formato DOC no se puede procesar.'),
      );

      const resultado = await service.procesarDocumento({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
      });

      expect(documentoRepository.actualizarResultadoProcesamiento).toHaveBeenCalledWith(
        DOCUMENTO_ID,
        {
          estado: 'error',
          motivoError: 'El formato DOC no se puede procesar.',
        },
      );
      expect(resultado).toEqual(
        expect.objectContaining({
          estado: 'error',
          permanente: true,
          motivo: 'El formato DOC no se puede procesar.',
        }),
      );
      expect(fragmentoRepository.reemplazarFragmentos).not.toHaveBeenCalled();
    });

    it('devuelve el documento a en_cola y relanza cuando el fallo es temporal', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(crearDocumento());
      documentoRepository.marcarProcesando.mockResolvedValue(crearDocumento());
      embeddingsService.generarEmbeddings.mockRejectedValue(
        ErrorProcesamiento.temporal('El proveedor de IA alcanzo su limite de uso.'),
      );

      await expect(
        service.procesarDocumento({ documentoId: DOCUMENTO_ID, usuarioId: USUARIO_ID }),
      ).rejects.toMatchObject({ permanente: false });

      expect(documentoRepository.marcarReintento).toHaveBeenCalledWith(DOCUMENTO_ID);
      expect(documentoRepository.actualizarResultadoProcesamiento).not.toHaveBeenCalled();
      expect(fragmentoRepository.reemplazarFragmentos).not.toHaveBeenCalled();
    });

    it('relanza el fallo temporal aunque no se pueda devolver el documento a la cola', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(crearDocumento());
      documentoRepository.marcarProcesando.mockResolvedValue(crearDocumento());
      documentoRepository.marcarReintento.mockRejectedValue(new Error('base caida'));
      embeddingsService.generarEmbeddings.mockRejectedValue(
        ErrorProcesamiento.temporal('Cuota del proveedor agotada.'),
      );

      await expect(
        service.procesarDocumento({ documentoId: DOCUMENTO_ID, usuarioId: USUARIO_ID }),
      ).rejects.toMatchObject({ permanente: false });

      expect(logger.error).toHaveBeenCalledWith(
        'No se pudo devolver el documento a la cola.',
        expect.objectContaining({ documentoId: DOCUMENTO_ID }),
      );
    });

    it('traduce un 429 del proveedor como error temporal', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(crearDocumento());
      documentoRepository.marcarProcesando.mockResolvedValue(crearDocumento());
      embeddingsService.generarEmbeddings.mockRejectedValue({ status: 429, message: 'rate' });

      await expect(
        service.procesarDocumento({ documentoId: DOCUMENTO_ID, usuarioId: USUARIO_ID }),
      ).rejects.toMatchObject({ permanente: false });

      expect(documentoRepository.marcarReintento).toHaveBeenCalledWith(DOCUMENTO_ID);
      expect(documentoRepository.actualizarResultadoProcesamiento).not.toHaveBeenCalled();
    });

    it('falla de forma controlada si el worker no tiene proveedor de IA', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(crearDocumento());
      documentoRepository.marcarProcesando.mockResolvedValue(crearDocumento());
      embeddingsService.estaDisponible.mockReturnValue(false);

      const resultado = await service.procesarDocumento({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
      });

      expect(resultado.estado).toBe('error');
      expect(resultado.motivo).toContain('AI_API_KEY');
      expect(almacenamientoRepository.obtenerObjeto).not.toHaveBeenCalled();
    });

    it('falla si la configuración de dimensiones no coincide con la base de datos', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(crearDocumento());
      documentoRepository.marcarProcesando.mockResolvedValue(crearDocumento());
      embeddingsService.dimensiones = 3072;

      const resultado = await service.procesarDocumento({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
      });

      expect(resultado.estado).toBe('error');
      expect(resultado.motivo).toContain('3072');
      expect(resultado.motivo).toContain('1536');
      expect(almacenamientoRepository.obtenerObjeto).not.toHaveBeenCalled();
    });

    it('falla de forma temporal si el almacenamiento no está configurado', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(crearDocumento());
      documentoRepository.marcarProcesando.mockResolvedValue(crearDocumento());
      almacenamientoRepository.estaDisponible.mockReturnValue(false);

      await expect(
        service.procesarDocumento({ documentoId: DOCUMENTO_ID, usuarioId: USUARIO_ID }),
      ).rejects.toMatchObject({ permanente: false });

      expect(documentoRepository.marcarReintento).toHaveBeenCalledWith(DOCUMENTO_ID);
    });

    it('falla de forma permanente si el objeto ya no existe en S3', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(crearDocumento());
      documentoRepository.marcarProcesando.mockResolvedValue(crearDocumento());
      almacenamientoRepository.obtenerObjeto.mockResolvedValue(null);

      const resultado = await service.procesarDocumento({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
      });

      expect(resultado.estado).toBe('error');
      expect(resultado.motivo).toContain('ya no esta disponible');
    });

    it('falla de forma permanente si el documento no contiene texto extraíble', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(crearDocumento());
      documentoRepository.marcarProcesando.mockResolvedValue(crearDocumento());
      extractorService.extraer.mockResolvedValue({ paginas: [], numeroPaginas: null });

      const resultado = await service.procesarDocumento({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
      });

      expect(resultado.estado).toBe('error');
      expect(resultado.motivo).toContain('no contiene texto extraible');
      expect(embeddingsService.generarEmbeddings).not.toHaveBeenCalled();
    });

    it('informa cuando el documento supera el máximo de fragmentos', async () => {
      documentoRepository.obtenerPorIdSinUsuario.mockResolvedValue(crearDocumento());
      documentoRepository.marcarProcesando.mockResolvedValue(crearDocumento());

      const paginas = Array.from({ length: 1600 }, (_, indice) => ({
        numero: indice + 1,
        texto: `Texto suficientemente largo de la página ${indice + 1}. `.repeat(30),
      }));

      extractorService.extraer.mockResolvedValue({ paginas, numeroPaginas: paginas.length });
      embeddingsService.generarEmbeddings.mockImplementation((textos) =>
        Promise.resolve(textos.map(() => crearVector())),
      );

      const resultado = await service.procesarDocumento({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
      });

      expect(resultado.fragmentos).toBe(1500);
      expect(resultado.truncado).toBe(true);
    });
  });

  describe('procesarPorRuta', () => {
    it('omite las claves que no viven bajo usuarios/', async () => {
      const resultado = await service.procesarPorRuta('tmp/archivo.pdf');

      expect(resultado).toEqual({ omitido: true, motivo: 'ruta_fuera_de_usuarios' });
      expect(documentoRepository.obtenerPorRutaSinUsuario).not.toHaveBeenCalled();
    });

    it('rechaza de forma temporal los objetos que todavía no están registrados', async () => {
      documentoRepository.obtenerPorRutaSinUsuario.mockResolvedValue(null);

      await expect(service.procesarPorRuta(RUTA)).rejects.toMatchObject({
        permanente: false,
      });
    });

    it('procesa el documento registrado pasando la ruta esperada', async () => {
      const documento = crearDocumento();
      documentoRepository.obtenerPorRutaSinUsuario.mockResolvedValue(documento);
      service.procesarDocumento = j.fn().mockResolvedValue({ estado: 'procesado' });

      const resultado = await service.procesarPorRuta(RUTA, { forzar: true, esReintento: true });

      expect(service.procesarDocumento).toHaveBeenCalledWith({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
        rutaEsperada: RUTA,
        forzar: true,
        esReintento: true,
      });
      expect(resultado).toEqual({ estado: 'procesado' });
    });
  });
});
