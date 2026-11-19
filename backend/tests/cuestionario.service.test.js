const CuestionarioService = require('../src/services/cuestionario.service');
const { CuestionarioIaError } = require('../src/services/ia/cuestionario.ia.service');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const MATERIA_ID = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const CUESTIONARIO_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const INTENTO_ID = 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f';
const PREGUNTA_MULTIPLE_ID = '11111111-1111-4111-8111-111111111111';
const PREGUNTA_VF_ID = '22222222-2222-4222-8222-222222222222';
const PREGUNTA_ABIERTA_ID = '33333333-3333-4333-8333-333333333333';

const PREGUNTAS = [
  {
    id: PREGUNTA_MULTIPLE_ID,
    cuestionario_id: CUESTIONARIO_ID,
    orden: 1,
    enunciado: '¿Qué mide la derivada de una función?',
    tipo_pregunta: 'opcion_multiple',
    respuesta_correcta: 'La tasa de cambio instantánea',
    explicacion: 'La derivada describe cómo cambia una función en un punto.',
    opciones: [
      { id: 'opcion-1', pregunta_id: PREGUNTA_MULTIPLE_ID, orden: 1, contenido: 'La tasa de cambio instantánea', es_correcta: true },
      { id: 'opcion-2', pregunta_id: PREGUNTA_MULTIPLE_ID, orden: 2, contenido: 'El área bajo la curva', es_correcta: false },
    ],
  },
  {
    id: PREGUNTA_VF_ID,
    cuestionario_id: CUESTIONARIO_ID,
    orden: 2,
    enunciado: 'La integral es la operación inversa de la derivada.',
    tipo_pregunta: 'verdadero_falso',
    respuesta_correcta: 'Verdadero',
    explicacion: 'Por el teorema fundamental del cálculo, ambas operaciones se relacionan.',
    opciones: [
      { id: 'opcion-3', pregunta_id: PREGUNTA_VF_ID, orden: 1, contenido: 'Verdadero', es_correcta: true },
      { id: 'opcion-4', pregunta_id: PREGUNTA_VF_ID, orden: 2, contenido: 'Falso', es_correcta: false },
    ],
  },
  {
    id: PREGUNTA_ABIERTA_ID,
    cuestionario_id: CUESTIONARIO_ID,
    orden: 3,
    enunciado: 'Explica con tus palabras qué es una función continua.',
    tipo_pregunta: 'abierta',
    respuesta_correcta: 'Una función sin cortes ni saltos en su dominio.',
    explicacion: 'La continuidad implica que no hay interrupciones en la gráfica.',
    opciones: [],
  },
];

const CONTENIDO_IA = {
  titulo: 'Repaso de cálculo diferencial',
  preguntas: PREGUNTAS.map((pregunta) => ({
    enunciado: pregunta.enunciado,
    tipo_pregunta: pregunta.tipo_pregunta,
    explicacion: pregunta.explicacion,
    respuesta_correcta: pregunta.respuesta_correcta,
    opciones: pregunta.opciones.map(({ contenido, es_correcta }) => ({ contenido, es_correcta })),
  })),
};

const FILA_CUESTIONARIO = {
  id: CUESTIONARIO_ID,
  usuario_id: USUARIO_ID,
  materia_id: MATERIA_ID,
  documento_id: DOCUMENTO_ID,
  titulo: 'Repaso de cálculo diferencial',
  dificultad: 'intermedia',
  cantidad_preguntas: 3,
  tipos: ['opcion_multiple', 'verdadero_falso', 'abierta'],
  modelo: 'gemini-3.5-flash-lite',
  tokens_entrada: 500,
  tokens_salida: 800,
  fecha_creacion: '2026-11-19T10:00:00.000Z',
  materias: { nombre: 'Cálculo Diferencial', codigo: 'MAT-101', color: '#3B82F6' },
};

const INTENTO_EN_PROGRESO = {
  id: INTENTO_ID,
  usuario_id: USUARIO_ID,
  cuestionario_id: CUESTIONARIO_ID,
  estado: 'en_progreso',
  total_preguntas: 3,
  preguntas_objetivas: 2,
  respuestas_correctas: 0,
  puntuacion: null,
  fecha_inicio: '2026-11-19T10:05:00.000Z',
  fecha_finalizacion: null,
};

/**
 * @param {object} [opciones]
 * @returns {{ servicio: CuestionarioService, dependencias: object }}
 */
function crearServicio({
  materia = { id: MATERIA_ID, nombre: 'Cálculo Diferencial' },
  documento = {
    id: DOCUMENTO_ID,
    materia_id: MATERIA_ID,
    nombre: 'Apuntes',
    estado_procesamiento: 'procesado',
  },
  fragmentosDocumento = [{ numero_fragmento: 1, numero_pagina: 1, contenido: 'x'.repeat(200) }],
  fragmentosMateria = [{ numero_fragmento: 1, numero_pagina: 1, contenido: 'x'.repeat(200) }],
  consumo = 0,
  intento = INTENTO_EN_PROGRESO,
  preguntas = PREGUNTAS,
  respuestasGuardadas = [],
  errorIa = null,
} = {}) {
  const dependencias = {
    materiaRepository: {
      obtenerMateriaPorId: jest.fn().mockResolvedValue(materia),
    },
    documentoRepository: {
      obtenerDocumentoPorId: jest.fn().mockResolvedValue(documento),
    },
    fragmentoRepository: {
      listarParaCuestionario: jest.fn().mockResolvedValue(fragmentosDocumento),
      listarPorMateriaParaCuestionario: jest.fn().mockResolvedValue(fragmentosMateria),
    },
    cuestionarioRepository: {
      crearCuestionario: jest.fn().mockImplementation(async (cuestionario, generadas) => ({
        ...cuestionario,
        ...FILA_CUESTIONARIO,
        cantidad_preguntas: generadas.length,
        preguntas: generadas.map((pregunta, indice) => ({
          ...PREGUNTAS[indice],
          enunciado: pregunta.enunciado,
          tipo_pregunta: pregunta.tipo_pregunta,
          explicacion: pregunta.explicacion,
          respuesta_correcta: pregunta.respuesta_correcta,
          opciones: PREGUNTAS[indice].opciones,
        })),
      })),
      listarCuestionarios: jest.fn().mockResolvedValue({ items: [FILA_CUESTIONARIO], total: 1 }),
      obtenerCuestionarioPorId: jest.fn().mockResolvedValue(FILA_CUESTIONARIO),
      listarPreguntas: jest.fn().mockResolvedValue(preguntas),
      eliminarCuestionario: jest.fn().mockResolvedValue(undefined),
      crearIntento: jest.fn().mockResolvedValue(INTENTO_EN_PROGRESO),
      obtenerIntentoPorId: jest.fn().mockResolvedValue(intento),
      listarIntentos: jest.fn().mockResolvedValue([INTENTO_EN_PROGRESO]),
      guardarRespuestas: jest.fn().mockImplementation(async (filas) => {
        respuestasGuardadas.push(...filas);
        return filas.map((fila, indice) => ({ id: `respuesta-${indice + 1}`, ...fila }));
      }),
      listarRespuestas: jest.fn().mockImplementation(async () => respuestasGuardadas),
      actualizarIntento: jest.fn().mockImplementation(async (_usuarioId, _intentoId, datos) => ({
        ...INTENTO_EN_PROGRESO,
        ...datos,
      })),
    },
    consumoRepository: {
      contar: jest.fn().mockResolvedValue(consumo),
      registrar: jest.fn().mockResolvedValue('consumo-id'),
    },
    iaService: {
      generarCuestionario: jest.fn().mockImplementation(() =>
        errorIa
          ? Promise.reject(errorIa)
          : Promise.resolve({
            contenido: CONTENIDO_IA,
            modelo: 'gemini-3.5-flash-lite',
            tokensEntrada: 500,
            tokensSalida: 800,
          }),
      ),
    },
    usuarioActualId: USUARIO_ID,
  };

  return { servicio: new CuestionarioService(dependencias), dependencias };
}

describe('CuestionarioService (HU13)', () => {
  const entrada = {
    materiaId: MATERIA_ID,
    documentoId: DOCUMENTO_ID,
    cantidadPreguntas: 3,
    dificultad: 'intermedia',
    tipos: ['opcion_multiple', 'verdadero_falso', 'abierta'],
  };

  it('rechaza una materia ajena o inexistente con 404', async () => {
    const { servicio, dependencias } = crearServicio({ materia: null });

    await expect(servicio.generar(entrada)).rejects.toMatchObject({ statusCode: 404 });
    expect(dependencias.iaService.generarCuestionario).not.toHaveBeenCalled();
  });

  it('rechaza un documento que no pertenece a la materia con 404', async () => {
    const { servicio } = crearServicio({
      documento: { id: DOCUMENTO_ID, materia_id: 'otra-materia', estado_procesamiento: 'procesado' },
    });

    await expect(servicio.generar(entrada)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rechaza con 422 un documento que todavia no esta procesado', async () => {
    const { servicio, dependencias } = crearServicio({
      documento: { id: DOCUMENTO_ID, materia_id: MATERIA_ID, estado_procesamiento: 'procesando' },
    });

    await expect(servicio.generar(entrada)).rejects.toMatchObject({ statusCode: 422 });
    expect(dependencias.iaService.generarCuestionario).not.toHaveBeenCalled();
  });

  it('rechaza con 422 una materia sin documentos procesados', async () => {
    const { servicio, dependencias } = crearServicio({
      fragmentosMateria: [],
    });

    await expect(
      servicio.generar({ ...entrada, documentoId: null }),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(dependencias.iaService.generarCuestionario).not.toHaveBeenCalled();
  });

  it('rechaza con 429 al agotar la cuota diaria de cuestionarios', async () => {
    const { servicio, dependencias } = crearServicio({ consumo: 10 });

    await expect(servicio.generar(entrada)).rejects.toMatchObject({
      statusCode: 429,
      details: { code: 'AI_QUOTA_EXCEEDED' },
    });
    expect(dependencias.iaService.generarCuestionario).not.toHaveBeenCalled();
  });

  it('genera desde un documento, registra consumo y guarda sin revelar respuestas', async () => {
    const { servicio, dependencias } = crearServicio();

    const resultado = await servicio.generar(entrada);

    expect(dependencias.fragmentoRepository.listarParaCuestionario).toHaveBeenCalledWith(
      DOCUMENTO_ID,
      CuestionarioService.MAXIMO_FRAGMENTOS,
    );
    expect(dependencias.consumoRepository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ operacion: 'cuestionario', tokens_entrada: 500, tokens_salida: 800 }),
    );
    expect(dependencias.cuestionarioRepository.crearCuestionario).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario_id: USUARIO_ID,
        materia_id: MATERIA_ID,
        documento_id: DOCUMENTO_ID,
        dificultad: 'intermedia',
        cantidad_preguntas: 3,
        modelo: 'gemini-3.5-flash-lite',
      }),
      CONTENIDO_IA.preguntas,
    );
    expect(resultado).toMatchObject({
      id: CUESTIONARIO_ID,
      titulo: 'Repaso de cálculo diferencial',
      materia_nombre: 'Cálculo Diferencial',
    });
    expect(resultado.preguntas).toHaveLength(3);
    expect(resultado.preguntas[0]).not.toHaveProperty('respuesta_correcta');
    expect(resultado.preguntas[0]).not.toHaveProperty('explicacion');
    expect(resultado.preguntas[0].opciones[0]).not.toHaveProperty('es_correcta');
  });

  it('agrega los documentos procesados cuando no se elige un documento', async () => {
    const { servicio, dependencias } = crearServicio();

    await servicio.generar({ ...entrada, documentoId: null });

    expect(
      dependencias.fragmentoRepository.listarPorMateriaParaCuestionario,
    ).toHaveBeenCalledWith(MATERIA_ID, CuestionarioService.MAXIMO_FRAGMENTOS);
    expect(dependencias.cuestionarioRepository.crearCuestionario).toHaveBeenCalledWith(
      expect.objectContaining({ documento_id: null }),
      expect.any(Array),
    );
  });

  it('traduce un error del proveedor de IA a 503 con mensaje seguro', async () => {
    const { servicio, dependencias } = crearServicio({
      errorIa: new CuestionarioIaError('El proveedor de IA no respondio a tiempo.'),
    });

    await expect(servicio.generar(entrada)).rejects.toMatchObject({
      statusCode: 503,
      message: 'El proveedor de IA no respondio a tiempo.',
    });
    expect(dependencias.consumoRepository.registrar).not.toHaveBeenCalled();
  });

  it('inicia un intento con el total de preguntas y objetivas', async () => {
    const { servicio, dependencias } = crearServicio();

    const resultado = await servicio.iniciarIntento(CUESTIONARIO_ID);

    expect(dependencias.cuestionarioRepository.crearIntento).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario_id: USUARIO_ID,
        cuestionario_id: CUESTIONARIO_ID,
        estado: 'en_progreso',
        total_preguntas: 3,
        preguntas_objetivas: 2,
        puntuacion: null,
      }),
    );
    expect(resultado.intento.id).toBe(INTENTO_ID);
    expect(resultado.cuestionario.preguntas).toHaveLength(3);
    expect(resultado.cuestionario.preguntas[0]).not.toHaveProperty('respuesta_correcta');
  });

  it('corrige las preguntas objetivas y finaliza el intento', async () => {
    const { servicio, dependencias } = crearServicio();

    const resultado = await servicio.responder(INTENTO_ID, [
      { pregunta_id: PREGUNTA_MULTIPLE_ID, respuesta: 'la tasa de cambio instantanea' },
      { pregunta_id: PREGUNTA_VF_ID, respuesta: 'Falso' },
      { pregunta_id: PREGUNTA_ABIERTA_ID, respuesta: 'Una función sin saltos.' },
    ]);

    expect(dependencias.cuestionarioRepository.guardarRespuestas).toHaveBeenCalledWith([
      expect.objectContaining({ pregunta_id: PREGUNTA_MULTIPLE_ID, es_correcta: true }),
      expect.objectContaining({ pregunta_id: PREGUNTA_VF_ID, es_correcta: false }),
      expect.objectContaining({ pregunta_id: PREGUNTA_ABIERTA_ID, es_correcta: null }),
    ]);
    expect(dependencias.cuestionarioRepository.actualizarIntento).toHaveBeenCalledWith(
      USUARIO_ID,
      INTENTO_ID,
      expect.objectContaining({
        estado: 'finalizado',
        respuestas_correctas: 1,
        puntuacion: 50,
        fecha_finalizacion: expect.any(String),
      }),
    );
    expect(resultado.intento).toMatchObject({
      estado: 'finalizado',
      respuestas_correctas: 1,
      puntuacion: 50,
    });
    expect(resultado.preguntas[0]).toMatchObject({
      respuesta_correcta: 'La tasa de cambio instantánea',
      explicacion: expect.any(String),
      es_correcta: true,
    });
  });

  it('rechaza con 409 un intento ya finalizado', async () => {
    const { servicio, dependencias } = crearServicio({
      intento: { ...INTENTO_EN_PROGRESO, estado: 'finalizado', puntuacion: 80 },
    });

    await expect(
      servicio.responder(INTENTO_ID, [
        { pregunta_id: PREGUNTA_MULTIPLE_ID, respuesta: 'La tasa de cambio instantánea' },
      ]),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(dependencias.cuestionarioRepository.guardarRespuestas).not.toHaveBeenCalled();
  });

  it('rechaza con 400 una respuesta de una pregunta ajena al cuestionario', async () => {
    const { servicio, dependencias } = crearServicio();

    await expect(
      servicio.responder(INTENTO_ID, [
        { pregunta_id: '99999999-9999-4999-8999-999999999999', respuesta: 'Algo' },
      ]),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(dependencias.cuestionarioRepository.guardarRespuestas).not.toHaveBeenCalled();
  });

  it('oculta la correccion de un intento en progreso', async () => {
    const { servicio } = crearServicio({
      respuestasGuardadas: [
        {
          id: 'respuesta-1',
          intento_id: INTENTO_ID,
          pregunta_id: PREGUNTA_MULTIPLE_ID,
          respuesta: 'La tasa de cambio instantánea',
          es_correcta: true,
        },
      ],
    });

    const resultado = await servicio.obtenerResultadoIntento(INTENTO_ID);

    expect(resultado.intento.estado).toBe('en_progreso');
    expect(resultado.preguntas[0]).not.toHaveProperty('respuesta_correcta');
    expect(resultado.preguntas[0]).not.toHaveProperty('explicacion');
    expect(resultado.preguntas[0].respuesta_usuario).toBe('La tasa de cambio instantánea');
    expect(resultado.preguntas[0].es_correcta).toBeNull();
  });

  it('devuelve un intento ajeno o inexistente con 404', async () => {
    const { servicio } = crearServicio({ intento: null });

    await expect(servicio.obtenerResultadoIntento(INTENTO_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('elimina un cuestionario propio y responde 404 si es ajeno', async () => {
    const propio = crearServicio();
    await propio.servicio.eliminar(CUESTIONARIO_ID);
    expect(propio.dependencias.cuestionarioRepository.eliminarCuestionario).toHaveBeenCalledWith(
      USUARIO_ID,
      CUESTIONARIO_ID,
    );

    const ajeno = crearServicio();
    ajeno.dependencias.cuestionarioRepository.obtenerCuestionarioPorId.mockResolvedValue(null);

    await expect(ajeno.servicio.eliminar(CUESTIONARIO_ID)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(ajeno.dependencias.cuestionarioRepository.eliminarCuestionario).not.toHaveBeenCalled();
  });
});
