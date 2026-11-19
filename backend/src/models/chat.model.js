const { z } = require('zod');

/**
 * Esquemas Zod de HU12: chat academico con RAG.
 * La propiedad de la conversacion, materia y documentos se comprueba en el
 * servicio; aqui solo se valida la forma de la entrada.
 */

const MAXIMO_CARACTERES_MENSAJE = 4000;
const MAXIMO_DOCUMENTOS_POR_PREGUNTA = 5;
const MAXIMO_CONVERSACIONES_POR_PAGINA = 100;

const mensajeSchema = z
  .string()
  .trim()
  .min(1, 'El mensaje no puede estar vacio')
  .max(MAXIMO_CARACTERES_MENSAJE, 'El mensaje no puede superar 4000 caracteres');

/** Cuerpo de POST /asistente/chat. `conversacion_id` vacio crea una conversacion. */
const chatEnviarSchema = z.object({
  conversacion_id: z.string().uuid('El identificador de la conversacion no es valido').nullable().optional(),
  mensaje: mensajeSchema,
  materia_id: z.string().uuid('El identificador de la materia no es valido').nullable().optional(),
  documento_ids: z
    .array(z.string().uuid('El identificador del documento no es valido'))
    .max(MAXIMO_DOCUMENTOS_POR_PREGUNTA, 'Se pueden seleccionar como maximo 5 documentos')
    .default([]),
  usar_documentos: z.boolean().default(true),
});

/** Parametro :id de las rutas de conversacion. */
const conversacionParamSchema = z.object({
  id: z.string().uuid('El identificador de la conversacion no es valido'),
});

/** Query de GET /asistente/conversaciones. */
const conversacionListarQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAXIMO_CONVERSACIONES_POR_PAGINA).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

module.exports = {
  MAXIMO_CARACTERES_MENSAJE,
  MAXIMO_DOCUMENTOS_POR_PREGUNTA,
  chatEnviarSchema,
  conversacionParamSchema,
  conversacionListarQuerySchema,
};
