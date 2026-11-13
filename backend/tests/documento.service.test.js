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
  let service;

  beforeEach(() => {
    documentoRepository = {
      crearDocumento: j.fn(),
      obtenerPorRuta: j.fn(),
      listarDocumentos: j.fn(),
    };

    materiaRepository = {
      existeMateria: j.fn().mockResolvedValue(true),
    };

    almacenamientoRepository = {
      crearUrlCarga: j.fn().mockResolvedValue('https://s3.example.com/firmada'),
      obtenerMetadatos: j.fn().mockResolvedValue({
        tamano: 1024,
        tipoArchivo: 'application/pdf',
      }),
      estaDisponible: j.fn().mockReturnValue(true),
    };

    service = new DocumentoService({
      documentoRepository,
      materiaRepository,
      almacenamientoRepository,
      usuarioActualId: USUARIO_ID,
    });
  });

  describe('solicitarUrlCarga', () => {
    it('devuelve la URL firmada y una clave bajo la carpeta del usuario', async () => {
      const resultado = await service.solicitarUrlCarga(DATOS_URL_CARGA);

      expect(materiaRepository.existeMateria).toHaveBeenCalledWith(USUARIO_ID, MATERIA_ID);
      expect(resultado.uploadUrl).toBe('https://s3.example.com/firmada');
      expect(resultado.objectKey).toMatch(
        new RegExp(`^usuarios/${USUARIO_ID}/documentos/[0-9a-f-]{36}/calculo\\.pdf$`),
      );
      expect(resultado.expiresInSeconds).toBe(900);
      expect(resultado.maxSizeBytes).toBe(config.uploads.maxFileSizeBytes);
    });

    it('responde 404 cuando la materia no existe o es de otro usuario', async () => {
      materiaRepository.existeMateria.mockResolvedValue(false);

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
      materiaRepository.existeMateria.mockResolvedValue(false);

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
  });

  describe('normalizarNombre', () => {
    it('quita rutas y caracteres no seguros del nombre', () => {
      expect(service.normalizarNombre('../../etc/passwd')).toBe('passwd');
      expect(service.normalizarNombre('C:\\Users\\a\\mi archivo.pdf')).toBe('mi_archivo.pdf');
    });
  });
});
