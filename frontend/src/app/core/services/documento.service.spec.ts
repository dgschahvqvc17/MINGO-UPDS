import { TestBed } from '@angular/core/testing';
import { HttpEventType } from '@angular/common/http';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TAMANO_MAXIMO_BYTES, DocumentoService, type Documento } from './documento.service';

const mockDocumento: Documento = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  usuario_id: '550e8400-e29b-41d4-a716-446655440001',
  materia_id: '550e8400-e29b-41d4-a716-446655440002',
  unidad_id: null,
  nombre: 'Cálculo diferencial - Unidad 1',
  nombre_archivo: 'calculo.pdf',
  ruta_almacenamiento:
    'usuarios/550e8400-e29b-41d4-a716-446655440001/documentos/550e8400-e29b-41d4-a716-446655440003/calculo.pdf',
  tipo_archivo: 'application/pdf',
  tamano: 1024,
  estado_procesamiento: 'pendiente',
  motivo_error: null,
  numero_paginas: null,
  fecha_carga: '2026-11-12T10:00:00.000Z',
  fecha_actualizacion: null,
  materias: { nombre: 'Cálculo', codigo: 'MAT101', color: '#3B82F6' },
};

describe('DocumentoService', () => {
  let service: DocumentoService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        DocumentoService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(DocumentoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    httpMock.verify();
  });

  it('lista los documentos y desenvuelve la paginación', () => {
    const paginacion = { limit: 12, offset: 0, total: 1 };

    service.listar({ materia_id: mockDocumento.materia_id }).subscribe((resultado) => {
      expect(resultado.documentos).toHaveLength(1);
      expect(resultado.documentos[0].nombre).toBe(mockDocumento.nombre);
      expect(resultado.paginacion).toEqual(paginacion);
    });

    const req = httpMock.expectOne((request) => request.url === '/api/documentos');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('materia_id')).toBe(mockDocumento.materia_id);
    req.flush({ success: true, data: [mockDocumento], meta: { paginacion } });
  });

  it('solicita la URL prefirmada con el contrato del backend', () => {
    const respuesta = {
      uploadUrl: 'https://s3.example.com/firmada',
      objectKey: mockDocumento.ruta_almacenamiento,
      expiresInSeconds: 900,
      maxSizeBytes: TAMANO_MAXIMO_BYTES,
    };

    service
      .solicitarUrlCarga({
        nombre_archivo: 'calculo.pdf',
        tipo_archivo: 'application/pdf',
        tamano: 1024,
        materia_id: mockDocumento.materia_id,
      })
      .subscribe((datos) => expect(datos.objectKey).toBe(mockDocumento.ruta_almacenamiento));

    const req = httpMock.expectOne('/api/documentos/url-carga');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toMatchObject({
      nombre_archivo: 'calculo.pdf',
      tipo_archivo: 'application/pdf',
    });
    req.flush({ success: true, data: respuesta });
  });

  it('registra el documento en la API tras subirlo a S3', () => {
    service
      .registrar({
        objectKey: mockDocumento.ruta_almacenamiento,
        nombre: mockDocumento.nombre,
        materia_id: mockDocumento.materia_id,
        unidad_id: null,
      })
      .subscribe((documento) => expect(documento.id).toBe(mockDocumento.id));

    const req = httpMock.expectOne('/api/documentos');
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, data: mockDocumento });
  });

  it('envía la búsqueda y el filtro de estado al listar', () => {
    const paginacion = { limit: 12, offset: 0, total: 0 };

    service
      .listar({ q: 'cálculo', estado: 'procesado', limit: 12, offset: 0 })
      .subscribe((resultado) => expect(resultado.documentos).toHaveLength(0));

    const req = httpMock.expectOne((request) => request.url === '/api/documentos');
    expect(req.request.params.get('q')).toBe('cálculo');
    expect(req.request.params.get('estado')).toBe('procesado');
    req.flush({ success: true, data: [], meta: { paginacion } });
  });

  it('pide el detalle de un documento por su identificador', () => {
    service
      .obtener(mockDocumento.id)
      .subscribe((documento) => expect(documento.id).toBe(mockDocumento.id));

    const req = httpMock.expectOne(`/api/documentos/${mockDocumento.id}`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: mockDocumento });
  });

  it('solicita la URL de descarga del documento', () => {
    const respuesta = {
      downloadUrl: 'https://s3.example.com/descarga',
      nombreArchivo: 'calculo.pdf',
      tipoArchivo: 'application/pdf',
      expiresInSeconds: 900,
    };

    service
      .urlDescarga(mockDocumento.id)
      .subscribe((datos) => expect(datos.downloadUrl).toBe(respuesta.downloadUrl));

    const req = httpMock.expectOne(`/api/documentos/${mockDocumento.id}/descarga`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: respuesta });
  });

  it('elimina el documento por su identificador', () => {
    service
      .eliminar(mockDocumento.id)
      .subscribe((resultado) => expect(resultado.id).toBe(mockDocumento.id));

    const req = httpMock.expectOne(`/api/documentos/${mockDocumento.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, data: { id: mockDocumento.id } });
  });

  it('sube el archivo a S3 con el tipo declarado y reporta progreso', () => {
    const archivo = new File(['contenido'], 'calculo.pdf', { type: 'application/pdf' });
    const url = 'https://s3.example.com/firmada';
    const progresos: number[] = [];

    service.subirArchivo(url, archivo).subscribe((progreso) => progresos.push(progreso));

    const req = httpMock.expectOne(url);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Content-Type')).toBe('application/pdf');

    req.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 });
    req.event({ type: HttpEventType.UploadProgress, loaded: 100, total: 100 });
    req.flush('', { status: 200, statusText: 'OK' });

    expect(progresos).toEqual([50, 100]);
  });

  it('reconoce formatos por extensión y rechaza los no permitidos', () => {
    expect(service.obtenerFormatoPorNombre('calculo.PDF')?.mime).toBe('application/pdf');
    expect(service.obtenerFormatoPorNombre('taller.docx')?.etiqueta).toBe('DOCX');
    expect(service.obtenerFormatoPorNombre('script.exe')).toBeUndefined();
  });

  it('formatea el tamaño en unidades legibles', () => {
    expect(service.formatearTamano(900)).toBe('900 B');
    expect(service.formatearTamano(2048)).toBe('2.0 KB');
    expect(service.formatearTamano(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
