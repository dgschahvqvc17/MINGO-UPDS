const EvaluadorIaService = require('../src/services/ia/evaluador.ia.service');

const PREGUNTA_ID = '33333333-3333-4333-8333-333333333333';
const OTRA_PREGUNTA_ID = '44444444-4444-4444-8444-444444444444';

const RESPUESTAS = [
  {
    pregunta_id: PREGUNTA_ID,
    tema: 'Derivadas',
    enunciado: '¿Qué mide la derivada de una función?',
    respuesta_correcta: 'La tasa de cambio instantánea.',
    explicacion: 'La derivada describe el cambio en un punto.',
    respuesta_usuario: 'Mide cuánto cambia la función en un instante.',
  },
];

function contenidoValido() {
  return {
    retroalimentacion_general: 'Identificaste la idea principal; profundiza en el concepto de límite.',
    evaluaciones: [
      {
        pregunta_id: PREGUNTA_ID,
        es_correcta: true,
        puntaje: 8.5,
        retroalimentacion: 'Tu respuesta es precisa y comunica la idea central de la derivada.',
        temas_reforzar: ['Derivadas'],
        criterios: [
          { nombre: 'precision_conceptual', cumplido: true, observacion: 'Uso correcto del concepto.' },
        ],
      },
    ],
  };
}

function crearClient(contenido, { fallos = 0 } = {}) {
  const create = jest.fn();
  let llamadas = 0;

  for (let indice = 0; indice < fallos; indice += 1) {
    create.mockResolvedValueOnce({
      choices: [{ message: { content: '{"evaluaciones": [' } }],
    });
  }

  create.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(contenido) } }],
    model: 'gemini-3.5-flash-lite',
    usage: { prompt_tokens: 320, completion_tokens: 180 },
  });

  return {
    create,
    llamadas: () => llamadas,
    chat: {
      completions: {
        create: (...argumentos) => {
          llamadas += 1;
          return create(...argumentos);
        },
      },
    },
  };
}

describe('EvaluadorIaService (HU16)', () => {
  it('valida la evaluación y devuelve los contadores del proveedor', async () => {
    const client = crearClient(contenidoValido());
    const servicio = new EvaluadorIaService({ client, model: 'modelo-de-prueba' });

    const resultado = await servicio.evaluar(RESPUESTAS);

    expect(client.llamadas()).toBe(1);
    expect(client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'modelo-de-prueba',
        temperature: 0.2,
        max_tokens: 2000,
      }),
    );
    expect(resultado.contenido.retroalimentacionGeneral).toContain('idea principal');
    expect(resultado.contenido.evaluaciones[0].puntaje).toBe(8.5);
    expect(resultado).toMatchObject({
      modelo: 'gemini-3.5-flash-lite',
      tokensEntrada: 320,
      tokensSalida: 180,
    });
  });

  it('rechaza evaluaciones con identificadores inventados o incompletos', () => {
    const contenido = contenidoValido();
    contenido.evaluaciones[0].pregunta_id = OTRA_PREGUNTA_ID;

    expect(() =>
      EvaluadorIaService.normalizarEvaluacion(contenido, RESPUESTAS),
    ).toThrow('no evaluo todas las respuestas');
  });

  it('reintenta una sola vez cuando el proveedor devuelve JSON inválido', async () => {
    const client = crearClient(contenidoValido(), { fallos: 1 });
    const servicio = new EvaluadorIaService({ client });

    await expect(servicio.evaluar(RESPUESTAS)).resolves.toMatchObject({
      contenido: expect.any(Object),
    });
    expect(client.llamadas()).toBe(2);
  });

  it('agota los reintentos con un mensaje seguro y sin formato crudo', async () => {
    const create = jest.fn().mockResolvedValue({
      choices: [{ message: { content: 'no es json' } }],
    });
    const servicio = new EvaluadorIaService({
      client: { chat: { completions: { create } } },
    });

    await expect(servicio.evaluar(RESPUESTAS)).rejects.toMatchObject({
      name: 'EvaluadorIaError',
      message: 'El proveedor devolvio una evaluacion con formato inesperado.',
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('no llama al proveedor si no hay clave configurada', async () => {
    const servicio = new EvaluadorIaService({ client: null });

    await expect(servicio.evaluar(RESPUESTAS)).rejects.toMatchObject({
      message: expect.stringContaining('Falta AI_API_KEY'),
    });
  });

  it('el prompt fija los criterios y prohíbe inventar datos externos', () => {
    const prompt = EvaluadorIaService.construirPrompt(RESPUESTAS);

    expect(prompt).toContain('precision_conceptual');
    expect(prompt).toContain('completitud');
    expect(prompt).toContain('claridad');
    expect(prompt).toContain('No inventes datos externos');
  });
});
