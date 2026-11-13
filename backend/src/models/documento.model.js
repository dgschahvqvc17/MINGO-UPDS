const { z } = require('zod');
const config = require('../config/environment');

/**
 * Esquemas Zod para HU07: cargar documentos academicos.
 * Valida forma, formato y tamano; la propiedad de la materia y de la clave
 * del objeto se verifican en el servicio.
 */

const EXTENSIONES_POR_MIME = {
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/plain': ['.txt'],
};

const MAXIMO_BYTES = config.uploads.maxFileSizeBytes;
const MAXIMO_MB = Math.round(MAXIMO_BYTES / (1024 * 1024));
const LARGO_MAXIMO_NOMBRE = 255;

const patronRuta = /^usuarios\/[0-9a-fA-F-]{36}\/documentos\/[0-9a-fA-F-]{36}\/[^/\\]+$/;

function obtenerExtension(nombreArchivo) {
  const posicionPunto = nombreArchivo.lastIndexOf('.');
  return posicionPunto > 0 ? nombreArchivo.slice(posicionPunto).toLowerCase() : '';
}

const nombreArchivoSchema = z
  .string()
  .trim()
  .min(3, 'El nombre del archivo debe tener al menos 3 caracteres')
  .max(LARGO_MAXIMO_NOMBRE, `El nombre del archivo no puede exceder ${LARGO_MAXIMO_NOMBRE} caracteres`);

const tipoArchivoSchema = z
  .string()
  .trim()
  .refine((tipo) => config.uploads.allowedMimeTypes.includes(tipo), {
    message: 'Formato no permitido. Se aceptan PDF, DOC, DOCX, PPT, PPTX y TXT',
  });

const tamanoSchema = z.coerce
  .number()
  .int('El tamano debe ser un numero entero de bytes')
  .positive('El archivo esta vacio')
  .max(MAXIMO_BYTES, `El archivo no puede superar ${MAXIMO_MB} MB`);

const materiaIdSchema = z.string().uuid('La materia seleccionada no es valida');
const unidadIdSchema = z.string().uuid('La unidad seleccionada no es valida').optional().nullable().default(null);

/**
 * Cuerpo de POST /documentos/url-carga.
 */
const documentoUrlCargaSchema = z
  .object({
    nombre_archivo: nombreArchivoSchema,
    tipo_archivo: tipoArchivoSchema,
    tamano: tamanoSchema,
    materia_id: materiaIdSchema,
  })
  .refine(
    ({ nombre_archivo, tipo_archivo }) =>
      (EXTENSIONES_POR_MIME[tipo_archivo] ?? []).includes(obtenerExtension(nombre_archivo)),
    {
      message: 'La extension del archivo no coincide con el tipo declarado',
      path: ['nombre_archivo'],
    },
  );

/**
 * Cuerpo de POST /documentos, tras subir el archivo a S3.
 */
const documentoRegistroSchema = z.object({
  objectKey: z
    .string()
    .trim()
    .min(1, 'La clave del objeto es obligatoria')
    .max(1024, 'La clave del objeto es demasiado larga')
    .regex(patronRuta, 'La clave del objeto no tiene un formato valido'),
  nombre: z
    .string()
    .trim()
    .min(3, 'El nombre del documento debe tener al menos 3 caracteres')
    .max(LARGO_MAXIMO_NOMBRE, `El nombre del documento no puede exceder ${LARGO_MAXIMO_NOMBRE} caracteres`),
  materia_id: materiaIdSchema,
  unidad_id: unidadIdSchema,
});

/**
 * Query de GET /documentos: listado paginado del usuario.
 */
const documentoFiltrosSchema = z.object({
  materia_id: materiaIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

module.exports = {
  EXTENSIONES_POR_MIME,
  MAXIMO_BYTES,
  documentoUrlCargaSchema,
  documentoRegistroSchema,
  documentoFiltrosSchema,
};
