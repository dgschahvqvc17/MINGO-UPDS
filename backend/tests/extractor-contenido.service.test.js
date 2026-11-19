const { describe, it, expect } = require('@jest/globals');
const ExtractorContenidoService = require('../src/services/procesamiento/extractor-contenido.service');
const { obtenerExtension } = require('../src/services/procesamiento/extractor-contenido.service');

describe('ExtractorContenidoService', () => {
  const service = new ExtractorContenidoService();

  it('extrae el texto plano de un TXT', async () => {
    const resultado = await service.extraer({
      buffer: Buffer.from('Apuntes de cálculo\nSegunda línea', 'utf8'),
      nombreArchivo: 'apuntes.txt',
      tipoArchivo: 'text/plain',
    });

    expect(resultado.numeroPaginas).toBeNull();
    expect(resultado.paginas).toEqual([
      { numero: null, texto: 'Apuntes de cálculo\nSegunda línea' },
    ]);
  });

  it('rechaza un archivo vacío de forma permanente', async () => {
    await expect(
      service.extraer({
        buffer: Buffer.alloc(0),
        nombreArchivo: 'vacio.pdf',
        tipoArchivo: 'application/pdf',
      }),
    ).rejects.toMatchObject({ permanente: true });
  });

  it('rechaza los formatos antiguos DOC y PPT con un motivo claro', async () => {
    await expect(
      service.extraer({
        buffer: Buffer.from('contenido'),
        nombreArchivo: 'tarea.doc',
        tipoArchivo: 'application/msword',
      }),
    ).rejects.toMatchObject({
      permanente: true,
      message: expect.stringContaining('DOC'),
    });

    await expect(
      service.extraer({
        buffer: Buffer.from('contenido'),
        nombreArchivo: 'clase.ppt',
        tipoArchivo: 'application/vnd.ms-powerpoint',
      }),
    ).rejects.toMatchObject({
      permanente: true,
      message: expect.stringContaining('PPT'),
    });
  });

  it('rechaza una extensión no soportada', async () => {
    await expect(
      service.extraer({
        buffer: Buffer.from('contenido'),
        nombreArchivo: 'planilla.xlsx',
        tipoArchivo: 'application/vnd.ms-excel',
      }),
    ).rejects.toMatchObject({ permanente: true });
  });

  it('usa el MIME para deducir la extensión cuando el nombre no la trae', async () => {
    const resultado = await service.extraer({
      buffer: Buffer.from('texto sin extensión', 'utf8'),
      nombreArchivo: 'documento',
      tipoArchivo: 'text/plain',
    });

    expect(resultado.paginas).toHaveLength(1);
  });

  describe('obtenerExtension', () => {
    it('devuelve la extensión del nombre en minúsculas', () => {
      expect(obtenerExtension('Clase.PDF', 'application/pdf')).toBe('.pdf');
    });

    it('cae al MIME cuando el nombre no tiene extensión', () => {
      expect(obtenerExtension('documento', 'text/plain')).toBe('.txt');
    });

    it('devuelve cadena vacía cuando no reconoce ni nombre ni MIME', () => {
      expect(obtenerExtension('sin-extension', 'application/octet-stream')).toBe('');
    });
  });
});
