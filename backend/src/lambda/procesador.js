/**
 * Handler de la Lambda procesadora de documentos (HU09).
 * Acepta dos origenes:
 *   - Mensajes internos de la API: { tipo: 'procesar_documento', ... }.
 *   - Eventos de S3 enviados directamente a SQS.
 * Devuelve batchItemFailures para que SQS reintente solo los mensajes fallidos.
 */
const { createProcesamientoService } = require('../container');

const TIPO_PROCESAR_DOCUMENTO = 'procesar_documento';

/**
 * S3 codifica la clave en la URL del evento; se decodifica antes de usarla.
 *
 * @param {string} clave
 * @returns {string}
 */
function decodificarClave(clave) {
  return decodeURIComponent(String(clave).replace(/\+/g, ' '));
}

/**
 * @param {string} cuerpo Mensaje de SQS.
 * @returns {Array<object>} Tareas a ejecutar.
 */
function extraerTareas(cuerpo) {
  let evento;

  try {
    evento = JSON.parse(cuerpo);
  } catch {
    throw new Error('Mensaje de SQS con JSON invalido.');
  }

  if (evento?.tipo === TIPO_PROCESAR_DOCUMENTO) {
    if (!evento.documentoId || !evento.usuarioId) {
      throw new Error('Mensaje de procesamiento sin documentoId o usuarioId.');
    }

    return [
      {
        tipo: TIPO_PROCESAR_DOCUMENTO,
        documentoId: String(evento.documentoId),
        usuarioId: String(evento.usuarioId),
        forzar: Boolean(evento.forzar),
      },
    ];
  }

  const registros = Array.isArray(evento?.Records) ? evento.Records : [];

  return registros
    .filter((registro) => registro?.s3?.object?.key)
    .map((registro) => ({
      tipo: 's3',
      ruta: decodificarClave(registro.s3.object.key),
      forzar: false,
    }))
    .filter((tarea) => tarea.ruta.startsWith('usuarios/'));
}

/**
 * Crea el handler con dependencias inyectables para las pruebas.
 *
 * @param {{ crearServicio?: () => { procesarDocumento: Function, procesarPorRuta: Function }, logger?: Pick<Console, 'error' | 'warn'> }} [dependencias]
 * @returns {(evento: { Records?: Array<{ messageId: string, body: string }> }) => Promise<{ batchItemFailures: Array<{ itemIdentifier: string }> }>}
 */
function crearHandler({
  crearServicio = createProcesamientoService,
  logger = console,
} = {}) {
  return async (evento) => {
    const registros = Array.isArray(evento?.Records) ? evento.Records : [];

    if (registros.length === 0) {
      return { batchItemFailures: [] };
    }

    const servicio = crearServicio();
    const fallos = [];

    for (const registro of registros) {
      try {
        const tareas = extraerTareas(registro.body);

        for (const tarea of tareas) {
          if (tarea.tipo === 's3') {
            await servicio.procesarPorRuta(tarea.ruta, { forzar: tarea.forzar });
          } else {
            await servicio.procesarDocumento(tarea);
          }
        }
      } catch (error) {
        logger.error('Fallo al procesar un mensaje de la cola.', {
          messageId: registro.messageId,
          message: error?.message,
        });
        fallos.push({ itemIdentifier: registro.messageId });
      }
    }

    return { batchItemFailures: fallos };
  };
}

const handler = crearHandler();

module.exports = {
  handler,
  crearHandler,
  extraerTareas,
  decodificarClave,
};
