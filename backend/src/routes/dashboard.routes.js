const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { createDashboardService, createDashboardController } = require('../container');

const router = Router();

/**
 * Rutas del panel principal académico (HU06).
 * Todas requieren autenticación y RLS: cada usuario ve solo su información.
 */
router.use(authMiddleware);

/**
 * Inyecta el servicio con el cliente del usuario autenticado.
 */
router.use((req, _res, next) => {
  try {
    req.dashboardService = createDashboardService(req.user.id, req.accessToken);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * GET /dashboard
 * Devuelve el resumen académico del usuario autenticado.
 */
router.get(
  '/',
  asyncHandler((req, res) =>
    createDashboardController(req.dashboardService).obtenerResumen(req, res),
  ),
);

module.exports = router;
