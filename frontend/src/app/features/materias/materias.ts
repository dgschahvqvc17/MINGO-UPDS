import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  MateriaService,
  type Materia,
  type MateriaEstadisticas,
  type MateriaFiltros,
} from '../../core/services/materia.service';
import { AuthService } from '../../core/services/auth.service';
import { mensajeDeErrorHttp } from '../../core/utils/http-error';

@Component({
  selector: 'app-materias',
  imports: [FormsModule, RouterLink],
  templateUrl: './materias.html',
  styleUrl: './materias.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MateriasPage {
  private readonly materiaService = inject(MateriaService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Estado del componente
  readonly materias = signal<Materia[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  
  // Filtros de búsqueda
  readonly filtros = signal({
    query: '',
    periodo_academico: 'todos' as 'todos' | string,
    estado: 'activo' as 'todos' | 'activo' | 'archivado',
  });

  // Paginación
  readonly paginacion = signal({
    limit: 12,
    offset: 0,
    total: 0,
  });

  // Estadísticas y metadatos
  readonly estadisticas = signal<MateriaEstadisticas>({
    total: 0,
    activas: 0,
    archivadas: 0,
    por_periodo: {},
    periodos_academicos: []
  });

  readonly coloresDisponibles = signal<string[]>([]);
  readonly periodosAcademicos = signal<string[]>([]);
  readonly mensajeEstado = signal<string | null>(null);
  readonly errorMetadatos = signal<string | null>(null);
  readonly confirmandoCambioId = signal<string | null>(null);
  readonly cambiandoEstadoId = signal<string | null>(null);

  readonly puedeAdministrar = computed(() => this.authService.role() === 'administrador');

  // Usuario actual
  readonly usuarioActual = this.authService.profile;
  readonly usuarioActualId = computed(() => this.usuarioActual()?.id || '');

  // Computed properties
  readonly tieneResultados = computed(() => this.materias().length > 0);
  readonly mostrarCargando = computed(() => this.loading() && this.materias().length === 0);
  readonly mostrarError = computed(() => !this.loading() && this.error() !== null);
  readonly mostrarListaVacia = computed(() => !this.loading() && !this.error() && !this.tieneResultados());

  readonly filtrosActivos = computed(() => {
    const f = this.filtros();
    return f.query !== '' || f.periodo_academico !== 'todos' || f.estado !== 'todos';
  });

  readonly periodosConTodos = computed(() => ['todos', ...this.periodosAcademicos()]);

  constructor() {
    this.cargarMaterias();
    this.cargarMetadatos();
  }

  /**
   * Carga la lista de materias con los filtros actuales
   */
  async cargarMaterias(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const filtros = this.filtros();
      const pagination = this.paginacion();
      const params: MateriaFiltros = {
        limit: pagination.limit,
        offset: pagination.offset,
      };

      if (filtros.query) params.query = filtros.query;
      if (filtros.periodo_academico !== 'todos') {
        params.periodo_academico = filtros.periodo_academico;
      }
      if (filtros.estado !== 'todos') params.estado = filtros.estado;

      const respuesta = await firstValueFrom(this.materiaService.listarMaterias(params));

      this.materias.set(respuesta.data);
      this.paginacion.set(respuesta.meta.paginacion);
      this.estadisticas.set({
        ...respuesta.meta.estadisticas,
        periodos_academicos: respuesta.meta.periodos_academicos,
      });
      this.coloresDisponibles.set(respuesta.meta.colores_disponibles);
      this.periodosAcademicos.set(respuesta.meta.periodos_academicos);
    } catch (error) {
      this.error.set(mensajeDeErrorHttp(error, 'No se pudieron cargar las materias.'));
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Carga metadatos adicionales (estadísticas, colores, periodos)
   */
  async cargarMetadatos(): Promise<void> {
    try {
      const [estadisticas, colores, periodos] = await Promise.all([
        firstValueFrom(this.materiaService.obtenerEstadisticas()),
        firstValueFrom(this.materiaService.obtenerColoresDisponibles()),
        firstValueFrom(this.materiaService.obtenerPeriodosAcademicos()),
      ]);

      this.estadisticas.set(estadisticas);
      this.coloresDisponibles.set(colores);
      this.periodosAcademicos.set(periodos);
    } catch {
      this.errorMetadatos.set('No se pudieron actualizar los filtros de materias.');
    }
  }

  /**
   * Aplica los filtros y recarga la lista
   */
  aplicarFiltros(): void {
    // Resetear paginación cuando se cambian los filtros
    this.paginacion.update(p => ({ ...p, offset: 0 }));
    this.cargarMaterias();
  }

  /**
   * Limpia todos los filtros
   */
  limpiarFiltros(): void {
    this.filtros.set({
      query: '',
      periodo_academico: 'todos',
      estado: 'todos',
    });
    this.aplicarFiltros();
  }

  /**
   * Navega a la página de detalles de una materia
   */
  verDetalles(materiaId: string): void {
    this.router.navigate(['/materias', materiaId]);
  }

  /**
   * Navega a la edición de una materia
   */
  editarMateria(materiaId: string): void {
    if (!this.puedeAdministrar()) {
      return;
    }

    this.router.navigate(['/materias', materiaId, 'editar']);
  }

  pedirCambioEstado(materia: Materia): void {
    if (!this.puedeAdministrar()) {
      return;
    }

    this.mensajeEstado.set(null);
    this.confirmandoCambioId.set(
      this.confirmandoCambioId() === materia.id ? null : materia.id,
    );
  }

  cancelarCambioEstado(): void {
    this.confirmandoCambioId.set(null);
  }

  textoConfirmacion(materia: Materia): string {
    return materia.estado === 'activo'
      ? `¿Archivar la materia ${materia.nombre}?`
      : `¿Activar la materia ${materia.nombre}?`;
  }

  /**
   * Cambia el estado de una materia (activar/archivar) tras confirmación explícita.
   */
  async cambiarEstado(materia: Materia): Promise<void> {
    if (!this.puedeAdministrar() || this.cambiandoEstadoId()) {
      return;
    }

    const nuevoEstado = materia.estado === 'activo' ? 'archivado' : 'activo';
    this.cambiandoEstadoId.set(materia.id);
    this.mensajeEstado.set(null);

    try {
      await firstValueFrom(this.materiaService.cambiarEstadoMateria(materia.id, nuevoEstado));
      this.mensajeEstado.set(
        `Materia ${nuevoEstado === 'archivado' ? 'archivada' : 'activada'} correctamente.`,
      );
      this.confirmandoCambioId.set(null);
      await this.cargarMaterias();
    } catch (error) {
      this.mensajeEstado.set(
        mensajeDeErrorHttp(error, 'No se pudo cambiar el estado de la materia.'),
      );
    } finally {
      this.cambiandoEstadoId.set(null);
    }
  }

  /**
   * Métodos de paginación
   */
  paginaAnterior(): void {
    const offset = this.paginacion().offset - this.paginacion().limit;
    if (offset >= 0) {
      this.paginacion.update(p => ({ ...p, offset }));
      this.cargarMaterias();
    }
  }

  paginaSiguiente(): void {
    const { offset, limit, total } = this.paginacion();
    if (offset + limit < total) {
      this.paginacion.update(p => ({ ...p, offset: p.offset + p.limit }));
      this.cargarMaterias();
    }
  }

  cambiarLimite(limite: number): void {
    this.paginacion.update(p => ({ ...p, limit: limite, offset: 0 }));
    this.cargarMaterias();
  }

  /**
   * Métodos de ayuda para la vista
   */
  obtenerNombreCompleto(materia: Materia): string {
    return this.materiaService.formatearNombreCompleto(materia);
  }

  obtenerEstadoTexto(estado: 'activo' | 'archivado'): string {
    return this.materiaService.obtenerEstadoTexto(estado);
  }

  obtenerDescripcionPeriodo(periodo: string): string {
    return this.materiaService.obtenerDescripcionPeriodo(periodo);
  }

  /**
   * Calcula el progreso de tareas de una materia
   */
  calcularProgresoTareas(materia: Materia): number {
    if (materia.total_tareas === 0) return 0;
    const completadas = materia.total_tareas - materia.tareas_pendientes;
    return Math.round((completadas / materia.total_tareas) * 100);
  }

  /**
   * Obtiene el color de fondo para la tarjeta de materia
   */
  obtenerColorFondo(color: string): string {
    return color;
  }

  /**
   * Obtiene el color de texto para la tarjeta de materia (basado en contraste)
   */
  obtenerColorTexto(color: string): string {
    // Simple contraste para colores claros/oscuros
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Fórmula de luminosidad
    const luminosidad = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    return luminosidad > 0.5 ? '#000000' : '#FFFFFF';
  }

  /**
   * Obtiene las iniciales de una materia (primeras letras de cada palabra)
   */
  obtenerIniciales(materia: Materia): string {
    return materia.nombre
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 3)
      .join('');
  }

  /**
   * Formatea la fecha de creación
   */
  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }
}