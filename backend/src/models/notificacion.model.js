const { z } = require('zod');

/**
 * Esquemas Zod de HU18: historial de notificaciones y preferencias.
 * La propiedad de cada notificacion se comprueba en el servicio y en RLS;
 * aqui solo se valida la forma de la entrada.
 */

const TIPOS_NOTIFICACION = ['tarea', 'evaluacion', 'sesion'];
const ANTICIPACION_MINIMA = 5;
const ANTICIPACION_MAXIMA = 10080;
const IDIOMAS_PERMITIDOS = ['es'];

const uuidSchema = z.string().uuid('El identificador no es valido');

const zonaHorariaSchema = z
  .string()
  .trim()
  .min(3, 'La zona horaria no puede estar vacia')
  .max(64, 'La zona horaria no puede exceder 64 caracteres')
  .refine((valor) => {
    try {
      new Intl.DateTimeFormat('es', { timeZone: valor });
      return true;
    } catch {
      return false;
    }
  }, 'La zona horaria no es valida');

const notificacionIdSchema = z.object({
  id: uuidSchema,
});

const notificacionListaQuerySchema = z.object({
  leida: z.enum(['true', 'false']).optional(),
  tipo: z.enum(TIPOS_NOTIFICACION).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const preferenciasActualizarSchema = z
  .object({
    notificaciones_activas: z.boolean(),
    anticipacion_minutos: z.coerce
      .number()
      .int()
      .min(ANTICIPACION_MINIMA, `La anticipacion minima es ${ANTICIPACION_MINIMA} minutos`)
      .max(ANTICIPACION_MAXIMA, `La anticipacion maxima es ${ANTICIPACION_MAXIMA} minutos`),
    canal_email: z.boolean(),
    zona_horaria: zonaHorariaSchema,
    idioma: z.enum(IDIOMAS_PERMITIDOS),
  })
  .partial()
  .refine((cambios) => Object.keys(cambios).length > 0, {
    message: 'Debes indicar al menos una preferencia para actualizar',
  });

module.exports = {
  TIPOS_NOTIFICACION,
  ANTICIPACION_MINIMA,
  ANTICIPACION_MAXIMA,
  notificacionIdSchema,
  notificacionListaQuerySchema,
  preferenciasActualizarSchema,
};
