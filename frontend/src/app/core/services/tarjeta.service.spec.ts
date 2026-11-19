import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  TarjetaService,
  type ConjuntoTarjetasResumen,
  type Tarjeta,
} from './tarjeta.service';

const MATERIA_ID = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const CONJUNTO_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const TARJETA_ID = 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f';

const conjunto: ConjuntoTarjetasResumen = {
  id: CONJUNTO_ID,
  usuario_id: 'usuario-1',
  materia_id: MATERIA_ID,
  materia_nombre: 'Cálculo Diferencial',
  documento_id: DOCUMENTO_ID,
  titulo: 'Tarjetas de cálculo',
  cantidad_tarjetas: 5,
  cantidad_conocidas: 1,
  cantidad_pendientes: 4,
  modelo: 'gemini-3.5-flash-lite',
  tokens_entrada: 500,
  tokens_salida: 300,
  fecha_creacion: '2026-11-19T10:00:00.000Z',
};

const tarjeta: Tarjeta = {
  id: TARJETA_ID,
  conjunto_id: CONJUNTO_ID,
  orden: 1,
  frente: '¿Qué mide la derivada?',
  reverso: 'La tasa de cambio instantánea.',
  estado: 'sin_revisar',
  fecha_actualizacion: '2026-11-19T10:00:00.000Z',
};

describe('TarjetaService (HU14)', () => {
  let service: TarjetaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TarjetaService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(TarjetaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    httpMock.verify();
  });

  it('genera un conjunto con el contrato del backend', () => {
    const solicitud = {
      materia_id: MATERIA_ID,
      documento_id: DOCUMENTO_ID,
      cantidad_tarjetas: 5,
    };

    service.generar(solicitud).subscribe((resultado) => {
      expect(resultado.tarjetas).toEqual([tarjeta]);
    });

    const req = httpMock.expectOne('/api/asistente/tarjetas');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(solicitud);
    req.flush({ success: true, data: { ...conjunto, tarjetas: [tarjeta] } });
  });

  it('lista los conjuntos y usa el total del metadato', () => {
    let total = 0;

    service.listar({ limit: 20, offset: 0 }).subscribe((resultado) => {
      total = resultado.total;
      expect(resultado.conjuntos).toEqual([conjunto]);
    });

    const req = httpMock.expectOne('/api/asistente/tarjetas/conjuntos?limit=20&offset=0');
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [conjunto], meta: { total: 3 } });

    expect(total).toBe(3);
  });

  it('obtiene un conjunto con el filtro de pendientes', () => {
    service.obtener(CONJUNTO_ID, 'pendientes').subscribe((resultado) => {
      expect(resultado.tarjetas).toEqual([tarjeta]);
    });

    const req = httpMock.expectOne(
      `/api/asistente/tarjetas/conjuntos/${CONJUNTO_ID}?estado=pendientes`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: { ...conjunto, tarjetas: [tarjeta] } });
  });

  it('elimina un conjunto propio', () => {
    service.eliminar(CONJUNTO_ID).subscribe((resultado) => {
      expect(resultado.id).toBe(CONJUNTO_ID);
    });

    const req = httpMock.expectOne(`/api/asistente/tarjetas/conjuntos/${CONJUNTO_ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, data: { id: CONJUNTO_ID } });
  });

  it('registra el avance de estudio de una tarjeta', () => {
    service.actualizarEstado(TARJETA_ID, 'conocida').subscribe((resultado) => {
      expect(resultado.estado).toBe('conocida');
    });

    const req = httpMock.expectOne(`/api/asistente/tarjetas/${TARJETA_ID}/estado`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ estado: 'conocida' });
    req.flush({ success: true, data: { ...tarjeta, estado: 'conocida' } });
  });

  it('devuelve etiquetas legibles para los estados', () => {
    expect(service.etiquetaEstado('sin_revisar')).toBe('Sin revisar');
    expect(service.etiquetaEstado('conocida')).toBe('Conocida');
    expect(service.etiquetaEstado('repaso')).toBe('Para repaso');
  });
});
