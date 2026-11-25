/**
 * Servicio de documentos academicos (HU07 y HU08).
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
  documentoIdSchema,
} = require('../models/documento.model');
const { calcularCorte, estaEnProceso, estaEstancado } = require('../utils/procesamiento-estado');

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
   *   colaRepository?: import('../repositories/cola.repository') | null,
   *   usuarioActualId: string,
   *   logger?: Pick<Console, 'warn'>
   * }} dependencies
   */
  constructor({
    documentoRepository,
    materiaRepository,
    almacenamientoRepository,
    colaRepository = null,
    usuarioActualId,
    logger = console,
  }) {
    this.documentoRepository = documentoRepository;
    this.materiaRepository = materiaRepository;
    this.almacenamientoRepository = almacenamientoRepository;
    this.colaRepository = colaRepository;
    this.usuarioActualId = usuarioActualId;
    this.logger = logger;
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
      const documento = await this.documentoRepository.crearDocumento(this.usuarioActualId, {
        materia_id: datosValidados.materia_id,
        unidad_id: datosValidados.unidad_id,
        nombre: datosValidados.nombre,
        nombre_archivo: this.extraerNombreArchivo(datosValidados.objectKey),
        ruta_almacenamiento: datosValidados.objectKey,
        tipo_archivo: metadatos.tipoArchivo,
        tamano: metadatos.tamano,
      });

      // El evento de S3 puede haber llegado antes del registro de metadatos.
      // Se encola de nuevo sin bloquear el registro si la cola no responde.
      await this.encolarTrasRegistro(documento);
      return documento;
    } catch (error) {
      if (error.code === '23505') {
        throw ApiError.conflict('Este archivo ya fue registrado en la biblioteca.');
      }

      throw error;
    }
  }

  /**
   * Obtiene un documento del usuario por su identificador.
   * Un documento ajeno responde 404 para no revelar su existencia.
   *
   * @param {string} documentoId UUID del documento.
   * @returns {Promise<object>} Documento encontrado.
   */
  async obtenerDocumento(documentoId) {
    const id = validarEntrada(documentoIdSchema, documentoId);
    const documento = await this.documentoRepository.obtenerDocumentoPorId(
      this.usuarioActualId,
      id,
    );

    if (!documento) {
      throw ApiError.notFound('Documento no encontrado.');
    }

    return documento;
  }

  /**
   * Encola el procesamiento de un documento propio.
   * La API responde 202: el trabajo real lo hace la Lambda procesadora.
   *
   * Un documento en `en_cola` o `procesando` responde 409 para evitar un doble
   * trabajo, salvo que haya quedado atascado (sin actualizaciones durante la
   * ventana permitida); en ese caso se reencola.
   *
   * @param {string} documentoId UUID del documento.
   * @returns {Promise<{ id: string, estado: string }>}
   */
  async procesarDocumento(documentoId) {
    const id = validarEntrada(documentoIdSchema, documentoId);
    const documento = await this.documentoRepository.obtenerDocumentoPorId(
      this.usuarioActualId,
      id,
    );

    if (!documento) {
      throw ApiError.notFound('Documento no encontrado.');
    }

    const debeReencolar = estaEstancado(documento);

    if (estaEnProceso(documento.estado_procesamiento) && !debeReencolar) {
      throw ApiError.conflict('El documento ya esta en proceso. Espera a que termine.');
    }

    if (!this.colaRepository?.estaDisponible()) {
      throw ApiError.serviceUnavailable(
        'El servicio de procesamiento no esta disponible en este momento.',
      );
    }

    await this.colaRepository.encolarProcesamiento({
      documentoId: documento.id,
      usuarioId: this.usuarioActualId,
      forzar: true,
    });

    const actualizado = await this.documentoRepository.marcarEnCola(
      this.usuarioActualId,
      documento.id,
      {
        reencolarEstancado: debeReencolar,
        actualizadoAntesDe: debeReencolar ? calcularCorte() : null,
      },
    );

    if (!actualizado) {
      // Otro proceso cambio el estado entre la lectura y la actualizacion.
      throw ApiError.conflict('El documento ya esta en proceso. Espera a que termine.');
    }

    return { id: documento.id, estado: 'en_cola' };
  }

  /**
   * Devuelve el estado de procesamiento de un documento propio.
   * Es el endpoint que consulta el frontend para refrescar la tarjeta.
   *
   * @param {string} documentoId UUID del documento.
   * @returns {Promise<object>}
   */
  async obtenerEstadoProcesamiento(documentoId) {
    const documento = await this.obtenerDocumento(documentoId);

    return {
      id: documento.id,
      estado_procesamiento: documento.estado_procesamiento,
      motivo_error: documento.motivo_error,
      numero_paginas: documento.numero_paginas,
      fecha_actualizacion: documento.fecha_actualizacion,
    };
  }

  /**
   * Encola sin propagar el fallo: el registro del documento no depende de SQS.
   * El usuario conserva el boton de reproceso manual si la cola falla.
   *
   * @param {object} documento Documento recien registrado.
   * @returns {Promise<void>}
   */
  async encolarTrasRegistro(documento) {
    if (!this.colaRepository?.estaDisponible()) {
      return;
    }

    try {
      await this.colaRepository.encolarProcesamiento({
        documentoId: documento.id,
        usuarioId: this.usuarioActualId,
        forzar: false,
      });
      await this.documentoRepository.marcarEnCola(this.usuarioActualId, documento.id);
    } catch (error) {
      this.logger.warn('No se pudo encolar el documento recien registrado.', {
        documentoId: documento.id,
        message: error?.message,
      });
    }
  }

  /**
   * Firma una URL de descarga directa desde S3 para un documento propio.
   * Verifica primero que el objeto siga existiendo para no entregar una URL rota.
   *
   * @param {string} documentoId UUID del documento.
   * @returns {Promise<{ downloadUrl: string, nombreArchivo: string, tipoArchivo: string, expiresInSeconds: number }>}
   */
  async obtenerUrlDescarga(documentoId) {
    const documento = await this.obtenerDocumento(documentoId);
    this.verificarAlmacenamiento();

    const metadatos = await this.almacenamientoRepository.obtenerMetadatos(
      documento.ruta_almacenamiento,
    );

    if (!metadatos) {
      throw ApiError.notFound('El archivo de este documento ya no esta disponible.');
    }

    const downloadUrl = await this.almacenamientoRepository.crearUrlDescarga({
      ruta: documento.ruta_almacenamiento,
      nombreArchivo: documento.nombre_archivo,
      expiresInSeconds: SEGUNDOS_EXPIRACION_URL,
    });

    return {
      downloadUrl,
      nombreArchivo: documento.nombre_archivo,
      tipoArchivo: documento.tipo_archivo,
      expiresInSeconds: SEGUNDOS_EXPIRACION_URL,
    };
  }

  /**
   * Elimina un documento propio: primero el objeto de S3 y luego los metadatos.
   * Si el objeto ya no existe en S3, la eliminacion continua sin fallar.
   *
   * @param {string} documentoId UUID del documento.
   * @returns {Promise<{ id: string }>}
   */
  async eliminarDocumento(documentoId) {
    const documento = await this.obtenerDocumento(documentoId);
    this.verificarAlmacenamiento();

    await this.almacenamientoRepository.eliminarObjeto(documento.ruta_almacenamiento);

    const eliminado = await this.documentoRepository.eliminarDocumento(
      this.usuarioActualId,
      documento.id,
    );

    if (!eliminado) {
      throw ApiError.notFound('Documento no encontrado.');
    }

    return { id: documento.id };
  }

  /**
   * Verifica que la materia exista y pertenezca al usuario.
   *
   * @param {string} materiaId UUID de la materia.
   * @returns {Promise<void>}
   */
  async verificarMateria(materiaId) {
    const materia = await this.materiaRepository.obtenerMateriaPorId(
      this.usuarioActualId,
      materiaId,
    );

    if (!materia) {
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
