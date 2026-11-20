const CuestionarioService = require('../src/services/cuestionario.service');
const { EvaluadorIaError } = require('../src/services/ia/evaluador.ia.service');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const CUESTIONARIO_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const INTENTO_ID = 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f';
const PREGUNTA_OBJETIVA_ID = '11111111-1111-4111-8111-111111111111';
const PREGUNTA_ABIERTA_ID = '33333333-3333-4333-8333-333333333333';

const CUESTIONARIO = {
  id: CUESTIONARIO_ID,
  usuario_id: USUARIO_ID,
  materia_id: null,
  documento_id: null,
  titulo: 'Repaso de derivadas',
  dificultad: 'intermedia',
  cantidad_preguntas: 2,
  tipos: ['opcion_multiple', 'abierta'],
  modelo: 'modelo',
  tokens_entrada: 10,
  tokens_salida: 10,
  fecha_creacion: '2026-11-19T10:00:00.000Z',
  materias: [{ nombre: 'Cálculo Diferencial' }],
};

const INTENTO_EN_PROGRESO = {
  id: INTENTO_ID,
  cuestionario_id: CUESTIONARIO_ID,
  estado: 'en_progreso',
  total_preguntas: 2,
  preguntas_objetivas: 1,
  respuestas_correctas: 0,
  puntuacion: null,
  fecha_inicio: '2026-11-19T10:05:00.000Z',
  fecha_finalizacion: null,
};

const PREGUNTAS = [
  {
    id: PREGUNTA_OBJETIVA_ID,
    cuestionario_id: CUESTIONARIO_ID,
    orden: 1,
    enunciado: '¿Qué mide la derivada?',
    tipo_pregunta: 'opcion_multiple',
    tema: 'Derivadas',
    respuesta_correcta: 'La tasa de cambio instantánea',
    explicacion: 'La derivada describe el cambio en un punto.',
    opciones: [],
  },
  {
    id: PREGUNTA_ABIERTA_ID,
    cuestionario_id: CUESTIONARIO_ID,
    orden: 2,
    enunciado: 'Explica la continuidad de una función.',
    tipo_pregunta: 'abierta',
    tema: 'Continuidad',
    respuesta_correcta: 'Una función sin saltos en su dominio.',
    explicacion: 'La gráfica no se interrumpe.',
    opciones: [],
  },
];

const EVALUACION_IA = {
  contenido: {
    retroalimentacionGeneral: 'Buena base conceptual; repasa el concepto de límite.',
    evaluaciones: [
      {
        pregunta_id: PREGUNTA_ABIERTA_ID,
        es_correcta: true,
        puntaje: 9,
        retroalimentacion: 'Explicaste la idea central con claridad y sin errores.',
        temas_reforzar: ['Continuidad'],
        criterios: [{ nombre: 'precision_conceptual', cumplido: true, observacion: 'Correcto.' }],
      },
    ],
  },
  modelo: 'modelo-evaluador',
  tokensEntrada: 300,
  tokensSalida: 150,
};

function crearServicio({ evaluador = true, falloEvaluador = null, consumosEvaluacion = 0 } = {}) {
  const evaluadorIaService = evaluador
    ? {
        estaDisponible: jest.fn().mockReturnValue(true),
        evaluar: jest.fn().mockImplementation(() => {
          if (falloEvaluador) {
            return Promise.reject(falloEvaluador);
          }
          return Promise.resolve(EVALUACION_IA);
        }),
      }
    : undefined;

  const dependencias = {
    materiaRepository: {},
    documentoRepository: {},
    fragmentoRepository: {},
    cuestionarioRepository: {
      obtenerCuestionarioPorId: jest.fn().mockResolvedValue(CUESTIONARIO),
      listarPreguntas: jest.fn().mockResolvedValue(PREGUNTAS),
      obtenerIntentoPorId: jest.fn().mockResolvedValue(INTENTO_EN_PROGRESO),
      guardarRespuestas: jest.fn().mockImplementation(async (filas) => filas),
      guardarEvaluaciones: jest.fn().mockImplementation(async (filas) => filas),
      listarEvaluaciones: jest.fn().mockResolvedValue([]),
      listarRespuestas: jest.fn().mockResolvedValue([
        {
          id: 'respuesta-1',
          intento_id: INTENTO_ID,
          pregunta_id: PREGUNTA_OBJETIVA_ID,
          respuesta: 'La tasa de cambio instantánea',
          es_correcta: true,
        },
        {
          id: 'respuesta-2',
          intento_id: INTENTO_ID,
          pregunta_id: PREGUNTA_ABIERTA_ID,
          respuesta: 'Es una función sin saltos.',
          es_correcta: true,
        },
      ]),
      listarIntentosUsuario: jest.fn().mockResolvedValue({
        items: [
          {
            ...INTENTO_EN_PROGRESO,
            estado: 'finalizado',
            puntuacion: 80,
            retroalimentacion_general: 'Buen trabajo.',
            temas_reforzar: ['Derivadas'],
            recomendaciones: ['Repasa derivadas.'],
            cuestionarios: [{ titulo: 'Repaso de derivadas', materias: [{ nombre: 'Cálculo' }] }],
          },
        ],
        total: 1,
      }),
      actualizarIntento: jest.fn().mockImplementation(async (_usuarioId, _intentoId, datos) => ({
        ...INTENTO_EN_PROGRESO,
        ...datos,
      })),
    },
    consumoRepository: {
      contar: jest
        .fn()
        .mockImplementation((_usuarioId, operacion) =>
          Promise.resolve(operacion === 'evaluacion' ? consumosEvaluacion : 0),
        ),
      registrar: jest.fn().mockResolvedValue('consumo-id'),
    },
    iaService: {},
    evaluadorIaService,
    usuarioActualId: USUARIO_ID,
  };

  return { servicio: new CuestionarioService(dependencias), dependencias };
}

const RESPUESTAS = [
  { pregunta_id: PREGUNTA_OBJETIVA_ID, respuesta: 'La tasa de cambio instantánea' },
  { pregunta_id: PREGUNTA_ABIERTA_ID, respuesta: 'Es una función sin saltos.' },
];

describe('CuestionarioService — evaluación (HU16)', () => {
  it('evalúa las abiertas, suma su nota y guarda retroalimentación y recomendaciones', async () => {
    const { servicio, dependencias } = crearServicio();

    const resultado = await servicio.responder(INTENTO_ID, [
      { ...RESPUESTAS[0], respuesta: 'El área bajo la curva' },
      RESPUESTAS[1],
    ]);

    expect(dependencias.evaluadorIaService.evaluar).toHaveBeenCalledTimes(1);
    expect(dependencias.cuestionarioRepository.guardarEvaluaciones).toHaveBeenCalledWith([
      expect.objectContaining({
        intento_id: INTENTO_ID,
        pregunta_id: PREGUNTA_ABIERTA_ID,
        puntaje: 9,
        es_correcta: true,
      }),
    ]);
    expect(dependencias.consumoRepository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        operacion: 'evaluacion',
        tokens_entrada: 300,
        tokens_salida: 150,
      }),
    );
    expect(dependencias.cuestionarioRepository.actualizarIntento).toHaveBeenCalledWith(
      USUARIO_ID,
      INTENTO_ID,
      expect.objectContaining({
        puntuacion: 45,
        respuestas_correctas: 1,
        retroalimentacion_general: EVALUACION_IA.contenido.retroalimentacionGeneral,
        temas_reforzar: ['Derivadas'],
        recomendaciones: expect.arrayContaining([expect.stringContaining('Derivadas')]),
      }),
    );
    expect(resultado.intento).toMatchObject({
      puntuacion: 45,
      dominio_por_tema: expect.arrayContaining([
        expect.objectContaining({ tema: 'Derivadas', dominio: 0 }),
        expect.objectContaining({ tema: 'Continuidad', dominio: 90 }),
      ]),
    });
    expect(resultado.preguntas[1].evaluacion).toMatchObject({
      puntaje: 9,
      retroalimentacion: expect.stringContaining('idea central'),
    });
    expect(resultado.aviso_evaluacion).toBeUndefined();
  });

  it('finaliza con las objetivas y un aviso si el proveedor falla', async () => {
    const { servicio, dependencias } = crearServicio({
      falloEvaluador: new EvaluadorIaError('El proveedor de IA no respondio a tiempo.'),
    });

    const resultado = await servicio.responder(INTENTO_ID, RESPUESTAS);

    expect(resultado.intento.puntuacion).toBe(100);
    expect(resultado.aviso_evaluacion).toBe('El proveedor de IA no respondio a tiempo.');
    expect(dependencias.cuestionarioRepository.guardarEvaluaciones).not.toHaveBeenCalled();
    expect(dependencias.consumoRepository.registrar).not.toHaveBeenCalled();
  });

  it('no consume IA si se agotó la cuota diaria de evaluaciones', async () => {
    const { servicio, dependencias } = crearServicio({ consumosEvaluacion: 10 });

    const resultado = await servicio.responder(INTENTO_ID, RESPUESTAS);

    expect(resultado.codigo_aviso).toBe('AI_QUOTA_EXCEEDED');
    expect(dependencias.evaluadorIaService.evaluar).not.toHaveBeenCalled();
    expect(dependencias.consumoRepository.registrar).not.toHaveBeenCalled();
  });

  it('recupera la evaluación guardada sin volver a llamar a la IA', async () => {
    const { servicio, dependencias } = crearServicio();
    const evaluacionGuardada = EVALUACION_IA.contenido.evaluaciones[0];
    dependencias.cuestionarioRepository.obtenerIntentoPorId.mockResolvedValue({
      ...INTENTO_EN_PROGRESO,
      estado: 'finalizado',
    });
    dependencias.cuestionarioRepository.listarEvaluaciones.mockResolvedValue([
      {
        id: 'evaluacion-id',
        ...evaluacionGuardada,
        puntaje: 9,
        retroalimentacion: evaluacionGuardada.retroalimentacion,
        temas_reforzar: evaluacionGuardada.temas_reforzar,
      },
    ]);

    const resultado = await servicio.obtenerResultadoIntento(INTENTO_ID);

    expect(dependencias.evaluadorIaService.evaluar).not.toHaveBeenCalled();
    expect(resultado.preguntas[1].evaluacion).toMatchObject({ puntaje: 9 });
    expect(resultado.intento.dominio_por_tema).toEqual(
      expect.arrayContaining([expect.objectContaining({ tema: 'Continuidad', dominio: 90 })]),
    );
  });

  it('lista el historial con título de cuestionario, materia y recomendaciones', async () => {
    const { servicio } = crearServicio();

    const { items, total } = await servicio.listarIntentos({ limite: 20, desplazamiento: 0 });

    expect(total).toBe(1);
    expect(items[0]).toMatchObject({
      id: INTENTO_ID,
      cuestionario_titulo: 'Repaso de derivadas',
      materia_nombre: 'Cálculo',
      recomendaciones: ['Repasa derivadas.'],
    });
  });
});
