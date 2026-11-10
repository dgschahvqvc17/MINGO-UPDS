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
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CardComponent } from '../../../shared/components/card/card.component';
import { mensajeDeErrorHttp } from '../../../core/utils/http-error';
import { MateriaService, type Materia } from '../../../core/services/materia.service';
import {
  ESTADOS_TAREA,
  PRIORIDADES_TAREA,
  TIPOS_TAREA,
  TareaService,
  type CrearTareaInput,
  type EstadoTarea,
  type PrioridadTarea,
  type TipoTarea,
} from '../../../core/services/tarea.service';

const LARGO_MAXIMO_DESCRIPCION = 2000;

function validarRangoFechas(control: AbstractControl): ValidationErrors | null {
  const asignacion = control.get('fecha_asignacion')?.value;
  const entrega = control.get('fecha_entrega')?.value;

  if (!asignacion || !entrega) {
    return null;
  }

  return entrega >= asignacion ? null : { rangoFechas: true };
}

@Component({
  selector: 'app-tarea-form',
  imports: [ReactiveFormsModule, RouterLink, CardComponent],
  templateUrl: './tarea-form.html',
  styleUrl: './tarea-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TareaFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly tareaService = inject(TareaService);
  private readonly materiaService = inject(MateriaService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly tareaId = signal<string | null>(null);
  readonly modoEdicion = computed(() => this.tareaId() !== null);
  readonly loading = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly materias = signal<Materia[]>([]);

  readonly tipos = TIPOS_TAREA;
  readonly prioridades = PRIORIDADES_TAREA;
  readonly estados = ESTADOS_TAREA;
  readonly largoMaximoDescripcion = LARGO_MAXIMO_DESCRIPCION;

  readonly form = this.fb.nonNullable.group(
    {
      materia_id: ['', [Validators.required]],
      titulo: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
      descripcion: ['', [Validators.maxLength(LARGO_MAXIMO_DESCRIPCION)]],
      tipo: ['tarea' as TipoTarea, [Validators.required]],
      prioridad: ['media' as PrioridadTarea, [Validators.required]],
      fecha_asignacion: [this.fechaHoy(), [Validators.required]],
      fecha_entrega: [''],
      estado: ['pendiente' as EstadoTarea, [Validators.required]],
    },
    { validators: [validarRangoFechas] },
  );

  readonly tituloPagina = computed(() =>
    this.modoEdicion() ? 'Editar tarea' : 'Nueva tarea',
  );

  readonly botonGuardarTexto = computed(() => {
    if (this.guardando()) {
      return 'Guardando...';
    }

    return this.modoEdicion() ? 'Actualizar tarea' : 'Crear tarea';
  });

  readonly descripcionActual = computed(() => this.form.controls.descripcion.value.length);

  readonly hayMaterias = computed(() => this.materias().length > 0);

  ngOnInit(): void {
    this.cargarMaterias();
    this.cargarTareaSiEsEdicion();
  }

  cargarMaterias(): void {
    this.materiaService
      .listarMaterias({ limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (respuesta) => {
          this.materias.set(respuesta.data);

          if (!this.modoEdicion() && respuesta.data.length === 1) {
            this.form.controls.materia_id.setValue(respuesta.data[0].id);
          }
        },
        error: () => this.materias.set([]),
      });
  }

  cargarTareaSiEsEdicion(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      return;
    }

    this.tareaId.set(id);
    this.loading.set(true);
    this.error.set(null);

    this.tareaService
      .obtenerTarea(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tarea) => {
          this.form.patchValue({
            materia_id: tarea.materia_id,
            titulo: tarea.titulo,
            descripcion: tarea.descripcion ?? '',
            tipo: tarea.tipo,
            prioridad: tarea.prioridad,
            fecha_asignacion: this.tareaService.aFechaInput(tarea.fecha_asignacion),
            fecha_entrega: this.tareaService.aFechaInput(tarea.fecha_entrega),
            estado: tarea.estado,
          });
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo cargar la tarea.'));
          this.loading.set(false);
        },
      });
  }

  onSubmit(): void {
    if (this.guardando()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos marcados antes de guardar.');
      return;
    }

    const valores = this.form.getRawValue();
    const payload: CrearTareaInput = {
      materia_id: valores.materia_id,
      titulo: valores.titulo.trim(),
      descripcion: valores.descripcion.trim() || null,
      tipo: valores.tipo,
      prioridad: valores.prioridad,
      fecha_asignacion: this.tareaService.aFechaAsignacionIso(valores.fecha_asignacion),
      fecha_entrega: valores.fecha_entrega
        ? this.tareaService.aFechaEntregaIso(valores.fecha_entrega)
        : null,
      estado: valores.estado,
    };

    this.guardando.set(true);
    this.error.set(null);

    const peticion = this.modoEdicion()
      ? this.tareaService.actualizarTarea(this.tareaId()!, payload)
      : this.tareaService.crearTarea(payload);

    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.guardando.set(false);
        this.router.navigate(['/tareas']);
      },
      error: (error: unknown) => {
        this.error.set(mensajeDeErrorHttp(error, 'No se pudo guardar la tarea.'));
        this.guardando.set(false);
      },
    });
  }

  cancelar(): void {
    this.router.navigate(['/tareas']);
  }

  tieneError(nombre: string, tipo: string): boolean {
    const control = this.form.get(nombre);

    return control ? control.hasError(tipo) && (control.touched || control.dirty) : false;
  }

  tieneErrorRango(): boolean {
    const { fecha_asignacion, fecha_entrega } = this.form.controls;

    return (
      this.form.hasError('rangoFechas') && (fecha_asignacion.touched || fecha_entrega.touched)
    );
  }

  obtenerMensajeError(nombre: string): string {
    const control = this.form.get(nombre);

    if (!control || !control.errors) {
      return '';
    }

    if (control.hasError('required')) {
      return 'Este campo es obligatorio.';
    }

    if (control.hasError('minlength')) {
      return `Mínimo ${control.errors['minlength'].requiredLength} caracteres.`;
    }

    if (control.hasError('maxlength')) {
      return `Máximo ${control.errors['maxlength'].requiredLength} caracteres.`;
    }

    return 'Campo inválido.';
  }

  private fechaHoy(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
