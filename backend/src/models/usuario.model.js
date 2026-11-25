const { z } = require('zod');
const { ROLES } = require('./roles.model');

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
  requiere_cambio_clave: z.boolean().optional(),
  roles: z.array(z.string()).min(1).max(5),
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
  rol: z.enum(ROLES).optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// Esquema para actualización de roles
const usuarioActualizarRolesSchema = z.object({
  roles: z.array(z.enum(ROLES))
    .min(1)
    .max(5)
    .refine(
      (roles) => !roles.includes('administrador') || roles.length === 1,
      { message: 'Un usuario no puede tener múltiples roles de administrador simultáneamente' }
    ),
});

// Alta administrativa de usuarios (HU02/HU-roles)
const usuarioCrearSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  apellido: z.string().trim().min(1).max(100),
  correo: z.string().trim().email().max(255),
  carrera: z.string().trim().max(100).optional().nullable(),
  rol: z.enum(ROLES),
  claveTemporal: z.string().min(8).max(72),
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
  usuarioCrearSchema,
  usuarioActualizarRolesSchema,
  usuarioActualizarEstadoSchema,
  usuarioIdParamSchema,
};