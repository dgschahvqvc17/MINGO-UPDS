import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ResumenService, type ResumenDocumento } from './resumen.service';

const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const resumen: ResumenDocumento = {
  id: 'resumen-id',
  documento_id: DOCUMENTO_ID,
  documento_nombre: 'Apuntes de calculo',
  profundidad: 'media',
  resumen_general: 'Resumen estructurado del documento.',
  temas_principales: ['Derivadas'],
  conceptos_importantes: [{ termino: 'Derivada', descripcion: 'Tasa de cambio.' }],
  modelo: 'gpt-4o-mini',
  tokens_entrada: 100,
  tokens_salida: 50,
  contenido_truncado: false,
  guardado: true,
  reutilizado: false,
  fecha_creacion: '2026-11-18T10:00:00.000Z',
};

describe('ResumenService', () => {
  let service: ResumenService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ResumenService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ResumenService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    httpMock.verify();
  });

  it('genera el resumen con el contrato del backend', () => {
    service
      .generar({ documento_id: DOCUMENTO_ID, profundidad: 'detallada', guardar: true })
      .subscribe((resultado) => expect(resultado).toEqual(resumen));

    const req = httpMock.expectOne('/api/asistente/resumen');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      documento_id: DOCUMENTO_ID,
      profundidad: 'detallada',
      guardar: true,
    });
    req.flush({ success: true, data: resumen });
  });

  it('consulta el resumen guardado del documento', () => {
    service.obtenerGuardado(DOCUMENTO_ID).subscribe((resultado) => expect(resultado).toEqual(resumen));

    const req = httpMock.expectOne(`/api/asistente/resumen/${DOCUMENTO_ID}`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: resumen });
  });

  it('devuelve null cuando el documento no tiene resumen guardado', () => {
    service.obtenerGuardado(DOCUMENTO_ID).subscribe((resultado) => expect(resultado).toBeNull());

    const req = httpMock.expectOne(`/api/asistente/resumen/${DOCUMENTO_ID}`);
    req.flush({ success: true, data: null });
  });

  it('devuelve la etiqueta legible de cada profundidad', () => {
    expect(service.etiquetaProfundidad('breve')).toBe('Breve');
    expect(service.etiquetaProfundidad('detallada')).toBe('Detallada');
  });
});
