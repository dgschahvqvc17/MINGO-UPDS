/**
 * Controlador HTTP de notificaciones (HU18). Traduce la solicitud, invoca al
 * servicio y devuelve el formato estandar de respuesta. No consulta datos.
 */
class NotificacionController {
  constructor({ notificacionService }) {
    this.notificacionService = notificacionService;
  }

  listar = async (req, res) => {
    const { leida, tipo, page, limit } = req.validated.query;
    const resultado = await this.notificacionService.listar({ leida, tipo, page, limit });

    res.json({
      success: true,
      data: resultado.items,
      meta: resultado.meta,
    });
  };

  marcarLeida = async (req, res) => {
    const notificacion = await this.notificacionService.marcarLeida(req.validated.params.id);
    res.json({ success: true, data: notificacion });
  };

  marcarTodasLeidas = async (_req, res) => {
    const actualizadas = await this.notificacionService.marcarTodasLeidas();
    res.json({ success: true, data: { actualizadas } });
  };

  obtenerPreferencias = async (_req, res) => {
    const preferencias = await this.notificacionService.obtenerPreferencias();
    res.json({ success: true, data: preferencias });
  };

  actualizarPreferencias = async (req, res) => {
    const preferencias = await this.notificacionService.actualizarPreferencias(
      req.validated.body,
    );
    res.json({ success: true, data: preferencias });
  };
}

module.exports = NotificacionController;
