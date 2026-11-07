const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');

const router = Router();

router.use(authMiddleware);

// TODO Sprint 3 (HU18): listado, lectura y configuracion de notificaciones.

module.exports = router;
