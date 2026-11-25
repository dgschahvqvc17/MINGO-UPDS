import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { mensajeDeErrorHttp } from '../../../core/utils/http-error';
import { MascotaAgenteComponent } from '../../../shared/components/mascota-agente/mascota-agente.component';

const LONGITUD_MINIMA_CLAVE = 8;

function validarCoincidencia(control: AbstractControl): ValidationErrors | null {
  const nueva = control.get('claveNueva')?.value;
  const confirmacion = control.get('confirmarClave')?.value;

  return nueva && confirmacion && nueva === confirmacion ? null : { clavesDistintas: true };
}

@Component({
  selector: 'app-cambiar-clave',
  imports: [ReactiveFormsModule, MascotaAgenteComponent],
  templateUrl: './cambiar-clave.html',
  styleUrl: './cambiar-clave.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CambiarClavePage {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly passwordType = signal<'password' | 'text'>('password');

  readonly form = this.formBuilder.group(
    {
      claveActual: ['', [Validators.required]],
      claveNueva: [
        '',
        [Validators.required, Validators.minLength(LONGITUD_MINIMA_CLAVE)],
      ],
      confirmarClave: ['', [Validators.required]],
    },
    { validators: [validarCoincidencia] },
  );

  readonly longitudMinima = LONGITUD_MINIMA_CLAVE;
  readonly nombreUsuario = computed(() => this.authService.fullName() || 'usuario');

  submit(): void {
    if (this.loading()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa los campos marcados antes de continuar.');
      return;
    }

    const { claveActual, claveNueva } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set(null);

    this.authService
      .cambiarClave(claveActual, claveNueva)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loading.set(false);
          void this.router.navigateByUrl(this.authService.homeRoute());
        },
        error: (error: unknown) => {
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo actualizar la clave.'));
          this.loading.set(false);
        },
      });
  }

  togglePasswordVisibility(): void {
    this.passwordType.update((type) => (type === 'password' ? 'text' : 'password'));
  }

  tieneError(controlName: 'claveActual' | 'claveNueva' | 'confirmarClave', error: string): boolean {
    const control = this.form.controls[controlName];
    return control.hasError(error) && (control.touched || control.dirty);
  }

  lasClavesCoincidenMal(): boolean {
    return this.form.hasError('clavesDistintas') && this.form.controls.confirmarClave.touched;
  }
}
