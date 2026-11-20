const { z } = require('zod');

/**
 * Esquemas Zod de HU13: generacion y resolucion de cuestionarios.
 * La propiedad de la materia, el documento y el cuestionario se comprueba en
 * el servicio; aqui solo se valida la forma de la entrada.
 */

const DIFICULTADES = ['basica', 'intermedia', 'avanzada'];
const TIPOS_PREGUNTA = ['opcion_multiple', 'verdadero_falso', 'abierta'];

const MINIMO_PREGUNTAS = 5;
const MAXIMO_PREGUNTAS = 20;
const MAXIMO_CARACTERES_RESPUESTA = 2000;
const MAXIMO_CUESTIONARIOS_POR_PAGINA = 50;

const tipoPreguntaSchema = z.enum(TIPOS_PREGUNTA, {
  message: 'El tipo de pregunta debe ser opcion_multiple, verdadero_falso o abierta',
});

/** Cuerpo de POST /asistente/cuestionario. */
const cuestionarioGenerarSchema = z.object({
  materia_id: z.string().uuid('El identificador de la materia no es valido'),
  documento_id: z
    .string()
    .uuid('El identificador del documento no es valido')
    .nullable()
    .optional(),
  cantidad_preguntas: z.coerce
    .number()
    .int()
    .min(MINIMO_PREGUNTAS, `El cuestionario debe tener al menos ${MINIMO_PREGUNTAS} preguntas`)
    .max(MAXIMO_PREGUNTAS, `El cuestionario puede tener como maximo ${MAXIMO_PREGUNTAS} preguntas`)
    .default(10),
  dificultad: z.enum(DIFICULTADES, {
    message: 'La dificultad debe ser basica, intermedia o avanzada',
  }).default('intermedia'),
  tipos: z
    .array(tipoPreguntaSchema)
    .min(1, 'Selecciona al menos un tipo de pregunta')
    .max(TIPOS_PREGUNTA.length)
    .default([...TIPOS_PREGUNTA])
    .refine((tipos) => new Set(tipos).size === tipos.length, {
      message: 'No se puede repetir un tipo de pregunta',
    }),
});

/** Parametro :id de las rutas de cuestionarios e intentos. */
const cuestionarioParamSchema = z.object({
  id: z.string().uuid('El identificador no es valido'),
});

const paginacionQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAXIMO_CUESTIONARIOS_POR_PAGINA)
    .default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Query de GET /asistente/cuestionarios. */
const cuestionarioListarQuerySchema = paginacionQuerySchema;

/** Query de GET /asistente/intentos. */
const intentoListarQuerySchema = paginacionQuerySchema;

const respuestaSchema = z.object({
  pregunta_id: z.string().uuid('El identificador de la pregunta no es valido'),
  respuesta: z
    .string()
    .trim()
    .min(1, 'La respuesta no puede estar vacia')
    .max(
      MAXIMO_CARACTERES_RESPUESTA,
      `La respuesta no puede superar ${MAXIMO_CARACTERES_RESPUESTA} caracteres`,
    ),
});

/** Cuerpo de POST /asistente/intentos/:id/responder. */
const intentoResponderSchema = z.object({
  respuestas: z
    .array(respuestaSchema)
    .min(1, 'Envia al menos una respuesta')
    .max(MAXIMO_PREGUNTAS)
    .refine(
      (respuestas) => new Set(respuestas.map((item) => item.pregunta_id)).size === respuestas.length,
      { message: 'No se puede responder dos veces la misma pregunta' },
    ),
});

module.exports = {
  DIFICULTADES,
  TIPOS_PREGUNTA,
  MINIMO_PREGUNTAS,
  MAXIMO_PREGUNTAS,
  MAXIMO_CARACTERES_RESPUESTA,
  MAXIMO_CUESTIONARIOS_POR_PAGINA,
  cuestionarioGenerarSchema,
  cuestionarioParamSchema,
  cuestionarioListarQuerySchema,
  intentoListarQuerySchema,
  intentoResponderSchema,
};
