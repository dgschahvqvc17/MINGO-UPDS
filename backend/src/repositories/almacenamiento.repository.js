/**
 * Acceso a Amazon S3 para los documentos academicos (HU07).
 * Solo firma URLs de subida y lee metadatos del objeto; nunca mueve bytes
 * a traves de la API, para no gastar tiempo ni ancho de banda en Lambda.
 * No conoce HTTP ni reglas de negocio.
 */
const { PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config/environment');

const SEGUNDOS_POR_DEFECTO = 900;

class AlmacenamientoRepository {
  /**
   * @param {{ s3Client: import('@aws-sdk/client-s3').S3Client | null, bucket?: string }} dependencies
   */
  constructor({ s3Client, bucket = config.aws.s3Bucket }) {
    this.s3Client = s3Client;
    this.bucket = bucket;
  }

  /**
   * Firma una URL de subida directa a S3.
   *
   * @param {{ ruta: string, tipoArchivo: string, expiresInSeconds?: number }} parametros
   * @returns {Promise<string>} URL prefirmada.
   */
  async crearUrlCarga({ ruta, tipoArchivo, expiresInSeconds = SEGUNDOS_POR_DEFECTO }) {
    const comando = new PutObjectCommand({
      Bucket: this.bucket,
      Key: ruta,
      ContentType: tipoArchivo,
    });

    return getSignedUrl(this.requireClient(), comando, { expiresIn: expiresInSeconds });
  }

  /**
   * Lee los metadatos reales del objeto. Devuelve null si no existe.
   * El tamano y el tipo reales se toman de aqui: nunca del cliente.
   *
   * @param {string} ruta Clave del objeto en S3.
   * @returns {Promise<{ tamano: number, tipoArchivo: string } | null>}
   */
  async obtenerMetadatos(ruta) {
    try {
      const respuesta = await this.requireClient().send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: ruta }),
      );

      return {
        tamano: Number(respuesta.ContentLength ?? 0),
        tipoArchivo: respuesta.ContentType ?? 'application/octet-stream',
      };
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return null;
      }

      throw error;
    }
  }

  /**
   * Indica si el cliente de S3 esta configurado.
   * La capa de servicio usa esto para responder 503 en lugar de fallar
   * con un error criptico cuando faltan credenciales o bucket.
   *
   * @returns {boolean}
   */
  estaDisponible() {
    return Boolean(this.s3Client && this.bucket);
  }

  requireClient() {
    if (!this.s3Client) {
      throw new Error('Amazon S3 no esta configurado en el servidor.');
    }

    return this.s3Client;
  }
}

module.exports = AlmacenamientoRepository;
