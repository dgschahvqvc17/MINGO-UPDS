const { z } = require('zod');

/**
 * Esquemas Zod para HU04: gestionar tareas y actividades académicas.
 * Valida forma y tipos; las reglas que dependen de la base de datos
 * (propiedad de la materia, existencia de la tarea) se validan en el servicio.
 */

const TIPOS_TAREA = [
  'tarea',
  'taller',
  'parcial',
  'examen',
  'proyecto',
  'exposicion',
  'laboratorio',
  'practica',
  'otro',
];

const ESTADOS_TAREA = ['pendiente', 'en_progreso', 'completada'];
const PRIORIDADES_TAREA = ['baja', 'media', 'alta'];
const CAMPOS_ORDEN = ['fecha_entrega', 'fecha_creacion', 'titulo'];
const DIRECCIONES_ORDEN = ['asc', 'desc'];

const tituloSchema = z
  .string()
  .trim()
  .min(3, 'El título debe tener al menos 3 caracteres')
  .max(200, 'El título no puede exceder 200 caracteres');

const descripcionSchema = z
  .string()
  .trim()
  .max(2000, 'La descripción no puede exceder 2000 caracteres')
  .optional()
  .nullable()
  .default(null);

const descripcionActualizarSchema = z
  .string()
  .trim()
  .max(2000, 'La descripción no puede exceder 2000 caracteres')
  .optional()
  .nullable();

const fechaAsignacionSchema = z.coerce.date().optional();
const fechaEntregaSchema = z.coerce.date().optional().nullable();

function validarFechas(data) {
  if (!data.fecha_entrega || !data.fecha_asignacion) {
    return true;
  }

  return data.fecha_entrega >= data.fecha_asignacion;
}

const mensajeFechas = 'La fecha de entrega no puede ser anterior a la fecha de asignación';

// Creación de tarea
const tareaCrearSchema = z
  .object({
    materia_id: z.string().uuid('La materia seleccionada no es válida'),
    titulo: tituloSchema,
    descripcion: descripcionSchema,
    tipo: z.enum(TIPOS_TAREA).default('tarea'),
    prioridad: z.enum(PRIORIDADES_TAREA).default('media'),
    fecha_asignacion: fechaAsignacionSchema,
    fecha_entrega: fechaEntregaSchema,
    estado: z.enum(ESTADOS_TAREA).default('pendiente'),
  })
  .refine(validarFechas, { message: mensajeFechas, path: ['fecha_entrega'] });

// Actualización completa o parcial de una tarea
const tareaActualizarSchema = z
  .object({
    materia_id: z.string().uuid('La materia seleccionada no es válida').optional(),
    titulo: tituloSchema.optional(),
    descripcion: descripcionActualizarSchema,
    tipo: z.enum(TIPOS_TAREA).optional(),
    prioridad: z.enum(PRIORIDADES_TAREA).optional(),
    fecha_asignacion: fechaAsignacionSchema,
    fecha_entrega: fechaEntregaSchema,
    estado: z.enum(ESTADOS_TAREA).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debes indicar al menos un campo para actualizar',
  })
  .refine(validarFechas, { message: mensajeFechas, path: ['fecha_entrega'] });

// Cambio de estado
const tareaEstadoSchema = z.object({
  estado: z.enum(ESTADOS_TAREA),
});

// Filtros del listado
const tareaBusquedaSchema = z
  .object({
    materia_id: z.string().uuid('La materia seleccionada no es válida').optional(),
    estado: z.enum(ESTADOS_TAREA).optional(),
    prioridad: z.enum(PRIORIDADES_TAREA).optional(),
    tipo: z.enum(TIPOS_TAREA).optional(),
    query: z.string().trim().max(200).optional(),
    desde: z.coerce.date().optional(),
    hasta: z.coerce.date().optional(),
    vencidas: z.enum(['true', 'false']).optional(),
    sort: z.enum(CAMPOS_ORDEN).default('fecha_entrega'),
    order: z.enum(DIRECCIONES_ORDEN).default('asc'),
    limit: z.coerce.number().int().positive().max(100).default(20),
    offset: z.coerce.number().int().nonnegative().default(0),
  })
  .refine((data) => !data.desde || !data.hasta || data.desde <= data.hasta, {
    message: 'La fecha inicial no puede ser posterior a la fecha final',
    path: ['desde'],
  });

// Tareas próximas a vencer
const tareasProximasSchema = z.object({
  dias: z.coerce.number().int().positive().max(30).default(7),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

// Parámetro de ruta
const tareaIdParamSchema = z.object({
  id: z.string().uuid('ID de tarea inválido'),
});

module.exports = {
  TIPOS_TAREA,
  ESTADOS_TAREA,
  PRIORIDADES_TAREA,
  CAMPOS_ORDEN,
  DIRECCIONES_ORDEN,
  tareaCrearSchema,
  tareaActualizarSchema,
  tareaEstadoSchema,
  tareaBusquedaSchema,
  tareasProximasSchema,
  tareaIdParamSchema,
};
