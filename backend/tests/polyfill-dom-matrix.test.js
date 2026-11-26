const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');
const ExtractorContenidoService = require('../src/services/procesamiento/extractor-contenido.service');
const {
  asegurarPolyfillDomMatrix,
  DomMatrixIdentidad,
} = require('../src/utils/polyfill-dom-matrix');

describe('polyfill-dom-matrix', () => {
  const domMatrixOriginal = globalThis.DOMMatrix;

  beforeEach(() => {
    delete globalThis.DOMMatrix;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.dontMock('pdf-parse');

    if (domMatrixOriginal === undefined) {
      delete globalThis.DOMMatrix;
    } else {
      globalThis.DOMMatrix = domMatrixOriginal;
    }
  });

  it('instala una matriz de identidad cuando el entorno no provee DOMMatrix', () => {
    asegurarPolyfillDomMatrix();

    const matriz = new globalThis.DOMMatrix();
    expect(matriz).toMatchObject({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  });

  it('no sobrescribe una implementación de DOMMatrix existente', () => {
    class DomMatrixReal {}
    globalThis.DOMMatrix = DomMatrixReal;

    asegurarPolyfillDomMatrix();

    expect(globalThis.DOMMatrix).toBe(DomMatrixReal);
  });

  it('acepta valores iniciales como arreglo de seis componentes', () => {
    const matriz = new DomMatrixIdentidad([2, 0, 0, 3, 4, 5]);

    expect(matriz).toMatchObject({ a: 2, b: 0, c: 0, d: 3, e: 4, f: 5 });
  });

  it('deja DOMMatrix disponible antes de cargar pdf-parse', async () => {
    jest.doMock('pdf-parse', () => {
      // pdfjs-dist construye una DOMMatrix al cargar el módulo. El doble
      // reproduce ese requisito para verificar el orden de inicialización.
      if (typeof globalThis.DOMMatrix !== 'function') {
        throw new Error('DOMMatrix is not defined');
      }

      return {
        PDFParse: class {
          async getText() {
            return { pages: [{ num: 1, text: 'Hola MINGO desde PDF' }] };
          }

          async destroy() {}
        },
      };
    });

    const extractor = new ExtractorContenidoService();
    const resultado = await extractor.extraerPdf(Buffer.from('%PDF-1.4'));

    expect(resultado).toEqual({
      paginas: [{ numero: 1, texto: 'Hola MINGO desde PDF' }],
      numeroPaginas: 1,
    });
  });
});
