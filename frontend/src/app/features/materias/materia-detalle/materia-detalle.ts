import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of, switchMap } from 'rxjs';
import { MateriaService, type Materia } from '../../../core/services/materia.service';
import { AuthService } from '../../../core/services/auth.service';
import { UsuarioAdminService, type UsuarioListado } from '../../../core/services/usuario-admin.service';
import {
  InscripcionService,
  type Inscripcion,
} from '../../../core/services/inscripcion.service';
import { mensajeDeErrorHttp } from '../../../core/utils/http-error';
import { CardComponent } from '../../../shared/components/card/card.component';

const PATRON_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-materia-detalle',
  imports: [ReactiveFormsModule, CardComponent, RouterLink],
  templateUrl: './materia-detalle.html',
  styleUrl: './materia-detalle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MateriaDetallePage implements OnInit {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly materiaService = inject(MateriaService);
  private readonly authService = inject(AuthService);
  private readonly usuarioAdminService = inject(UsuarioAdminService);
  private readonly inscripcionService = inject(InscripcionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly materiaId = this.route.snapshot.paramMap.get('id') || '';
  readonly materia = signal<Materia | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly inscripciones = signal<Inscripcion[]>([]);
  readonly totalInscripciones = signal(0);
  readonly cargandoInscripciones = signal(false);
  readonly errorInscripciones = signal<string | null>(null);
  readonly mensajeInscripcion = signal<string | null>(null);
  readonly inscribiendo = signal(false);
  readonly estudiantes = signal<UsuarioListado[]>([]);

  readonly inscripcionForm = this.formBuilder.group({
    estudianteId: ['', [Validators.required, Validators.pattern(PATRON_UUID)]],
  });

  readonly usuarioActual = this.authService.profile;
  readonly usuarioActualId = computed(() => this.usuarioActual()?.id || '');
  readonly esAdmin = computed(() => this.authService.role() === 'administrador');
  readonly esDocente = computed(() => this.authService.role() === 'docente');

  /** Admin o docente responsable de la materia. Los estudiantes solo consultan. */
  readonly puedeGestionar = computed(() => {
    const rol = this.authService.role();
    const materia = this.materia();

    if (rol === 'administrador') {
      return true;
    }

    return this.esDocente() && Boolean(materia && materia.docente_id === this.usuarioActualId());
  });

  readonly puedeCrearMateria = computed(() => this.esAdmin() || this.esDocente());
  readonly puedeModificarMateria = this.puedeGestionar;

  readonly progresoTareas = computed(() => {
    const materia = this.materia();
    if (!materia || materia.total_tareas === 0) {
      return 0;
    }

    const completadas = materia.total_tareas - materia.tareas_pendientes;
    return Math.round((completadas / materia.total_tareas) * 100);
  });

  readonly tieneContenido = computed(() => {
    const materia = this.materia();
    return Boolean(materia && (materia.total_tareas > 0 || materia.total_documentos > 0));
  });

  readonly estadoTexto = computed(() => {
    const materia = this.materia();
    return materia ? this.materiaService.obtenerEstadoTexto(materia.estado) : '';
  });

  readonly descripcionPeriodo = computed(() => {
    const materia = this.materia();
    return materia ? this.materiaService.obtenerDescripcionPeriodo(materia.periodo_academico) : '';
  });

  ngOnInit(): void {
    this.cargarMateria();

    if (this.esAdmin()) {
      this.cargarEstudiantes();
    }
  }

  cargarMateria(): void {
    if (!this.materiaId) {
      this.error.set('ID de materia no válido');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.cargandoInscripciones.set(true);

    this.materiaService
      .obtenerMateria(this.materiaId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap((materia) => {
          this.materia.set(materia);
          this.loading.set(false);
          return this.puedeGestionar()
            ? this.inscripcionService.listar(this.materiaId)
            : of(null);
        }),
      )
      .subscribe({
        next: (resultado) => {
          if (!resultado) {
            return;
          }

          this.inscripciones.set(resultado.inscripciones);
          this.totalInscripciones.set(resultado.total);
          this.cargandoInscripciones.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo cargar la materia.'));
          this.errorInscripciones.set(mensajeDeErrorHttp(error, 'No se pudieron cargar las inscripciones.'));
          this.cargandoInscripciones.set(false);
          this.loading.set(false);
        },
      });
  }

  private cargarEstudiantes(): void {
    this.usuarioAdminService
      .listarEstudiantes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (estudiantes) => this.estudiantes.set(estudiantes),
        error: () => this.estudiantes.set([]),
      });
  }

  cargarInscripciones(): void {
    if (!this.puedeGestionar()) {
      return;
    }

    this.cargandoInscripciones.set(true);
    this.errorInscripciones.set(null);

    this.inscripcionService
      .listar(this.materiaId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.inscripciones.set(resultado.inscripciones);
          this.totalInscripciones.set(resultado.total);
          this.cargandoInscripciones.set(false);
        },
        error: (error: unknown) => {
          this.errorInscripciones.set(mensajeDeErrorHttp(error, 'No se pudieron cargar las inscripciones.'));
          this.cargandoInscripciones.set(false);
        },
      });
  }

  inscribir(): void {
    if (!this.puedeGestionar() || this.inscribiendo() || this.inscripcionForm.invalid) {
      this.inscripcionForm.markAllAsTouched();
      return;
    }

    const usuarioId = this.inscripcionForm.controls.estudianteId.value.trim();
    this.inscribiendo.set(true);
    this.errorInscripciones.set(null);
    this.mensajeInscripcion.set(null);

    this.inscripcionService
      .inscribir(this.materiaId, usuarioId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.inscribiendo.set(false);
          this.inscripcionForm.reset({ estudianteId: '' });
          this.mensajeInscripcion.set('Estudiante inscrito correctamente.');
          this.cargarInscripciones();
        },
        error: (error: unknown) => {
          this.errorInscripciones.set(mensajeDeErrorHttp(error, 'No se pudo inscribir al estudiante.'));
          this.inscribiendo.set(false);
        },
      });
  }

  desinscribir(inscripcion: Inscripcion): void {
    if (!this.puedeGestionar() || this.inscribiendo()) {
      return;
    }

    this.inscribiendo.set(true);
    this.errorInscripciones.set(null);
    this.mensajeInscripcion.set(null);

    this.inscripcionService
      .desinscribir(this.materiaId, inscripcion.usuario_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.inscribiendo.set(false);
          this.mensajeInscripcion.set('Inscripción dada de baja correctamente.');
          this.cargarInscripciones();
        },
        error: (error: unknown) => {
          this.errorInscripciones.set(mensajeDeErrorHttp(error, 'No se pudo dar de baja la inscripción.'));
          this.inscribiendo.set(false);
        },
      });
  }

  nombreEstudiante(inscripcion: Inscripcion): string {
    const estudiante = inscripcion.estudiante;
    return estudiante ? `${estudiante.nombre} ${estudiante.apellido}`.trim() : 'Estudiante';
  }

  tieneErrorEstudiante(): boolean {
    const control = this.inscripcionForm.controls.estudianteId;
    return control.invalid && (control.touched || control.dirty);
  }

  editarMateria(): void {
    if (this.puedeModificarMateria()) {
      void this.router.navigate(['editar'], { relativeTo: this.route });
    }
  }

  cambiarEstado(): void {
    const materia = this.materia();
    if (!materia || !this.puedeModificarMateria()) {
      return;
    }

    const nuevoEstado = materia.estado === 'activo' ? 'archivado' : 'activo';
    this.error.set(null);

    this.materiaService
      .cambiarEstadoMateria(materia.id, nuevoEstado)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.cargarMateria(),
        error: (error: unknown) =>
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo cambiar el estado de la materia.')),
      });
  }

  verTareas(): void {
    const materia = this.materia();
    if (!materia) {
      return;
    }

    void this.router.navigate(['/tareas'], { queryParams: { materia_id: materia.id } });
  }

  verDocumentos(): void {
    const materia = this.materia();
    void this.router.navigate(['/biblioteca'], {
      queryParams: materia ? { materia_id: materia.id } : {},
    });
  }

  subirDocumento(): void {
    const materia = this.materia();
    if (!materia || !this.puedeGestionar()) {
      return;
    }

    void this.router.navigate(['/biblioteca'], {
      queryParams: { materia_id: materia.id, subir: '1' },
    });
  }

  volverALista(): void {
    void this.router.navigate(['/materias']);
  }

  obtenerNombreCompleto(): string {
    const materia = this.materia();
    return materia ? this.materiaService.formatearNombreCompleto(materia) : '';
  }

  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  obtenerColorFondo(): string {
    return this.materia()?.color ?? '';
  }

  obtenerIniciales(): string {
    const materia = this.materia();
    if (!materia) {
      return '';
    }

    return materia.nombre
      .split(' ')
      .slice(0, 3)
      .map((palabra) => palabra.charAt(0).toUpperCase())
      .join('');
  }
}
