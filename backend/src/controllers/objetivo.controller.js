/**
 * Controlador HTTP de objetivos academicos (HU17). Solo traduce req/res y
 * delega en el servicio; no contiene reglas de negocio ni acceso a datos.
 */
class ObjetivoController {
  constructor({ objetivoService }) {
    this.objetivoService = objetivoService;
  }

  listar = async (req, res) => {
    const { estado, limit, offset } = req.validated.query;
    const resultado = await this.objetivoService.listar({
      estado,
      limite: limit,
      desplazamiento: offset,
    });

    res.json({
      success: true,
      data: resultado.items,
      meta: { limit, offset, total: resultado.total },
    });
  };

  obtener = async (req, res) => {
    const objetivo = await this.objetivoService.obtener(req.validated.params.id);
    res.json({ success: true, data: objetivo });
  };

  crear = async (req, res) => {
    const { titulo, descripcion, materia_id, fecha_limite } = req.validated.body;
    const objetivo = await this.objetivoService.crear({
      titulo,
      descripcion,
      materiaId: materia_id,
      fechaLimite: fecha_limite,
    });

    res.status(201).json({ success: true, data: objetivo });
  };

  actualizar = async (req, res) => {
    const { titulo, descripcion, materia_id, fecha_limite, estado } = req.validated.body;
    const cambios = {};

    if (titulo !== undefined) cambios.titulo = titulo;
    if (descripcion !== undefined) cambios.descripcion = descripcion;
    if (Object.hasOwn(req.validated.body, 'materia_id')) cambios.materiaId = materia_id;
    if (Object.hasOwn(req.validated.body, 'fecha_limite')) cambios.fechaLimite = fecha_limite;
    if (estado !== undefined) cambios.estado = estado;

    const objetivo = await this.objetivoService.actualizar(req.validated.params.id, cambios);
    res.json({ success: true, data: objetivo });
  };

  eliminar = async (req, res) => {
    await this.objetivoService.eliminar(req.validated.params.id);
    res.status(204).end();
  };
}

module.exports = ObjetivoController;
