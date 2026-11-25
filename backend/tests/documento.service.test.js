const { describe, it, expect, beforeEach, jest: j } = require('@jest/globals');
const DocumentoService = require('../src/services/documento.service');
const config = require('../src/config/environment');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const OTRO_USUARIO_ID = '11111111-2222-4333-8444-555555555555';
const MATERIA_ID = '6d1c2a53-4f7e-4b8a-9c1d-2e3f4a5b6c7d';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const OBJECT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const OBJECT_KEY = `usuarios/${USUARIO_ID}/documentos/${OBJECT_ID}/calculo.pdf`;

const DATOS_URL_CARGA = {
  nombre_archivo: 'calculo.pdf',
  tipo_archivo: 'application/pdf',
  tamano: 1024,
  materia_id: MATERIA_ID,
};

const DATOS_REGISTRO = {
  objectKey: OBJECT_KEY,
  nombre: 'Cálculo diferencial - Unidad 1',
  materia_id: MATERIA_ID,
  unidad_id: null,
};

describe('DocumentoService', () => {
  let documentoRepository;
  let materiaRepository;
  let almacenamientoRepository;
  let colaRepository;
  let logger;
  let service;

  beforeEach(() => {
    documentoRepository = {
      crearDocumento: j.fn(),
      obtenerPorRuta: j.fn(),
      listarDocumentos: j.fn(),
      obtenerDocumentoPorId: j.fn(),
      eliminarDocumento: j.fn(),
      marcarEnCola: j.fn(),
    };

    materiaRepository = {
      obtenerMateriaPorId: j.fn().mockResolvedValue({ id: MATERIA_ID, docente_id: USUARIO_ID }),
    };

    almacenamientoRepository = {
      crearUrlCarga: j.fn().mockResolvedValue('https://s3.example.com/firmada'),
      crearUrlDescarga: j.fn().mockResolvedValue('https://s3.example.com/descarga'),
      eliminarObjeto: j.fn().mockResolvedValue(true),
      obtenerMetadatos: j.fn().mockResolvedValue({
        tamano: 1024,
        tipoArchivo: 'application/pdf',
      }),
      estaDisponible: j.fn().mockReturnValue(true),
    };

    colaRepository = {
      estaDisponible: j.fn().mockReturnValue(false),
      encolarProcesamiento: j.fn().mockResolvedValue({ messageId: 'mensaje-1' }),
    };

    logger = { warn: j.fn(), error: j.fn() };

    service = new DocumentoService({
      documentoRepository,
      materiaRepository,
      almacenamientoRepository,
      colaRepository,
      usuarioActualId: USUARIO_ID,
      logger,
    });
  });

  describe('solicitarUrlCarga', () => {
    it('devuelve la URL firmada y una clave bajo la carpeta del usuario', async () => {
      const resultado = await service.solicitarUrlCarga(DATOS_URL_CARGA);

      expect(materiaRepository.obtenerMateriaPorId).toHaveBeenCalledWith(USUARIO_ID, MATERIA_ID);
      expect(resultado.uploadUrl).toBe('https://s3.example.com/firmada');
      expect(resultado.objectKey).toMatch(
        new RegExp(`^usuarios/${USUARIO_ID}/documentos/[0-9a-f-]{36}/calculo\\.pdf$`),
      );
      expect(resultado.expiresInSeconds).toBe(900);
      expect(resultado.maxSizeBytes).toBe(config.uploads.maxFileSizeBytes);
    });

    it('responde 404 cuando la materia no existe o es de otro usuario', async () => {
      materiaRepository.obtenerMateriaPorId.mockResolvedValue(null);

      await expect(service.solicitarUrlCarga(DATOS_URL_CARGA)).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(almacenamientoRepository.crearUrlCarga).not.toHaveBeenCalled();
    });

    it('responde 503 cuando S3 no está configurado', async () => {
      almacenamientoRepository.estaDisponible.mockReturnValue(false);

      await expect(service.solicitarUrlCarga(DATOS_URL_CARGA)).rejects.toMatchObject({
        statusCode: 503,
      });
    });

    it('rechaza un archivo que supera el límite de 20 MB', async () => {
      const demasiadoGrande = {
        ...DATOS_URL_CARGA,
        tamano: config.uploads.maxFileSizeBytes + 1,
      };

      await expect(service.solicitarUrlCarga(demasiadoGrande)).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe('registrarDocumento', () => {
    it('registra el documento con el tamaño y el tipo reales de S3', async () => {
      documentoRepository.crearDocumento.mockResolvedValue({
        id: DOCUMENTO_ID,
        ruta_almacenamiento: OBJECT_KEY,
      });

      const resultado = await service.registrarDocumento(DATOS_REGISTRO);

      expect(almacenamientoRepository.obtenerMetadatos).toHaveBeenCalledWith(OBJECT_KEY);
      expect(documentoRepository.crearDocumento).toHaveBeenCalledWith(
        USUARIO_ID,
        expect.objectContaining({
          ruta_almacenamiento: OBJECT_KEY,
          nombre_archivo: 'calculo.pdf',
          tamano: 1024,
          tipo_archivo: 'application/pdf',
        }),
      );
      expect(resultado.id).toBe(DOCUMENTO_ID);
    });

    it('responde 403 cuando la clave pertenece a otro usuario', async () => {
      const claveAjena = `usuarios/${OTRO_USUARIO_ID}/documentos/${OBJECT_ID}/calculo.pdf`;

      await expect(
        service.registrarDocumento({ ...DATOS_REGISTRO, objectKey: claveAjena }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(almacenamientoRepository.obtenerMetadatos).not.toHaveBeenCalled();
    });

    it('responde 400 cuando el objeto no existe en S3', async () => {
      almacenamientoRepository.obtenerMetadatos.mockResolvedValue(null);

      await expect(service.registrarDocumento(DATOS_REGISTRO)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(documentoRepository.crearDocumento).not.toHaveBeenCalled();
    });

    it('responde 400 cuando el objeto real supera el límite', async () => {
      almacenamientoRepository.obtenerMetadatos.mockResolvedValue({
        tamano: config.uploads.maxFileSizeBytes + 1,
        tipoArchivo: 'application/pdf',
      });

      await expect(service.registrarDocumento(DATOS_REGISTRO)).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(documentoRepository.crearDocumento).not.toHaveBeenCalled();
    });

    it('responde 409 cuando el archivo ya fue registrado', async () => {
      documentoRepository.crearDocumento.mockRejectedValue({ code: '23505' });

      await expect(service.registrarDocumento(DATOS_REGISTRO)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('responde 404 cuando la materia no pertenece al usuario', async () => {
      materiaRepository.obtenerMateriaPorId.mockResolvedValue(null);

      await expect(service.registrarDocumento(DATOS_REGISTRO)).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(almacenamientoRepository.obtenerMetadatos).not.toHaveBeenCalled();
    });
  });

  describe('listarDocumentos', () => {
    it('devuelve los documentos y la paginación calculada', async () => {
      documentoRepository.listarDocumentos.mockResolvedValue({
        items: [{ id: DOCUMENTO_ID, nombre: 'Cálculo' }],
        total: 1,
      });

      const resultado = await service.listarDocumentos({ limit: 10, offset: 0 });

      expect(documentoRepository.listarDocumentos).toHaveBeenCalledWith(USUARIO_ID, {
        limit: 10,
        offset: 0,
      });
      expect(resultado.documentos).toHaveLength(1);
      expect(resultado.paginacion).toEqual({ limit: 10, offset: 0, total: 1 });
    });

    it('filtra por materia cuando se indica', async () => {
      documentoRepository.listarDocumentos.mockResolvedValue({ items: [], total: 0 });

      await service.listarDocumentos({ materia_id: MATERIA_ID, limit: 20, offset: 0 });

      expect(documentoRepository.listarDocumentos).toHaveBeenCalledWith(USUARIO_ID, {
        materia_id: MATERIA_ID,
        limit: 20,
        offset: 0,
      });
    });

    it('traslada la busqueda por nombre y el filtro por estado', async () => {
      documentoRepository.listarDocumentos.mockResolvedValue({ items: [], total: 0 });

      await service.listarDocumentos({ q: 'calculo', estado: 'procesado', limit: 20, offset: 0 });

      expect(documentoRepository.listarDocumentos).toHaveBeenCalledWith(USUARIO_ID, {
        q: 'calculo',
        estado: 'procesado',
        limit: 20,
        offset: 0,
      });
    });

    it('rechaza un estado de procesamiento desconocido', async () => {
      await expect(service.listarDocumentos({ estado: 'inventado' })).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(documentoRepository.listarDocumentos).not.toHaveBeenCalled();
    });
  });

  describe('obtenerDocumento', () => {
    it('devuelve el documento cuando pertenece al usuario', async () => {
      documentoRepository.obtenerDocumentoPorId.mockResolvedValue({
        id: DOCUMENTO_ID,
        nombre: 'Cálculo diferencial',
      });

      const documento = await service.obtenerDocumento(DOCUMENTO_ID);

      expect(documentoRepository.obtenerDocumentoPorId).toHaveBeenCalledWith(
        USUARIO_ID,
        DOCUMENTO_ID,
      );
      expect(documento.id).toBe(DOCUMENTO_ID);
    });

    it('responde 404 cuando el documento no existe o es de otro usuario', async () => {
      documentoRepository.obtenerDocumentoPorId.mockResolvedValue(null);

      await expect(service.obtenerDocumento(DOCUMENTO_ID)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('responde 400 cuando el identificador no es un UUID', async () => {
      await expect(service.obtenerDocumento('no-es-uuid')).rejects.toMatchObject({
        statusCode: 400,
      });
      expect(documentoRepository.obtenerDocumentoPorId).not.toHaveBeenCalled();
    });
  });

  describe('obtenerUrlDescarga', () => {
    const documento = {
      id: DOCUMENTO_ID,
      ruta_almacenamiento: OBJECT_KEY,
      nombre_archivo: 'calculo.pdf',
      tipo_archivo: 'application/pdf',
    };

    beforeEach(() => {
      documentoRepository.obtenerDocumentoPorId.mockResolvedValue(documento);
    });

    it('firma la descarga con el nombre original del archivo', async () => {
      const resultado = await service.obtenerUrlDescarga(DOCUMENTO_ID);

      expect(almacenamientoRepository.obtenerMetadatos).toHaveBeenCalledWith(OBJECT_KEY);
      expect(almacenamientoRepository.crearUrlDescarga).toHaveBeenCalledWith({
        ruta: OBJECT_KEY,
        nombreArchivo: 'calculo.pdf',
        expiresInSeconds: 900,
      });
      expect(resultado).toEqual({
        downloadUrl: 'https://s3.example.com/descarga',
        nombreArchivo: 'calculo.pdf',
        tipoArchivo: 'application/pdf',
        expiresInSeconds: 900,
      });
    });

    it('responde 404 cuando el objeto ya no existe en S3', async () => {
      almacenamientoRepository.obtenerMetadatos.mockResolvedValue(null);

      await expect(service.obtenerUrlDescarga(DOCUMENTO_ID)).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(almacenamientoRepository.crearUrlDescarga).not.toHaveBeenCalled();
    });

    it('responde 503 cuando S3 no está configurado', async () => {
      almacenamientoRepository.estaDisponible.mockReturnValue(false);

      await expect(service.obtenerUrlDescarga(DOCUMENTO_ID)).rejects.toMatchObject({
        statusCode: 503,
      });
    });
  });

  describe('eliminarDocumento', () => {
    const documento = {
      id: DOCUMENTO_ID,
      ruta_almacenamiento: OBJECT_KEY,
      nombre_archivo: 'calculo.pdf',
      tipo_archivo: 'application/pdf',
    };

    beforeEach(() => {
      documentoRepository.obtenerDocumentoPorId.mockResolvedValue(documento);
      documentoRepository.eliminarDocumento.mockResolvedValue({ id: DOCUMENTO_ID });
    });

    it('elimina primero el objeto de S3 y luego los metadatos', async () => {
      const resultado = await service.eliminarDocumento(DOCUMENTO_ID);

      expect(almacenamientoRepository.eliminarObjeto).toHaveBeenCalledWith(OBJECT_KEY);
      expect(documentoRepository.eliminarDocumento).toHaveBeenCalledWith(USUARIO_ID, DOCUMENTO_ID);
      expect(resultado).toEqual({ id: DOCUMENTO_ID });
    });

    it('sigue adelante cuando el objeto ya no existía en S3', async () => {
      almacenamientoRepository.eliminarObjeto.mockResolvedValue(false);

      await expect(service.eliminarDocumento(DOCUMENTO_ID)).resolves.toEqual({ id: DOCUMENTO_ID });
      expect(documentoRepository.eliminarDocumento).toHaveBeenCalled();
    });

    it('responde 404 cuando el documento es de otro usuario', async () => {
      documentoRepository.obtenerDocumentoPorId.mockResolvedValue(null);

      await expect(service.eliminarDocumento(DOCUMENTO_ID)).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(almacenamientoRepository.eliminarObjeto).not.toHaveBeenCalled();
      expect(documentoRepository.eliminarDocumento).not.toHaveBeenCalled();
    });

    it('responde 404 si la fila desapareció entre la lectura y el borrado', async () => {
      documentoRepository.eliminarDocumento.mockResolvedValue(null);

      await expect(service.eliminarDocumento(DOCUMENTO_ID)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('responde 503 cuando S3 no está configurado', async () => {
      almacenamientoRepository.estaDisponible.mockReturnValue(false);

      await expect(service.eliminarDocumento(DOCUMENTO_ID)).rejects.toMatchObject({
        statusCode: 503,
      });
      expect(documentoRepository.eliminarDocumento).not.toHaveBeenCalled();
    });
  });

  describe('procesarDocumento', () => {
    const documentoPendiente = {
      id: DOCUMENTO_ID,
      estado_procesamiento: 'pendiente',
      motivo_error: null,
      numero_paginas: null,
      fecha_actualizacion: new Date().toISOString(),
    };

    it('encola el documento y lo marca en cola', async () => {
      documentoRepository.obtenerDocumentoPorId.mockResolvedValue(documentoPendiente);
      documentoRepository.marcarEnCola.mockResolvedValue({
        ...documentoPendiente,
        estado_procesamiento: 'en_cola',
      });
      colaRepository.estaDisponible.mockReturnValue(true);

      const resultado = await service.procesarDocumento(DOCUMENTO_ID);

      expect(colaRepository.encolarProcesamiento).toHaveBeenCalledWith({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
        forzar: true,
      });
      expect(documentoRepository.marcarEnCola).toHaveBeenCalledWith(USUARIO_ID, DOCUMENTO_ID, {
        reencolarEstancado: false,
        actualizadoAntesDe: null,
      });
      expect(resultado).toEqual({ id: DOCUMENTO_ID, estado: 'en_cola' });
    });

    it('responde 404 cuando el documento no es del usuario', async () => {
      documentoRepository.obtenerDocumentoPorId.mockResolvedValue(null);

      await expect(service.procesarDocumento(DOCUMENTO_ID)).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(colaRepository.encolarProcesamiento).not.toHaveBeenCalled();
    });

    it('responde 409 cuando el documento ya está en cola o procesándose', async () => {
      documentoRepository.obtenerDocumentoPorId.mockResolvedValue({
        ...documentoPendiente,
        estado_procesamiento: 'procesando',
      });

      await expect(service.procesarDocumento(DOCUMENTO_ID)).rejects.toMatchObject({
        statusCode: 409,
      });
      expect(colaRepository.encolarProcesamiento).not.toHaveBeenCalled();
    });

    it('reencola un documento atascado sin esperar a que termine', async () => {
      documentoRepository.obtenerDocumentoPorId.mockResolvedValue({
        ...documentoPendiente,
        estado_procesamiento: 'procesando',
        fecha_actualizacion: '2026-01-01T00:00:00.000Z',
      });
      documentoRepository.marcarEnCola.mockResolvedValue({
        ...documentoPendiente,
        estado_procesamiento: 'en_cola',
      });
      colaRepository.estaDisponible.mockReturnValue(true);

      const resultado = await service.procesarDocumento(DOCUMENTO_ID);

      expect(colaRepository.encolarProcesamiento).toHaveBeenCalled();
      expect(documentoRepository.marcarEnCola).toHaveBeenCalledWith(
        USUARIO_ID,
        DOCUMENTO_ID,
        expect.objectContaining({
          reencolarEstancado: true,
          actualizadoAntesDe: expect.any(String),
        }),
      );
      expect(resultado).toEqual({ id: DOCUMENTO_ID, estado: 'en_cola' });
    });

    it('responde 409 si otro proceso retoma el documento antes de reencolarlo', async () => {
      documentoRepository.obtenerDocumentoPorId.mockResolvedValue({
        ...documentoPendiente,
        estado_procesamiento: 'en_cola',
        fecha_actualizacion: '2026-01-01T00:00:00.000Z',
      });
      documentoRepository.marcarEnCola.mockResolvedValue(null);
      colaRepository.estaDisponible.mockReturnValue(true);

      await expect(service.procesarDocumento(DOCUMENTO_ID)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it('responde 503 cuando SQS no está configurado', async () => {
      documentoRepository.obtenerDocumentoPorId.mockResolvedValue(documentoPendiente);

      await expect(service.procesarDocumento(DOCUMENTO_ID)).rejects.toMatchObject({
        statusCode: 503,
      });
      expect(documentoRepository.marcarEnCola).not.toHaveBeenCalled();
    });

    it('responde 400 cuando el identificador no es un UUID', async () => {
      await expect(service.procesarDocumento('no-es-uuid')).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  describe('obtenerEstadoProcesamiento', () => {
    it('devuelve solo los campos de estado del documento propio', async () => {
      documentoRepository.obtenerDocumentoPorId.mockResolvedValue({
        id: DOCUMENTO_ID,
        nombre: 'Cálculo',
        estado_procesamiento: 'procesado',
        motivo_error: null,
        numero_paginas: 12,
        fecha_actualizacion: '2026-11-13T10:00:00.000Z',
      });

      const estado = await service.obtenerEstadoProcesamiento(DOCUMENTO_ID);

      expect(estado).toEqual({
        id: DOCUMENTO_ID,
        estado_procesamiento: 'procesado',
        motivo_error: null,
        numero_paginas: 12,
        fecha_actualizacion: '2026-11-13T10:00:00.000Z',
      });
      expect(estado.nombre).toBeUndefined();
    });

    it('responde 404 cuando el documento es de otro usuario', async () => {
      documentoRepository.obtenerDocumentoPorId.mockResolvedValue(null);

      await expect(service.obtenerEstadoProcesamiento(DOCUMENTO_ID)).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('encolado tras el registro', () => {
    beforeEach(() => {
      documentoRepository.crearDocumento.mockResolvedValue({
        id: DOCUMENTO_ID,
        ruta_almacenamiento: OBJECT_KEY,
      });
      documentoRepository.marcarEnCola.mockResolvedValue({ id: DOCUMENTO_ID });
    });

    it('marca el documento en cola cuando SQS está disponible', async () => {
      colaRepository.estaDisponible.mockReturnValue(true);

      await service.registrarDocumento(DATOS_REGISTRO);

      expect(colaRepository.encolarProcesamiento).toHaveBeenCalledWith({
        documentoId: DOCUMENTO_ID,
        usuarioId: USUARIO_ID,
        forzar: false,
      });
      expect(documentoRepository.marcarEnCola).toHaveBeenCalledWith(USUARIO_ID, DOCUMENTO_ID);
    });

    it('no falla el registro cuando la cola no responde', async () => {
      colaRepository.estaDisponible.mockReturnValue(true);
      colaRepository.encolarProcesamiento.mockRejectedValue(new Error('SQS caido'));

      const resultado = await service.registrarDocumento(DATOS_REGISTRO);

      expect(resultado.id).toBe(DOCUMENTO_ID);
      expect(documentoRepository.marcarEnCola).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'No se pudo encolar el documento recien registrado.',
        expect.objectContaining({ documentoId: DOCUMENTO_ID }),
      );
    });

    it('no intenta encolar cuando la cola no está configurada', async () => {
      await service.registrarDocumento(DATOS_REGISTRO);

      expect(colaRepository.encolarProcesamiento).not.toHaveBeenCalled();
      expect(documentoRepository.marcarEnCola).not.toHaveBeenCalled();
    });
  });

  describe('normalizarNombre', () => {
    it('quita rutas y caracteres no seguros del nombre', () => {
      expect(service.normalizarNombre('../../etc/passwd')).toBe('passwd');
      expect(service.normalizarNombre('C:\\Users\\a\\mi archivo.pdf')).toBe('mi_archivo.pdf');
    });
  });
});
