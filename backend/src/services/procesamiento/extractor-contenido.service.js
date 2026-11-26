/**
 * Extraccion de texto de documentos academicos (HU09).
 * Devuelve el texto por pagina o diapositiva para conservar la trazabilidad
 * de las citas del RAG. No genera embeddings ni toca la base de datos.
 */
const { ErrorProcesamiento } = require('./procesamiento.error');
const { asegurarPolyfillDomMatrix } = require('../../utils/polyfill-dom-matrix');

const EXTENSIONES_POR_MIME = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt',
};

const FORMATOS_SIN_SOPORTE = new Set(['.doc', '.ppt']);

/**
 * @param {string} nombreArchivo
 * @param {string} tipoArchivo
 * @returns {string} Extension en minusculas, con punto.
 */
function obtenerExtension(nombreArchivo, tipoArchivo) {
  const nombre = String(nombreArchivo ?? '');
  const posicionPunto = nombre.lastIndexOf('.');

  if (posicionPunto > 0) {
    return nombre.slice(posicionPunto).toLowerCase();
  }

  return EXTENSIONES_POR_MIME[tipoArchivo] ?? '';
}

/**
 * Convierte una pagina extraida al contrato interno.
 *
 * @param {number | null} numero
 * @param {string} texto
 * @returns {{ numero: number | null, texto: string } | null}
 */
function construirPagina(numero, texto) {
  const contenido = String(texto ?? '').trim();
  return contenido ? { numero, texto: contenido } : null;
}

class ExtractorContenidoService {
  /**
   * Extrae el texto de un documento.
   *
   * @param {{ buffer: Buffer, nombreArchivo: string, tipoArchivo: string }} parametros
   * @returns {Promise<{ paginas: Array<{ numero: number | null, texto: string }>, numeroPaginas: number | null }>}
   */
  async extraer({ buffer, nombreArchivo, tipoArchivo }) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw ErrorProcesamiento.permanente('El archivo del documento esta vacio o no se pudo leer.');
    }

    const extension = obtenerExtension(nombreArchivo, tipoArchivo);

    if (FORMATOS_SIN_SOPORTE.has(extension)) {
      throw ErrorProcesamiento.permanente(
        `El formato ${extension.slice(1).toUpperCase()} no se puede procesar. Conviertelo a PDF, DOCX, PPTX o TXT.`,
      );
    }

    switch (extension) {
      case '.pdf':
        return this.extraerPdf(buffer);
      case '.docx':
        return this.extraerDocx(buffer);
      case '.pptx':
        return this.extraerPptx(buffer);
      case '.txt':
        return this.extraerTxt(buffer);
      default:
        throw ErrorProcesamiento.permanente(
          'El formato del documento no es compatible con el procesamiento.',
        );
    }
  }

  /**
   * @param {Buffer} buffer
   * @returns {Promise<{ paginas: Array<{ numero: number | null, texto: string }>, numeroPaginas: number }>}
   */
  async extraerPdf(buffer) {
    // Antes de cargar pdf-parse: pdfjs-dist construye una DOMMatrix al iniciar.
    asegurarPolyfillDomMatrix();
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: buffer });

    try {
      const resultado = await parser.getText();
      const paginas = (resultado.pages ?? [])
        .map((pagina) => construirPagina(Number(pagina.num) || null, pagina.text))
        .filter(Boolean);

      return { paginas, numeroPaginas: resultado.pages?.length ?? paginas.length };
    } catch (error) {
      throw ErrorProcesamiento.desde(error, 'No se pudo leer el PDF del documento.');
    } finally {
      await parser.destroy();
    }
  }

  /**
   * @param {Buffer} buffer
   * @returns {Promise<{ paginas: Array<{ numero: null, texto: string }>, numeroPaginas: null }>}
   */
  async extraerDocx(buffer) {
    try {
      const mammoth = require('mammoth');
      const resultado = await mammoth.extractRawText({ buffer });
      const pagina = construirPagina(null, resultado.value);

      return { paginas: pagina ? [pagina] : [], numeroPaginas: null };
    } catch (error) {
      throw ErrorProcesamiento.desde(error, 'No se pudo leer el archivo DOCX.');
    }
  }

  /**
   * @param {Buffer} buffer
   * @returns {Promise<{ paginas: Array<{ numero: number | null, texto: string }>, numeroPaginas: number | null }>}
   */
  async extraerPptx(buffer) {
    try {
      const { parseOffice } = require('officeparser');
      const ast = await parseOffice(buffer, { ocr: false });
      const diapositivas = (ast.content ?? []).filter((nodo) => nodo.type === 'slide');
      const paginas = diapositivas
        .map((diapositiva, indice) => construirPagina(indice + 1, diapositiva.text))
        .filter(Boolean);

      if (paginas.length > 0) {
        return { paginas, numeroPaginas: diapositivas.length };
      }

      const textoCompleto = String((await ast.to('text'))?.value ?? '').trim();
      const pagina = construirPagina(null, textoCompleto);

      return { paginas: pagina ? [pagina] : [], numeroPaginas: null };
    } catch (error) {
      throw ErrorProcesamiento.desde(error, 'No se pudo leer el archivo PPTX.');
    }
  }

  /**
   * @param {Buffer} buffer
   * @returns {{ paginas: Array<{ numero: null, texto: string }>, numeroPaginas: null }}
   */
  extraerTxt(buffer) {
    const pagina = construirPagina(null, buffer.toString('utf8'));
    return { paginas: pagina ? [pagina] : [], numeroPaginas: null };
  }
}

module.exports = ExtractorContenidoService;
module.exports.obtenerExtension = obtenerExtension;
