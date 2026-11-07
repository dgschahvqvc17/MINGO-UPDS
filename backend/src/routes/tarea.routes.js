const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');

const router = Router();

router.use(authMiddleware);

// TODO Sprint 1 (HU04): CRUD de tareas, filtros y cambio de estado.

module.exports = router;
