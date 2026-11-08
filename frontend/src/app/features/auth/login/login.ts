import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly errorMessage = computed(() => this.error() ?? this.authService.lastAuthError());
  readonly isConfigured = this.authService.isConfigured;

  readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  async submit(): Promise<void> {
    if (this.loading()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const { email, password } = this.form.getRawValue();
      await this.authService.signIn(email, password);

      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const target = returnUrl?.startsWith('/') ? returnUrl : this.authService.homeRoute();
      await this.router.navigateByUrl(target);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No fue posible iniciar sesion.');
    } finally {
      this.loading.set(false);
    }
  }
}
