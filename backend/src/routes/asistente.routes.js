const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');

const router = Router();

router.use(authMiddleware);

// TODO Sprint 2-3 (HU10-HU16): chat RAG, resumenes, cuestionarios, tutor y evaluador.

module.exports = router;
