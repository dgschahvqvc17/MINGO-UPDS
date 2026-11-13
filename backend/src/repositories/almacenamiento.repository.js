/**
 * Acceso a Amazon S3 para los documentos academicos (HU07 y HU08).
 * Firma URLs de subida y descarga, lee metadatos y elimina objetos; nunca
 * mueve bytes a traves de la API, para no gastar tiempo ni ancho de banda en Lambda.
 * No conoce HTTP ni reglas de negocio.
 */
const {
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config/environment');

const SEGUNDOS_POR_DEFECTO = 900;

/**
 * Construye una cabecera Content-Disposition segura: una version ASCII para
 * navegadores antiguos y la version UTF-8 para conservar tildes y enes.
 *
 * @param {string} nombreArchivo
 * @returns {string}
 */
function construirContentDisposition(nombreArchivo) {
  const nombre = String(nombreArchivo || 'documento');
  const ascii = nombre.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`;
}

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
   * Firma una URL de descarga directa desde S3.
   * La respuesta fuerza la descarga con el nombre original del archivo.
   *
   * @param {{ ruta: string, nombreArchivo: string, expiresInSeconds?: number }} parametros
   * @returns {Promise<string>} URL prefirmada.
   */
  async crearUrlDescarga({ ruta, nombreArchivo, expiresInSeconds = SEGUNDOS_POR_DEFECTO }) {
    const comando = new GetObjectCommand({
      Bucket: this.bucket,
      Key: ruta,
      ResponseContentDisposition: construirContentDisposition(nombreArchivo),
    });

    return getSignedUrl(this.requireClient(), comando, { expiresIn: expiresInSeconds });
  }

  /**
   * Elimina un objeto de S3. Es idempotente: un objeto inexistente no es error.
   *
   * @param {string} ruta Clave del objeto en S3.
   * @returns {Promise<boolean>} true si existia y se elimino, false si no existia.
   */
  async eliminarObjeto(ruta) {
    try {
      await this.requireClient().send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: ruta }),
      );

      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
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
