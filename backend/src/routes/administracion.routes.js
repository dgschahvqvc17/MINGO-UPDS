const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/roles.middleware');

const router = Router();

router.use(authMiddleware, requireRole('administrador'));

// TODO Sprint 1 (HU02): gestion de usuarios, roles, auditoria y estadisticas.

module.exports = router;
