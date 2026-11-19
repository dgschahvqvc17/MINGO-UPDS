const { z } = require('zod');

/**
 * Esquemas Zod de HU14: generacion y estudio de tarjetas de memoria.
 * La propiedad de la materia, el documento, el conjunto y la tarjeta se
 * comprueba en el servicio; aqui solo se valida la forma de la entrada.
 */

const ESTADOS_TARJETA = ['sin_revisar', 'conocida', 'repaso'];

const MINIMO_TARJETAS = 5;
const MAXIMO_TARJETAS = 30;
const MAXIMO_CONJUNTOS_POR_PAGINA = 50;

/** Cuerpo de POST /asistente/tarjetas. */
const tarjetaGenerarSchema = z.object({
  materia_id: z.string().uuid('El identificador de la materia no es valido'),
  documento_id: z
    .string()
    .uuid('El identificador del documento no es valido')
    .nullable()
    .optional(),
  cantidad_tarjetas: z.coerce
    .number()
    .int()
    .min(MINIMO_TARJETAS, `El conjunto debe tener al menos ${MINIMO_TARJETAS} tarjetas`)
    .max(MAXIMO_TARJETAS, `El conjunto puede tener como maximo ${MAXIMO_TARJETAS} tarjetas`)
    .default(10),
});

/** Parametro :id de las rutas de conjuntos y tarjetas. */
const tarjetaParamSchema = z.object({
  id: z.string().uuid('El identificador no es valido'),
});

/** Query de GET /asistente/tarjetas/conjuntos. */
const conjuntoListarQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAXIMO_CONJUNTOS_POR_PAGINA)
    .default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Query de GET /asistente/tarjetas/conjuntos/:id. */
const conjuntoDetalleQuerySchema = z.object({
  estado: z.enum(['todas', 'pendientes'], {
    message: 'El filtro debe ser todas o pendientes',
  }).default('todas'),
});

/** Cuerpo de PATCH /asistente/tarjetas/:id/estado. */
const tarjetaEstadoSchema = z.object({
  estado: z.enum(ESTADOS_TARJETA, {
    message: 'El estado debe ser sin_revisar, conocida o repaso',
  }),
});

module.exports = {
  ESTADOS_TARJETA,
  MINIMO_TARJETAS,
  MAXIMO_TARJETAS,
  MAXIMO_CONJUNTOS_POR_PAGINA,
  tarjetaGenerarSchema,
  tarjetaParamSchema,
  conjuntoListarQuerySchema,
  conjuntoDetalleQuerySchema,
  tarjetaEstadoSchema,
};
