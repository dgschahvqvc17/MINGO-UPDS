import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MateriaService, type Materia, type MateriaEstadisticas } from '../../core/services/materia.service';
import { AuthService } from '../../core/services/auth.service';
import { CardComponent } from '../../shared/components/card/card.component';

@Component({
  selector: 'app-materias',
  imports: [CommonModule, FormsModule, CardComponent, RouterLink],
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
      const params: any = {};

      if (filtros.query) params.query = filtros.query;
      if (filtros.periodo_academico !== 'todos') params.periodo_academico = filtros.periodo_academico;
      if (filtros.estado !== 'todos') params.estado = filtros.estado;
      if (this.paginacion().limit) params.limit = this.paginacion().limit;
      if (this.paginacion().offset) params.offset = this.paginacion().offset;

      const respuesta = await this.materiaService.listarMaterias(params).toPromise();
      
      if (respuesta) {
        this.materias.set(respuesta.data);
        this.paginacion.set(respuesta.meta.paginacion);
        
        // Crear objeto de estadísticas completo
        const estadisticasCompletas = {
          ...respuesta.meta.estadisticas,
          periodos_academicos: respuesta.meta.periodos_academicos
        };
        
        this.estadisticas.set(estadisticasCompletas);
        this.coloresDisponibles.set(respuesta.meta.colores_disponibles);
        this.periodosAcademicos.set(respuesta.meta.periodos_academicos);
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Error al cargar materias');
      console.error('Error al cargar materias:', error);
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
        this.materiaService.obtenerEstadisticas().toPromise(),
        this.materiaService.obtenerColoresDisponibles().toPromise(),
        this.materiaService.obtenerPeriodosAcademicos().toPromise()
      ]);

      if (estadisticas) this.estadisticas.set(estadisticas);
      if (colores) this.coloresDisponibles.set(colores);
      if (periodos) this.periodosAcademicos.set(periodos);
    } catch (error) {
      console.error('Error al cargar metadatos:', error);
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
    this.router.navigate(['/materias', materiaId, 'editar']);
  }

  /**
   * Cambia el estado de una materia (activar/archivar)
   */
  async cambiarEstado(materia: Materia): Promise<void> {
    const nuevoEstado = materia.estado === 'activo' ? 'archivado' : 'activo';
    const confirmacion = confirm(
      `¿Estás seguro de ${nuevoEstado === 'archivado' ? 'archivar' : 'activar'} la materia ${materia.nombre}?`
    );

    if (!confirmacion) return;

    try {
      await this.materiaService.cambiarEstadoMateria(materia.id, nuevoEstado).toPromise();
      alert(`Materia ${nuevoEstado === 'archivado' ? 'archivada' : 'activada'} exitosamente`);
      
      // Recargar la lista
      this.cargarMaterias();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al cambiar el estado de la materia');
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

  obtenerEstadoBadgeClase(estado: 'activo' | 'archivado'): string {
    return this.materiaService.obtenerEstadoBadgeClase(estado);
  }

  obtenerPeriodoBadgeClase(periodo: string): string {
    return this.materiaService.obtenerPeriodoBadgeClase(periodo);
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