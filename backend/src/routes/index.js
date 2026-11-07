/**
 * Router principal de la API REST de MINGO.
 * Los modulos se incorporan progresivamente por sprint.
 */
const { Router } = require('express');
const config = require('../config/environment');

const authRoutes = require('./auth.routes');
const usuarioRoutes = require('./usuario.routes');
const materiaRoutes = require('./materia.routes');
const tareaRoutes = require('./tarea.routes');
const calendarioRoutes = require('./calendario.routes');
const documentoRoutes = require('./documento.routes');
const estudioRoutes = require('./estudio.routes');
const asistenteRoutes = require('./asistente.routes');
const notificacionRoutes = require('./notificacion.routes');
const administracionRoutes = require('./administracion.routes');

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      service: 'MINGO API',
      status: 'ok',
      environment: config.env,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  });
});

router.use('/auth', authRoutes);
router.use('/usuarios', usuarioRoutes);
router.use('/materias', materiaRoutes);
router.use('/tareas', tareaRoutes);
router.use('/calendario', calendarioRoutes);
router.use('/documentos', documentoRoutes);
router.use('/estudio', estudioRoutes);
router.use('/asistente', asistenteRoutes);
router.use('/notificaciones', notificacionRoutes);
router.use('/admin', administracionRoutes);

module.exports = router;
