import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MateriaService, type Materia } from '../../../core/services/materia.service';
import { AuthService } from '../../../core/services/auth.service';
import { CardComponent } from '../../../shared/components/card/card.component';

@Component({
  selector: 'app-materia-form',
  imports: [ReactiveFormsModule, CardComponent, RouterLink],
  templateUrl: './materia-form.html',
  styleUrl: './materia-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MateriaFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly materiaService = inject(MateriaService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // Estado del componente
  readonly materiaId = signal<string | null>(null);
  readonly modoEdicion = computed(() => this.materiaId() !== null);
  readonly estadoMateria = signal<'activo' | 'archivado' | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly guardando = signal(false);

  // Metadatos
  readonly coloresDisponibles = signal<string[]>([]);
  readonly periodosAcademicos = signal<string[]>([]);

  // Formulario
  readonly form = this.fb.group({
    nombre: ['', [
      Validators.required,
      Validators.minLength(2),
      Validators.maxLength(100)
    ]],
    codigo: ['', [
      Validators.required,
      Validators.minLength(1),
      Validators.maxLength(20),
      Validators.pattern(/^[A-Z0-9\-]+$/)
    ]],
    docente: ['', [
      Validators.required,
      Validators.minLength(2),
      Validators.maxLength(100)
    ]],
    descripcion: ['', [
      Validators.maxLength(500)
    ]],
    periodo_academico: ['', [
      Validators.required,
      Validators.pattern(/^\d{4}-[12]$/)
    ]],
    color: ['#3B82F6', [
      Validators.required,
      Validators.pattern(/^#[0-9A-F]{6}$/i)
    ]]
  });

  // Computed properties
  readonly tituloPagina = computed(() => 
    this.modoEdicion() ? 'Editar materia' : 'Nueva materia'
  );

  readonly botonGuardarTexto = computed(() => 
    this.guardando() ? 'Guardando...' : (this.modoEdicion() ? 'Actualizar materia' : 'Crear materia')
  );

  readonly descripcionPeriodo = computed(() => {
    const periodo = this.form.get('periodo_academico')?.value;
    if (!periodo || !this.materiaService.validarPeriodoAcademico(periodo)) {
      return '';
    }
    return this.materiaService.obtenerDescripcionPeriodo(periodo);
  });

  // Usuario actual
  readonly usuarioActual = this.authService.profile;

  ngOnInit(): void {
    this.cargarMetadatos();
    this.cargarMateriaSiEsEdicion();
  }

  /**
   * Carga metadatos necesarios (colores, periodos)
   */
  async cargarMetadatos(): Promise<void> {
    try {
      const [colores, periodos] = await Promise.all([
        this.materiaService.obtenerColoresDisponibles().toPromise(),
        this.materiaService.obtenerPeriodosAcademicos().toPromise()
      ]);

      if (colores) this.coloresDisponibles.set(colores);
      if (periodos) this.periodosAcademicos.set(periodos);
    } catch (error) {
      console.error('Error al cargar metadatos:', error);
    }
  }

  /**
   * Carga la materia si estamos en modo edición
   */
  async cargarMateriaSiEsEdicion(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.materiaId.set(id);
    this.loading.set(true);
    this.error.set(null);

    try {
      const materia = await this.materiaService.obtenerMateria(id).toPromise();
      if (materia) {
        this.estadoMateria.set(materia.estado);
        this.form.patchValue({
          nombre: materia.nombre,
          codigo: materia.codigo,
          docente: materia.docente,
          descripcion: materia.descripcion || '',
          periodo_academico: materia.periodo_academico,
          color: materia.color
        });
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Error al cargar la materia');
      console.error('Error al cargar materia:', error);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Maneja el envío del formulario
   */
  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.guardando()) return;

    // Marcar todos los campos como tocados para mostrar errores
    this.markAllAsTouched();

    if (this.form.invalid) {
      this.error.set('Por favor, corrige los errores en el formulario');
      return;
    }

    this.guardando.set(true);
    this.error.set(null);

    try {
      const formValue = this.form.value;
      
      // Crear objeto tipado seguro
      const formData = {
        nombre: formValue.nombre || '',
        codigo: formValue.codigo || '',
        docente: formValue.docente || '',
        descripcion: formValue.descripcion || null,
        periodo_academico: formValue.periodo_academico || '',
        color: formValue.color || this.coloresDisponibles()[0]
      };

      if (this.modoEdicion()) {
        await this.materiaService.actualizarMateria(this.materiaId()!, formData).toPromise();
        alert('Materia actualizada exitosamente');
        this.router.navigate(['/materias', this.materiaId()]);
      } else {
        const nuevaMateria = await this.materiaService.crearMateria(formData).toPromise();
        alert('Materia creada exitosamente');
        this.router.navigate(['/materias', nuevaMateria!.id]);
      }
    } catch (error) {
      const mensajeError = error instanceof Error ? error.message : 'Error al guardar la materia';
      this.error.set(mensajeError);
      alert(`Error: ${mensajeError}`);
    } finally {
      this.guardando.set(false);
    }
  }

  /**
   * Archiva o activa la materia (no existe borrado definitivo en el backend)
   */
  async archivarMateria(): Promise<void> {
    const id = this.materiaId();
    const estadoActual = this.estadoMateria();
    if (!id || !estadoActual || this.guardando()) return;

    const nuevoEstado = estadoActual === 'activo' ? 'archivado' : 'activo';
    const confirmacion = confirm(
      `¿Estás seguro de ${nuevoEstado === 'archivado' ? 'archivar' : 'activar'} la materia?`,
    );
    if (!confirmacion) return;

    this.guardando.set(true);
    this.error.set(null);

    try {
      await this.materiaService.cambiarEstadoMateria(id, nuevoEstado).toPromise();
      this.estadoMateria.set(nuevoEstado);
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'Error al cambiar el estado de la materia';
      this.error.set(mensaje);
    } finally {
      this.guardando.set(false);
    }
  }

  /**
   * Cambia el color seleccionado
   */
  seleccionarColor(color: string): void {
    this.form.patchValue({ color });
  }

  /**
   * Genera automáticamente el siguiente periodo académico
   */
  generarSiguientePeriodo(): void {
    const ultimoPeriodo = this.periodosAcademicos()[0];
    if (ultimoPeriodo && this.materiaService.validarPeriodoAcademico(ultimoPeriodo)) {
      try {
        const siguientePeriodo = this.materiaService.generarPeriodoSiguiente(ultimoPeriodo);
        this.form.patchValue({ periodo_academico: siguientePeriodo });
      } catch (error) {
        console.error('Error al generar siguiente periodo:', error);
      }
    }
  }

  /**
   * Verifica si un campo tiene errores
   */
  tieneError(controlName: string, errorType: string): boolean {
    const control = this.form.get(controlName);
    return control ? control.hasError(errorType) && (control.touched || control.dirty) : false;
  }

  /**
   * Obtiene el mensaje de error para un campo
   */
  obtenerMensajeError(controlName: string): string {
    const control = this.form.get(controlName);
    if (!control || !control.errors) return '';

    if (control.hasError('required')) {
      return 'Este campo es requerido';
    }
    if (control.hasError('minlength')) {
      const min = control.errors['minlength'].requiredLength;
      return `Mínimo ${min} caracteres`;
    }
    if (control.hasError('maxlength')) {
      const max = control.errors['maxlength'].requiredLength;
      return `Máximo ${max} caracteres`;
    }
    if (control.hasError('pattern')) {
      switch (controlName) {
        case 'codigo':
          return 'Solo letras mayúsculas, números y guiones';
        case 'periodo_academico':
          return 'Formato: AÑO-SEMESTRE (ej: 2024-1)';
        case 'color':
          return 'Formato hexadecimal (ej: #3B82F6)';
        default:
          return 'Formato inválido';
      }
    }

    return 'Campo inválido';
  }

  /**
   * Marca todos los campos como tocados
   */
  private markAllAsTouched(): void {
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Cancela y regresa a la lista de materias
   */
  cancelar(): void {
    if (this.modoEdicion()) {
      this.router.navigate(['/materias', this.materiaId()]);
    } else {
      this.router.navigate(['/materias']);
    }
  }

  /**
   * Obtiene el color de fondo para la tarjeta de color
   */
  obtenerColorFondo(color: string): string {
    return color;
  }

  /**
   * Obtiene el color de texto para la tarjeta de color
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
   * Verifica si un color está seleccionado
   */
  estaColorSeleccionado(color: string): boolean {
    return this.form.get('color')?.value === color;
  }
}