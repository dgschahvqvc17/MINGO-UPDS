import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MateriaService, type Materia } from '../../../core/services/materia.service';
import { AuthService } from '../../../core/services/auth.service';
import { CardComponent } from '../../../shared/components/card/card.component';

@Component({
  selector: 'app-materia-detalle',
  imports: [CardComponent, RouterLink],
  templateUrl: './materia-detalle.html',
  styleUrl: './materia-detalle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MateriaDetallePage {
  private readonly materiaService = inject(MateriaService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly materiaId = this.route.snapshot.paramMap.get('id') || '';
  readonly materia = signal<Materia | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  // Usuario actual
  readonly usuarioActual = this.authService.profile;
  readonly usuarioActualId = computed(() => this.usuarioActual()?.id || '');

  // Computed properties
  readonly puedeModificar = computed(() => {
    const materia = this.materia();
    return materia ? materia.usuario_id === this.usuarioActualId() : false;
  });

  readonly progresoTareas = computed(() => {
    const materia = this.materia();
    if (!materia || materia.total_tareas === 0) return 0;
    const completadas = materia.total_tareas - materia.tareas_pendientes;
    return Math.round((completadas / materia.total_tareas) * 100);
  });

  readonly tieneContenido = computed(() => {
    const materia = this.materia();
    return materia ? (materia.total_tareas > 0 || materia.total_documentos > 0) : false;
  });

  readonly estadoTexto = computed(() => {
    const materia = this.materia();
    return materia ? this.materiaService.obtenerEstadoTexto(materia.estado) : '';
  });

  readonly descripcionPeriodo = computed(() => {
    const materia = this.materia();
    return materia ? this.materiaService.obtenerDescripcionPeriodo(materia.periodo_academico) : '';
  });

  constructor() {
    this.cargarMateria();
  }

  /**
   * Carga la información de la materia
   */
  async cargarMateria(): Promise<void> {
    if (!this.materiaId) {
      this.error.set('ID de materia no válido');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const materia = await this.materiaService.obtenerMateria(this.materiaId).toPromise();
      this.materia.set(materia || null);
      
      if (!materia) {
        this.error.set('Materia no encontrada');
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Error al cargar la materia');
      console.error('Error al cargar materia:', error);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Edita la materia actual
   */
  editarMateria(): void {
    if (this.puedeModificar()) {
      this.router.navigate(['editar'], { relativeTo: this.route });
    }
  }

  /**
   * Cambia el estado de la materia (activar/archivar)
   */
  async cambiarEstado(): Promise<void> {
    const materia = this.materia();
    if (!materia || !this.puedeModificar()) return;

    const nuevoEstado = materia.estado === 'activo' ? 'archivado' : 'activo';
    const confirmacion = confirm(
      `¿Estás seguro de ${nuevoEstado === 'archivado' ? 'archivar' : 'activar'} la materia ${materia.nombre}?`
    );

    if (!confirmacion) return;

    try {
      await this.materiaService.cambiarEstadoMateria(materia.id, nuevoEstado).toPromise();
      alert(`Materia ${nuevoEstado === 'archivado' ? 'archivada' : 'activada'} exitosamente`);
      
      // Recargar datos de la materia
      this.cargarMateria();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al cambiar el estado de la materia');
    }
  }

  /**
   * Navega a las tareas filtradas por esta materia
   */
  verTareas(): void {
    const materia = this.materia();
    if (!materia) return;
    this.router.navigate(['/tareas'], { queryParams: { materia_id: materia.id } });
  }

  /**
   * Navega a la biblioteca de documentos filtrada por esta materia
   */
  verDocumentos(): void {
    const materia = this.materia();
    this.router.navigate(['/biblioteca'], {
      queryParams: materia ? { materia_id: materia.id } : {},
    });
  }

  /**
   * Abre la biblioteca con el formulario de carga listo para esta materia
   */
  subirDocumento(): void {
    const materia = this.materia();
    if (!materia) return;

    this.router.navigate(['/biblioteca'], {
      queryParams: { materia_id: materia.id, subir: '1' },
    });
  }

  /**
   * Volver a la lista de materias
   */
  volverALista(): void {
    this.router.navigate(['/materias']);
  }

  /**
   * Obtiene el nombre completo de la materia
   */
  obtenerNombreCompleto(): string {
    const materia = this.materia();
    return materia ? this.materiaService.formatearNombreCompleto(materia) : '';
  }

  /**
   * Formatea la fecha
   */
  formatearFecha(fecha: string): string {
    return new Date(fecha).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Obtiene el color de fondo basado en el color de la materia
   */
  obtenerColorFondo(): string {
    const materia = this.materia();
    return materia ? this.materiaService.formatearNombreCompleto(materia) : '';
  }

  /**
   * Obtiene las iniciales de la materia
   */
  obtenerIniciales(): string {
    const materia = this.materia();
    if (!materia) return '';
    
    return materia.nombre
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 3)
      .join('');
  }
}