const { z } = require('zod');

/**
 * Esquemas Zod para HU05: Calendario academico.
 * Valida forma y tipos; las reglas que dependen de la base de datos
 * (propiedad de la materia/tarea, existencia del evento) se validan en el servicio.
 */

const TIPOS_EVENTO = [
  'examen',
  'entrega',
  'clase',
  'estudio',
  'personal',
  'otro',
];

const CAMPOS_ORDEN = ['fecha_inicio', 'fecha_creacion', 'titulo'];
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

const fechaInicioSchema = z.coerce.date({ message: 'Fecha de inicio inválida' });
const fechaFinSchema = z.coerce.date().optional().nullable();

const recordatorioSchema = z.coerce.number().int().positive().max(10080).optional().nullable(); // max 7 días en minutos

function validarFechas(data) {
  if (!data.fecha_fin || !data.fecha_inicio) {
    return true;
  }
  return data.fecha_fin >= data.fecha_inicio;
}

const mensajeFechas = 'La fecha de fin no puede ser anterior a la fecha de inicio';

// Creación de evento
const eventoCrearSchema = z
  .object({
    materia_id: z.string().uuid('La materia seleccionada no es válida').optional().nullable(),
    tarea_id: z.string().uuid('La tarea seleccionada no es válida').optional().nullable(),
    titulo: tituloSchema,
    descripcion: descripcionSchema,
    tipo_evento: z.enum(TIPOS_EVENTO).default('otro'),
    fecha_inicio: fechaInicioSchema,
    fecha_fin: fechaFinSchema,
    recordatorio: recordatorioSchema,
  })
  .refine(validarFechas, { message: mensajeFechas, path: ['fecha_fin'] });

// Actualización completa o parcial de un evento
const eventoActualizarSchema = z
  .object({
    materia_id: z.string().uuid('La materia seleccionada no es válida').optional().nullable(),
    tarea_id: z.string().uuid('La tarea seleccionada no es válida').optional().nullable(),
    titulo: tituloSchema.optional(),
    descripcion: descripcionActualizarSchema,
    tipo_evento: z.enum(TIPOS_EVENTO).optional(),
    fecha_inicio: fechaInicioSchema.optional(),
    fecha_fin: fechaFinSchema,
    recordatorio: recordatorioSchema,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debes indicar al menos un campo para actualizar',
  })
  .refine(validarFechas, { message: mensajeFechas, path: ['fecha_fin'] });

// Filtros del listado
const eventoBusquedaSchema = z
  .object({
    materia_id: z.string().uuid('La materia seleccionada no es válida').optional(),
    tipo_evento: z.enum(TIPOS_EVENTO).optional(),
    desde: z.coerce.date({ message: 'Fecha desde inválida' }),
    hasta: z.coerce.date({ message: 'Fecha hasta inválida' }),
    query: z.string().trim().max(200).optional(),
    sort: z.enum(CAMPOS_ORDEN).default('fecha_inicio'),
    order: z.enum(DIRECCIONES_ORDEN).default('asc'),
    limit: z.coerce.number().int().positive().max(100).default(50),
    offset: z.coerce.number().int().nonnegative().default(0),
  })
  .refine((data) => !data.desde || !data.hasta || data.desde <= data.hasta, {
    message: 'La fecha inicial no puede ser posterior a la fecha final',
    path: ['desde'],
  });

// Eventos próximos
const eventosProximosSchema = z.object({
  dias: z.coerce.number().int().positive().max(30).default(7),
  limit: z.coerce.number().int().positive().max(50).default(10),
});

// Parámetro de ruta
const eventoIdParamSchema = z.object({
  id: z.string().uuid('ID de evento inválido'),
});

module.exports = {
  TIPOS_EVENTO,
  CAMPOS_ORDEN,
  DIRECCIONES_ORDEN,
  eventoCrearSchema,
  eventoActualizarSchema,
  eventoBusquedaSchema,
  eventosProximosSchema,
  eventoIdParamSchema,
};