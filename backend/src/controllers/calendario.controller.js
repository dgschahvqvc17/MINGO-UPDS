/**
 * Controlador HTTP de eventos del calendario académico (HU05).
 * Traduce HTTP -> servicio -> HTTP y responde con el sobre estándar.
 * La validación de entrada se realiza en el middleware de rutas.
 */
class CalendarioController {
  /**
   * @param {{ calendarioService: import('../services/calendario.service') }} dependencies
   */
  constructor({ calendarioService }) {
    this.calendarioService = calendarioService;
  }

  listarEventos = async (req, res) => {
    const filtros = req.validated?.query ?? req.query;
    const { eventos, paginacion } = await this.calendarioService.listarEventos(filtros);

    res.status(200).json({
      success: true,
      data: eventos,
      meta: { paginacion },
    });
  };

  listarProximos = async (req, res) => {
    const filtros = req.validated?.query ?? req.query;
    const { eventos, rango } = await this.calendarioService.listarProximos(filtros);

    res.status(200).json({
      success: true,
      data: eventos,
      meta: {
        total: eventos.length,
        rango,
      },
    });
  };

  obtenerEvento = async (req, res) => {
    const { id: eventoId } = req.validated.params;
    const evento = await this.calendarioService.obtenerEvento(eventoId);

    res.status(200).json({
      success: true,
      data: evento,
    });
  };

  crearEvento = async (req, res) => {
    const evento = await this.calendarioService.crearEvento(req.validated.body);

    res.status(201).json({
      success: true,
      message: 'Evento creado exitosamente.',
      data: evento,
    });
  };

  actualizarEvento = async (req, res) => {
    const { id: eventoId } = req.validated.params;
    const evento = await this.calendarioService.actualizarEvento(eventoId, req.validated.body);

    res.status(200).json({
      success: true,
      message: 'Evento actualizado exitosamente.',
      data: evento,
    });
  };

  eliminarEvento = async (req, res) => {
    const { id: eventoId } = req.validated.params;
    await this.calendarioService.eliminarEvento(eventoId);

    res.status(200).json({
      success: true,
      message: 'Evento eliminado exitosamente.',
      data: { id: eventoId },
    });
  };
}

module.exports = CalendarioController;