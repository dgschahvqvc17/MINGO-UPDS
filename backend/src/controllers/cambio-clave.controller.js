/**
 * Capa HTTP del cambio obligatorio de contraseña temporal.
 */
class CambioClaveController {
  constructor({ cambioClaveService }) {
    this.cambioClaveService = cambioClaveService;
  }

  cambiar = async (req, res) => {
    const resultado = await this.cambioClaveService.cambiarClave({
      usuarioId: req.user.id,
      claveActual: req.validated.body.claveActual,
      claveNueva: req.validated.body.claveNueva,
    });

    res.json({ success: true, data: resultado });
  };
}

module.exports = CambioClaveController;
