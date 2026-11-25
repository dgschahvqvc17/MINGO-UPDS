import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, map, of } from 'rxjs';
import {
  CrearMateriaRequest,
  ActualizarMateriaRequest,
  MateriaService,
} from '../../../core/services/materia.service';
import { AuthService } from '../../../core/services/auth.service';
import { UsuarioAdminService } from '../../../core/services/usuario-admin.service';
import { mensajeDeErrorHttp } from '../../../core/utils/http-error';
import { CardComponent } from '../../../shared/components/card/card.component';

interface DocenteOpcion {
  id: string;
  nombre: string;
}

type CampoFormulario =
  | 'nombre'
  | 'codigo'
  | 'docente_id'
  | 'descripcion'
  | 'periodo_academico'
  | 'color';

const COLOR_PREDETERMINADO = '#3B82F6';

@Component({
  selector: 'app-materia-form',
  imports: [ReactiveFormsModule, CardComponent, RouterLink],
  templateUrl: './materia-form.html',
  styleUrl: './materia-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MateriaFormPage implements OnInit {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly materiaService = inject(MateriaService);
  private readonly usuarioAdminService = inject(UsuarioAdminService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly materiaId = signal<string | null>(null);
  readonly modoEdicion = computed(() => this.materiaId() !== null);
  readonly estadoMateria = signal<'activo' | 'archivado' | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);

  readonly coloresDisponibles = signal<string[]>([]);
  readonly periodosAcademicos = signal<string[]>([]);
  readonly docentes = signal<DocenteOpcion[]>([]);

  readonly form = this.formBuilder.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    codigo: [
      '',
      [
        Validators.required,
        Validators.minLength(1),
        Validators.maxLength(20),
        Validators.pattern(/^[A-Z0-9-]+$/),
      ],
    ],
    docente_id: ['', [Validators.required]],
    descripcion: ['', [Validators.maxLength(500)]],
    periodo_academico: ['', [Validators.required, Validators.pattern(/^\d{4}-[12]$/)]],
    color: [COLOR_PREDETERMINADO, [Validators.required, Validators.pattern(/^#[0-9A-F]{6}$/i)]],
  });

  readonly tituloPagina = computed(() =>
    this.modoEdicion() ? 'Editar materia' : 'Nueva materia',
  );

  readonly botonGuardarTexto = computed(() =>
    this.guardando() ? 'Guardando...' : this.modoEdicion() ? 'Actualizar materia' : 'Crear materia',
  );

  readonly nombreDocente = computed(
    () => this.docentes().find((docente) => docente.id === this.form.controls.docente_id.value)?.nombre ?? '',
  );

  readonly descripcionPeriodo = computed(() => {
    const periodo = this.form.controls.periodo_academico.value;
    return this.materiaService.validarPeriodoAcademico(periodo)
      ? this.materiaService.obtenerDescripcionPeriodo(periodo)
      : '';
  });

  readonly esAdmin = computed(() => this.authService.role() === 'administrador');

  ngOnInit(): void {
    this.cargarMetadatos();
    this.cargarMateriaSiEsEdicion();
  }

  cargarMetadatos(): void {
    const docentes = this.esAdmin()
      ? this.usuarioAdminService.listarDocentes().pipe(
          map((usuarios) =>
            usuarios.map((usuario) => ({
              id: usuario.id,
              nombre: `${usuario.nombre} ${usuario.apellido}`.trim(),
            })),
          ),
        )
      : of(this.docenteActualComoOpcion());

    forkJoin({
      colores: this.materiaService.obtenerColoresDisponibles(),
      periodos: this.materiaService.obtenerPeriodosAcademicos(),
      docentes,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ colores, periodos, docentes: opciones }) => {
          this.coloresDisponibles.set(colores);
          this.periodosAcademicos.set(periodos);
          this.docentes.set(opciones);
          if (!this.modoEdicion() && opciones.length === 1) {
            this.form.controls.docente_id.setValue(opciones[0].id);
          }
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo preparar el formulario.'));
        },
      });
  }

  cargarMateriaSiEsEdicion(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.materiaId.set(id);
    this.loading.set(true);
    this.error.set(null);

    this.materiaService
      .obtenerMateria(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (materia) => {
          if (
            !this.esAdmin() &&
            materia.docente_id &&
            materia.docente_id !== this.authService.profile()?.id
          ) {
            this.error.set('No tienes permiso para editar esta materia.');
            void this.router.navigate(['/materias', id]);
            return;
          }

          this.estadoMateria.set(materia.estado);
          this.registrarDocenteDeMateria(materia.docente_id, materia.docente);
          this.form.patchValue({
            nombre: materia.nombre,
            codigo: materia.codigo,
            docente_id: materia.docente_id ?? '',
            descripcion: materia.descripcion ?? '',
            periodo_academico: materia.periodo_academico,
            color: materia.color,
          });
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo cargar la materia.'));
          this.loading.set(false);
        },
      });
  }

  onSubmit(): void {
    if (this.form.invalid || this.guardando()) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos marcados antes de continuar.');
      return;
    }

    const valores = this.form.getRawValue();
    const nombreDocente = this.nombreDocente();

    if (!nombreDocente) {
      this.error.set('Selecciona un docente válido.');
      return;
    }

    const datos: CrearMateriaRequest = {
      nombre: valores.nombre.trim(),
      codigo: valores.codigo.trim().toUpperCase(),
      docente: nombreDocente,
      docente_id: valores.docente_id,
      descripcion: valores.descripcion.trim() || null,
      periodo_academico: valores.periodo_academico,
      color: valores.color,
    };

    this.guardando.set(true);
    this.error.set(null);

    const solicitud = this.modoEdicion()
      ? this.materiaService
          .actualizarMateria(this.materiaId()!, datos as ActualizarMateriaRequest)
          .pipe(map((materia) => ({ id: materia.id, creada: false })))
      : this.materiaService
          .crearMateria(datos)
          .pipe(map((materia) => ({ id: materia.id, creada: true })));

    solicitud.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ id }) => {
        this.guardando.set(false);
        void this.router.navigate(['/materias', id]);
      },
      error: (error: unknown) => {
        this.error.set(mensajeDeErrorHttp(error, 'No se pudo guardar la materia.'));
        this.guardando.set(false);
      },
    });
  }

  archivarMateria(): void {
    const id = this.materiaId();
    const estadoActual = this.estadoMateria();
    if (!id || !estadoActual || this.guardando()) {
      return;
    }

    const nuevoEstado = estadoActual === 'activo' ? 'archivado' : 'activo';
    this.guardando.set(true);
    this.error.set(null);

    this.materiaService
      .cambiarEstadoMateria(id, nuevoEstado)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.estadoMateria.set(nuevoEstado);
          this.guardando.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo cambiar el estado de la materia.'));
          this.guardando.set(false);
        },
      });
  }

  seleccionarColor(color: string): void {
    this.form.controls.color.setValue(color);
  }

  generarSiguientePeriodo(): void {
    const ultimoPeriodo = this.periodosAcademicos()[0];
    if (!ultimoPeriodo || !this.materiaService.validarPeriodoAcademico(ultimoPeriodo)) {
      return;
    }

    try {
      this.form.controls.periodo_academico.setValue(
        this.materiaService.generarPeriodoSiguiente(ultimoPeriodo),
      );
    } catch {
      this.error.set('No se pudo calcular el siguiente periodo académico.');
    }
  }

  tieneError(campo: CampoFormulario, tipo: string): boolean {
    const control = this.form.controls[campo];
    return control.hasError(tipo) && (control.touched || control.dirty);
  }

  obtenerMensajeError(campo: CampoFormulario): string {
    const control = this.form.controls[campo];

    if (control.hasError('required')) {
      return 'Este campo es obligatorio';
    }
    if (control.hasError('minlength')) {
      return `Mínimo ${this.longitudRequerida(control, 'minlength')} caracteres`;
    }
    if (control.hasError('maxlength')) {
      return `Máximo ${this.longitudRequerida(control, 'maxlength')} caracteres`;
    }
    if (control.hasError('pattern')) {
      const mensajes: Partial<Record<CampoFormulario, string>> = {
        codigo: 'Solo letras mayúsculas, números y guiones',
        periodo_academico: 'Formato: AÑO-SEMESTRE (ej: 2024-1)',
        color: 'Formato hexadecimal (ej: #3B82F6)',
      };
      return mensajes[campo] ?? 'Formato inválido';
    }

    return 'Campo inválido';
  }

  cancelar(): void {
    void this.router.navigate(this.modoEdicion() ? ['/materias', this.materiaId()] : ['/materias']);
  }

  obtenerColorFondo(color: string): string {
    return color;
  }

  obtenerColorTexto(color: string): string {
    const rojo = Number.parseInt(color.slice(1, 3), 16);
    const verde = Number.parseInt(color.slice(3, 5), 16);
    const azul = Number.parseInt(color.slice(5, 7), 16);
    const luminosidad = (0.299 * rojo + 0.587 * verde + 0.114 * azul) / 255;

    return luminosidad > 0.5 ? '#000000' : '#FFFFFF';
  }

  estaColorSeleccionado(color: string): boolean {
    return this.form.controls.color.value === color;
  }

  private registrarDocenteDeMateria(docenteId: string | null, nombre: string): void {
    if (!docenteId) {
      return;
    }

    this.docentes.update((docentes) =>
      docentes.some((docente) => docente.id === docenteId)
        ? docentes
        : [...docentes, { id: docenteId, nombre }],
    );
  }

  private docenteActualComoOpcion(): DocenteOpcion[] {
    const perfil = this.authService.profile();
    if (!perfil || perfil.role !== 'docente') {
      return [];
    }

    return [
      {
        id: perfil.id,
        nombre: `${perfil.nombre} ${perfil.apellido}`.trim(),
      },
    ];
  }

  private longitudRequerida(control: AbstractControl, tipo: string): number {
    const error = control.errors?.[tipo] as { requiredLength?: number } | null;
    return error?.requiredLength ?? 0;
  }
}
