/**
 * Controlador HTTP del panel principal académico (HU06).
 * Traduce HTTP -> servicio -> HTTP y responde con el sobre estándar.
 */
class DashboardController {
  /**
   * @param {{ dashboardService: import('../services/dashboard.service') }} dependencies
   */
  constructor({ dashboardService }) {
    this.dashboardService = dashboardService;
  }

  obtenerResumen = async (_req, res) => {
    const resumen = await this.dashboardService.obtenerResumen();

    res.status(200).json({
      success: true,
      data: resumen,
    });
  };
}

module.exports = DashboardController;
