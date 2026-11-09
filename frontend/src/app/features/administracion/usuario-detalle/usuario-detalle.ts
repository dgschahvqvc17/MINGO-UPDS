import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UsuarioAdminService, type UsuarioDetalle } from '../../../core/services/usuario-admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { CardComponent } from '../../../shared/components/card/card.component';

@Component({
  selector: 'app-usuario-detalle',
  imports: [CommonModule, CardComponent, RouterLink],
  templateUrl: './usuario-detalle.html',
  styleUrl: './usuario-detalle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuarioDetallePage {
  private readonly usuarioAdminService = inject(UsuarioAdminService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly usuarioId = this.route.snapshot.paramMap.get('id') || '';
  readonly usuario = signal<UsuarioDetalle | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  
  readonly usuarioActual = this.authService.profile;
  readonly usuarioActualId = computed(() => this.usuarioActual()?.id || '');
  readonly puedeModificar = computed(() => 
    this.usuarioAdminService.validarNoAutoModificacion(this.usuarioId, this.usuarioActualId())
  );

  readonly tieneRoles = computed(() => this.usuario()?.roles_detalle?.length ?? 0 > 0);
  readonly esAdministrador = computed(() => 
    this.usuario()?.roles.includes('administrador') ?? false
  );

  constructor() {
    this.cargarUsuario();
  }

  async cargarUsuario(): Promise<void> {
    if (!this.usuarioId) {
      this.error.set('ID de usuario no válido');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const usuario = await this.usuarioAdminService.obtenerUsuario(this.usuarioId).toPromise();
      this.usuario.set(usuario || null);
      
      if (!usuario) {
        this.error.set('Usuario no encontrado');
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Error al cargar el usuario');
      console.error('Error al cargar usuario:', error);
    } finally {
      this.loading.set(false);
    }
  }

  editarRoles(): void {
    if (this.puedeModificar()) {
      this.router.navigate(['roles'], { relativeTo: this.route });
    } else {
      alert('No puedes modificar tus propios privilegios');
    }
  }

  async cambiarEstado(): Promise<void> {
    if (!this.puedeModificar()) {
      alert('No puedes modificar tu propio estado');
      return;
    }

    const usuario = this.usuario();
    if (!usuario) return;

    const nuevoEstado = usuario.estado === 'activo' ? 'inactivo' : 'activo';
    const confirmacion = confirm(
      `¿Estás seguro de ${nuevoEstado === 'activo' ? 'activar' : 'desactivar'} al usuario ${usuario.nombre} ${usuario.apellido}?`
    );

    if (!confirmacion) return;

    try {
      await this.usuarioAdminService.actualizarEstadoUsuario(usuario.id, nuevoEstado).toPromise();
      alert(`Usuario ${nuevoEstado === 'activo' ? 'activado' : 'desactivado'} exitosamente`);
      
      // Recargar datos del usuario
      this.cargarUsuario();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al cambiar el estado del usuario');
    }
  }

  volverALista(): void {
    this.router.navigate(['/administracion']);
  }

  obtenerNombreCompleto(): string {
    const usuario = this.usuario();
    return usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() : '';
  }

  obtenerFechaCreacionFormateada(): string {
    const usuario = this.usuario();
    if (!usuario) return '';
    
    const fecha = new Date(usuario.fecha_creacion);
    return fecha.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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