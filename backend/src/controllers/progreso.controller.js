/**
 * Controlador HTTP del progreso academico (HU17). Traduce la respuesta del
 * servicio al sobre estandar de la API.
 */
class ProgresoController {
  constructor({ progresoService }) {
    this.progresoService = progresoService;
  }

  obtener = async (_req, res) => {
    const progreso = await this.progresoService.obtener();
    res.json({ success: true, data: progreso });
  };
}

module.exports = ProgresoController;
