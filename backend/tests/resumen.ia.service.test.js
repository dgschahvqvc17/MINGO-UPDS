const ResumenIaService = require('../src/services/ia/resumen.ia.service');

const CONTENIDO = {
  resumen_general: 'Este documento explica los conceptos fundamentales del tema y sus aplicaciones.',
  temas_principales: ['Conceptos basicos', 'Aplicaciones'],
  conceptos_importantes: [
    { termino: 'Concepto', descripcion: 'Idea central que estructural el tema.' },
  ],
};

function crearServicio() {
  return new ResumenIaService({ client: {}, model: 'modelo-de-prueba' });
}

describe('ResumenIaService (HU10)', () => {
  it('acepta una respuesta JSON pura', () => {
    const resultado = crearServicio().procesarRespuesta({
      choices: [{ message: { content: JSON.stringify(CONTENIDO) } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });

    expect(resultado.contenido).toEqual(CONTENIDO);
    expect(resultado.tokensEntrada).toBe(100);
    expect(resultado.tokensSalida).toBe(50);
  });

  it('acepta una respuesta envuelta en bloque markdown', () => {
    const contenido = '```json\n' + JSON.stringify(CONTENIDO) + '\n```';

    const resultado = crearServicio().procesarRespuesta({
      choices: [{ message: { content: contenido } }],
    });

    expect(resultado.contenido).toEqual(CONTENIDO);
  });

  it('acepta texto introductorio antes del JSON', () => {
    const contenido = 'Aqui tienes el resumen: ' + JSON.stringify(CONTENIDO);

    const resultado = crearServicio().procesarRespuesta({
      choices: [{ message: { content: contenido } }],
    });

    expect(resultado.contenido).toEqual(CONTENIDO);
  });

  it('rechaza una respuesta con formato inesperado', () => {
    expect(() =>
      crearServicio().procesarRespuesta({
        choices: [{ message: { content: 'No pude resumir el documento' } }],
      }),
    ).toThrow('El proveedor de IA devolvio un resumen que no es JSON.');
  });
});
