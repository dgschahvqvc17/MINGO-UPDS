const { z } = require('zod');

/**
 * Esquemas Zod de HU10: resumenes inteligentes de documentos.
 * La propiedad del documento se comprueba en el servicio; aqui solo se valida
 * la forma de la entrada y la lista cerrada de niveles de profundidad.
 */

const PROFUNDIDADES = ['breve', 'media', 'detallada'];

/** Cuerpo de POST /asistente/resumen. */
const resumenGenerarSchema = z.object({
  documento_id: z.string().uuid('El identificador del documento no es valido'),
  profundidad: z.enum(PROFUNDIDADES, {
    message: 'La profundidad debe ser breve, media o detallada',
  }).default('media'),
  guardar: z.boolean().default(true),
});

/** Parametro :documento_id de GET /asistente/resumen/:documento_id. */
const resumenDocumentoParamSchema = z.object({
  documento_id: z.string().uuid('El identificador del documento no es valido'),
});

module.exports = {
  PROFUNDIDADES,
  resumenGenerarSchema,
  resumenDocumentoParamSchema,
};
