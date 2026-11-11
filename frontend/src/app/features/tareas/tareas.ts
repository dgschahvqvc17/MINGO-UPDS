import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { mensajeDeErrorHttp } from '../../core/utils/http-error';
import { MateriaService, type Materia } from '../../core/services/materia.service';
import {
  ESTADOS_TAREA,
  PRIORIDADES_TAREA,
  TareaService,
  type EstadoTarea,
  type PrioridadTarea,
  type Tarea,
  type TareaEstadisticas,
  type TareaFiltros,
} from '../../core/services/tarea.service';

const LIMITE_POR_PAGINA = 9;
const DIAS_PROXIMAS = 7;

const ESTADISTICAS_INICIALES: TareaEstadisticas = {
  total: 0,
  pendientes: 0,
  en_progreso: 0,
  completadas: 0,
  vencidas: 0,
  prioridad_alta: 0,
  prioridad_media: 0,
  prioridad_baja: 0,
};

@Component({
  selector: 'app-tareas',
  imports: [FormsModule, RouterLink],
  templateUrl: './tareas.html',
  styleUrl: './tareas.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TareasPage {
  private readonly tareaService = inject(TareaService);
  private readonly materiaService = inject(MateriaService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly tareas = signal<Tarea[]>([]);
  readonly proximas = signal<Tarea[]>([]);
  readonly materias = signal<Materia[]>([]);
  readonly estadisticas = signal<TareaEstadisticas>(ESTADISTICAS_INICIALES);

  readonly loading = signal(false);
  readonly loadingProximas = signal(false);
  readonly error = signal<string | null>(null);
  readonly mensajeExito = signal<string | null>(null);

  readonly filtros = signal<TareaFiltros>({ sort: 'fecha_entrega', order: 'asc' });
  readonly paginacion = signal({ limit: LIMITE_POR_PAGINA, offset: 0, total: 0 });

  readonly prioridades = PRIORIDADES_TAREA;
  readonly estados = ESTADOS_TAREA;
  readonly diasProximas = DIAS_PROXIMAS;

  readonly filtrosActivos = computed(() => {
    const filtros = this.filtros();

    return Boolean(
      filtros.query ||
        filtros.materia_id ||
        filtros.prioridad ||
        filtros.estado ||
        filtros.vencidas,
    );
  });

  readonly tieneResultados = computed(() => this.tareas().length > 0);
  readonly mostrarCargando = computed(() => this.loading() && this.tareas().length === 0);
  readonly mostrarError = computed(() => !this.loading() && this.error() !== null);
  readonly mostrarListaVacia = computed(
    () => !this.loading() && !this.error() && !this.tieneResultados(),
  );

  readonly paginaActual = computed(() =>
    Math.floor(this.paginacion().offset / this.paginacion().limit) + 1,
  );

  readonly totalPaginas = computed(() =>
    Math.max(1, Math.ceil(this.paginacion().total / this.paginacion().limit)),
  );

  readonly rangoMostrado = computed(() => {
    const { offset, limit, total } = this.paginacion();

    if (total === 0) {
      return 'Sin tareas para mostrar';
    }

    const inicio = offset + 1;
    const fin = Math.min(offset + limit, total);

    return `Mostrando ${inicio}-${fin} de ${total} tareas`;
  });

  constructor() {
    // Permite deep-linking desde el detalle de una materia (?materia_id=<uuid>).
    const materiaId = this.route.snapshot.queryParamMap.get('materia_id');
    if (materiaId) {
      this.filtros.update((filtros) => ({ ...filtros, materia_id: materiaId }));
    }

    this.cargarMaterias();
    this.cargarTareas();
    this.cargarEstadisticas();
    this.cargarProximas();
  }

  cargarTareas(): void {
    this.loading.set(true);
    this.error.set(null);

    const { limit, offset } = this.paginacion();

    this.tareaService
      .listarTareas({ ...this.filtros(), limit, offset })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.tareas.set(resultado.tareas);
          this.paginacion.set(resultado.paginacion);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudieron cargar las tareas.'));
          this.loading.set(false);
        },
      });
  }

  cargarMaterias(): void {
    this.materiaService
      .listarMaterias({ estado: 'activo', limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (respuesta) => this.materias.set(respuesta.data),
        error: () => this.materias.set([]),
      });
  }

  cargarEstadisticas(): void {
    this.tareaService
      .obtenerEstadisticas()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (estadisticas) => this.estadisticas.set(estadisticas),
        error: () => this.estadisticas.set(ESTADISTICAS_INICIALES),
      });
  }

  cargarProximas(): void {
    this.loadingProximas.set(true);

    this.tareaService
      .listarProximas(DIAS_PROXIMAS, 5)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.proximas.set(resultado.tareas);
          this.loadingProximas.set(false);
        },
        error: () => {
          this.proximas.set([]);
          this.loadingProximas.set(false);
        },
      });
  }

  aplicarFiltros(): void {
    this.mensajeExito.set(null);
    this.paginacion.update((paginacion) => ({ ...paginacion, offset: 0 }));
    this.cargarTareas();
  }

  cerrarMensaje(): void {
    this.mensajeExito.set(null);
  }

  limpiarFiltros(): void {
    this.filtros.set({ sort: 'fecha_entrega', order: 'asc' });
    this.aplicarFiltros();
  }

  cambiarQuery(valor: string): void {
    this.filtros.update((filtros) => ({ ...filtros, query: valor.trim() || undefined }));
  }

  cambiarMateria(valor: string): void {
    this.filtros.update((filtros) => ({ ...filtros, materia_id: valor || undefined }));
  }

  cambiarPrioridad(valor: string): void {
    this.filtros.update((filtros) => ({
      ...filtros,
      prioridad: this.esPrioridad(valor) ? valor : undefined,
    }));
  }

  cambiarEstado(valor: string): void {
    this.filtros.update((filtros) => ({
      ...filtros,
      estado: this.esEstado(valor) ? valor : undefined,
    }));
  }

  cambiarVencidas(valor: boolean): void {
    this.filtros.update((filtros) => ({ ...filtros, vencidas: valor || undefined }));
  }

  cambiarOrden(valor: string): void {
    const [sort, order] = valor.split(':');

    this.filtros.update((filtros) => ({
      ...filtros,
      sort: sort === 'fecha_creacion' || sort === 'titulo' ? sort : 'fecha_entrega',
      order: order === 'desc' ? 'desc' : 'asc',
    }));
  }

  cambiarEstadoTarea(tarea: Tarea, estado: EstadoTarea): void {
    this.tareaService
      .cambiarEstadoTarea(tarea.id, estado)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.mensajeExito.set(`Estado de "${tarea.titulo}" actualizado.`);
          this.cargarTareas();
          this.cargarEstadisticas();
          this.cargarProximas();
        },
        error: (error: unknown) =>
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo actualizar la tarea.')),
      });
  }

  eliminarTarea(tarea: Tarea): void {
    const confirmado = confirm(`�Eliminar la tarea "${tarea.titulo}"?`);

    if (!confirmado) {
      return;
    }

    this.tareaService
      .eliminarTarea(tarea.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.mensajeExito.set(`Tarea "${tarea.titulo}" eliminada.`);
          this.cargarTareas();
          this.cargarEstadisticas();
          this.cargarProximas();
        },
        error: (error: unknown) =>
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo eliminar la tarea.')),
      });
  }

  paginaAnterior(): void {
    const { offset, limit } = this.paginacion();

    if (offset <= 0) {
      return;
    }

    this.paginacion.update((paginacion) => ({
      ...paginacion,
      offset: Math.max(0, offset - limit),
    }));
    this.cargarTareas();
  }

  paginaSiguiente(): void {
    const { offset, limit, total } = this.paginacion();

    if (offset + limit >= total) {
      return;
    }

    this.paginacion.update((paginacion) => ({ ...paginacion, offset: offset + limit }));
    this.cargarTareas();
  }

  obtenerMateria(tarea: Tarea) {
    return this.tareaService.obtenerMateriaDeTarea(tarea);
  }

  esVencida(tarea: Tarea): boolean {
    return this.tareaService.esTareaVencida(tarea);
  }

  formatearFecha(fecha: string | null, vacio = 'Sin fecha'): string {
    return this.tareaService.formatearFecha(fecha, vacio);
  }

  tipoTexto(tarea: Tarea): string {
    return this.tareaService.obtenerTipoTexto(tarea.tipo);
  }

  estadoTexto(estado: EstadoTarea): string {
    return this.tareaService.obtenerEstadoTexto(estado);
  }

  prioridadTexto(prioridad: PrioridadTarea): string {
    return this.tareaService.obtenerPrioridadTexto(prioridad);
  }

  estadoBadgeClase(estado: EstadoTarea): string {
    return this.tareaService.obtenerEstadoBadgeClase(estado);
  }

  prioridadBadgeClase(prioridad: PrioridadTarea): string {
    return this.tareaService.obtenerPrioridadBadgeClase(prioridad);
  }

  private esPrioridad(valor: string): valor is PrioridadTarea {
    return (PRIORIDADES_TAREA as readonly string[]).includes(valor);
  }

  private esEstado(valor: string): valor is EstadoTarea {
    return (ESTADOS_TAREA as readonly string[]).includes(valor);
  }
}
