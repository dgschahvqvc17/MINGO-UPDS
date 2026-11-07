const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');

const router = Router();

router.use(authMiddleware);

// TODO Sprint 1 (HU05): CRUD de eventos del calendario academico.

module.exports = router;
