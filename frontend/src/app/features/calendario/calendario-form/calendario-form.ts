import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { mensajeDeErrorHttp } from '../../../core/utils/http-error';
import { MateriaService, type Materia } from '../../../core/services/materia.service';
import { TareaService, type Tarea } from '../../../core/services/tarea.service';
import {
  CalendarioService,
  TIPOS_EVENTO_OPCIONES,
  type CrearEventoInput,
  type TipoEvento,
} from '../../../core/services/calendario.service';

const LARGO_MAXIMO_DESCRIPCION = 2000;
const HORA_POR_DEFECTO = '09:00';

interface OpcionRecordatorio {
  valor: string;
  etiqueta: string;
}

const OPCIONES_RECORDATORIO: readonly OpcionRecordatorio[] = [
  { valor: '', etiqueta: 'Sin recordatorio' },
  { valor: '10', etiqueta: '10 minutos antes' },
  { valor: '30', etiqueta: '30 minutos antes' },
  { valor: '60', etiqueta: '1 hora antes' },
  { valor: '120', etiqueta: '2 horas antes' },
  { valor: '1440', etiqueta: '1 día antes' },
  { valor: '2880', etiqueta: '2 días antes' },
  { valor: '10080', etiqueta: '1 semana antes' },
];

function validarRangoFechas(control: AbstractControl): ValidationErrors | null {
  const fechaInicio = control.get('fecha_inicio')?.value as string;
  const fechaFin = control.get('fecha_fin')?.value as string;

  if (!fechaInicio || !fechaFin) {
    return null;
  }

  return new Date(fechaFin) >= new Date(fechaInicio) ? null : { rangoInvalido: true };
}

@Component({
  selector: 'app-calendario-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './calendario-form.html',
  styleUrl: './calendario-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarioFormPage implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly calendarioService = inject(CalendarioService);
  private readonly materiaService = inject(MateriaService);
  private readonly tareaService = inject(TareaService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly tiposEvento = TIPOS_EVENTO_OPCIONES;
  readonly opcionesRecordatorio = OPCIONES_RECORDATORIO;
  readonly largoMaximoDescripcion = LARGO_MAXIMO_DESCRIPCION;

  readonly esEdicion = signal(false);
  readonly eventoId = signal<string | null>(null);
  readonly materias = signal<Materia[]>([]);
  readonly tareas = signal<Tarea[]>([]);
  readonly cargandoEvento = signal(false);
  readonly guardando = signal(false);
  readonly eliminando = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.formBuilder.nonNullable.group(
    {
      titulo: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
      descripcion: ['', [Validators.maxLength(LARGO_MAXIMO_DESCRIPCION)]],
      tipo_evento: ['otro' as TipoEvento, Validators.required],
      materia_id: [''],
      tarea_id: [''],
      fecha_inicio: ['', Validators.required],
      fecha_fin: [''],
      recordatorio: [''],
    },
    { validators: validarRangoFechas },
  );

  get tituloControl() {
    return this.form.controls.titulo;
  }

  get fechaInicioControl() {
    return this.form.controls.fecha_inicio;
  }

  get fechaFinControl() {
    return this.form.controls.fecha_fin;
  }

  get descripcionControl() {
    return this.form.controls.descripcion;
  }

  ngOnInit(): void {
    this.cargarMaterias();
    this.cargarTareas();
    this.detectarModo();
  }

  guardar(): void {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando.set(true);
    this.error.set(null);

    const valores = this.form.getRawValue();
    const input: CrearEventoInput = {
      titulo: valores.titulo.trim(),
      descripcion: valores.descripcion.trim() || null,
      tipo_evento: valores.tipo_evento,
      materia_id: valores.materia_id || null,
      tarea_id: valores.tarea_id || null,
      fecha_inicio: this.calendarioService.aFechaIso(valores.fecha_inicio),
      fecha_fin: valores.fecha_fin ? this.calendarioService.aFechaIso(valores.fecha_fin) : null,
      recordatorio: valores.recordatorio ? Number(valores.recordatorio) : null,
    };

    const operacion$ = this.esEdicion()
      ? this.calendarioService.actualizarEvento(this.eventoId() as string, input)
      : this.calendarioService.crearEvento(input);

    operacion$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.guardando.set(false);
        this.router.navigate(['/calendario']);
      },
      error: (err) => {
        this.error.set(
          mensajeDeErrorHttp(
            err,
            this.esEdicion()
              ? 'No se pudo actualizar el evento.'
              : 'No se pudo crear el evento.',
          ),
        );
        this.guardando.set(false);
      },
    });
  }

  eliminar(): void {
    const eventoId = this.eventoId();

    if (!eventoId || this.eliminando()) {
      return;
    }

    const confirmado = window.confirm(
      '¿Eliminar este evento? Esta acción no se puede deshacer.',
    );

    if (!confirmado) {
      return;
    }

    this.eliminando.set(true);
    this.error.set(null);

    this.calendarioService
      .eliminarEvento(eventoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigate(['/calendario']),
        error: (err) => {
          this.error.set(mensajeDeErrorHttp(err, 'No se pudo eliminar el evento.'));
          this.eliminando.set(false);
        },
      });
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

  private cargarTareas(): void {
    this.tareaService
      .listarTareas({ limit: 100, sort: 'fecha_entrega', order: 'asc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ tareas }) => this.tareas.set(tareas),
        error: () => this.tareas.set([]),
      });
  }

  private detectarModo(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (id) {
      this.esEdicion.set(true);
      this.eventoId.set(id);
      this.cargarEvento(id);
      return;
    }

    const fecha = this.route.snapshot.queryParamMap.get('fecha');
    const fechaInicio = fecha
      ? `${fecha}T${HORA_POR_DEFECTO}`
      : new Date().toISOString().slice(0, 16);

    this.form.patchValue({ fecha_inicio: fechaInicio });
  }

  private cargarEvento(id: string): void {
    this.cargandoEvento.set(true);
    this.error.set(null);

    this.calendarioService
      .obtenerEvento(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (evento) => {
          this.form.patchValue({
            titulo: evento.titulo,
            descripcion: evento.descripcion ?? '',
            tipo_evento: evento.tipo_evento,
            materia_id: evento.materia_id ?? '',
            tarea_id: evento.tarea_id ?? '',
            fecha_inicio: this.calendarioService.aFechaInput(evento.fecha_inicio),
            fecha_fin: this.calendarioService.aFechaInput(evento.fecha_fin),
            recordatorio: evento.recordatorio ? String(evento.recordatorio) : '',
          });
          this.cargandoEvento.set(false);
        },
        error: (err) => {
          this.error.set(mensajeDeErrorHttp(err, 'No se pudo cargar el evento.'));
          this.cargandoEvento.set(false);
        },
      });
  }
}
