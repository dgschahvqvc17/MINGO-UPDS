import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/services/auth.service';
import { DashboardService, type DashboardResumen } from '../../core/services/dashboard.service';
import { CalendarioService, type EventoCalendario } from '../../core/services/calendario.service';
import { TareaService, type Tarea } from '../../core/services/tarea.service';
import { CardComponent } from '../../shared/components/card/card.component';
import { mensajeDeErrorHttp } from '../../core/utils/http-error';

const MILISEGUNDOS_POR_DIA = 86_400_000;
const COLOR_POR_DEFECTO = 'var(--mingo-primary)';

interface EnlaceRapido {
  path: string;
  icon: string;
  label: string;
  description: string;
}

interface ItemAcademico {
  id: string;
  titulo: string;
  tipoTexto: string;
  prioridadTexto: string;
  prioridadClase: string;
  fechaTexto: string;
  vencimientoTexto: string;
  vencimientoClase: string;
  materiaNombre: string | null;
  materiaColor: string;
  ruta: string;
}

interface EventoVista {
  id: string;
  titulo: string;
  tipoTexto: string;
  tipoClase: string;
  fechaTexto: string;
  materiaNombre: string | null;
  materiaColor: string;
}

interface NotificacionVista {
  id: string;
  titulo: string;
  mensaje: string;
  fechaTexto: string;
  leida: boolean;
}

interface DescripcionVencimiento {
  texto: string;
  clase: string;
}

const ENLACES_ESTUDIANTE: readonly EnlaceRapido[] = [
  {
    path: '/materias',
    icon: 'bi-journal-bookmark',
    label: 'Materias',
    description: 'Consulta tus materias y unidades',
  },
  {
    path: '/tareas',
    icon: 'bi-check2-square',
    label: 'Tareas',
    description: 'Revisa entregas y prioridades',
  },
  {
    path: '/calendario',
    icon: 'bi-calendar3',
    label: 'Calendario',
    description: 'Organiza tus fechas académicas',
  },
  {
    path: '/biblioteca',
    icon: 'bi-folder2-open',
    label: 'Biblioteca',
    description: 'Accede a tus documentos de estudio',
  },
  {
    path: '/centro-estudio',
    icon: 'bi-mortarboard',
    label: 'Centro de estudio',
    description: 'Planifica sesiones de aprendizaje',
  },
  {
    path: '/asistente-ia',
    icon: 'bi-stars',
    label: 'Asistente IA',
    description: 'Resuelve dudas con tus materiales',
  },
];

const ENLACES_ADMINISTRADOR: readonly EnlaceRapido[] = [
  {
    path: '/administracion',
    icon: 'bi-shield-lock',
    label: 'Administración',
    description: 'Gestiona usuarios y roles del sistema',
  },
  {
    path: '/materias',
    icon: 'bi-journal-bookmark',
    label: 'Materias',
    description: 'Consulta las materias registradas',
  },
  {
    path: '/tareas',
    icon: 'bi-check2-square',
    label: 'Tareas',
    description: 'Revisa la actividad académica',
  },
  {
    path: '/calendario',
    icon: 'bi-calendar3',
    label: 'Calendario',
    description: 'Supervisa los eventos del sistema',
  },
];

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, CardComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly authService = inject(AuthService);
  private readonly dashboardService = inject(DashboardService);
  private readonly tareaService = inject(TareaService);
  private readonly calendarioService = inject(CalendarioService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly resumenSignal = signal<DashboardResumen | null>(null);
  private readonly ultimaActualizacionSignal = signal<Date | null>(null);
  private readonly cargandoSignal = signal(true);
  private readonly errorSignal = signal<string | null>(null);

  readonly isLoading = this.cargandoSignal.asReadonly();
  readonly errorMessage = this.errorSignal.asReadonly();
  readonly resumen = this.resumenSignal.asReadonly();
  readonly ultimaActualizacion = this.ultimaActualizacionSignal.asReadonly();

  readonly nombre = this.authService.fullName;
  readonly rol = this.authService.role;

  readonly rolTexto = computed(() =>
    this.rol() === 'administrador' ? 'Administrador' : 'Estudiante',
  );

  readonly iconoRol = computed(() =>
    this.rol() === 'administrador' ? 'bi bi-shield-check' : 'bi bi-person-badge',
  );

  readonly enlacesRapidos = computed<readonly EnlaceRapido[]>(() =>
    this.rol() === 'administrador' ? ENLACES_ADMINISTRADOR : ENLACES_ESTUDIANTE,
  );

  readonly saludo = computed(() => `${this.saludoDelDia()}, ${this.nombre() || 'estudiante'}`);

  readonly fechaHoy = this.formatearFechaLarga(new Date());

  readonly materias = computed(
    () => this.resumenSignal()?.materias ?? { total: 0, activas: 0, archivadas: 0 },
  );

  readonly tareas = computed(
    () =>
      this.resumenSignal()?.tareas ?? {
        total: 0,
        pendientes: 0,
        en_progreso: 0,
        completadas: 0,
        vencidas: 0,
      },
  );

  readonly progreso = computed(
    () =>
      this.resumenSignal()?.progreso ?? {
        tareas_totales: 0,
        tareas_completadas: 0,
        porcentaje_completado: 0,
        materias_activas: 0,
      },
  );

  readonly totalPendientes = computed(() => this.tareas().pendientes + this.tareas().en_progreso);

  readonly proximosExamenes = computed(() =>
    this.mapearTareas(this.resumenSignal()?.proximos_examenes ?? []),
  );

  readonly actividades = computed(() =>
    this.mapearTareas(this.resumenSignal()?.proximas_actividades ?? []),
  );

  readonly eventos = computed(() =>
    (this.resumenSignal()?.proximos_eventos ?? []).map((evento) => this.mapearEvento(evento)),
  );

  readonly notificaciones = computed<NotificacionVista[]>(() =>
    (this.resumenSignal()?.notificaciones ?? []).map((notificacion) => ({
      id: notificacion.id,
      titulo: notificacion.titulo,
      mensaje: notificacion.mensaje,
      leida: notificacion.leida,
      fechaTexto: this.formatearFechaHora(notificacion.fecha_creacion),
    })),
  );

  readonly mensajeBienvenida = computed(() => {
    if (this.rol() === 'administrador') {
      return 'Revisa la actividad del sistema y gestiona usuarios, roles y permisos.';
    }

    const pendientes = this.totalPendientes();

    if (pendientes === 0) {
      return 'No tienes tareas pendientes. Aprovecha para repasar o planificar tu semana.';
    }

    if (pendientes === 1) {
      return 'Tienes 1 tarea pendiente. ¡Vamos a avanzar!';
    }

    return `Tienes ${pendientes} tareas pendientes. ¡Vamos a avanzar!`;
  });

  readonly horaActualizacion = computed(() => this.formatearHora(this.ultimaActualizacionSignal()));

  constructor() {
    this.cargar();
  }

  recargar(): void {
    if (this.cargandoSignal()) {
      return;
    }

    this.cargar();
  }

  private cargar(): void {
    this.cargandoSignal.set(true);
    this.errorSignal.set(null);

    this.dashboardService
      .obtenerResumen()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resumen) => {
          this.resumenSignal.set(resumen);
          this.ultimaActualizacionSignal.set(new Date());
          this.cargandoSignal.set(false);
        },
        error: (error: unknown) => {
          this.errorSignal.set(mensajeDeErrorHttp(error, 'No se pudo cargar el panel académico.'));
          this.cargandoSignal.set(false);
        },
      });
  }

  private colorMateria(color: string | null | undefined): string {
    return color ?? COLOR_POR_DEFECTO;
  }

  private mapearTareas(tareas: readonly Tarea[]): ItemAcademico[] {
    return tareas.map((tarea) => {
      const materia = this.tareaService.obtenerMateriaDeTarea(tarea);
      const vencimiento = this.describirVencimiento(tarea.fecha_entrega);

      return {
        id: tarea.id,
        titulo: tarea.titulo,
        tipoTexto: this.tareaService.obtenerTipoTexto(tarea.tipo),
        prioridadTexto: this.tareaService.obtenerPrioridadTexto(tarea.prioridad),
        prioridadClase: this.tareaService.obtenerPrioridadBadgeClase(tarea.prioridad),
        fechaTexto: this.tareaService.formatearFecha(tarea.fecha_entrega),
        vencimientoTexto: vencimiento.texto,
        vencimientoClase: vencimiento.clase,
        materiaNombre: materia?.nombre ?? null,
        materiaColor: this.colorMateria(materia?.color),
        ruta: '/tareas',
      };
    });
  }

  private mapearEvento(evento: EventoCalendario): EventoVista {
    const materia = this.calendarioService.obtenerMateriaDeEvento(evento);

    return {
      id: evento.id,
      titulo: evento.titulo,
      tipoTexto: this.calendarioService.obtenerTipoTexto(evento.tipo_evento),
      tipoClase: this.calendarioService.obtenerTipoBadgeClase(evento.tipo_evento),
      fechaTexto: this.calendarioService.formatearFechaHora(evento.fecha_inicio),
      materiaNombre: materia?.nombre ?? null,
      materiaColor: this.colorMateria(materia?.color),
    };
  }

  private describirVencimiento(fecha: string | null): DescripcionVencimiento {
    if (!fecha) {
      return { texto: 'Sin fecha', clase: 'small text-muted-soft' };
    }

    const dias = this.diasHasta(fecha);

    if (dias < 0) {
      const transcurridos = Math.abs(dias);
      return {
        texto: transcurridos === 1 ? 'Venció hace 1 día' : `Venció hace ${transcurridos} días`,
        clase: 'small text-danger fw-semibold',
      };
    }

    if (dias === 0) {
      return { texto: 'Vence hoy', clase: 'small text-danger fw-semibold' };
    }

    if (dias === 1) {
      return { texto: 'Vence mañana', clase: 'small text-warning fw-semibold' };
    }

    return {
      texto: `En ${dias} días`,
      clase: dias <= 3 ? 'small text-warning' : 'small text-muted-soft',
    };
  }

  private diasHasta(fecha: string): number {
    const objetivo = new Date(fecha);

    if (Number.isNaN(objetivo.getTime())) {
      return Number.POSITIVE_INFINITY;
    }

    const hoy = new Date();
    const diferencia =
      Date.UTC(objetivo.getUTCFullYear(), objetivo.getUTCMonth(), objetivo.getUTCDate()) -
      Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());

    return Math.round(diferencia / MILISEGUNDOS_POR_DIA);
  }

  private saludoDelDia(): string {
    const hora = new Date().getHours();

    if (hora < 12) {
      return 'Buenos días';
    }

    if (hora < 19) {
      return 'Buenas tardes';
    }

    return 'Buenas noches';
  }

  private formatearFechaLarga(fecha: Date): string {
    const texto = fecha.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }

  private formatearHora(fecha: Date | null): string {
    if (!fecha) {
      return '';
    }

    return fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  private formatearFechaHora(fecha: string): string {
    return new Date(fecha).toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
