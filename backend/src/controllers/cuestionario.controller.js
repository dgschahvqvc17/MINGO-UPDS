/**
 * Controlador HTTP de cuestionarios academicos (HU13 y publicacion HU20).
 * Traduce HTTP -> servicio -> HTTP y responde con el sobre estandar.
 */
class CuestionarioController {
  /**
   * @param {{ cuestionarioService: import('../services/cuestionario.service') }} dependencies
   */
  constructor({ cuestionarioService }) {
    this.cuestionarioService = cuestionarioService;
  }

  generar = async (req, res) => {
    const { materia_id, documento_id, cantidad_preguntas, dificultad, tipos } =
      req.validated.body;

    const cuestionario = await this.cuestionarioService.generar({
      materiaId: materia_id,
      documentoId: documento_id ?? null,
      cantidadPreguntas: cantidad_preguntas,
      dificultad,
      tipos,
    });

    res.status(201).json({ success: true, data: cuestionario });
  };

  listar = async (req, res) => {
    const { limit, offset } = req.validated.query;
    const { items, total } = await this.cuestionarioService.listar({
      limite: limit,
      desplazamiento: offset,
    });

    res.status(200).json({
      success: true,
      data: items,
      meta: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  };

  listarDisponibles = async (req, res) => {
    const { limit, offset } = req.validated.query;
    const { items, total } = await this.cuestionarioService.listarDisponibles({
      limite: limit,
      desplazamiento: offset,
    });

    res.status(200).json({
      success: true,
      data: items,
      meta: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  };

  publicar = async (req, res) => {
    const { publicado, fecha_inicio, fecha_limite } = req.validated.body;
    const cuestionario = await this.cuestionarioService.publicar(
      req.validated.params.id,
      publicado,
      { fechaInicio: fecha_inicio, fechaLimite: fecha_limite },
    );

    res.status(200).json({ success: true, data: cuestionario });
  };

  listarCalificaciones = async (req, res) => {
    const { limit, offset } = req.validated.query;
    const { items, total } = await this.cuestionarioService.listarCalificaciones(
      req.validated.params.id,
      { limite: limit, desplazamiento: offset },
    );

    res.status(200).json({
      success: true,
      data: items,
      meta: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  };

  obtener = async (req, res) => {
    const cuestionario = await this.cuestionarioService.obtener(req.validated.params.id);
    res.status(200).json({ success: true, data: cuestionario });
  };

  eliminar = async (req, res) => {
    const { id } = req.validated.params;
    await this.cuestionarioService.eliminar(id);
    res.status(200).json({ success: true, data: { id } });
  };

  iniciarIntento = async (req, res) => {
    const intento = await this.cuestionarioService.iniciarIntento(req.validated.params.id);
    res.status(201).json({ success: true, data: intento });
  };

  responder = async (req, res) => {
    const resultado = await this.cuestionarioService.responder(
      req.validated.params.id,
      req.validated.body.respuestas,
    );

    res.status(200).json({ success: true, data: resultado });
  };

  obtenerIntento = async (req, res) => {
    const resultado = await this.cuestionarioService.obtenerResultadoIntento(
      req.validated.params.id,
    );

    res.status(200).json({ success: true, data: resultado });
  };

  listarIntentos = async (req, res) => {
    const { limit, offset } = req.validated.query;
    const { items, total } = await this.cuestionarioService.listarIntentos({
      limite: limit,
      desplazamiento: offset,
    });

    res.status(200).json({
      success: true,
      data: items,
      meta: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  };
}

module.exports = CuestionarioController;
