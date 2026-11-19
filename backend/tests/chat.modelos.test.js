const {
  chatEnviarSchema,
  conversacionParamSchema,
  conversacionListarQuerySchema,
  MAXIMO_CARACTERES_MENSAJE,
  MAXIMO_DOCUMENTOS_POR_PREGUNTA,
} = require('../src/models/chat.model');

const CONVERSACION_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const MATERIA_ID = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';

describe('esquemas Zod de chat (HU12)', () => {
  it('acepta un mensaje nuevo con valores por defecto', () => {
    const resultado = chatEnviarSchema.parse({ mensaje: 'Explícame la derivada' });

    expect(resultado).toEqual({
      mensaje: 'Explícame la derivada',
      conversacion_id: undefined,
      materia_id: undefined,
      documento_ids: [],
      usar_documentos: true,
    });
  });

  it('acepta una conversacion, materia y documentos con UUID', () => {
    const resultado = chatEnviarSchema.parse({
      conversacion_id: CONVERSACION_ID,
      mensaje: 'Pregunta de seguimiento',
      materia_id: MATERIA_ID,
      documento_ids: [DOCUMENTO_ID],
      usar_documentos: false,
    });

    expect(resultado.conversacion_id).toBe(CONVERSACION_ID);
    expect(resultado.materia_id).toBe(MATERIA_ID);
    expect(resultado.documento_ids).toEqual([DOCUMENTO_ID]);
    expect(resultado.usar_documentos).toBe(false);
  });

  it('rechaza un mensaje vacio o demasiado largo', () => {
    expect(() => chatEnviarSchema.parse({ mensaje: '   ' })).toThrow();
    expect(() =>
      chatEnviarSchema.parse({ mensaje: 'a'.repeat(MAXIMO_CARACTERES_MENSAJE + 1) }),
    ).toThrow();
  });

  it('rechaza mas documentos de los permitidos', () => {
    const documentoIds = Array.from(
      { length: MAXIMO_DOCUMENTOS_POR_PREGUNTA + 1 },
      () => DOCUMENTO_ID,
    );

    expect(() => chatEnviarSchema.parse({ mensaje: 'Hola', documento_ids: documentoIds })).toThrow();
  });

  it('rechaza identificadores que no son UUID', () => {
    expect(() => chatEnviarSchema.parse({ mensaje: 'Hola', documento_ids: ['123'] })).toThrow();
    expect(() => conversacionParamSchema.parse({ id: '123' })).toThrow();
  });

  it('coercea y limita la paginacion de conversaciones', () => {
    expect(conversacionListarQuerySchema.parse({ limit: '10', offset: '20' })).toEqual({
      limit: 10,
      offset: 20,
    });
    expect(conversacionListarQuerySchema.parse({})).toEqual({ limit: 20, offset: 0 });
    expect(() => conversacionListarQuerySchema.parse({ limit: '101' })).toThrow();
    expect(() => conversacionListarQuerySchema.parse({ offset: '-1' })).toThrow();
  });
});
