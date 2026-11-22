import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Notificacion, PreferenciasNotificacion } from '../models/dominio.models';
import { NotificacionService } from './notificacion.service';

const NOTIFICACION_ID = '9c5f0f18-d01e-4c9f-b4e6-58b24c7f9a01';

const notificacion: Notificacion = {
  id: NOTIFICACION_ID,
  usuario_id: '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01',
  tipo: 'tarea',
  titulo: 'Entrega: Ensayo',
  mensaje: 'La entrega vence pronto.',
  tarea_id: 'b2f0f18-d01e-4c9f-b4e6-58b24c7f9a01',
  evento_calendario_id: null,
  sesion_estudio_id: null,
  clave_idempotencia: 'tarea:b2f0...:60',
  fecha_actividad: '2026-11-20T15:00:00.000Z',
  fecha_programada: '2026-11-20T14:00:00.000Z',
  leida: false,
  fecha_envio: null,
  fecha_creacion: '2026-11-20T12:00:00.000Z',
  fecha_actualizacion: null,
};

const preferencias: PreferenciasNotificacion = {
  usuario_id: notificacion.usuario_id,
  notificaciones_activas: true,
  anticipacion_minutos: 60,
  canal_email: false,
  zona_horaria: 'America/Bogota',
  idioma: 'es',
  fecha_creacion: '2026-11-20T12:00:00.000Z',
  fecha_actualizacion: null,
};

describe('NotificacionService (HU18)', () => {
  let service: NotificacionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        NotificacionService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(NotificacionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('envia los filtros de paginacion y actualiza el contador de no leidas', () => {
    service.listar({ leida: false, tipo: 'tarea', page: 2, limit: 10 }).subscribe();

    const peticion = httpMock.expectOne((req) => req.url.endsWith('/notificaciones'));
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.get('leida')).toBe('false');
    expect(peticion.request.params.get('tipo')).toBe('tarea');
    expect(peticion.request.params.get('page')).toBe('2');
    expect(peticion.request.params.get('limit')).toBe('10');

    peticion.flush({
      success: true,
      data: [notificacion],
      meta: { page: 2, limit: 10, total: 3, totalPages: 1 },
    });

    expect(service.noLeidas()).toBe(3);
  });

  it('cuenta las no leidas con una sola fila', () => {
    service.contarNoLeidas().subscribe((total) => expect(total).toBe(2));

    const peticion = httpMock.expectOne((req) => req.url.endsWith('/notificaciones'));
    expect(peticion.request.params.get('limit')).toBe('1');
    peticion.flush({
      success: true,
      data: [notificacion],
      meta: { page: 1, limit: 1, total: 2, totalPages: 2 },
    });
  });

  it('marca una notificacion como leida y descuenta el contador', () => {
    service.contarNoLeidas().subscribe();
    const conteo = httpMock.expectOne((req) => req.url.endsWith('/notificaciones'));
    conteo.flush({
      success: true,
      data: [],
      meta: { page: 1, limit: 1, total: 1, totalPages: 1 },
    });

    service.marcarLeida(NOTIFICACION_ID).subscribe();

    const peticion = httpMock.expectOne((req) =>
      req.url.endsWith(`/notificaciones/${NOTIFICACION_ID}/leida`));
    expect(peticion.request.method).toBe('PATCH');
    peticion.flush({ success: true, data: { ...notificacion, leida: true } });

    expect(service.noLeidas()).toBe(0);
  });

  it('pone el contador en cero al marcar todas como leidas', () => {
    service.marcarTodasLeidas().subscribe();

    const peticion = httpMock.expectOne((req) =>
      req.url.endsWith('/notificaciones/leer-todas'));
    peticion.flush({ success: true, data: { actualizadas: 4 } });

    expect(service.noLeidas()).toBe(0);
  });

  it('consulta y actualiza las preferencias', () => {
    service.obtenerPreferencias().subscribe((datos) => expect(datos).toEqual(preferencias));
    httpMock
      .expectOne((req) => req.url.endsWith('/notificaciones/preferencias'))
      .flush({ success: true, data: preferencias });

    service.actualizarPreferencias({ anticipacion_minutos: 120 }).subscribe();
    const actualizacion = httpMock.expectOne((req) =>
      req.url.endsWith('/notificaciones/preferencias'));
    expect(actualizacion.request.method).toBe('PUT');
    expect(actualizacion.request.body).toEqual({ anticipacion_minutos: 120 });
    actualizacion.flush({ success: true, data: { ...preferencias, anticipacion_minutos: 120 } });
  });
});
