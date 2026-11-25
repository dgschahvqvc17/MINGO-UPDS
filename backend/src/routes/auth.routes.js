const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validation.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { authController, createCambioClaveController } = require('../container');
const { cambiarClaveSchema } = require('../models/auth.model');

const router = Router();

// El cierre de sesion lo realiza el frontend con supabase.auth.signOut(),
// que revoca el refresh token. No se expone un endpoint de logout.
router.get('/me', authMiddleware, asyncHandler(authController.me));
router.post(
  '/cambiar-clave',
  authMiddleware,
  validate({ body: cambiarClaveSchema }),
  asyncHandler((req, res) => createCambioClaveController().cambiar(req, res)),
);

module.exports = router;
