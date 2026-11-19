/**
 * Controlador HTTP de la busqueda semantica (HU11).
 * Traduce la query validada a datos de dominio y responde con el sobre estandar.
 */
class BusquedaController {
  /**
   * @param {{ busquedaService: import('../services/busqueda.service') }} dependencies
   */
  constructor({ busquedaService }) {
    this.busquedaService = busquedaService;
  }

  buscar = async (req, res) => {
    const { q, documento_id, materia_id, limit } = req.validated.query;
    const { resultados, mensaje } = await this.busquedaService.buscar({
      consulta: q,
      documentoId: documento_id ?? null,
      materiaId: materia_id ?? null,
      limite: limit,
    });

    res.json({ success: true, data: resultados, meta: { mensaje } });
  };
}

module.exports = BusquedaController;
