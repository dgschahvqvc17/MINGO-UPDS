/**
 * Script para ejecutar migraciones de base de datos.
 * Ejecuta archivos SQL en el orden correcto usando PostgreSQL client.
 */
/* eslint-disable no-console */
const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function createDatabasePool() {
  // Intentar obtener DATABASE_URL de varias fuentes
  let databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('\n❌ Error: DATABASE_URL no está configurado');
    console.error('\nPara ejecutar migraciones, necesitas configurar DATABASE_URL en el archivo .env');
    console.error('\nObtén la conexión de base de datos desde Supabase:');
    console.error('1. Ve a tu proyecto en Supabase');
    console.error('2. Navega a Settings > Database');
    console.error('3. Busca "Connection string"');
    console.error('4. Usa el formato: postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres');
    console.error('\nTambién puedes usar la variable SUPABASE_DB_PASSWORD si prefieres construir la URL automáticamente');
    process.exit(1);
  }
  
  console.log(`Conectando a la base de datos...`);
  
  return new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
}

async function runMigration(pool, filePath) {
  const client = await pool.connect();
  
  try {
    console.log(`Ejecutando migración: ${filePath}`);
    const sql = await fs.readFile(filePath, 'utf8');
    
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    
    console.log(`✓ Migración ${path.basename(filePath)} completada`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`✗ Error ejecutando migración ${filePath}:`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function runAllMigrations() {
  console.log('Iniciando migraciones de base de datos...\n');
  
  const pool = await createDatabasePool();
  const repositoryRoot = path.join(__dirname, '..', '..');
  
  try {
    // Orden de migraciones: identidad, materias y tareas.
    const migrations = [
      path.join('supabase', 'migrations', '0001_hu01_auth.sql'),
      path.join('backend', 'sql', 'materias.sql'),
      path.join('supabase', 'migrations', '0002_hu04_tareas.sql'),
    ];
    
    for (const migrationFile of migrations) {
      const migrationPath = path.join(repositoryRoot, migrationFile);
      await runMigration(pool, migrationPath);
    }
    
    console.log('\n✅ Todas las migraciones completadas exitosamente');
  } catch (error) {
    console.error('\n❌ Error en migraciones:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Si se ejecuta directamente (no como módulo)
if (require.main === module) {
  runAllMigrations();
}

module.exports = { runAllMigrations };