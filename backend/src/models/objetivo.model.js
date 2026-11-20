const { z } = require('zod');

/**
 * Esquemas Zod de HU17: objetivos academicos y progreso.
 * La forma se valida aqui; la propiedad de la materia se comprueba en el
 * servicio y en la politica RLS de la tabla.
 */

const ESTADOS_OBJETIVO = ['pendiente', 'en_progreso', 'completada'];

const MINIMO_TITULO = 5;
const MAXIMO_TITULO = 150;
const MAXIMO_DESCRIPCION = 1000;

const tituloSchema = z
  .string()
  .trim()
  .min(MINIMO_TITULO, `El titulo debe tener al menos ${MINIMO_TITULO} caracteres`)
  .max(MAXIMO_TITULO, `El titulo puede tener como maximo ${MAXIMO_TITULO} caracteres`);

const descripcionSchema = z
  .string()
  .trim()
  .max(MAXIMO_DESCRIPCION, `La descripcion puede tener como maximo ${MAXIMO_DESCRIPCION} caracteres`);

const materiaIdSchema = z
  .string()
  .uuid('El identificador de la materia no es valido')
  .nullable()
  .optional();

const fechaLimiteSchema = z
  .string()
  .date('La fecha limite debe tener el formato AAAA-MM-DD')
  .nullable()
  .optional();

/** Cuerpo de POST /estudio/objetivos. */
const objetivoCrearSchema = z.object({
  titulo: tituloSchema,
  descripcion: descripcionSchema.optional(),
  materia_id: materiaIdSchema,
  fecha_limite: fechaLimiteSchema,
});

/** Cuerpo de PUT /estudio/objetivos/:id. */
const objetivoActualizarSchema = z
  .object({
    titulo: tituloSchema.optional(),
    descripcion: descripcionSchema.nullable().optional(),
    materia_id: materiaIdSchema,
    fecha_limite: fechaLimiteSchema,
    estado: z.enum(ESTADOS_OBJETIVO).optional(),
  })
  .refine(
    (datos) => Object.values(datos).some((valor) => valor !== undefined),
    { message: 'Se requiere al menos un campo para actualizar' },
  );

/** Query de GET /estudio/objetivos. */
const objetivoListarQuerySchema = z.object({
  estado: z.enum(ESTADOS_OBJETIVO).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Parametro :id de las rutas de objetivos. */
const objetivoIdSchema = z.object({
  id: z.string().uuid('El identificador del objetivo no es valido'),
});

module.exports = {
  ESTADOS_OBJETIVO,
  objetivoCrearSchema,
  objetivoActualizarSchema,
  objetivoListarQuerySchema,
  objetivoIdSchema,
};
