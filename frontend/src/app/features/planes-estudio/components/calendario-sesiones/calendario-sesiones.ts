import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FullCalendarModule } from '@fullcalendar/angular';
import type { CalendarOptions, EventInput } from '@fullcalendar/core';
import esLocale from '@fullcalendar/core/locales/es';
import dayGridPlugin from '@fullcalendar/daygrid';
import type { SesionEstudio } from '../../../../core/models/plan-estudio.model';

/** Calendario de solo lectura con las sesiones de un plan confirmado. */
@Component({
  selector: 'app-calendario-sesiones',
  imports: [FullCalendarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="calendario-sesiones">
      <full-calendar [options]="calendarOptions()"></full-calendar>
    </div>
  `,
  styles: [
    `
      .calendario-sesiones {
        --fc-event-bg-color: #0d6efd;
        --fc-event-border-color: #0d6efd;
      }
    `,
  ],
})
export class CalendarioSesionesComponent {
  readonly sesiones = input.required<SesionEstudio[]>();

  readonly eventos = computed<EventInput[]>(() =>
    this.sesiones().map((sesion) => {
      const inicio = new Date(sesion.fecha_inicio);
      const fin = new Date(inicio.getTime() + sesion.duracion_minutos * 60_000);

      return {
        id: sesion.id,
        title: sesion.tema,
        start: sesion.fecha_inicio,
        end: fin.toISOString(),
        backgroundColor: sesion.estado === 'completada' ? '#198754' : '#0d6efd',
        borderColor: sesion.estado === 'completada' ? '#198754' : '#0d6efd',
      };
    }),
  );

  readonly calendarOptions = computed<CalendarOptions>(() => ({
    plugins: [dayGridPlugin],
    initialView: 'dayGridMonth',
    locale: esLocale,
    timeZone: 'local',
    height: 'auto',
    firstDay: 1,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: '',
    },
    buttonText: { today: 'Hoy' },
    events: this.eventos(),
  }));
}
