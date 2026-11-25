import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { RolUsuario } from '../../../core/models/dominio.models';
import {
  UsuarioAdminService,
  type RolDisponible,
  type UsuarioDetalle,
} from '../../../core/services/usuario-admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { mensajeDeErrorHttp } from '../../../core/utils/http-error';
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
  private readonly destroyRef = inject(DestroyRef);

  readonly usuarioId = this.route.snapshot.paramMap.get('id') || '';
  readonly usuario = signal<UsuarioDetalle | null>(null);
  readonly rolesDisponibles = signal<RolDisponible[]>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);

  readonly rolesSeleccionados = signal<RolUsuario[]>([]);

  readonly usuarioActual = this.authService.profile;
  readonly usuarioActualId = computed(() => this.usuarioActual()?.id || '');
  readonly puedeModificar = computed(() =>
    this.usuarioAdminService.validarNoAutoModificacion(this.usuarioId, this.usuarioActualId()),
  );

  readonly tieneCambios = computed(() => {
    const rolesActuales = this.usuario()?.roles ?? [];
    const seleccionados = this.rolesSeleccionados();

    if (rolesActuales.length !== seleccionados.length) {
      return true;
    }

    return !rolesActuales.every((rol) => seleccionados.includes(rol));
  });

  readonly esUnicoAdministrador = signal(false);
  readonly advertenciaUnicoAdmin = computed(
    () => this.esUnicoAdministrador() && !this.rolesSeleccionados().includes('administrador'),
  );

  constructor() {
    this.cargarDatos();
  }

  cargarDatos(): void {
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

    forkJoin({
      usuario: this.usuarioAdminService.obtenerUsuario(this.usuarioId),
      roles: this.usuarioAdminService.obtenerRolesDisponibles(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ usuario, roles }) => {
          this.usuario.set(usuario);
          this.rolesDisponibles.set(roles);
          this.rolesSeleccionados.set([...usuario.roles]);
          this.verificarUnicoAdministrador(usuario);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudieron cargar los datos.'));
          this.loading.set(false);
        },
      });
  }

  private verificarUnicoAdministrador(usuario: UsuarioDetalle): void {
    if (!usuario.roles.includes('administrador')) {
      this.esUnicoAdministrador.set(false);
      return;
    }

    this.usuarioAdminService
      .listarUsuarios({ rol: 'administrador', limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (respuesta) => this.esUnicoAdministrador.set(respuesta.estadisticas.administradores <= 1),
        error: () => this.esUnicoAdministrador.set(false),
      });
  }

  toggleRol(rol: RolUsuario): void {
    if (this.guardando()) {
      return;
    }

    const actuales = this.rolesSeleccionados();
    this.rolesSeleccionados.set(
      actuales.includes(rol) ? actuales.filter((item) => item !== rol) : [...actuales, rol],
    );
  }

  guardarCambios(): void {
    if (!this.tieneCambios() || this.guardando()) {
      return;
    }

    if (this.rolesSeleccionados().length === 0) {
      this.error.set('Debes seleccionar al menos un rol.');
      return;
    }

    if (this.advertenciaUnicoAdmin()) {
      this.error.set('No puedes quitar el rol de administrador al único administrador.');
      return;
    }

    this.error.set(null);
    this.guardando.set(true);

    this.usuarioAdminService
      .actualizarRolesUsuario(this.usuarioId, this.rolesSeleccionados())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.guardando.set(false);
          void this.router.navigate(['../../', this.usuarioId], { relativeTo: this.route });
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudieron actualizar los roles.'));
          this.guardando.set(false);
        },
      });
  }

  cancelar(): void {
    void this.router.navigate(['../../', this.usuarioId], { relativeTo: this.route });
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

  estaRolSeleccionado(nombreRol: string): boolean {
    return this.rolesSeleccionados().includes(nombreRol as RolUsuario);
  }

  etiquetaRol(rol: RolUsuario | string): string {
    const etiquetas: Record<RolUsuario, string> = {
      administrador: 'Administrador',
      docente: 'Docente',
      estudiante: 'Estudiante',
    };
    return etiquetas[rol as RolUsuario] ?? rol;
  }

  alternarRolPorNombre(nombreRol: string): void {
    this.toggleRol(nombreRol as RolUsuario);
  }
}
