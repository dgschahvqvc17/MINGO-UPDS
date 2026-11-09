import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UsuarioAdminService, type UsuarioListado } from '../../core/services/usuario-admin.service';
import { AuthService } from '../../core/services/auth.service';
import { CardComponent } from '../../shared/components/card/card.component';

@Component({
  selector: 'app-administracion',
  imports: [CommonModule, FormsModule, CardComponent],
  templateUrl: './administracion.html',
  styleUrl: './administracion.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdministracionPage {
  private readonly usuarioAdminService = inject(UsuarioAdminService);
  // Exponer métodos de validación del servicio para el template
  readonly validarNoAutoModificacion = (usuarioId: string) => 
    this.usuarioAdminService.validarNoAutoModificacion(usuarioId, this.usuarioActualId());
  readonly obtenerMensajeValidacion = (usuarioId: string, operacion: string) => {
    const esValido = this.usuarioAdminService.validarNoAutoModificacion(usuarioId, this.usuarioActualId());
    return this.usuarioAdminService.obtenerMensajeValidacion(esValido, operacion);
  };
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  // Estado del componente
  readonly usuarios = signal<UsuarioListado[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  
  // Filtros de búsqueda
  readonly filtros = signal({
    query: '',
    estado: 'todos' as 'todos' | 'activo' | 'inactivo',
    rol: 'todos' as 'todos' | 'administrador' | 'estudiante',
  });

  // Paginación
  readonly paginacion = signal({
    limit: 20,
    offset: 0,
    total: 0,
  });

  // Estadísticas
  readonly estadisticas = signal({
    total: 0,
    activos: 0,
    inactivos: 0,
    administradores: 0,
    estudiantes: 0,
  });

  // Usuario actual (para validaciones de seguridad)
  readonly usuarioActual = this.authService.profile;
  readonly usuarioActualId = computed(() => this.usuarioActual()?.id || '');

  // Computed properties
  readonly tieneResultados = computed(() => this.usuarios().length > 0);
  readonly mostrarCargando = computed(() => this.loading() && this.usuarios().length === 0);
  readonly mostrarError = computed(() => !this.loading() && this.error() !== null);
  readonly mostrarListaVacia = computed(() => !this.loading() && !this.error() && !this.tieneResultados());

  readonly filtrosActivos = computed(() => {
    const f = this.filtros();
    return f.query !== '' || f.estado !== 'todos' || f.rol !== 'todos';
  });

  constructor() {
    this.cargarUsuarios();
  }

  /**
   * Carga la lista de usuarios con los filtros actuales
   */
  async cargarUsuarios(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const filtros = this.filtros();
      const params: any = {};

      if (filtros.query) params.query = filtros.query;
      if (filtros.estado !== 'todos') params.estado = filtros.estado;
      if (filtros.rol !== 'todos') params.rol = filtros.rol;
      if (this.paginacion().limit) params.limit = this.paginacion().limit;
      if (this.paginacion().offset) params.offset = this.paginacion().offset;

      const respuesta = await this.usuarioAdminService.listarUsuarios(params).toPromise();
      
      if (respuesta) {
        this.usuarios.set(respuesta.usuarios);
        this.paginacion.set(respuesta.paginacion);
        this.estadisticas.set(respuesta.estadisticas);
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Error al cargar usuarios');
      console.error('Error al cargar usuarios:', error);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Aplica los filtros y recarga la lista
   */
  aplicarFiltros(): void {
    // Resetear paginación cuando se cambian los filtros
    this.paginacion.update(p => ({ ...p, offset: 0 }));
    this.cargarUsuarios();
  }

  /**
   * Limpia todos los filtros
   */
  limpiarFiltros(): void {
    this.filtros.set({
      query: '',
      estado: 'todos',
      rol: 'todos',
    });
    this.aplicarFiltros();
  }

  /**
   * Navega a la página de detalles de un usuario
   */
  verDetalles(usuarioId: string): void {
    this.router.navigate(['/administracion/usuarios', usuarioId]);
  }

  /**
   * Navega a la edición de roles de un usuario
   */
  editarRoles(usuarioId: string): void {
    this.router.navigate(['/administracion/usuarios', usuarioId, 'roles']);
  }

  /**
   * Cambia el estado de un usuario (activar/desactivar)
   */
  async cambiarEstado(usuario: UsuarioListado): Promise<void> {
    if (!this.usuarioAdminService.validarNoAutoModificacion(usuario.id, this.usuarioActualId())) {
      alert('No puedes modificar tu propio estado');
      return;
    }

    const nuevoEstado = usuario.estado === 'activo' ? 'inactivo' : 'activo';
    const confirmacion = confirm(
      `¿Estás seguro de ${nuevoEstado === 'activo' ? 'activar' : 'desactivar'} al usuario ${usuario.nombre} ${usuario.apellido}?`
    );

    if (!confirmacion) return;

    try {
      await this.usuarioAdminService.actualizarEstadoUsuario(usuario.id, nuevoEstado).toPromise();
      alert(`Usuario ${nuevoEstado === 'activo' ? 'activado' : 'desactivado'} exitosamente`);
      
      // Recargar la lista
      this.cargarUsuarios();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al cambiar el estado del usuario');
    }
  }

  /**
   * Métodos de paginación
   */
  paginaAnterior(): void {
    const offset = this.paginacion().offset - this.paginacion().limit;
    if (offset >= 0) {
      this.paginacion.update(p => ({ ...p, offset }));
      this.cargarUsuarios();
    }
  }

  paginaSiguiente(): void {
    const { offset, limit, total } = this.paginacion();
    if (offset + limit < total) {
      this.paginacion.update(p => ({ ...p, offset: p.offset + p.limit }));
      this.cargarUsuarios();
    }
  }

  cambiarLimite(limite: number): void {
    this.paginacion.update(p => ({ ...p, limit: limite, offset: 0 }));
    this.cargarUsuarios();
  }

  /**
   * Métodos de ayuda para la vista
   */
  obtenerNombreCompleto(usuario: UsuarioListado): string {
    return this.usuarioAdminService.obtenerNombreCompleto(usuario);
  }

  obtenerRolesTexto(usuario: UsuarioListado): string {
    return this.usuarioAdminService.obtenerRolesTexto(usuario);
  }

  obtenerEstadoTexto(estado: 'activo' | 'inactivo'): string {
    return this.usuarioAdminService.obtenerEstadoTexto(estado);
  }

  obtenerEstadoBadgeClase(estado: 'activo' | 'inactivo'): string {
    return this.usuarioAdminService.obtenerEstadoBadgeClase(estado);
  }

  obtenerRolBadgeClase(rol: string): string {
    return this.usuarioAdminService.obtenerRolBadgeClase(rol);
  }
}
