import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UsuarioAdminService, type UsuarioDetalle } from '../../../core/services/usuario-admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { mensajeDeErrorHttp } from '../../../core/utils/http-error';
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
  readonly mensajeEstado = signal<{
    texto: string;
    tipo: 'success' | 'warning' | 'danger';
  } | null>(null);
  readonly confirmandoCambio = signal(false);
  readonly cambiandoEstado = signal(false);

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
      const usuario = await firstValueFrom(this.usuarioAdminService.obtenerUsuario(this.usuarioId));
      this.usuario.set(usuario);

      if (!usuario) {
        this.error.set('Usuario no encontrado');
      }
    } catch (error) {
      this.error.set(mensajeDeErrorHttp(error, 'No se pudo cargar el usuario.'));
    } finally {
      this.loading.set(false);
    }
  }

  editarRoles(): void {
    if (this.puedeModificar()) {
      this.mensajeEstado.set(null);
      this.router.navigate(['roles'], { relativeTo: this.route });
      return;
    }

    this.mensajeEstado.set({
      texto: 'No puedes modificar tus propios privilegios.',
      tipo: 'warning',
    });
  }

  pedirConfirmacion(): void {
    if (!this.puedeModificar()) {
      this.mensajeEstado.set({
        texto: 'No puedes modificar tu propio estado.',
        tipo: 'warning',
      });
      return;
    }

    this.mensajeEstado.set(null);
    this.confirmandoCambio.set(!this.confirmandoCambio());
  }

  cancelarCambio(): void {
    this.confirmandoCambio.set(false);
  }

  textoConfirmacion(): string {
    const usuario = this.usuario();
    if (!usuario) {
      return '';
    }

    const accion = usuario.estado === 'activo' ? 'desactivar' : 'activar';
    return `¿Deseas ${accion} al usuario ${usuario.nombre} ${usuario.apellido}?`;
  }

  async cambiarEstado(): Promise<void> {
    const usuario = this.usuario();
    if (!usuario || !this.puedeModificar() || this.cambiandoEstado()) {
      return;
    }

    const nuevoEstado = usuario.estado === 'activo' ? 'inactivo' : 'activo';
    this.cambiandoEstado.set(true);
    this.mensajeEstado.set(null);

    try {
      await firstValueFrom(
        this.usuarioAdminService.actualizarEstadoUsuario(usuario.id, nuevoEstado),
      );
      this.mensajeEstado.set({
        texto: `Usuario ${nuevoEstado === 'activo' ? 'activado' : 'desactivado'} correctamente.`,
        tipo: 'success',
      });
      this.confirmandoCambio.set(false);
      await this.cargarUsuario();
    } catch (error) {
      this.mensajeEstado.set({
        texto: mensajeDeErrorHttp(error, 'No se pudo cambiar el estado del usuario.'),
        tipo: 'danger',
      });
    } finally {
      this.cambiandoEstado.set(false);
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