const { z } = require('zod');

/**
 * Esquemas Zod para validación de materias académicas.
 * Según los requerimientos de HU03: Gestionar materias académicas.
 */

// Lista de colores disponibles para identificación visual
const COLORES_DISPONIBLES = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
  '#F97316', // orange-500
  '#6366F1', // indigo-500
];

// Esquema para creación de materia
const materiaCrearSchema = z.object({
  nombre: z.string()
    .min(1, 'El nombre de la materia es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres')
    .trim(),
  codigo: z.string()
    .min(1, 'El código de la asignatura es requerido')
    .max(20, 'El código no puede exceder 20 caracteres')
    .regex(/^[A-Z0-9-]+$/, 'El código debe contener solo letras mayúsculas, números y guiones')
    .trim()
    .toUpperCase(),
  docente: z.string()
    .min(1, 'El nombre del docente es requerido')
    .max(100, 'El nombre del docente no puede exceder 100 caracteres')
    .trim(),
  descripcion: z.string()
    .max(500, 'La descripción no puede exceder 500 caracteres')
    .trim()
    .optional()
    .nullable()
    .default(null),
  periodo_academico: z.string()
    .min(1, 'El periodo académico es requerido')
    .max(10, 'El periodo académico no puede exceder 10 caracteres')
    .regex(/^\d{4}-[12]$/, 'El periodo debe tener el formato: AÑO-SEMESTRE (ej: 2024-1)')
    .trim(),
  color: z.string()
    .regex(/^#[0-9A-F]{6}$/i, 'El color debe ser un código hexadecimal válido (ej: #3B82F6)')
    .default('#3B82F6'),
});

// Esquema para actualización de materia
const materiaActualizarSchema = materiaCrearSchema.partial().extend({
  estado: z.enum(['activo', 'archivado']).optional(),
});

// Esquema para respuesta de listado de materias
const materiaListadoSchema = z.object({
  id: z.string().uuid(),
  usuario_id: z.string().uuid(),
  nombre: z.string(),
  codigo: z.string(),
  docente: z.string(),
  descripcion: z.string().nullable(),
  periodo_academico: z.string(),
  color: z.string(),
  estado: z.enum(['activo', 'archivado']),
  fecha_creacion: z.string().datetime(),
  fecha_actualizacion: z.string().datetime().nullable(),
});

// Esquema para respuesta detallada de materia
const materiaDetalleSchema = materiaListadoSchema.extend({
  // Podemos extender con información adicional si es necesario
  estadisticas: z.object({
    total_tareas: z.number().int().nonnegative().default(0),
    tareas_pendientes: z.number().int().nonnegative().default(0),
    total_documentos: z.number().int().nonnegative().default(0),
  }).optional(),
});

// Esquema para búsqueda/filtrado de materias
const materiaBusquedaSchema = z.object({
  query: z.string().min(1).max(100).optional(),
  periodo_academico: z.string().optional(),
  estado: z.enum(['activo', 'archivado']).optional(),
  limit: z.number().int().positive().max(50).default(20),
  offset: z.number().int().nonnegative().default(0),
});

// Esquema para validación de parámetros de ruta
const materiaIdParamSchema = z.object({
  id: z.string().uuid('ID de materia inválido'),
});

// Esquema para cambio de estado (activar/archivar)
const materiaCambiarEstadoSchema = z.object({
  estado: z.enum(['activo', 'archivado'], {
    required_error: 'El estado es requerido',
    invalid_type_error: 'El estado debe ser "activo" o "archivado"',
  }),
});

// Esquema para estadísticas de materias
const materiaEstadisticasSchema = z.object({
  total: z.number().int().nonnegative(),
  activas: z.number().int().nonnegative(),
  archivadas: z.number().int().nonnegative(),
  por_periodo: z.record(z.number().int().nonnegative()),
});

module.exports = {
  materiaCrearSchema,
  materiaActualizarSchema,
  materiaListadoSchema,
  materiaDetalleSchema,
  materiaBusquedaSchema,
  materiaIdParamSchema,
  materiaCambiarEstadoSchema,
  materiaEstadisticasSchema,
  COLORES_DISPONIBLES,
};