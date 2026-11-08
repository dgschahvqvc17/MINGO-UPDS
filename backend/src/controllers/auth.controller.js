/**
 * Capa HTTP del modulo de autenticacion.
 * El usuario lo resuelve authMiddleware; aqui solo se responde.
 */
class AuthController {
  me = (req, res) => {
    res.json({ success: true, data: req.user });
  };
}

module.exports = AuthController;
