const { z } = require('zod');

/**
 * Esquemas Zod de HU15: propuesta y confirmacion de planes de estudio.
 * La propiedad de la materia y del plan se comprueba en el servicio; aqui solo
 * se valida la forma de la entrada.
 */

const DIAS_SEMANA = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
];

const TIPOS_SESION = ['lectura', 'practica', 'repaso', 'ejercicios'];

const MINIMO_OBJETIVO = 5;
const MAXIMO_OBJETIVO = 300;
const MINUTO_MINIMO_DIA = 15;
const MINUTO_MAXIMO_DIA = 480;
const MAXIMO_SESIONES = 30;
const MINIMO_TEMA = 2;
const MAXIMO_TEMA = 200;
const MAXIMO_ACTIVIDADES = 2000;

/** Cuerpo de POST /asistente/plan. */
const planGenerarSchema = z.object({
  materia_id: z.string().uuid('El identificador de la materia no es valido'),
  objetivo: z
    .string()
    .trim()
    .min(MINIMO_OBJETIVO, `El objetivo debe tener al menos ${MINIMO_OBJETIVO} caracteres`)
    .max(MAXIMO_OBJETIVO, `El objetivo puede tener como maximo ${MAXIMO_OBJETIVO} caracteres`),
  fecha_examen: z
    .string()
    .date('La fecha del examen debe tener el formato AAAA-MM-DD'),
  minutos_por_dia: z.coerce
    .number()
    .int()
    .min(MINUTO_MINIMO_DIA, `El minimo es ${MINUTO_MINIMO_DIA} minutos por dia`)
    .max(MINUTO_MAXIMO_DIA, `El maximo es ${MINUTO_MAXIMO_DIA} minutos por dia`),
  dias_disponibles: z
    .array(z.enum(DIAS_SEMANA))
    .min(1, 'Selecciona al menos un dia disponible')
    .max(DIAS_SEMANA.length)
    .refine((dias) => new Set(dias).size === dias.length, {
      message: 'Los dias disponibles no pueden repetirse',
    }),
});

/** Una sesion editada o confirmada por el estudiante. */
const sesionPlanSchema = z.object({
  tema: z
    .string()
    .trim()
    .min(MINIMO_TEMA, `El tema debe tener al menos ${MINIMO_TEMA} caracteres`)
    .max(MAXIMO_TEMA, `El tema puede tener como maximo ${MAXIMO_TEMA} caracteres`),
  actividades: z
    .string()
    .trim()
    .min(MINIMO_TEMA, `Las actividades deben tener al menos ${MINIMO_TEMA} caracteres`)
    .max(MAXIMO_ACTIVIDADES, `Las actividades pueden tener como maximo ${MAXIMO_ACTIVIDADES} caracteres`),
  fecha_inicio: z.string().datetime({ offset: true, message: 'La fecha de inicio debe ser ISO 8601 con zona horaria' }),
  duracion_minutos: z.coerce
    .number()
    .int()
    .min(5, 'La duracion minima por sesion es de 5 minutos')
    .max(MINUTO_MAXIMO_DIA, `La duracion maxima por sesion es de ${MINUTO_MAXIMO_DIA} minutos`),
  tipo: z.enum(TIPOS_SESION).optional(),
});

/** Cuerpo de POST /estudio/planes. */
const planConfirmarSchema = z.object({
  materia_id: z.string().uuid('El identificador de la materia no es valido'),
  objetivo: planGenerarSchema.shape.objetivo,
  fecha_examen: planGenerarSchema.shape.fecha_examen,
  minutos_por_dia: planGenerarSchema.shape.minutos_por_dia,
  dias_disponibles: planGenerarSchema.shape.dias_disponibles,
  modelo: z.string().trim().min(1).max(100).optional(),
  tokens_entrada: z.coerce.number().int().min(0).default(0),
  tokens_salida: z.coerce.number().int().min(0).default(0),
  sesiones: z
    .array(sesionPlanSchema)
    .min(1, 'El plan debe tener al menos una sesion')
    .max(MAXIMO_SESIONES, `El plan puede tener como maximo ${MAXIMO_SESIONES} sesiones`),
});

/** Query de GET /estudio/planes. */
const planListarQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Parametro :id de las rutas de planes. */
const planIdSchema = z.object({
  id: z.string().uuid('El identificador del plan no es valido'),
});

/** Cuerpo de PUT /estudio/planes/:id. */
const planActualizarSchema = z.object({
  objetivo: planGenerarSchema.shape.objetivo.optional(),
  fecha_examen: planGenerarSchema.shape.fecha_examen.optional(),
  minutos_por_dia: planGenerarSchema.shape.minutos_por_dia.optional(),
  dias_disponibles: planGenerarSchema.shape.dias_disponibles.optional(),
});

/** Cuerpo de POST /estudio/planes/:id/sesiones. */
const planAgregarSesionSchema = z.object({
  sesion: sesionPlanSchema,
});

/** Parametro :id de las rutas de sesiones. */
const sesionIdSchema = z.object({
  id: z.string().uuid('El identificador de la sesion no es valido'),
});

/** Cuerpo de PATCH /estudio/sesiones/:id. */
const sesionActualizarSchema = sesionPlanSchema.partial().extend({
  estado: z.enum(['pendiente', 'completada']).optional(),
});

module.exports = {
  DIAS_SEMANA,
  TIPOS_SESION,
  MINIMO_OBJETIVO,
  MAXIMO_OBJETIVO,
  MINUTO_MINIMO_DIA,
  MINUTO_MAXIMO_DIA,
  MAXIMO_SESIONES,
  planGenerarSchema,
  planListarQuerySchema,
  planConfirmarSchema,
  planIdSchema,
  planActualizarSchema,
  planAgregarSesionSchema,
  sesionIdSchema,
  sesionActualizarSchema,
};
