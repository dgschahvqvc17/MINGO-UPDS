import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MateriaService, type Materia } from '../../core/services/materia.service';
import {
  ProgresoService,
  type CrearObjetivoInput,
} from '../../core/services/progreso.service';
import {
  ESTADOS_OBJETIVO,
  ETIQUETAS_OBJETIVO,
  type EstadoObjetivo,
  type Objetivo,
  type Progreso,
} from '../../core/models/progreso.model';
import { mensajeDeErrorHttp } from '../../core/utils/http-error';

type FiltroObjetivos = 'todos' | EstadoObjetivo;

const LIMITE_MATERIAS = 100;
const LIMITE_OBJETIVOS = 20;
const PORCENTAJE_COMPLETO = 100;

@Component({
  selector: 'app-progreso',
  imports: [DatePipe, RouterLink],
  templateUrl: './progreso.html',
  styleUrl: './progreso.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProgresoPage {
  private readonly progresoService = inject(ProgresoService);
  private readonly materiaService = inject(MateriaService);
  private readonly destroyRef = inject(DestroyRef);

  readonly estados = ESTADOS_OBJETIVO;
  readonly etiquetasEstado = ETIQUETAS_OBJETIVO;

  readonly progreso = signal<Progreso | null>(null);
  readonly objetivos = signal<Objetivo[]>([]);
  readonly totalObjetivos = signal(0);
  readonly materias = signal<Materia[]>([]);
  readonly filtro = signal<FiltroObjetivos>('todos');

  readonly titulo = signal('');
  readonly descripcion = signal('');
  readonly materiaId = signal('');
  readonly fechaLimite = signal('');
  readonly estado = signal<EstadoObjetivo>('pendiente');
  readonly editandoId = signal<string | null>(null);

  readonly cargandoProgreso = signal(true);
  readonly cargandoObjetivos = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorFormulario = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);

  readonly materiasActivas = computed(() =>
    this.materias().filter((materia) => materia.estado === 'activo'),
  );

  readonly objetivosFiltrados = computed(() => {
    const filtro = this.filtro();
    const objetivos = this.objetivos();
    return filtro === 'todos'
      ? objetivos
      : objetivos.filter((objetivo) => objetivo.estado === filtro);
  });

  readonly hayMasObjetivos = computed(() => this.objetivos().length < this.totalObjetivos());

  readonly puedeGuardar = computed(
    () => this.titulo().trim().length >= 5 && !this.guardando(),
  );

  readonly cumplimientoGeneral = computed(() => {
    const progreso = this.progreso();
    if (!progreso) {
      return 0;
    }

    const valores = [
      progreso.cumplimiento_tareas,
      progreso.cumplimiento_sesiones,
      progreso.cumplimiento_objetivos,
    ];

    const promedio = valores.reduce((total, valor) => total + valor, 0) / valores.length;
    return Math.round(promedio * PORCENTAJE_COMPLETO);
  });

  readonly donutBackground = computed(() => {
    const porcentaje = this.cumplimientoGeneral();
    return `conic-gradient(var(--mingo-primary) 0% ${porcentaje}%, var(--mingo-primary-soft) ${porcentaje}% 100%)`;
  });

  readonly maximoActividad = computed(() => {
    const dias = this.progreso()?.actividad_semanal ?? [];
    return Math.max(1, ...dias.map((dia) => dia.tareas + dia.sesiones));
  });

  readonly sinActividadSemanal = computed(() =>
    (this.progreso()?.actividad_semanal ?? []).every(
      (dia) => dia.tareas === 0 && dia.sesiones === 0,
    ),
  );

  readonly indicadores = computed(() => {
    const progreso = this.progreso();
    if (!progreso) {
      return [];
    }

    return [
      { etiqueta: 'Tareas', valor: progreso.cumplimiento_tareas, color: 'primary' },
      { etiqueta: 'Sesiones', valor: progreso.cumplimiento_sesiones, color: 'success' },
      { etiqueta: 'Objetivos', valor: progreso.cumplimiento_objetivos, color: 'info' },
    ];
  });

  readonly horasEstudiadas = computed(
    () => Math.floor((this.progreso()?.minutos_estudiados ?? 0) / 60),
  );

  readonly minutosEstudiados = computed(
    () => (this.progreso()?.minutos_estudiados ?? 0) % 60,
  );

  constructor() {
    this.cargarMaterias();
    this.cargarProgreso();
    this.cargarObjetivos();
  }

  cargarMaterias(): void {
    this.materiaService
      .listarMaterias({ estado: 'activo', limit: LIMITE_MATERIAS })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (respuesta) => this.materias.set(respuesta.data ?? []),
        error: () => this.errorFormulario.set('No se pudieron cargar tus materias.'),
      });
  }

  cargarProgreso(): void {
    this.cargandoProgreso.set(true);

    this.progresoService
      .obtenerProgreso()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (progreso) => {
          this.progreso.set(progreso);
          this.cargandoProgreso.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo cargar tu progreso académico.'));
          this.progreso.set(null);
          this.cargandoProgreso.set(false);
        },
      });
  }

  cargarObjetivos(): void {
    this.cargandoObjetivos.set(true);
    this.error.set(null);

    const estado = this.filtro();
    this.progresoService
      .listarObjetivos({
        ...(estado === 'todos' ? {} : { estado }),
        limit: LIMITE_OBJETIVOS,
        offset: 0,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ objetivos, total }) => {
          this.objetivos.set(objetivos);
          this.totalObjetivos.set(total);
          this.cargandoObjetivos.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudieron cargar tus objetivos.'));
          this.objetivos.set([]);
          this.cargandoObjetivos.set(false);
        },
      });
  }

  cargarMas(): void {
    if (this.cargandoObjetivos() || !this.hayMasObjetivos()) {
      return;
    }

    this.cargandoObjetivos.set(true);
    const estado = this.filtro();

    this.progresoService
      .listarObjetivos({
        ...(estado === 'todos' ? {} : { estado }),
        limit: LIMITE_OBJETIVOS,
        offset: this.objetivos().length,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ objetivos, total }) => {
          this.objetivos.update((actuales) => [...actuales, ...objetivos]);
          this.totalObjetivos.set(total);
          this.cargandoObjetivos.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudieron cargar más objetivos.'));
          this.cargandoObjetivos.set(false);
        },
      });
  }

  cambiarFiltro(filtro: FiltroObjetivos): void {
    if (this.filtro() === filtro) {
      return;
    }

    this.filtro.set(filtro);
    this.objetivos.set([]);
    this.totalObjetivos.set(0);
    this.cargarObjetivos();
  }

  editar(objetivo: Objetivo): void {
    this.editandoId.set(objetivo.id);
    this.titulo.set(objetivo.titulo);
    this.descripcion.set(objetivo.descripcion ?? '');
    this.materiaId.set(objetivo.materia_id ?? '');
    this.fechaLimite.set(objetivo.fecha_limite ?? '');
    this.estado.set(objetivo.estado);
    this.errorFormulario.set(null);
  }

  cancelarEdicion(): void {
    this.limpiarFormulario();
  }

  guardar(): void {
    if (!this.puedeGuardar()) {
      return;
    }

    const datos: CrearObjetivoInput = {
      titulo: this.titulo().trim(),
      descripcion: this.descripcion().trim() || undefined,
      materia_id: this.materiaId() || null,
      fecha_limite: this.fechaLimite() || null,
    };

    this.guardando.set(true);
    this.errorFormulario.set(null);
    this.mensajeExito.set(null);

    const editandoId = this.editandoId();
    const peticion = editandoId
      ? this.progresoService.actualizarObjetivo(editandoId, {
          ...datos,
          estado: this.estado(),
        })
      : this.progresoService.crearObjetivo(datos);

    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.guardando.set(false);
        this.mensajeExito.set(
          this.editandoId() ? 'Objetivo actualizado correctamente.' : 'Objetivo registrado correctamente.',
        );
        this.limpiarFormulario();
        this.cargarObjetivos();
        this.cargarProgreso();
      },
      error: (error: unknown) => {
        this.guardando.set(false);
        this.errorFormulario.set(
          mensajeDeErrorHttp(error, 'No se pudo guardar el objetivo.'),
        );
      },
    });
  }

  cambiarEstado(objetivo: Objetivo, estado: EstadoObjetivo): void {
    if (objetivo.estado === estado) {
      return;
    }

    this.progresoService
      .actualizarObjetivo(objetivo.id, { estado })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.mensajeExito.set('Estado del objetivo actualizado.');
          this.cargarObjetivos();
          this.cargarProgreso();
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo actualizar el estado.'));
        },
      });
  }

  eliminar(objetivo: Objetivo): void {
    this.progresoService
      .eliminarObjetivo(objetivo.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.mensajeExito.set('Objetivo eliminado.');
          if (this.editandoId() === objetivo.id) {
            this.limpiarFormulario();
          }
          this.cargarObjetivos();
          this.cargarProgreso();
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo eliminar el objetivo.'));
        },
      });
  }

  alturaBarra(valor: number): number {
    return valor === 0 ? 0 : Math.round((valor / this.maximoActividad()) * PORCENTAJE_COMPLETO);
  }

  porcentaje(valor: number): number {
    return Math.round(valor * PORCENTAJE_COMPLETO);
  }

  private limpiarFormulario(): void {
    this.editandoId.set(null);
    this.titulo.set('');
    this.descripcion.set('');
    this.materiaId.set('');
    this.fechaLimite.set('');
    this.estado.set('pendiente');
  }
}
