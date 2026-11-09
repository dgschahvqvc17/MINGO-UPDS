import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UsuarioAdminService, type UsuarioDetalle, type RolDisponible } from '../../../core/services/usuario-admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { CardComponent } from '../../../shared/components/card/card.component';

@Component({
  selector: 'app-usuario-roles',
  imports: [CommonModule, FormsModule, CardComponent, RouterLink],
  templateUrl: './usuario-roles.html',
  styleUrl: './usuario-roles.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsuarioRolesPage {
  private readonly usuarioAdminService = inject(UsuarioAdminService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly usuarioId = this.route.snapshot.paramMap.get('id') || '';
  readonly usuario = signal<UsuarioDetalle | null>(null);
  readonly rolesDisponibles = signal<RolDisponible[]>([]);
  
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);
  
  // Roles seleccionados
  readonly rolesSeleccionados = signal<Array<'administrador' | 'estudiante'>>([]);
  
  readonly usuarioActual = this.authService.profile;
  readonly usuarioActualId = computed(() => this.usuarioActual()?.id || '');
  readonly puedeModificar = computed(() => 
    this.usuarioAdminService.validarNoAutoModificacion(this.usuarioId, this.usuarioActualId())
  );

  readonly tieneCambios = computed(() => {
    const usuarioRoles = this.usuario()?.roles ?? [];
    const seleccionados = this.rolesSeleccionados();
    
    if (usuarioRoles.length !== seleccionados.length) return true;
    
    return !usuarioRoles.every(role => 
      seleccionados.includes(role as 'administrador' | 'estudiante')
    );
  });

  readonly esUnicoAdministrador = signal(false);
  readonly advertenciaUnicoAdmin = computed(() => 
    this.esUnicoAdministrador() && !this.rolesSeleccionados().includes('administrador')
  );

  constructor() {
    this.cargarDatos();
  }

  async cargarDatos(): Promise<void> {
    if (!this.usuarioId) {
      this.error.set('ID de usuario no válido');
      this.loading.set(false);
      return;
    }

    if (!this.puedeModificar()) {
      this.error.set('No puedes modificar tus propios privilegios');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      // Cargar usuario y roles disponibles en paralelo
      const [usuario, roles] = await Promise.all([
        this.usuarioAdminService.obtenerUsuario(this.usuarioId).toPromise(),
        this.usuarioAdminService.obtenerRolesDisponibles().toPromise()
      ]);

      this.usuario.set(usuario || null);
      this.rolesDisponibles.set(roles || []);

      if (!usuario) {
        this.error.set('Usuario no encontrado');
      } else {
        // Inicializar roles seleccionados con los actuales
        this.rolesSeleccionados.set([...usuario.roles] as Array<'administrador' | 'estudiante'>);
        
        // Verificar si es el único administrador
        await this.verificarUnicoAdministrador();
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Error al cargar datos');
      console.error('Error al cargar datos:', error);
    } finally {
      this.loading.set(false);
    }
  }

  async verificarUnicoAdministrador(): Promise<void> {
    try {
      const usuario = this.usuario();
      if (!usuario || !usuario.roles.includes('administrador')) {
        this.esUnicoAdministrador.set(false);
        return;
      }

      // En una implementación real, esto debería venir del servicio de estadísticas
      // Por ahora, lo simulamos
      const estadisticas = await this.usuarioAdminService.listarUsuarios({ rol: 'administrador' }).toPromise();
      const totalAdministradores = estadisticas?.estadisticas.administradores || 0;
      
      this.esUnicoAdministrador.set(totalAdministradores <= 1);
    } catch (error) {
      console.error('Error al verificar único administrador:', error);
      this.esUnicoAdministrador.set(false);
    }
  }

  toggleRol(rol: 'administrador' | 'estudiante'): void {
    if (this.guardando()) return;

    const actuales = this.rolesSeleccionados();
    
    if (actuales.includes(rol)) {
      // Remover rol
      this.rolesSeleccionados.set(actuales.filter(r => r !== rol));
    } else {
      // Añadir rol
      if (rol === 'administrador') {
        // Si se añade administrador, remover otros roles (solo puede ser administrador o estudiante)
        this.rolesSeleccionados.set(['administrador']);
      } else {
        // Si se añade estudiante, remover administrador (no pueden coexistir)
        const nuevos = actuales.filter(r => r !== 'administrador');
        this.rolesSeleccionados.set([...nuevos, rol]);
      }
    }
  }

  async guardarCambios(): Promise<void> {
    if (!this.tieneCambios() || this.guardando()) return;
    
    const usuario = this.usuario();
    if (!usuario) return;

    // Validaciones
    if (this.rolesSeleccionados().length === 0) {
      alert('Debes seleccionar al menos un rol');
      return;
    }

    if (this.advertenciaUnicoAdmin()) {
      const confirmacion = confirm(
        '¡ADVERTENCIA CRÍTICA!\n\n' +
        'Este usuario es el único administrador del sistema.\n' +
        'Si eliminas el rol de administrador, nadie podrá realizar operaciones administrativas.\n\n' +
        '¿Estás absolutamente seguro de continuar?'
      );
      
      if (!confirmacion) return;
    }

    const confirmacion = confirm(
      `¿Estás seguro de actualizar los roles de ${usuario.nombre} ${usuario.apellido}?\n\n` +
      `Roles anteriores: ${usuario.roles.join(', ')}\n` +
      `Roles nuevos: ${this.rolesSeleccionados().join(', ')}`
    );

    if (!confirmacion) return;

    this.guardando.set(true);

    try {
      await this.usuarioAdminService.actualizarRolesUsuario(
        this.usuarioId,
        this.rolesSeleccionados()
      ).toPromise();

      alert('Roles actualizados exitosamente');
      this.router.navigate(['../../', this.usuarioId], { relativeTo: this.route });
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error al actualizar roles';
      alert(`Error: ${mensaje}`);
      console.error('Error al actualizar roles:', error);
    } finally {
      this.guardando.set(false);
    }
  }

  cancelar(): void {
    if (this.tieneCambios()) {
      const confirmacion = confirm('¿Descartar los cambios sin guardar?');
      if (!confirmacion) return;
    }
    
    this.router.navigate(['../../', this.usuarioId], { relativeTo: this.route });
  }

  obtenerNombreCompleto(): string {
    const usuario = this.usuario();
    return usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() : '';
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

  // Helper para template: verificar si un rol está seleccionado
  estaRolSeleccionado(nombreRol: string): boolean {
    return this.rolesSeleccionados().includes(nombreRol as 'administrador' | 'estudiante');
  }

  // Helper para template: alternar rol por nombre
  alternarRolPorNombre(nombreRol: string): void {
    this.toggleRol(nombreRol as 'administrador' | 'estudiante');
  }
}