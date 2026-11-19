/**
 * Comprueba que el proveedor de IA configurado genere embeddings con la
 * dimension que espera la columna vector(n) de Supabase.
 *
 * Uso:
 *   npm run verificar:embeddings
 *   npm run verificar:embeddings -- "texto de prueba"
 *   npm run verificar:embeddings -- --archivo ./documento.txt
 *
 * No requiere AWS: llama al proveedor de IA y valida la respuesta.
 */
/* eslint-disable no-console */
const fs = require('fs/promises');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const config = require('../src/config/environment');
const EmbeddingsService = require('../src/services/ia/embeddings.service');

const TEXTO_POR_DEFECTO =
  'La derivada de una funcion compuesta se calcula aplicando la regla de la cadena.';
const MAXIMO_CARACTERES = 2000;

/**
 * Obtiene el texto a enviar al proveedor desde los argumentos o un archivo.
 *
 * @param {string[]} argumentos
 * @returns {Promise<string>}
 */
async function obtenerTexto(argumentos) {
  const indiceArchivo = argumentos.indexOf('--archivo');

  if (indiceArchivo === -1) {
    return (argumentos[0] ?? TEXTO_POR_DEFECTO).slice(0, MAXIMO_CARACTERES);
  }

  const ruta = argumentos[indiceArchivo + 1];

  if (!ruta) {
    throw new Error('Falta la ruta despues de --archivo.');
  }

  const contenido = await fs.readFile(path.resolve(ruta), 'utf8');
  return contenido.slice(0, MAXIMO_CARACTERES);
}

/**
 * @param {EmbeddingsService} servicio
 */
function imprimirConfiguracion(servicio) {
  console.log('Configuracion de embeddings');
  console.log(`  AI_PROVIDER          : ${config.ai.provider}`);
  console.log(`  AI_BASE_URL          : ${config.ai.baseUrl ?? '(endpoint por defecto del SDK)'}`);
  console.log(`  AI_EMBEDDING_MODEL   : ${servicio.modelo}`);
  console.log(`  dimensiones esperadas: ${servicio.dimensiones}`);
  console.log(`  AI_API_KEY           : ${config.ai.apiKey ? 'configurada' : 'VACIA'}`);
}

/**
 * @returns {Promise<void>}
 */
async function main() {
  const texto = await obtenerTexto(process.argv.slice(2));
  const servicio = new EmbeddingsService();

  imprimirConfiguracion(servicio);

  if (!servicio.estaDisponible()) {
    throw new Error('No hay AI_API_KEY en backend/.env. Sin clave no se puede verificar.');
  }

  const inicio = Date.now();
  const [vector] = await servicio.generarEmbeddings([texto]);
  const duracion = Date.now() - inicio;

  console.log('\nRespuesta del proveedor');
  console.log(`  dimensiones recibidas: ${vector.length}`);
  console.log(`  latencia             : ${duracion} ms`);
  console.log(`  primeras componentes : ${vector.slice(0, 3).map((valor) => valor.toFixed(6)).join(', ')}`);
  console.log('\nOK: la dimension coincide con AI_EMBEDDING_DIMENSIONS y con vector(n).');
}

main().catch((error) => {
  console.error(`\nFallo la verificacion: ${error?.message ?? error}`);
  process.exitCode = 1;
});
