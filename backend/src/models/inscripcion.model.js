const { z } = require('zod');

const idMateriaSchema = z.string().uuid('ID de materia inválido');

const inscripcionMateriaParamSchema = z.object({ materiaId: idMateriaSchema });

const inscripcionUsuarioParamSchema = z.object({
  materiaId: idMateriaSchema,
  usuarioId: z.string().uuid('ID de estudiante inválido'),
});

const inscripcionCrearSchema = z.object({
  usuario_id: z.string().uuid('El estudiante seleccionado no es válido'),
});

const inscripcionBusquedaSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

module.exports = {
  inscripcionMateriaParamSchema,
  inscripcionUsuarioParamSchema,
  inscripcionCrearSchema,
  inscripcionBusquedaSchema,
};
