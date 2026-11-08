/**
 * Contrato de la configuracion de entorno del frontend.
 * Los valores reales los genera scripts/generate-env.mjs desde frontend/.env.
 */
export interface Environment {
  production: boolean;
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}
