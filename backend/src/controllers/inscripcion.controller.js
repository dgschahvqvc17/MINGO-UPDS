/** Capa HTTP de la administración de inscripciones por materia. */
class InscripcionController {
  constructor({ inscripcionService }) {
    this.inscripcionService = inscripcionService;
  }

  listar = async (req, res) => {
    const { materiaId } = req.validated.params;
    const filtros = req.validated.query ?? {};
    const resultado = await this.inscripcionService.listar(materiaId, filtros);

    res.json({
      success: true,
      data: resultado.items,
      meta: { total: resultado.total, limit: filtros.limit, offset: filtros.offset },
    });
  };

  inscribir = async (req, res) => {
    const { materiaId } = req.validated.params;
    const inscripcion = await this.inscripcionService.inscribir(
      materiaId,
      req.validated.body.usuario_id,
    );

    res.status(201).json({ success: true, data: inscripcion });
  };

  desinscribir = async (req, res) => {
    const { materiaId, usuarioId } = req.validated.params;
    const inscripcion = await this.inscripcionService.desinscribir(materiaId, usuarioId);

    res.json({ success: true, data: inscripcion });
  };
}

module.exports = InscripcionController;
