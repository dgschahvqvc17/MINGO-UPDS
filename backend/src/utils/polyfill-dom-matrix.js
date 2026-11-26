/**
 * Polífill mínimo de DOMMatrix para el procesamiento de documentos en Lambda.
 *
 * pdf-parse incorpora pdfjs-dist, que construye una matriz al cargar el módulo
 * aunque solo se extraiga texto. En Lambda arm64 no se puede cargar el binario
 * nativo de @napi-rs/canvas, por lo que esa construcción falla con
 * "DOMMatrix is not defined". Se provee una matriz de identidad suficiente para
 * la extracción de texto, sin renderizado y sin dependencias nativas.
 */

const VALORES_IDENTIDAD = Object.freeze({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });

class DomMatrixIdentidad {
  constructor(valores) {
    Object.assign(this, VALORES_IDENTIDAD);

    if (Array.isArray(valores) && valores.length >= 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = valores.slice(0, 6);
    }
  }

  multiplySelf() {
    return this;
  }

  preMultiplySelf() {
    return this;
  }

  translateSelf() {
    return this;
  }

  scaleSelf() {
    return this;
  }

  invertSelf() {
    return this;
  }

  transformPoint(punto) {
    return punto;
  }
}

/**
 * Instala el polífill solo cuando el entorno no provee DOMMatrix.
 * No sobrescribe una implementación real (navegador o @napi-rs/canvas).
 */
function asegurarPolyfillDomMatrix() {
  if (typeof globalThis.DOMMatrix === 'function') {
    return;
  }

  globalThis.DOMMatrix = DomMatrixIdentidad;
}

module.exports = { asegurarPolyfillDomMatrix, DomMatrixIdentidad };
