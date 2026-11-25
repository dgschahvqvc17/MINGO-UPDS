import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RolUsuario } from '../../core/models/dominio.models';
import {
  UsuarioAdminService,
  type UsuarioBusquedaParams,
  type UsuarioListado,
} from '../../core/services/usuario-admin.service';
import { AuthService } from '../../core/services/auth.service';
import { mensajeDeErrorHttp } from '../../core/utils/http-error';
import { CardComponent } from '../../shared/components/card/card.component';

@Component({
  selector: 'app-administracion',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, CardComponent],
  templateUrl: './administracion.html',
  styleUrl: './administracion.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdministracionPage {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
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
  readonly mensajeEstado = signal<string | null>(null);
  
  // Filtros de búsqueda
  readonly filtros = signal({
    query: '',
    estado: 'todos' as 'todos' | 'activo' | 'inactivo',
    rol: 'todos' as 'todos' | RolUsuario,
  });

  readonly rolesDisponibles: readonly RolUsuario[] = ['administrador', 'docente', 'estudiante'];

  readonly mostrarAlta = signal(false);
  readonly creando = signal(false);
  readonly claveTemporal = signal<string | null>(null);
  readonly errorCreacion = signal<string | null>(null);

  readonly crearForm = this.formBuilder.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    apellido: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    correo: ['', [Validators.required, Validators.email]],
    carrera: ['', [Validators.maxLength(100)]],
    rol: ['estudiante' as RolUsuario, [Validators.required]],
    claveTemporal: ['', [Validators.required, Validators.minLength(8)]],
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
    docentes: 0,
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
  cargarUsuarios(): void {
    this.loading.set(true);
    this.error.set(null);

    const filtros = this.filtros();
    const params: UsuarioBusquedaParams = {};

    if (filtros.query) params.query = filtros.query;
    if (filtros.estado !== 'todos') params.estado = filtros.estado;
    if (filtros.rol !== 'todos') params.rol = filtros.rol;
    if (this.paginacion().limit) params.limit = this.paginacion().limit;
    if (this.paginacion().offset) params.offset = this.paginacion().offset;

    this.usuarioAdminService
      .listarUsuarios(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (respuesta) => {
          this.usuarios.set(respuesta.usuarios);
          this.paginacion.set(respuesta.paginacion);
          this.estadisticas.set({
            ...respuesta.estadisticas,
            docentes: respuesta.estadisticas.docentes ?? 0,
          });
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudieron cargar los usuarios.'));
          this.loading.set(false);
        },
      });
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

  abrirAlta(): void {
    this.mostrarAlta.set(true);
    this.claveTemporal.set(null);
    this.errorCreacion.set(null);
  }

  cerrarAlta(): void {
    this.mostrarAlta.set(false);
    this.claveTemporal.set(null);
    this.errorCreacion.set(null);
    this.crearForm.reset({
      nombre: '',
      apellido: '',
      correo: '',
      carrera: '',
      rol: 'estudiante',
      claveTemporal: '',
    });
  }

  crearUsuario(): void {
    if (this.creando() || this.crearForm.invalid) {
      this.crearForm.markAllAsTouched();
      return;
    }

    const valores = this.crearForm.getRawValue();
    this.creando.set(true);
    this.errorCreacion.set(null);

    this.usuarioAdminService
      .crearUsuario({
        nombre: valores.nombre.trim(),
        apellido: valores.apellido.trim(),
        correo: valores.correo.trim(),
        carrera: valores.carrera.trim() || undefined,
        rol: valores.rol,
        claveTemporal: valores.claveTemporal,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (usuario) => {
          this.claveTemporal.set(usuario.claveTemporal);
          this.creando.set(false);
          this.crearForm.reset({
            nombre: '',
            apellido: '',
            correo: '',
            carrera: '',
            rol: 'estudiante',
            claveTemporal: '',
          });
          this.cargarUsuarios();
        },
        error: (error: unknown) => {
          this.errorCreacion.set(mensajeDeErrorHttp(error, 'No se pudo crear el usuario.'));
          this.creando.set(false);
        },
      });
  }

  descartarClaveTemporal(): void {
    this.claveTemporal.set(null);
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
  cambiarEstado(usuario: UsuarioListado): void {
    if (!this.usuarioAdminService.validarNoAutoModificacion(usuario.id, this.usuarioActualId())) {
      this.error.set('No puedes modificar tu propio estado.');
      return;
    }

    const nuevoEstado = usuario.estado === 'activo' ? 'inactivo' : 'activo';
    this.mensajeEstado.set(null);

    this.usuarioAdminService
      .actualizarEstadoUsuario(usuario.id, nuevoEstado)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.mensajeEstado.set(
            `Usuario ${nuevoEstado === 'activo' ? 'activado' : 'desactivado'} correctamente.`,
          );
          this.cargarUsuarios();
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo cambiar el estado del usuario.'));
        },
      });
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

  etiquetaRol(rol: RolUsuario | string): string {
    const etiquetas: Record<RolUsuario, string> = {
      administrador: 'Administrador',
      docente: 'Docente',
      estudiante: 'Estudiante',
    };
    return etiquetas[rol as RolUsuario] ?? rol;
  }

  tieneErrorCreacion(
    campo: 'nombre' | 'apellido' | 'correo' | 'carrera' | 'rol' | 'claveTemporal',
    tipo: string,
  ): boolean {
    const control = this.crearForm.controls[campo];
    return control.hasError(tipo) && (control.touched || control.dirty);
  }
}
