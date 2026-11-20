const {
  construirPrompt,
  normalizarCuestionario,
  CuestionarioIaError,
} = require('../src/services/ia/cuestionario.ia.service');

describe('construirPrompt (HU13)', () => {
  it('solo ofrece el tipo pedido cuando se marca una sola opcion', () => {
    const prompt = construirPrompt({
      cantidad: 5,
      dificultad: 'basica',
      tipos: ['abierta'],
    });

    expect(prompt).toContain('- abierta: respuesta abierta');
    expect(prompt).not.toContain('- opcion_multiple:');
    expect(prompt).not.toContain('- verdadero_falso:');
    expect(prompt).not.toContain('"tipo_pregunta":"opcion_multiple"');
    expect(prompt).not.toContain('"tipo_pregunta":"verdadero_falso"');
    expect(prompt).toContain('"tipo_pregunta":"abierta"');
    expect(prompt).toContain('El tipo pedido debe aparecer al menos una vez.');
  });

  it('usa el primer tipo pedido en el ejemplo JSON', () => {
    const prompt = construirPrompt({
      cantidad: 5,
      dificultad: 'intermedia',
      tipos: ['verdadero_falso', 'abierta'],
    });

    expect(prompt).toContain('- verdadero_falso:');
    expect(prompt).toContain('- abierta:');
    expect(prompt).not.toContain('- opcion_multiple:');
    expect(prompt).toContain('"tipo_pregunta":"verdadero_falso"');
    expect(prompt).not.toContain('"tipo_pregunta":"opcion_multiple"');
  });

  it('muestra tres opciones en el ejemplo de opcion multiple', () => {
    const prompt = construirPrompt({
      cantidad: 5,
      dificultad: 'basica',
      tipos: ['opcion_multiple'],
    });

    expect(prompt).toContain('"contenido":"Opcion correcta","es_correcta":true');
    expect(prompt).toContain('"contenido":"Opcion incorrecta 1","es_correcta":false');
    expect(prompt).toContain('"contenido":"Opcion incorrecta 2","es_correcta":false');
  });

  it('enumera cada tipo pedido como valor permitido', () => {
    const prompt = construirPrompt({
      cantidad: 10,
      dificultad: 'avanzada',
      tipos: ['opcion_multiple', 'abierta'],
    });

    expect(prompt).toContain('unicamente puede valer opcion_multiple, abierta');
    expect(prompt).toContain('Todos los 2 tipos pedidos');
  });
});

describe('normalizarCuestionario (HU13)', () => {
  const preguntaBase = {
    enunciado: 'Enunciado de prueba suficientemente largo.',
    tipo_pregunta: 'opcion_multiple',
    explicacion: 'Explicacion de prueba suficientemente larga.',
    respuesta_correcta: 'Respuesta',
    opciones: [
      { contenido: 'Respuesta', es_correcta: true },
      { contenido: 'Otra opcion', es_correcta: false },
    ],
  };

  it('rechaza un tipo que no fue solicitado', () => {
    expect(() =>
      normalizarCuestionario(
        { titulo: 'Prueba', preguntas: [preguntaBase] },
        { cantidad: 1, tipos: ['abierta'] },
      ),
    ).toThrow(CuestionarioIaError);
  });

  it('acepta una pregunta del tipo solicitado', () => {
    const resultado = normalizarCuestionario(
      { titulo: 'Prueba', preguntas: [preguntaBase] },
      { cantidad: 1, tipos: ['opcion_multiple'] },
    );

    expect(resultado.preguntas[0].tipo_pregunta).toBe('opcion_multiple');
  });
});
