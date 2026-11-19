const { describe, it, expect } = require('@jest/globals');
const FragmentadorService = require('../src/services/procesamiento/fragmentador.service');

const {
  LARGO_FRAGMENTO,
  MAXIMO_FRAGMENTOS,
  dividirTexto,
  normalizarTexto,
} = require('../src/services/procesamiento/fragmentador.service');

describe('FragmentadorService', () => {
  const service = new FragmentadorService();

  it('devuelve un solo fragmento para un texto corto', () => {
    const { fragmentos, truncado } = service.fragmentar([
      { numero: 1, texto: '  Texto   corto  con   espacios.  ' },
    ]);

    expect(truncado).toBe(false);
    expect(fragmentos).toHaveLength(1);
    expect(fragmentos[0]).toEqual(
      expect.objectContaining({
        numero_fragmento: 1,
        numero_pagina: 1,
        contenido: 'Texto corto con espacios.',
      }),
    );
    expect(fragmentos[0].hash_contenido).toMatch(/^[a-f0-9]{64}$/);
  });

  it('ignora páginas sin contenido', () => {
    const { fragmentos } = service.fragmentar([
      { numero: 1, texto: '   ' },
      { numero: 2, texto: '' },
    ]);

    expect(fragmentos).toEqual([]);
  });

  it('divide un texto largo en fragmentos que no superan el límite', () => {
    const texto = 'palabra '.repeat(1000).trim();
    const fragmentos = dividirTexto(texto);

    expect(fragmentos.length).toBeGreaterThan(1);
    for (const fragmento of fragmentos) {
      expect(fragmento.length).toBeLessThanOrEqual(LARGO_FRAGMENTO);
    }
  });

  it('conserva contexto con solapamiento entre fragmentos consecutivos', () => {
    const texto = Array.from({ length: 400 }, (_, indice) => `palabra${indice}`).join(' ');
    const fragmentos = dividirTexto(texto);
    const cola = fragmentos[0].slice(-200);

    expect(fragmentos[1].startsWith(cola)).toBe(true);
  });

  it('numera los fragmentos de forma consecutiva y conserva la página', () => {
    const { fragmentos } = service.fragmentar([
      { numero: 4, texto: 'Contenido de la cuarta página.' },
      { numero: 5, texto: 'Contenido de la quinta página.' },
    ]);

    expect(fragmentos.map((fragmento) => fragmento.numero_fragmento)).toEqual([1, 2]);
    expect(fragmentos.map((fragmento) => fragmento.numero_pagina)).toEqual([4, 5]);
  });

  it('corta al máximo de fragmentos e informa el truncado', () => {
    const paginas = Array.from({ length: MAXIMO_FRAGMENTOS + 5 }, (_, indice) => ({
      numero: indice + 1,
      texto: `Contenido exclusivo de la página ${indice + 1}.`,
    }));

    const { fragmentos, truncado } = service.fragmentar(paginas);

    expect(fragmentos).toHaveLength(MAXIMO_FRAGMENTOS);
    expect(truncado).toBe(true);
  });

  it('normaliza saltos de línea y espacios repetidos', () => {
    expect(normalizarTexto('a\r\nb\t\tc   d\n\n\n\ne')).toBe('a\nb c d\n\ne');
  });
});
