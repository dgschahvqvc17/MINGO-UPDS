import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Notificacion, PreferenciasNotificacion } from '../../core/models/dominio.models';
import { NotificacionService } from '../../core/services/notificacion.service';
import { NotificacionesPage } from './notificaciones';

const NOTIFICACION_ID = '9c5f0f18-d01e-4c9f-b4e6-58b24c7f9a01';

const notificacion: Notificacion = {
  id: NOTIFICACION_ID,
  usuario_id: '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01',
  tipo: 'tarea',
  titulo: 'Entrega: Ensayo',
  mensaje: 'La entrega vence mañana.',
  tarea_id: 'b2f0f18-d01e-4c9f-b4e6-58b24c7f9a01',
  evento_calendario_id: null,
  sesion_estudio_id: null,
  clave_idempotencia: 'tarea:b2f0:60',
  fecha_actividad: '2026-11-21T15:00:00.000Z',
  fecha_programada: '2026-11-21T14:00:00.000Z',
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

describe('NotificacionesPage (HU18)', () => {
  const listar = vi.fn();
  const marcarLeida = vi.fn();
  const marcarTodasLeidas = vi.fn();
  const obtenerPreferencias = vi.fn();
  const actualizarPreferencias = vi.fn();

  let fixture: ReturnType<typeof TestBed.createComponent<NotificacionesPage>>;
  let componente: NotificacionesPage;

  beforeEach(() => {
    listar.mockReset().mockReturnValue(
      of({
        items: [notificacion],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    );
    marcarLeida.mockReset().mockReturnValue(of({ ...notificacion, leida: true }));
    marcarTodasLeidas.mockReset().mockReturnValue(of({ actualizadas: 1 }));
    obtenerPreferencias.mockReset().mockReturnValue(of(preferencias));
    actualizarPreferencias.mockReset().mockReturnValue(of(preferencias));

    TestBed.configureTestingModule({
      imports: [NotificacionesPage],
      providers: [
        {
          provide: NotificacionService,
          useValue: {
            noLeidas: signal(1).asReadonly(),
            listar,
            marcarLeida,
            marcarTodasLeidas,
            obtenerPreferencias,
            actualizarPreferencias,
          },
        },
      ],
    });

    fixture = TestBed.createComponent(NotificacionesPage);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('muestra el historial de notificaciones', () => {
    expect(componente.notificaciones()).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Entrega: Ensayo');
    expect(fixture.nativeElement.textContent).toContain('Nueva');
  });

  it('muestra el estado vacio cuando no hay notificaciones', () => {
    listar.mockReturnValue(
      of({ items: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
    );

    componente.cargar();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hay notificaciones en esta vista');
  });

  it('muestra un error cuando falla la carga', () => {
    listar.mockReturnValue(throwError(() => new Error('Fallo de red')));

    componente.cargar();
    fixture.detectChanges();

    expect(componente.errorMessage()).toContain('Fallo de red');
    expect(fixture.nativeElement.textContent).toContain('Fallo de red');
  });

  it('filtra las no leidas y reinicia la pagina', () => {
    componente.pagina.set(3);

    componente.cambiarFiltroLectura('no-leidas');

    expect(componente.pagina()).toBe(1);
    expect(listar).toHaveBeenLastCalledWith({
      leida: false,
      tipo: undefined,
      page: 1,
      limit: 20,
    });
  });

  it('marca una notificacion como leida y recarga el historial', () => {
    componente.marcarLeida(notificacion);

    expect(marcarLeida).toHaveBeenCalledWith(NOTIFICACION_ID);
    expect(listar).toHaveBeenCalledTimes(2);
  });

  it('carga y guarda las preferencias', () => {
    expect(componente.anticipacionMinutos()).toBe(60);

    componente.anticipacionMinutos.set(120);
    componente.guardarPreferencias();

    expect(actualizarPreferencias).toHaveBeenCalledWith({
      notificaciones_activas: true,
      canal_email: false,
      anticipacion_minutos: 120,
      zona_horaria: 'America/Bogota',
      idioma: 'es',
    });
    expect(componente.mensajeExito()).toContain('Preferencias');
  });

  it('no guarda una anticipacion invalida', () => {
    componente.anticipacionMinutos.set(1);

    componente.guardarPreferencias();

    expect(componente.errorAnticipacion()).toBeTruthy();
    expect(actualizarPreferencias).not.toHaveBeenCalled();
  });
});
