const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');

const router = Router();

router.use(authMiddleware);

// TODO Sprint 1 (HU03): CRUD de materias y unidades.

module.exports = router;
