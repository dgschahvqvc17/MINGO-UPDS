import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CalendarioService, type EventoCalendario } from '../../core/services/calendario.service';
import { DashboardService, type DashboardResumen } from '../../core/services/dashboard.service';
import { TareaService, type Tarea } from '../../core/services/tarea.service';
import { DashboardPage } from './dashboard';

function crearTarea(overrides: Partial<Tarea> = {}): Tarea {
  return {
    id: 'tarea-1',
    usuario_id: 'usuario-1',
    materia_id: 'materia-1',
    titulo: 'Taller de cálculo',
    descripcion: null,
    tipo: 'taller',
    prioridad: 'alta',
    fecha_asignacion: '2026-11-01T00:00:00.000Z',
    fecha_entrega: '2099-11-15T23:59:00.000Z',
    estado: 'pendiente',
    fecha_creacion: '2026-11-01T00:00:00.000Z',
    fecha_actualizacion: null,
    materias: { nombre: 'Cálculo Diferencial', codigo: 'MAT-101', color: '#3B82F6' },
    ...overrides,
  };
}

function crearEvento(overrides: Partial<EventoCalendario> = {}): EventoCalendario {
  return {
    id: 'evento-1',
    usuario_id: 'usuario-1',
    materia_id: 'materia-1',
    tarea_id: null,
    titulo: 'Examen parcial',
    descripcion: null,
    tipo_evento: 'examen',
    fecha_inicio: '2099-11-20T14:00:00.000Z',
    fecha_fin: null,
    recordatorio: null,
    fecha_creacion: '2026-11-01T00:00:00.000Z',
    fecha_actualizacion: null,
    materias: { nombre: 'Cálculo Diferencial', codigo: 'MAT-101', color: '#3B82F6' },
    ...overrides,
  };
}

function crearResumen(overrides: Partial<DashboardResumen> = {}): DashboardResumen {
  return {
    materias: { total: 3, activas: 2, archivadas: 1 },
    tareas: { total: 10, pendientes: 4, en_progreso: 2, completadas: 4, vencidas: 1 },
    proximas_actividades: [crearTarea()],
    proximos_examenes: [
      crearTarea({ id: 'examen-1', titulo: 'Parcial de álgebra', tipo: 'parcial' }),
    ],
    proximos_eventos: [crearEvento()],
    progreso: {
      tareas_totales: 10,
      tareas_completadas: 4,
      porcentaje_completado: 40,
      materias_activas: 2,
    },
    notificaciones: [],
    generado_en: '2026-11-10T15:00:00.000Z',
    ...overrides,
  };
}

const obtenerResumen = vi.fn();

function configurarTestBed(resumen: DashboardResumen = crearResumen()): void {
  obtenerResumen.mockReturnValue(of(resumen));

  TestBed.configureTestingModule({
    imports: [DashboardPage],
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: { fullName: signal('Ana Pérez'), role: signal('estudiante') },
      },
      { provide: DashboardService, useValue: { obtenerResumen } },
      {
        provide: TareaService,
        useValue: {
          obtenerMateriaDeTarea: (tarea: Tarea) =>
            Array.isArray(tarea.materias) ? (tarea.materias[0] ?? null) : (tarea.materias ?? null),
          obtenerTipoTexto: (tipo: string) => tipo,
          obtenerPrioridadTexto: (prioridad: string) => prioridad,
          obtenerPrioridadBadgeClase: () => 'badge bg-primary',
          formatearFecha: (fecha: string | null) => (fecha ? fecha.slice(0, 10) : 'Sin fecha'),
        },
      },
      {
        provide: CalendarioService,
        useValue: {
          obtenerMateriaDeEvento: () => null,
          obtenerTipoTexto: () => 'Examen',
          obtenerTipoBadgeClase: () => 'badge text-bg-danger',
          formatearFechaHora: () => '20 nov 2099',
        },
      },
    ],
  });
}

function crearComponente() {
  const fixture = TestBed.createComponent(DashboardPage);
  fixture.detectChanges();
  return fixture;
}

describe('DashboardPage (HU06)', () => {
  beforeEach(() => {
    obtenerResumen.mockReset();
  });

  it('muestra los indicadores académicos del usuario autenticado', () => {
    configurarTestBed();

    const fixture = crearComponente();
    const valores = Array.from(
      fixture.nativeElement.querySelectorAll('.stat-value') as NodeListOf<HTMLElement>,
    ).map((elemento) => elemento.textContent?.trim());

    expect(valores).toEqual(['3', '6', '4', '1']);
    expect(fixture.nativeElement.textContent).toContain('Taller de cálculo');
    expect(fixture.nativeElement.textContent).toContain('Parcial de álgebra');
    expect(fixture.nativeElement.textContent).toContain('Examen parcial');
    expect(fixture.nativeElement.textContent).toContain('Ana Pérez');
    expect(obtenerResumen).toHaveBeenCalledTimes(1);
  });

  it('muestra los estados vacíos cuando el usuario no tiene datos', () => {
    configurarTestBed(
      crearResumen({
        materias: { total: 0, activas: 0, archivadas: 0 },
        tareas: { total: 0, pendientes: 0, en_progreso: 0, completadas: 0, vencidas: 0 },
        proximas_actividades: [],
        proximos_examenes: [],
        proximos_eventos: [],
        progreso: {
          tareas_totales: 0,
          tareas_completadas: 0,
          porcentaje_completado: 0,
          materias_activas: 0,
        },
      }),
    );

    const fixture = crearComponente();
    const vacios = fixture.nativeElement.querySelectorAll(
      '.dashboard-empty',
    ) as NodeListOf<HTMLElement>;

    expect(vacios).toHaveLength(4);
    expect(fixture.nativeElement.textContent).toContain('¡Estás al día!');
    expect(fixture.nativeElement.textContent).toContain('Aún no tienes notificaciones');
  });

  it('muestra un mensaje de error cuando falla la carga del panel', () => {
    configurarTestBed();
    obtenerResumen.mockReturnValue(
      throwError(() => new Error('No se pudo conectar con el servidor.')),
    );

    const fixture = crearComponente();
    const alerta = fixture.nativeElement.querySelector('.alert-danger') as HTMLElement | null;

    expect(alerta?.textContent).toContain('No se pudo conectar con el servidor.');
    expect(fixture.nativeElement.querySelector('.stat-value')).toBeNull();
  });

  it('vuelve a cargar el resumen al pulsar actualizar', () => {
    configurarTestBed();

    const fixture = crearComponente();
    const boton = fixture.nativeElement.querySelector(
      'button[aria-label="Actualizar panel académico"]',
    ) as HTMLButtonElement;
    obtenerResumen.mockClear();

    boton.click();
    fixture.detectChanges();

    expect(obtenerResumen).toHaveBeenCalledTimes(1);
  });
});
