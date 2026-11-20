const TarjetaIaService = require('../src/services/ia/tarjeta.ia.service');

/**
 * @param {number} cantidad
 * @returns {Array<{ frente: string, reverso: string }>}
 */
function crearTarjetas(cantidad) {
  return Array.from({ length: cantidad }, (_valor, indice) => ({
    frente: `Pregunta ${indice + 1}`,
    reverso: `Respuesta ${indice + 1}`,
  }));
}

/**
 * @param {number} cantidad
 * @returns {object}
 */
function respuestaValida(cantidad) {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({
            titulo: 'Tarjetas de prueba',
            tarjetas: crearTarjetas(cantidad),
          }),
        },
      },
    ],
    usage: { prompt_tokens: 100, completion_tokens: 50 },
    model: 'modelo-de-prueba',
  };
}

/**
 * @param {Array<object | Error>} resultados
 * @returns {{ client: object, create: jest.Mock }}
 */
function crearCliente(resultados) {
  const create = jest.fn();

  for (const resultado of resultados) {
    if (resultado instanceof Error) {
      create.mockRejectedValueOnce(resultado);
    } else {
      create.mockResolvedValueOnce(resultado);
    }
  }

  return { client: { chat: { completions: { create } } }, create };
}

/**
 * @returns {TarjetaIaService}
 */
function crearServicio(client = {}) {
  return new TarjetaIaService({ client, model: 'modelo-de-prueba' });
}

describe('TarjetaIaService (HU14)', () => {
  it('procesa una respuesta JSON pura', () => {
    const resultado = crearServicio().procesarRespuesta(respuestaValida(3), { cantidad: 3 });

    expect(resultado.contenido.tarjetas).toEqual(crearTarjetas(3));
    expect(resultado.contenido.titulo).toBe('Tarjetas de prueba');
    expect(resultado.tokensEntrada).toBe(100);
    expect(resultado.tokensSalida).toBe(50);
  });

  it('acepta una respuesta envuelta en bloque markdown', () => {
    const original = respuestaValida(2);
    const contenido = `Resumen: \`\`\`json\n${original.choices[0].message.content}\n\`\`\``;
    original.choices[0].message.content = contenido;

    const resultado = crearServicio().procesarRespuesta(original, { cantidad: 2 });

    expect(resultado.contenido.tarjetas).toHaveLength(2);
  });

  it('rechaza una respuesta que no es JSON', () => {
    expect(() =>
      crearServicio().procesarRespuesta(
        { choices: [{ message: { content: 'No pude generar tarjetas' } }] },
        { cantidad: 3 },
      ),
    ).toThrow(TarjetaIaService.TarjetaIaError);
  });

  it('rechaza una cantidad distinta de la solicitada', () => {
    expect(() =>
      crearServicio().procesarRespuesta(respuestaValida(3), { cantidad: 5 }),
    ).toThrow(/se pidieron 5/);
  });

  it('rechaza frentes repetidos sin distincion de tildes o mayusculas', () => {
    const respuesta = respuestaValida(2);
    respuesta.choices[0].message.content = JSON.stringify({
      tarjetas: [
        { frente: '¿Qué es la derivada?', reverso: 'Tasa de cambio.' },
        { frente: 'que es la derivada', reverso: 'Cambio instantaneo.' },
      ],
    });

    expect(() =>
      crearServicio().procesarRespuesta(respuesta, { cantidad: 2 }),
    ).toThrow(/repetidas/);
  });

  it('normaliza los espacios del frente y del reverso', () => {
    const respuesta = respuestaValida(1);
    respuesta.choices[0].message.content = JSON.stringify({
      tarjetas: [{ frente: '  ¿ Qué   es   esto? ', reverso: 'Una   respuesta\n larga ' }],
    });

    const { contenido } = crearServicio().procesarRespuesta(respuesta, { cantidad: 1 });

    expect(contenido.tarjetas[0]).toEqual({
      frente: '¿ Qué es esto?',
      reverso: 'Una respuesta larga',
    });
  });

  it('incluye la cantidad y la regla de contenido no confiable en el prompt', () => {
    const prompt = TarjetaIaService.construirPrompt({ cantidad: 7 });

    expect(prompt).toMatch(/exactamente 7 tarjetas/);
    expect(prompt).toMatch(/no confiable/i);
    expect(prompt).toMatch(/unicamente un objeto JSON/);
  });

  it('reintenta una vez cuando el proveedor devuelve un error temporal', async () => {
    const errorTemporal = Object.assign(new Error('Gateway timeout'), { status: 503 });
    const { client, create } = crearCliente([errorTemporal, respuestaValida(2)]);

    const resultado = await crearServicio(client).generarTarjetas({
      texto: 'Material de estudio suficiente.',
      cantidad: 2,
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(resultado.contenido.tarjetas).toHaveLength(2);
  });

  it('no reintenta un error permanente del proveedor', async () => {
    const errorPermanente = Object.assign(new Error('Invalid API key'), { status: 401 });
    const { client, create } = crearCliente([errorPermanente]);

    await expect(
      crearServicio(client).generarTarjetas({ texto: 'Material', cantidad: 2 }),
    ).rejects.toThrow(/no esta configurado correctamente/);

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('devuelve un error seguro despues de dos respuestas invalidas', async () => {
    const invalida = { choices: [{ message: { content: 'no es json' } }] };
    const { client, create } = crearCliente([invalida, invalida]);

    await expect(
      crearServicio(client).generarTarjetas({ texto: 'Material', cantidad: 2 }),
    ).rejects.toThrow(TarjetaIaService.TarjetaIaError);

    expect(create).toHaveBeenCalledTimes(2);
  });

  it('falla sin cliente configurado', async () => {
    await expect(
      crearServicio(null).generarTarjetas({ texto: 'Material', cantidad: 2 }),
    ).rejects.toThrow(/Falta AI_API_KEY/);
  });
});
