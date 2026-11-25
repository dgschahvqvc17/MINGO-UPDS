const { z } = require('zod');

/** Esquemas de autenticacion adicionales al registro publico. */
const cambiarClaveSchema = z
  .object({
    claveActual: z.string().min(8, 'La contraseña actual no es valida').max(72),
    claveNueva: z
      .string()
      .min(8, 'La contraseña nueva debe tener al menos 8 caracteres')
      .max(72, 'La contraseña nueva no puede exceder 72 caracteres'),
  })
  .refine(({ claveActual, claveNueva }) => claveActual !== claveNueva, {
    message: 'La contraseña nueva debe ser diferente de la actual',
    path: ['claveNueva'],
  });

module.exports = { cambiarClaveSchema };
