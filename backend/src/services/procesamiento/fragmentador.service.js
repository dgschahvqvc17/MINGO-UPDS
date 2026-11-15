/**
 * Fragmentacion de texto para RAG (HU09).
 * Divide el texto por parrafos con solapamiento para no perder contexto
 * en los limites de cada fragmento. No genera embeddings.
 */
const { createHash } = require('crypto');

const LARGO_FRAGMENTO = 1200;
const SOLAPAMIENTO = 200;
const MINIMO_CORTE = Math.floor(LARGO_FRAGMENTO * 0.6);
const MAXIMO_FRAGMENTOS = 1500;

/**
 * Normaliza espacios y saltos de linea sin perder la separacion de parrafos.
 *
 * @param {string} texto
 * @returns {string}
 */
function normalizarTexto(texto) {
  return String(texto ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Calcula el hash SHA-256 del fragmento, usado para no regenerar embeddings
 * cuando el contenido no cambio.
 *
 * @param {string} contenido
 * @returns {string}
 */
function calcularHash(contenido) {
  return createHash('sha256').update(contenido, 'utf8').digest('hex');
}

/**
 * Busca el ultimo espacio en blanco razonable para cortar sin partir palabras.
 *
 * @param {string} texto
 * @param {number} desde
 * @param {number} hasta
 * @returns {number}
 */
function buscarCorte(texto, desde, hasta) {
  const minimo = Math.max(desde + MINIMO_CORTE, desde + 1);

  for (let posicion = hasta; posicion > minimo; posicion -= 1) {
    if (/\s/.test(texto[posicion])) {
      return posicion;
    }
  }

  return hasta;
}

/**
 * Divide el texto de una pagina en fragmentos con solapamiento.
 *
 * @param {string} texto
 * @returns {string[]}
 */
function dividirTexto(texto) {
  if (!texto) {
    return [];
  }

  if (texto.length <= LARGO_FRAGMENTO) {
    return [texto];
  }

  const fragmentos = [];
  let inicio = 0;

  while (inicio < texto.length) {
    const limite = Math.min(inicio + LARGO_FRAGMENTO, texto.length);
    const fin = limite === texto.length ? limite : buscarCorte(texto, inicio, limite);
    const fragmento = texto.slice(inicio, fin).trim();

    if (fragmento) {
      fragmentos.push(fragmento);
    }

    if (fin >= texto.length) {
      break;
    }

    const siguiente = Math.max(fin - SOLAPAMIENTO, inicio + 1);
    inicio = siguiente;
  }

  return fragmentos;
}

class FragmentadorService {
  /**
   * @param {Array<{ numero: number | null, texto: string }>} paginas
   * @returns {{ fragmentos: Array<{ numero_fragmento: number, numero_pagina: number | null, contenido: string, hash_contenido: string }>, truncado: boolean }}
   */
  fragmentar(paginas) {
    const fragmentos = [];
    let truncado = false;

    for (const pagina of paginas ?? []) {
      const texto = normalizarTexto(pagina?.texto);

      for (const contenido of dividirTexto(texto)) {
        if (fragmentos.length >= MAXIMO_FRAGMENTOS) {
          truncado = true;
          break;
        }

        fragmentos.push({
          numero_fragmento: fragmentos.length + 1,
          numero_pagina: pagina?.numero ?? null,
          contenido,
          hash_contenido: calcularHash(contenido),
        });
      }

      if (truncado) {
        break;
      }
    }

    return { fragmentos, truncado };
  }
}

module.exports = FragmentadorService;
module.exports.LARGO_FRAGMENTO = LARGO_FRAGMENTO;
module.exports.SOLAPAMIENTO = SOLAPAMIENTO;
module.exports.MAXIMO_FRAGMENTOS = MAXIMO_FRAGMENTOS;
module.exports.dividirTexto = dividirTexto;
module.exports.normalizarTexto = normalizarTexto;
