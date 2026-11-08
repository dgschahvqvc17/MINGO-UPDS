/**
 * Genera la configuracion del frontend a partir de frontend/.env.
 *
 * Angular no lee archivos .env por si solo, asi que este script crea los
 * archivos TypeScript generados que importan environment.ts y
 * environment.production.ts. Los archivos generados estan en .gitignore:
 * las claves nunca se versionan.
 *
 * Uso: npm run env:generate
 * Se ejecuta automaticamente antes de start, build y test.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(currentDirectory, '..');
const envPath = path.join(frontendRoot, '.env');
const environmentsDirectory = path.join(frontendRoot, 'src', 'environments');

const GENERATED_BANNER =
  '// Archivo generado por scripts/generate-env.mjs. No editar ni versionar.\n';

function loadEnvFile() {
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

function readConfig() {
  return {
    supabaseUrl: (process.env.SUPABASE_URL ?? '').trim(),
    supabaseAnonKey: (process.env.SUPABASE_ANON_KEY ?? '').trim(),
  };
}

function buildEnvironmentFile({ production, supabaseUrl, supabaseAnonKey }) {
  return `${GENERATED_BANNER}import type { Environment } from './environment.model';

export const environment: Environment = {
  production: ${production},
  apiUrl: '/api',
  supabaseUrl: ${JSON.stringify(supabaseUrl)},
  supabaseAnonKey: ${JSON.stringify(supabaseAnonKey)},
};
`;
}

async function main() {
  loadEnvFile();

  const config = readConfig();

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    console.warn(
      '[env] Faltan SUPABASE_URL o SUPABASE_ANON_KEY en frontend/.env. ' +
        'El inicio de sesion quedara deshabilitado.',
    );
  }

  await mkdir(environmentsDirectory, { recursive: true });

  const files = [
    ['environment.generated.ts', buildEnvironmentFile({ production: false, ...config })],
    [
      'environment.production.generated.ts',
      buildEnvironmentFile({ production: true, ...config }),
    ],
  ];

  await Promise.all(
    files.map(([fileName, content]) =>
      writeFile(path.join(environmentsDirectory, fileName), content, 'utf8'),
    ),
  );

  console.log('[env] Configuracion del frontend generada desde frontend/.env.');
}

main().catch((error) => {
  console.error(`[env] No se pudo generar la configuracion: ${error.message}`);
  process.exitCode = 1;
});
