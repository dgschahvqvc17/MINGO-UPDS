/**
 * Publicacion en el unico topic SNS permitido por las reglas de AWS (HU18).
 * Si no hay topic configurado, la notificacion queda solo dentro de la
 * plataforma: se degrada sin fallar y sin reintentos.
 */
const { PublishCommand } = require('@aws-sdk/client-sns');

const ASUNTO = 'MINGO: recordatorio academico';

class CanalNotificacionRepository {
  /**
   * @param {{ snsClient: object | null, topicArn: string }} dependencies
   */
  constructor({ snsClient, topicArn }) {
    this.snsClient = snsClient;
    this.topicArn = topicArn;
  }

  get estaConfigurado() {
    return Boolean(this.snsClient && this.topicArn);
  }

  /**
   * @param {{ tipo: string, titulo: string, mensaje: string, fechaActividad: string, usuarioId: string }} notificacion
   * @returns {Promise<boolean>} true si se publico en SNS.
   */
  async publicar({ tipo, titulo, mensaje, fechaActividad, usuarioId }) {
    if (!this.estaConfigurado) {
      return false;
    }

    await this.snsClient.send(
      new PublishCommand({
        TopicArn: this.topicArn,
        Subject: ASUNTO,
        Message: JSON.stringify({
          tipo,
          titulo,
          mensaje,
          fecha_actividad: fechaActividad,
        }),
        MessageAttributes: {
          tipo: { DataType: 'String', StringValue: tipo },
          usuarioId: { DataType: 'String', StringValue: usuarioId },
        },
      }),
    );

    return true;
  }
}

module.exports = CanalNotificacionRepository;
module.exports.ASUNTO = ASUNTO;
