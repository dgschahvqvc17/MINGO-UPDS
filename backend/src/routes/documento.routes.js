const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');

const router = Router();

router.use(authMiddleware);

// TODO Sprint 2 (HU07-HU11): carga, listado, descarga, procesamiento y busqueda semantica.

module.exports = router;
