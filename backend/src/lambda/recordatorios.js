/**
 * Handler de la Lambda de recordatorios (HU18).
 * Lo invoca EventBridge Scheduler una vez por hora. Genera los avisos pendientes
 * y publica en SNS solo cuando el estudiante activo el canal de email.
 */
const { createRecordatoriosService } = require('../container');

const MAXIMO_USUARIOS_EN_EVENTO = 100;

/**
 * El schedule no necesita detalle; se admite una lista opcional para pruebas
 * controladas o ejecuciones dirigidas sin crear un schedule por estudiante.
 *
 * @param {unknown} evento
 * @returns {string[] | undefined}
 */
function extraerUsuarios(evento) {
  const usuarios = evento?.detail?.usuarios;
  if (!Array.isArray(usuarios)) {
    return undefined;
  }

  return usuarios.filter((usuario) => typeof usuario === 'string' && usuario.length > 0)
    .slice(0, MAXIMO_USUARIOS_EN_EVENTO);
}

/**
 * @param {{
 *   crearServicio?: () => import('../services/notificacion.service'),
 *   logger?: { info?: (mensaje: string, contexto: object) => void }
 * }} [dependencias]
 */
function crearHandler({
  crearServicio = createRecordatoriosService,
  logger = console,
} = {}) {
  return async (evento) => {
    const usuarios = extraerUsuarios(evento);
    const servicio = crearServicio();
    const resumen = await servicio.ejecutarRecordatorios({
      ahora: new Date(),
      usuarios,
    });

    logger.info?.('Recordatorios HU18 ejecutados', {
      usuarios: resumen.usuarios,
      creadas: resumen.creadas,
      duplicadas: resumen.duplicadas,
      enviadas: resumen.enviadas,
      erroresEnvio: resumen.erroresEnvio,
    });

    return resumen;
  };
}

const handler = crearHandler();

module.exports = {
  handler,
  crearHandler,
  extraerUsuarios,
  MAXIMO_USUARIOS_EN_EVENTO,
};
