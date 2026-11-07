const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');

const router = Router();

router.use(authMiddleware);

// TODO Sprint 3 (HU15, HU17): planes de estudio, sesiones y progreso.

module.exports = router;
