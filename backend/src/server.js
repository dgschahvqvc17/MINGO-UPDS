/**
 * Punto de entrada del servidor HTTP.
 */
const app = require('./app');
const config = require('./config/environment');

const server = app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[MINGO] API escuchando en http://localhost:${config.port}${config.apiPrefix}`);
  // eslint-disable-next-line no-console
  console.log(`[MINGO] Entorno: ${config.env}`);
});

function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`[MINGO] ${signal} recibido. Cerrando servidor...`);
  server.close(() => {
    // eslint-disable-next-line no-console
    console.log('[MINGO] Servidor cerrado correctamente.');
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[MINGO] Promesa rechazada sin manejar:', reason);
});

module.exports = server;
