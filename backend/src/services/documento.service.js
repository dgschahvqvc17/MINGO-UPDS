/**
 * Servicio de carga de documentos academicos (HU07).
 * Aplica las reglas de negocio y la autorizacion de dominio.
 * No conoce req ni res: recibe datos ya validados por la capa HTTP.
 */
const { randomUUID } = require('crypto');
const ApiError = require('../utils/ApiError');
const config = require('../config/environment');
const {
  documentoUrlCargaSchema,
  documentoRegistroSchema,
  documentoFiltrosSchema,
} = require('../models/documento.model');

const SEGUNDOS_EXPIRACION_URL = 900;
const CARACTERES_NO_SEGUROS = /[^A-Za-z0-9._-]/g;
const LARGO_MAXIMO_NOMBRE_SEGURO = 120;

/**
 * Valida con Zod y traduce un fallo al error estandar de la API.
 * La ruta ya valida; esto protege al servicio si se invoca por otra via
 * y evita que un ZodError crudo llegue al cliente como 500.
 *
 * @param {import('zod').ZodTypeAny} schema
 * @param {unknown} datos
 * @returns {object}
 */
function validarEntrada(schema, datos) {
  const resultado = schema.safeParse(datos);

  if (!resultado.success) {
    throw ApiError.badRequest('Datos de entrada invalidos.', {
      source: 'body',
      issues: resultado.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  return resultado.data;
}

class DocumentoService {
  /**
   * @param {{
   *   documentoRepository: import('../repositories/documento.repository'),
   *   materiaRepository: import('../repositories/materia.repository'),
   *   almacenamientoRepository: import('../repositories/almacenamiento.repository'),
   *   usuarioActualId: string
   * }} dependencies
   */
  constructor({ documentoRepository, materiaRepository, almacenamientoRepository, usuarioActualId }) {
    this.documentoRepository = documentoRepository;
    this.materiaRepository = materiaRepository;
    this.almacenamientoRepository = almacenamientoRepository;
    this.usuarioActualId = usuarioActualId;
  }

  /**
   * Firma la URL de subida directa a S3 para el usuario actual.
   *
   * @param {object} datos Datos validados por el middleware.
   * @returns {Promise<{ uploadUrl: string, objectKey: string, expiresInSeconds: number, maxSizeBytes: number }>}
   */
  async solicitarUrlCarga(datos) {
    const datosValidados = validarEntrada(documentoUrlCargaSchema, datos);

    await this.verificarMateria(datosValidados.materia_id);
    this.verificarAlmacenamiento();

    const objectKey = this.construirRuta(datosValidados.nombre_archivo);
    const uploadUrl = await this.almacenamientoRepository.crearUrlCarga({
      ruta: objectKey,
      tipoArchivo: datosValidados.tipo_archivo,
      expiresInSeconds: SEGUNDOS_EXPIRACION_URL,
    });

    return {
      uploadUrl,
      objectKey,
      expiresInSeconds: SEGUNDOS_EXPIRACION_URL,
      maxSizeBytes: config.uploads.maxFileSizeBytes,
    };
  }

  /**
   * Lista los documentos del usuario con paginacion.
   *
   * @param {object} filtros Filtros validados por el middleware.
   * @returns {Promise<{ documentos: object[], paginacion: { limit: number, offset: number, total: number } }>}
   */
  async listarDocumentos(filtros) {
    const datosValidados = validarEntrada(documentoFiltrosSchema, filtros);
    const { items, total } = await this.documentoRepository.listarDocumentos(
      this.usuarioActualId,
      datosValidados,
    );

    return {
      documentos: items,
      paginacion: {
        limit: datosValidados.limit,
        offset: datosValidados.offset,
        total,
      },
    };
  }

  /**
   * Registra los metadatos de un archivo ya subido a S3.
   * El tamano y el tipo se leen de S3, nunca se confia en el cliente.
   *
   * @param {object} datos Datos validados por el middleware.
   * @returns {Promise<object>} Documento registrado.
   */
  async registrarDocumento(datos) {
    const datosValidados = validarEntrada(documentoRegistroSchema, datos);

    await this.verificarMateria(datosValidados.materia_id);
    this.verificarPropiedadRuta(datosValidados.objectKey);
    this.verificarAlmacenamiento();

    const metadatos = await this.almacenamientoRepository.obtenerMetadatos(datosValidados.objectKey);

    if (!metadatos) {
      throw ApiError.badRequest(
        'El archivo no se ha subido. Subelo a la URL firmada antes de registrar el documento.',
      );
    }

    this.verificarTamanoReal(metadatos.tamano);

    try {
      return await this.documentoRepository.crearDocumento(this.usuarioActualId, {
        materia_id: datosValidados.materia_id,
        unidad_id: datosValidados.unidad_id,
        nombre: datosValidados.nombre,
        nombre_archivo: this.extraerNombreArchivo(datosValidados.objectKey),
        ruta_almacenamiento: datosValidados.objectKey,
        tipo_archivo: metadatos.tipoArchivo,
        tamano: metadatos.tamano,
      });
    } catch (error) {
      if (error.code === '23505') {
        throw ApiError.conflict('Este archivo ya fue registrado en la biblioteca.');
      }

      throw error;
    }
  }

  /**
   * Verifica que la materia exista y pertenezca al usuario.
   *
   * @param {string} materiaId UUID de la materia.
   * @returns {Promise<void>}
   */
  async verificarMateria(materiaId) {
    const existe = await this.materiaRepository.existeMateria(this.usuarioActualId, materiaId);

    if (!existe) {
      throw ApiError.notFound('Materia no encontrada.');
    }
  }

  /**
   * Rechaza claves que no viven bajo la carpeta del usuario actual.
   *
   * @param {string} objectKey Clave del objeto en S3.
   * @returns {void}
   */
  verificarPropiedadRuta(objectKey) {
    const prefijo = `usuarios/${this.usuarioActualId}/documentos/`;

    if (!objectKey.startsWith(prefijo)) {
      throw ApiError.forbidden('El archivo indicado no pertenece a tu cuenta.');
    }
  }

  /**
   * @param {number} tamano Tamano real del objeto en bytes.
   * @returns {void}
   */
  verificarTamanoReal(tamano) {
    if (tamano > config.uploads.maxFileSizeBytes) {
      const maximoMb = Math.round(config.uploads.maxFileSizeBytes / (1024 * 1024));
      throw ApiError.badRequest(`El archivo supera el limite de ${maximoMb} MB.`);
    }
  }

  verificarAlmacenamiento() {
    if (!this.almacenamientoRepository.estaDisponible()) {
      throw ApiError.serviceUnavailable('El almacenamiento de documentos no esta disponible.');
    }
  }

  /**
   * Construye la clave del objeto con el prefijo obligatorio del usuario.
   *
   * @param {string} nombreArchivo Nombre declarado por el cliente.
   * @returns {string} Clave del objeto en S3.
   */
  construirRuta(nombreArchivo) {
    return `usuarios/${this.usuarioActualId}/documentos/${randomUUID()}/${this.normalizarNombre(nombreArchivo)}`;
  }

  /**
   * Quita rutas y caracteres no seguros del nombre del archivo.
   *
   * @param {string} nombreArchivo Nombre declarado por el cliente.
   * @returns {string}
   */
  normalizarNombre(nombreArchivo) {
    const soloNombre = String(nombreArchivo).split(/[\\/]/).pop() ?? '';
    const seguro = soloNombre
      .replace(CARACTERES_NO_SEGUROS, '_')
      .replace(/^\.+/, '')
      .slice(-LARGO_MAXIMO_NOMBRE_SEGURO);

    return seguro || 'documento';
  }

  /**
   * @param {string} objectKey Clave del objeto en S3.
   * @returns {string}
   */
  extraerNombreArchivo(objectKey) {
    return String(objectKey).split('/').pop() ?? 'documento';
  }
}

module.exports = DocumentoService;
