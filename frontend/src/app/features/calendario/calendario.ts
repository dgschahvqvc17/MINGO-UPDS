import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FullCalendarModule } from '@fullcalendar/angular';
import type {
  CalendarOptions,
  DateSelectArg,
  EventChangeArg,
  EventClickArg,
  EventDropArg,
} from '@fullcalendar/core';
import esLocale from '@fullcalendar/core/locales/es';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import timeGridPlugin from '@fullcalendar/timegrid';
import { mensajeDeErrorHttp } from '../../core/utils/http-error';
import { MateriaService, type Materia } from '../../core/services/materia.service';
import {
  CalendarioService,
  TIPOS_EVENTO_OPCIONES,
  type EventoCalendario,
  type EventoFiltros,
  type MateriaResumenEvento,
  type TipoEvento,
} from '../../core/services/calendario.service';

const LIMITE_EVENTOS = 100;
const DIAS_PROXIMOS = 7;
const LIMITE_PROXIMOS = 6;
const MILISEGUNDOS_POR_DIA = 24 * 60 * 60 * 1000;

interface RangoCalendario {
  desde: string;
  hasta: string;
}

@Component({
  selector: 'app-calendario',
  standalone: true,
  imports: [FullCalendarModule],
  templateUrl: './calendario.html',
  styleUrl: './calendario.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarioPage implements OnInit {
  private readonly calendarioService = inject(CalendarioService);
  private readonly materiaService = inject(MateriaService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly tiposEvento = TIPOS_EVENTO_OPCIONES;
  readonly diasProximos = DIAS_PROXIMOS;

  readonly eventos = signal<EventoCalendario[]>([]);
  readonly materias = signal<Materia[]>([]);
  readonly proximos = signal<EventoCalendario[]>([]);
  readonly eventoSeleccionado = signal<EventoCalendario | null>(null);
  readonly filtroTipo = signal<TipoEvento | ''>('');
  readonly filtroMateria = signal<string>('');
  readonly rangoActual = signal<RangoCalendario | null>(null);

  readonly cargando = signal(false);
  readonly cargandoProximos = signal(false);
  readonly eliminando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorProximos = signal<string | null>(null);

  readonly eventosFullCalendar = computed(() =>
    this.calendarioService.aEventosFullCalendar(this.eventos()),
  );

  readonly filtrosActivos = computed(
    () => Boolean(this.filtroTipo()) || Boolean(this.filtroMateria()),
  );

  readonly totalFiltrosActivos = computed(
    () => Number(Boolean(this.filtroTipo())) + Number(Boolean(this.filtroMateria())),
  );

  readonly calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
    initialView: 'dayGridMonth',
    locale: esLocale,
    timeZone: 'UTC',
    height: 'auto',
    firstDay: 1,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
    },
    buttonText: {
      today: 'Hoy',
      month: 'Mes',
      week: 'Semana',
      day: 'Día',
      list: 'Lista',
    },
    dayMaxEvents: true,
    nowIndicator: true,
    selectable: true,
    selectMirror: true,
    editable: true,
    eventStartEditable: true,
    eventDurationEditable: true,
    datesSet: (arg) => this.alCambiarRango(arg.start, arg.end),
    eventClick: (arg) => this.alSeleccionarEvento(arg),
    eventDrop: (arg) => this.alMoverEvento(arg),
    eventResize: (arg) => this.alRedimensionarEvento(arg),
    select: (arg) => this.alSeleccionarRango(arg),
  };

  ngOnInit(): void {
    this.cargarMaterias();
    this.cargarProximos();
  }

  private cargarMaterias(): void {
    this.materiaService
      .listarMaterias({ estado: 'activo', limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (respuesta) => this.materias.set(respuesta.data),
        error: () => this.materias.set([]),
      });
  }

  private alCambiarRango(desde: Date, hasta: Date): void {
    const rango: RangoCalendario = {
      desde: desde.toISOString(),
      hasta: new Date(hasta.getTime() - 1).toISOString(),
    };

    this.rangoActual.set(rango);
    this.cargarEventos(rango);
  }

  private cargarEventos(rango: RangoCalendario): void {
    this.cargando.set(true);
    this.error.set(null);

    const filtros: EventoFiltros = {
      desde: rango.desde,
      hasta: rango.hasta,
      tipo_evento: this.filtroTipo() || undefined,
      materia_id: this.filtroMateria() || undefined,
      limit: LIMITE_EVENTOS,
    };

    this.calendarioService
      .listarEventos(filtros)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ eventos }) => {
          this.eventos.set(eventos);
          this.cargando.set(false);
          this.cerrarDetalleSiNoExiste();
        },
        error: (error) => {
          this.eventos.set([]);
          this.error.set(mensajeDeErrorHttp(error, 'No se pudieron cargar los eventos.'));
          this.cargando.set(false);
        },
      });
  }

  private cerrarDetalleSiNoExiste(): void {
    const seleccionado = this.eventoSeleccionado();

    if (seleccionado && !this.eventos().some((evento) => evento.id === seleccionado.id)) {
      this.eventoSeleccionado.set(null);
    }
  }

  cargarProximos(): void {
    this.cargandoProximos.set(true);
    this.errorProximos.set(null);

    this.calendarioService
      .listarProximos(DIAS_PROXIMOS, LIMITE_PROXIMOS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ eventos }) => {
          this.proximos.set(eventos);
          this.cargandoProximos.set(false);
        },
        error: (error) => {
          this.proximos.set([]);
          this.errorProximos.set(
            mensajeDeErrorHttp(error, 'No se pudieron cargar las próximas actividades.'),
          );
          this.cargandoProximos.set(false);
        },
      });
  }

  aplicarFiltros(): void {
    const rango = this.rangoActual();

    if (rango) {
      this.cargarEventos(rango);
      return;
    }

    this.recargarCalendario();
  }

  limpiarFiltros(): void {
    this.filtroTipo.set('');
    this.filtroMateria.set('');
    this.aplicarFiltros();
  }

  alCambiarTipo(event: Event): void {
    const valor = (event.target as HTMLSelectElement).value as TipoEvento | '';
    this.filtroTipo.set(valor);
  }

  alCambiarMateria(event: Event): void {
    this.filtroMateria.set((event.target as HTMLSelectElement).value);
  }

  irANuevoEvento(fecha?: string): void {
    this.router.navigate(['/calendario/nuevo'], {
      queryParams: fecha ? { fecha } : {},
    });
  }

  editarEvento(evento: EventoCalendario): void {
    this.router.navigate(['/calendario', evento.id, 'editar']);
  }

  cerrarDetalle(): void {
    this.eventoSeleccionado.set(null);
  }

  eliminarEvento(evento: EventoCalendario): void {
    const confirmado = window.confirm(`¿Eliminar el evento "${evento.titulo}"?`);

    if (!confirmado) {
      return;
    }

    this.eliminando.set(true);
    this.error.set(null);

    this.calendarioService
      .eliminarEvento(evento.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.eventos.update((eventos) =>
            eventos.filter((actual) => actual.id !== evento.id),
          );
          this.eventoSeleccionado.set(null);
          this.eliminando.set(false);
          this.cargarProximos();
        },
        error: (error) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo eliminar el evento.'));
          this.eliminando.set(false);
        },
      });
  }

  obtenerMateria(evento: EventoCalendario): MateriaResumenEvento | null {
    return this.calendarioService.obtenerMateriaDeEvento(evento);
  }

  obtenerTipoTexto(tipo: TipoEvento): string {
    return this.calendarioService.obtenerTipoTexto(tipo);
  }

  obtenerTipoBadgeClase(tipo: TipoEvento): string {
    return this.calendarioService.obtenerTipoBadgeClase(tipo);
  }

  obtenerColorTipo(tipo: TipoEvento): string {
    return this.calendarioService.obtenerColorTipo(tipo);
  }

  formatearFechaHora(fecha: string | null): string {
    return this.calendarioService.formatearFechaHora(fecha);
  }

  formatearFecha(fecha: string | null): string {
    return this.calendarioService.formatearFecha(fecha);
  }

  private alSeleccionarEvento(arg: EventClickArg): void {
    const evento = this.eventos().find((actual) => actual.id === arg.event.id);
    this.eventoSeleccionado.set(evento ?? null);
  }

  private alSeleccionarRango(arg: DateSelectArg): void {
    arg.view.calendar.unselect();
    this.irANuevoEvento(arg.startStr.slice(0, 10));
  }

  private alMoverEvento(arg: EventDropArg): void {
    const fechaInicio = arg.event.start?.toISOString();

    if (!fechaInicio) {
      arg.revert();
      return;
    }

    this.calendarioService
      .actualizarEvento(arg.event.id, {
        fecha_inicio: fechaInicio,
        fecha_fin: arg.event.end?.toISOString() ?? null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.refrescarEventoLocal(arg.event.id),
        error: (error) => {
          arg.revert();
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo mover el evento.'));
        },
      });
  }

  private alRedimensionarEvento(arg: EventChangeArg): void {
    const fechaFin = arg.event.end?.toISOString();

    if (!fechaFin) {
      arg.revert();
      return;
    }

    this.calendarioService
      .actualizarEvento(arg.event.id, { fecha_fin: fechaFin })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.refrescarEventoLocal(arg.event.id),
        error: (error) => {
          arg.revert();
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo redimensionar el evento.'));
        },
      });
  }

  private refrescarEventoLocal(eventoId: string): void {
    if (this.rangoActual()) {
      this.cargarEventos(this.rangoActual() as RangoCalendario);
    }

    if (this.eventoSeleccionado()?.id === eventoId) {
      this.eventoSeleccionado.set(null);
    }
  }

  private recargarCalendario(): void {
    const hoy = new Date();
    const desde = new Date(hoy);
    const hasta = new Date(hoy.getTime() + 30 * MILISEGUNDOS_POR_DIA);

    this.cargarEventos({ desde: desde.toISOString(), hasta: hasta.toISOString() });
  }
}
