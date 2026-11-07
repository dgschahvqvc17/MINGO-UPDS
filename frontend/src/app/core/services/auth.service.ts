import { Injectable, computed, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly sessionSignal = signal<Session | null>(null);

  readonly session = this.sessionSignal.asReadonly();
  readonly user = computed(() => this.sessionSignal()?.user ?? null);
  readonly isAuthenticated = computed(() => Boolean(this.sessionSignal()));

  get isConfigured(): boolean {
    return this.supabaseService.isConfigured;
  }

  readonly role = computed(() => {
    const user = this.user();
    const appRole = user?.app_metadata?.['role'];
    const metadataRole = user?.user_metadata?.['role'];

    if (typeof appRole === 'string') {
      return appRole;
    }

    if (typeof metadataRole === 'string') {
      return metadataRole;
    }

    return 'estudiante';
  });

  constructor(private readonly supabaseService: SupabaseService) {
    if (this.supabaseService.isConfigured) {
      void this.restoreSession();

      this.supabaseService.client.auth.onAuthStateChange((_event, session) => {
        this.sessionSignal.set(session);
      });
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.supabaseService.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(this.translateError(error.message));
    }
  }

  async signOut(): Promise<void> {
    if (!this.supabaseService.isConfigured) {
      return;
    }

    await this.supabaseService.client.auth.signOut();
    this.sessionSignal.set(null);
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.supabaseService.isConfigured) {
      return null;
    }

    const { data } = await this.supabaseService.client.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async hasActiveSession(): Promise<boolean> {
    if (!this.supabaseService.isConfigured) {
      return false;
    }

    const { data } = await this.supabaseService.client.auth.getSession();
    return Boolean(data.session);
  }

  private async restoreSession(): Promise<void> {
    const { data } = await this.supabaseService.client.auth.getSession();
    this.sessionSignal.set(data.session);
  }

  private translateError(message: string): string {
    if (message.toLowerCase().includes('invalid login credentials')) {
      return 'Correo o contrasena incorrectos.';
    }

    if (message.toLowerCase().includes('email not confirmed')) {
      return 'Debe confirmar su correo electronico antes de iniciar sesion.';
    }

    return message;
  }
}
