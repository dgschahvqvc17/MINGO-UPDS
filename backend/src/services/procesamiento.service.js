/**
 * Servicio de procesamiento de documentos academicos (HU09).
 * Lo ejecuta la Lambda procesadora con service_role: descarga el archivo,
 * extrae texto, lo fragmenta, genera embeddings y guarda el resultado.
 * No conoce HTTP ni SQS: recibe datos ya resueltos por el handler.
 */
const { ErrorProcesamiento } = require('./procesamiento/procesamiento.error');
const ExtractorContenidoService = require('./procesamiento/extractor-contenido.service');
const FragmentadorService = require('./procesamiento/fragmentador.service');
const { DIMENSION_VECTOR } = require('./ia/embeddings.service');

const ESTADOS_EN_PROCESO = new Set(['en_cola', 'procesando']);

class ProcesamientoService {
  /**
   * @param {{
   *   documentoRepository: import('../repositories/documento.repository'),
   *   fragmentoRepository: import('../repositories/fragmento.repository'),
   *   almacenamientoRepository: import('../repositories/almacenamiento.repository'),
   *   embeddingsService: import('./ia/embeddings.service'),
   *   extractorService?: import('./procesamiento/extractor-contenido.service'),
   *   fragmentadorService?: import('./procesamiento/fragmentador.service'),
   *   logger?: Pick<Console, 'error'>
   * }} dependencies
   */
  constructor({
    documentoRepository,
    fragmentoRepository,
    almacenamientoRepository,
    embeddingsService,
    extractorService = new ExtractorContenidoService(),
    fragmentadorService = new FragmentadorService(),
    logger = console,
  }) {
    this.documentoRepository = documentoRepository;
    this.fragmentoRepository = fragmentoRepository;
    this.almacenamientoRepository = almacenamientoRepository;
    this.embeddingsService = embeddingsService;
    this.extractorService = extractorService;
    this.fragmentadorService = fragmentadorService;
    this.logger = logger;
  }

  /**
   * Procesa el documento asociado a un evento de S3.
   * Si el objeto todavia no esta registrado, se omite: el registro lo vuelve
   * a encolar de forma best-effort y el reproceso manual sigue disponible.
   *
   * @param {string} rutaAlmacenamiento Clave del objeto en S3.
   * @param {{ forzar?: boolean }} [opciones]
   * @returns {Promise<object>}
   */
  async procesarPorRuta(rutaAlmacenamiento, { forzar = false } = {}) {
    if (!String(rutaAlmacenamiento ?? '').startsWith('usuarios/')) {
      return { omitido: true, motivo: 'ruta_fuera_de_usuarios' };
    }

    const documento =
      await this.documentoRepository.obtenerPorRutaSinUsuario(rutaAlmacenamiento);

    if (!documento) {
      return { omitido: true, motivo: 'documento_no_registrado' };
    }

    return this.procesarDocumento({
      documentoId: documento.id,
      usuarioId: documento.usuario_id,
      rutaEsperada: rutaAlmacenamiento,
      forzar,
    });
  }

  /**
   * Procesa un documento con idempotencia y verificacion de propiedad.
   *
   * @param {{ documentoId: string, usuarioId: string, rutaEsperada?: string | null, forzar?: boolean }} parametros
   * @returns {Promise<object>}
   */
  async procesarDocumento({
    documentoId,
    usuarioId,
    rutaEsperada = null,
    forzar = false,
  }) {
    const documento = await this.documentoRepository.obtenerPorIdSinUsuario(documentoId);

    try {
      this.validarDocumento(documento, { usuarioId, rutaEsperada });
    } catch (error) {
      const fallo = ErrorProcesamiento.desde(error);
      return {
        documentoId,
        estado: 'error',
        permanente: true,
        motivo: fallo.message,
      };
    }

    if (documento.estado_procesamiento === 'procesado' && !forzar) {
      return { documentoId: documento.id, omitido: true, motivo: 'ya_procesado' };
    }

    if (ESTADOS_EN_PROCESO.has(documento.estado_procesamiento)) {
      return {
        documentoId: documento.id,
        omitido: true,
        motivo: 'procesamiento_en_curso',
      };
    }

    const enProceso = await this.documentoRepository.marcarProcesando(documento.id, {
      incluirProcesado: forzar,
    });

    if (!enProceso) {
      return {
        documentoId: documento.id,
        omitido: true,
        motivo: 'estado_no_iniciable',
      };
    }

    try {
      return await this.ejecutar(enProceso);
    } catch (error) {
      return this.manejarFallo(enProceso.id, error);
    }
  }

  /**
   * @param {object} documento Fila ya marcada como `procesando`.
   * @returns {Promise<object>}
   */
  async ejecutar(documento) {
    this.validarConfiguracion();

    if (!this.almacenamientoRepository.estaDisponible()) {
      throw ErrorProcesamiento.temporal(
        'El almacenamiento de documentos no esta disponible en este momento.',
      );
    }

    const buffer = await this.almacenamientoRepository.obtenerObjeto(
      documento.ruta_almacenamiento,
    );

    if (!buffer) {
      throw ErrorProcesamiento.permanente(
        'El archivo del documento ya no esta disponible en el almacenamiento.',
      );
    }

    const extraido = await this.extractorService.extraer({
      buffer,
      nombreArchivo: documento.nombre_archivo,
      tipoArchivo: documento.tipo_archivo,
    });

    const { fragmentos, truncado } = this.fragmentadorService.fragmentar(extraido.paginas);

    if (fragmentos.length === 0) {
      throw ErrorProcesamiento.permanente(
        'El documento no contiene texto extraible. Si es un escaneo, aplica OCR antes de subirlo.',
      );
    }

    const embeddings = await this.embeddingsService.generarEmbeddings(
      fragmentos.map((fragmento) => fragmento.contenido),
    );

    const fragmentosConEmbedding = fragmentos.map((fragmento, indice) => ({
      ...fragmento,
      embedding: embeddings[indice],
    }));

    await this.fragmentoRepository.reemplazarFragmentos(
      documento.id,
      fragmentosConEmbedding,
      { modeloEmbedding: this.embeddingsService.modelo },
    );

    await this.documentoRepository.actualizarResultadoProcesamiento(documento.id, {
      estado: 'procesado',
      numeroPaginas: extraido.numeroPaginas,
    });

    return {
      documentoId: documento.id,
      estado: 'procesado',
      fragmentos: fragmentosConEmbedding.length,
      numeroPaginas: extraido.numeroPaginas,
      truncado,
    };
  }

  /**
   * Registra el error en el documento y decide si SQS debe reintentar.
   *
   * @param {string} documentoId
   * @param {unknown} error
   * @returns {Promise<object>}
   */
  async manejarFallo(documentoId, error) {
    const fallo = ErrorProcesamiento.desde(error);

    try {
      await this.documentoRepository.actualizarResultadoProcesamiento(documentoId, {
        estado: 'error',
        motivoError: fallo.message,
      });
    } catch (errorRegistro) {
      this.logger.error('No se pudo registrar el error de procesamiento.', {
        documentoId,
        message: errorRegistro?.message,
      });
      throw errorRegistro;
    }

    if (fallo.permanente) {
      return {
        documentoId,
        estado: 'error',
        permanente: true,
        motivo: fallo.message,
      };
    }

    throw fallo;
  }

  /**
   * @param {object | null} documento
   * @param {{ usuarioId: string, rutaEsperada: string | null }} contexto
   * @returns {void}
   */
  validarDocumento(documento, { usuarioId, rutaEsperada }) {
    if (!documento) {
      throw ErrorProcesamiento.permanente('El documento no existe o fue eliminado.');
    }

    if (!usuarioId || documento.usuario_id !== usuarioId) {
      throw ErrorProcesamiento.permanente(
        'El documento no pertenece al usuario indicado en el evento.',
      );
    }

    const prefijo = `usuarios/${documento.usuario_id}/documentos/`;
    if (!String(documento.ruta_almacenamiento ?? '').startsWith(prefijo)) {
      throw ErrorProcesamiento.permanente(
        'La ruta del documento no coincide con su propietario.',
      );
    }

    if (rutaEsperada && rutaEsperada !== documento.ruta_almacenamiento) {
      throw ErrorProcesamiento.permanente(
        'La ruta del evento no coincide con el documento registrado.',
      );
    }
  }

  /**
   * Falla de forma controlada si la configuracion no puede cumplir el esquema.
   *
   * @returns {void}
   */
  validarConfiguracion() {
    if (!this.embeddingsService.estaDisponible()) {
      throw ErrorProcesamiento.permanente(
        'El servicio de IA no esta configurado. Falta AI_API_KEY en el servidor.',
      );
    }

    if (this.embeddingsService.dimensiones !== DIMENSION_VECTOR) {
      throw ErrorProcesamiento.permanente(
        `La configuracion de embeddings usa ${this.embeddingsService.dimensiones} dimensiones y la base de datos espera ${DIMENSION_VECTOR}.`,
      );
    }
  }
}

module.exports = ProcesamientoService;
