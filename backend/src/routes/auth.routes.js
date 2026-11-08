const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { authController } = require('../container');

const router = Router();

// El cierre de sesion lo realiza el frontend con supabase.auth.signOut(),
// que revoca el refresh token. No se expone un endpoint de logout.
router.get('/me', authMiddleware, asyncHandler(authController.me));

module.exports = router;
