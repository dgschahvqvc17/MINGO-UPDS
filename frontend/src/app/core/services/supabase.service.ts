import { Injectable } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/**
 * Cliente de Supabase para el frontend.
 * Solo utiliza la clave anonima publica; la seguridad real depende de RLS.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private clientInstance: SupabaseClient | null = null;

  get isConfigured(): boolean {
    return Boolean(environment.supabaseUrl && environment.supabaseAnonKey);
  }

  get client(): SupabaseClient {
    if (!this.isConfigured) {
      throw new Error(
        'Supabase no esta configurado. Complete supabaseUrl y supabaseAnonKey en src/environments/environment.ts',
      );
    }

    if (!this.clientInstance) {
      this.clientInstance = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    }

    return this.clientInstance;
  }
}
