const { z } = require('zod');

/**
 * Esquemas Zod para validación de usuarios en el módulo de administración.
 * Según la tabla `perfiles` con campos adicionales de roles.
 */

// Esquema para la respuesta de listado de usuarios
const usuarioListadoSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1).max(100),
  apellido: z.string().min(1).max(100),
  correo: z.string().email().max(255),
  carrera: z.string().nullable(),
  estado: z.enum(['activo', 'inactivo']),
  fecha_creacion: z.string().datetime(),
  roles: z.array(z.string()).min(1).max(5), // ['administrador', 'estudiante']
});

// Esquema para la respuesta detallada de un usuario
const usuarioDetalleSchema = usuarioListadoSchema.extend({
  roles_detalle: z.array(z.object({
    id: z.number().int().positive(),
    nombre: z.string(),
    descripcion: z.string().nullable(),
  })).min(1).max(5),
});

// Esquema para búsqueda de usuarios
const usuarioBusquedaSchema = z.object({
  query: z.string().min(1).max(100).optional(),
  estado: z.enum(['activo', 'inactivo']).optional(),
  rol: z.enum(['administrador', 'estudiante']).optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});

// Esquema para actualización de roles
const usuarioActualizarRolesSchema = z.object({
  roles: z.array(z.enum(['administrador', 'estudiante']))
    .min(1)
    .max(5)
    .refine(
      (roles) => !roles.includes('administrador') || roles.length === 1,
      { message: 'Un usuario no puede tener múltiples roles de administrador simultáneamente' }
    ),
});

// Esquema para actualización de estado
const usuarioActualizarEstadoSchema = z.object({
  estado: z.enum(['activo', 'inactivo']),
});

// Esquema para validación de parámetros de ruta
const usuarioIdParamSchema = z.object({
  id: z.string().uuid(),
});

module.exports = {
  usuarioListadoSchema,
  usuarioDetalleSchema,
  usuarioBusquedaSchema,
  usuarioActualizarRolesSchema,
  usuarioActualizarEstadoSchema,
  usuarioIdParamSchema,
};