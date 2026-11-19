/**
 * Controlador HTTP de tarjetas de memoria (HU14).
 * Traduce HTTP -> servicio -> HTTP y responde con el sobre estandar.
 */
class TarjetaController {
  /**
   * @param {{ tarjetaService: import('../services/tarjeta.service') }} dependencies
   */
  constructor({ tarjetaService }) {
    this.tarjetaService = tarjetaService;
  }

  generar = async (req, res) => {
    const { materia_id, documento_id, cantidad_tarjetas } = req.validated.body;

    const conjunto = await this.tarjetaService.generar({
      materiaId: materia_id,
      documentoId: documento_id ?? null,
      cantidadTarjetas: cantidad_tarjetas,
    });

    res.status(201).json({ success: true, data: conjunto });
  };

  listar = async (req, res) => {
    const { limit, offset } = req.validated.query;
    const { items, total } = await this.tarjetaService.listar({
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

  obtener = async (req, res) => {
    const conjunto = await this.tarjetaService.obtener(req.validated.params.id, {
      estado: req.validated.query.estado,
    });

    res.status(200).json({ success: true, data: conjunto });
  };

  eliminar = async (req, res) => {
    const { id } = req.validated.params;
    await this.tarjetaService.eliminar(id);
    res.status(200).json({ success: true, data: { id } });
  };

  actualizarEstado = async (req, res) => {
    const tarjeta = await this.tarjetaService.actualizarEstado(
      req.validated.params.id,
      req.validated.body.estado,
    );

    res.status(200).json({ success: true, data: tarjeta });
  };
}

module.exports = TarjetaController;
