const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/roles.middleware');
const validationMiddleware = require('../middlewares/validation.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { ROLE_ADMINISTRADOR, ROLE_DOCENTE } = require('../models/roles.model');
const { createInscripcionService } = require('../container');
const InscripcionController = require('../controllers/inscripcion.controller');
const {
  inscripcionMateriaParamSchema,
  inscripcionUsuarioParamSchema,
  inscripcionCrearSchema,
  inscripcionBusquedaSchema,
} = require('../models/inscripcion.model');

const router = Router({ mergeParams: true });

router.use(authMiddleware, requireRole(ROLE_ADMINISTRADOR, ROLE_DOCENTE));

router.use((req, _res, next) => {
  try {
    req.inscripcionService = createInscripcionService(req.user.id, req.user.role);
    next();
  } catch (error) {
    next(error);
  }
});

function atender(accion) {
  return asyncHandler((req, res) => {
    const controller = new InscripcionController({ inscripcionService: req.inscripcionService });
    return controller[accion](req, res);
  });
}

router.get(
  '/',
  validationMiddleware({ params: inscripcionMateriaParamSchema, query: inscripcionBusquedaSchema }),
  atender('listar'),
);

router.post(
  '/',
  validationMiddleware({ params: inscripcionMateriaParamSchema, body: inscripcionCrearSchema }),
  atender('inscribir'),
);

router.delete(
  '/:usuarioId',
  validationMiddleware({ params: inscripcionUsuarioParamSchema }),
  atender('desinscribir'),
);

module.exports = router;
