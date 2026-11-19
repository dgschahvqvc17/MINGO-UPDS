import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  BusquedaService,
  type FragmentoBusqueda,
  type RespuestaBusqueda,
} from './busqueda.service';

const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const MATERIA_ID = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';

const fragmento: FragmentoBusqueda = {
  fragmento_id: 'fragmento-1',
  documento_id: DOCUMENTO_ID,
  documento_nombre: 'Apuntes de cálculo',
  contenido: 'La derivada mide la tasa de cambio instantánea.',
  numero_pagina: 12,
  similitud: 0.873421,
};

describe('BusquedaService (HU11)', () => {
  let service: BusquedaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        BusquedaService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(BusquedaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Se reinicia primero para que una aserción fallida no deje un TestBed
    // instanciado y contamine el siguiente archivo de pruebas.
    TestBed.resetTestingModule();
    httpMock.verify();
  });

  it('envía la consulta y los filtros al endpoint de búsqueda', () => {
    service
      .buscar('  derivadas de funciones  ', { materiaId: MATERIA_ID, limit: 5 })
      .subscribe((respuesta) => expect(respuesta.resultados).toEqual([fragmento]));

    const req = httpMock.expectOne(
      (peticion) =>
        peticion.url === '/api/documentos/buscar' &&
        peticion.params.get('q') === 'derivadas de funciones' &&
        peticion.params.get('materia_id') === MATERIA_ID &&
        peticion.params.get('limit') === '5',
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: [fragmento],
      meta: { mensaje: null },
    });
  });

  it('devuelve la lista vacía y el mensaje del backend cuando no hay coincidencias', () => {
    let resultado: RespuestaBusqueda | undefined;

    service.buscar('temas sin coincidencia').subscribe((respuesta) => {
      resultado = respuesta;
    });

    const req = httpMock.expectOne(
      (peticion) => peticion.url === '/api/documentos/buscar',
    );
    req.flush({
      success: true,
      data: [],
      meta: { mensaje: 'No encontramos fragmentos relacionados.' },
    });

    expect(resultado?.resultados).toEqual([]);
    expect(resultado?.mensaje).toBe('No encontramos fragmentos relacionados.');
  });
});
