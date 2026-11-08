import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { Session } from '@supabase/supabase-js';
import { firstValueFrom } from 'rxjs';
import { UsuarioSesion } from '../models/auth.models';
import { RolUsuario } from '../models/dominio.models';
import { ApiService } from './api.service';
import { SupabaseService } from './supabase.service';

const ROL_ADMINISTRADOR: RolUsuario = 'administrador';
const PERFIL_ENDPOINT = '/auth/me';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly api = inject(ApiService);

  private readonly sessionSignal = signal<Session | null>(null);
  private readonly profileSignal = signal<UsuarioSesion | null>(null);
  private readonly lastAuthErrorSignal = signal<string | null>(null);
  private profileRequest: Promise<UsuarioSesion | null> | null = null;

  readonly session = this.sessionSignal.asReadonly();
  readonly profile = this.profileSignal.asReadonly();
  readonly lastAuthError = this.lastAuthErrorSignal.asReadonly();
  readonly user = computed(() => this.sessionSignal()?.user ?? null);
  readonly isAuthenticated = computed(() => Boolean(this.sessionSignal()));
  readonly role = computed<RolUsuario>(() => this.profileSignal()?.role ?? 'estudiante');
  readonly fullName = computed(() => {
    const profile = this.profileSignal();
    return profile ? `${profile.nombre} ${profile.apellido}`.trim() : '';
  });

  constructor() {
    if (this.supabaseService.isConfigured) {
      void this.restoreSession();

      this.supabaseService.client.auth.onAuthStateChange((event, session) => {
        this.sessionSignal.set(session);

        if (event === 'SIGNED_OUT' || !session) {
          this.profileSignal.set(null);
        }
      });
    }
  }

  get isConfigured(): boolean {
    return this.supabaseService.isConfigured;
  }

  /**
   * Inicia sesion en Supabase y valida la cuenta contra el backend.
   * Si la cuenta esta deshabilitada, se cierra la sesion recien creada.
   */
  async signIn(email: string, password: string): Promise<void> {
    this.lastAuthErrorSignal.set(null);

    const { error } = await this.supabaseService.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(this.translateError(error.message));
    }

    try {
      await this.loadProfile();
    } catch (error) {
      await this.signOut();
      throw new Error(this.resolveErrorMessage(error, 'No se pudo validar la cuenta.'));
    }
  }

  async signOut(): Promise<void> {
    if (this.supabaseService.isConfigured) {
      await this.supabaseService.client.auth.signOut();
    }

    this.sessionSignal.set(null);
    this.profileSignal.set(null);
  }

  /**
   * Carga el perfil y el rol desde la API. El interceptor adjunta el JWT.
   */
  async loadProfile(): Promise<UsuarioSesion> {
    const profile = await firstValueFrom(this.api.get<UsuarioSesion>(PERFIL_ENDPOINT));
    this.profileSignal.set(profile);
    return profile;
  }

  /**
   * Garantiza que el perfil este cargado antes de activar una ruta.
   * Deduplica solicitudes concurrentes y cierra la sesion si el backend la rechaza.
   */
  async ensureProfile(): Promise<UsuarioSesion | null> {
    if (!this.isConfigured) {
      return null;
    }

    const profile = this.profileSignal();
    if (profile) {
      return profile;
    }

    if (!this.profileRequest) {
      this.profileRequest = this.resolveProfile();
    }

    try {
      return await this.profileRequest;
    } finally {
      this.profileRequest = null;
    }
  }

  /**
   * Panel inicial segun el rol del usuario autenticado.
   */
  homeRoute(): string {
    return this.role() === ROL_ADMINISTRADOR ? '/administracion' : '/dashboard';
  }

  async getAccessToken(): Promise<string | null> {
    if (!this.isConfigured) {
      return null;
    }

    const { data } = await this.supabaseService.client.auth.getSession();
    return data.session?.access_token ?? null;
  }

  async hasActiveSession(): Promise<boolean> {
    if (!this.isConfigured) {
      return false;
    }

    const { data } = await this.supabaseService.client.auth.getSession();
    return Boolean(data.session);
  }

  private async resolveProfile(): Promise<UsuarioSesion | null> {
    if (!(await this.hasActiveSession())) {
      return null;
    }

    try {
      return await this.loadProfile();
    } catch (error) {
      this.lastAuthErrorSignal.set(
        this.resolveErrorMessage(error, 'No se pudo validar la sesion.'),
      );
      await this.signOut();
      return null;
    }
  }

  private async restoreSession(): Promise<void> {
    const { data } = await this.supabaseService.client.auth.getSession();
    this.sessionSignal.set(data.session);
  }

  private translateError(message: string): string {
    const normalized = message.toLowerCase();

    if (normalized.includes('invalid login credentials')) {
      return 'Correo o contrasena incorrectos.';
    }

    if (normalized.includes('email not confirmed')) {
      return 'Debe confirmar su correo electronico antes de iniciar sesion.';
    }

    return message;
  }

  private resolveErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const payload = error.error as { error?: { message?: unknown } } | null;
      const backendMessage = payload?.error?.message;

      if (typeof backendMessage === 'string' && backendMessage.trim()) {
        return backendMessage;
      }

      if (error.status === 0) {
        return 'No se pudo conectar con el servidor.';
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }
}
