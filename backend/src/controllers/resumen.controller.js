/**
 * Controlador HTTP de resumenes inteligentes (HU10).
 * Traduce HTTP -> servicio -> HTTP y responde con el sobre estandar.
 */
class ResumenController {
  /**
   * @param {{ resumenService: import('../services/resumen.service') }} dependencies
   */
  constructor({ resumenService }) {
    this.resumenService = resumenService;
  }

  generar = async (req, res) => {
    const resumen = await this.resumenService.generar(req.validated.body);

    res.status(200).json({ success: true, data: resumen });
  };

  obtenerGuardado = async (req, res) => {
    const resumen = await this.resumenService.obtenerGuardado(
      req.validated.params.documento_id,
    );

    res.status(200).json({ success: true, data: resumen });
  };
}

module.exports = ResumenController;
