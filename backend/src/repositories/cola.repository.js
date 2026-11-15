/**
 * Acceso a Amazon SQS para encolar el procesamiento de documentos (HU09).
 * Solo envia mensajes: el consumo lo hace la Lambda procesadora.
 * No conoce HTTP ni reglas de negocio.
 */
const { SendMessageCommand } = require('@aws-sdk/client-sqs');
const config = require('../config/environment');

const TIPO_PROCESAR_DOCUMENTO = 'procesar_documento';

class ColaRepository {
  /**
   * @param {{ sqsClient: import('@aws-sdk/client-sqs').SQSClient | null, queueUrl?: string }} dependencies
   */
  constructor({ sqsClient, queueUrl = config.aws.sqsQueueUrl }) {
    this.sqsClient = sqsClient;
    this.queueUrl = queueUrl;
  }

  /**
   * Encola el procesamiento de un documento.
   * El mensaje lleva solo identificadores, nunca contenido ni credenciales.
   *
   * @param {{ documentoId: string, usuarioId: string, forzar?: boolean }} parametros
   * @returns {Promise<{ messageId: string | undefined }>}
   */
  async encolarProcesamiento({ documentoId, usuarioId, forzar = false }) {
    const cuerpo = JSON.stringify({
      tipo: TIPO_PROCESAR_DOCUMENTO,
      documentoId,
      usuarioId,
      forzar,
    });

    const respuesta = await this.requireClient().send(
      new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: cuerpo,
      }),
    );

    return { messageId: respuesta.MessageId };
  }

  /**
   * Indica si la cola esta configurada.
   * La capa de servicio responde 503 en lugar de fallar con un error criptico.
   *
   * @returns {boolean}
   */
  estaDisponible() {
    return Boolean(this.sqsClient && this.queueUrl);
  }

  requireClient() {
    if (!this.sqsClient) {
      throw new Error('Amazon SQS no esta configurado en el servidor.');
    }

    if (!this.queueUrl) {
      throw new Error('Falta AWS_SQS_QUEUE_URL para encolar el procesamiento.');
    }

    return this.sqsClient;
  }
}

module.exports = ColaRepository;
module.exports.TIPO_PROCESAR_DOCUMENTO = TIPO_PROCESAR_DOCUMENTO;
