/**
 * Configuracion central del backend.
 * Carga las variables de entorno y valida los valores necesarios.
 */
require('dotenv').config({ quiet: true });

const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('/api'),
  CORS_ORIGINS: z.string().default('http://localhost:4200'),

  // Supabase
  SUPABASE_URL: z.string().optional().default(''),
  SUPABASE_ANON_KEY: z.string().optional().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),

  // AWS
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().default('mingo-documentos'),
  AWS_LAMBDA_FUNCTION_NAME: z.string().default('mingo-document-processor'),
  AWS_SNS_TOPIC_ARN: z.string().optional().default(''),
  AWS_SQS_QUEUE_URL: z.string().optional().default(''),

  // Inteligencia artificial
  AI_PROVIDER: z.string().default('openai'),
  AI_API_KEY: z.string().optional().default(''),
  AI_BASE_URL: z.string().optional().default(''),
  AI_CHAT_MODEL: z.string().default('gpt-4o-mini'),
  AI_EMBEDDING_MODEL: z.string().default('text-embedding-3-small'),
  AI_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),

  // Limites
  MAX_UPLOAD_MB: z.coerce.number().positive().default(20),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().positive().default(15),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(300),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Variables de entorno invalidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

const isProd = env.NODE_ENV === 'production';
const isTestEnv = env.NODE_ENV === 'test';

// Las pruebas nunca deben usar credenciales reales ni llamar a Supabase.
const supabaseUrl = isTestEnv ? '' : env.SUPABASE_URL;
const supabaseAnonKey = isTestEnv ? '' : env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = isTestEnv ? '' : env.SUPABASE_SERVICE_ROLE_KEY;

if (isProd) {
  // La service role key es opcional: HU01 funciona con el token del usuario y RLS.
  const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Faltan variables de entorno obligatorias en produccion: ${missing.join(', ')}`);
    process.exit(1);
  }
}

const config = {
  env: env.NODE_ENV,
  isProd,
  isTest: isTestEnv,
  port: env.PORT,
  apiPrefix: env.API_PREFIX,
  corsOrigins: env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),

  supabase: {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    serviceRoleKey: supabaseServiceRoleKey,
    isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
    hasServiceRole: Boolean(supabaseUrl && supabaseServiceRoleKey),
  },

  aws: {
    region: env.AWS_REGION,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    s3Bucket: env.AWS_S3_BUCKET,
    lambdaFunctionName: env.AWS_LAMBDA_FUNCTION_NAME,
    snsTopicArn: env.AWS_SNS_TOPIC_ARN,
    sqsQueueUrl: env.AWS_SQS_QUEUE_URL,
  },

  ai: {
    provider: env.AI_PROVIDER,
    apiKey: env.AI_API_KEY,
    baseUrl: env.AI_BASE_URL || undefined,
    chatModel: env.AI_CHAT_MODEL,
    embeddingModel: env.AI_EMBEDDING_MODEL,
    embeddingDimensions: env.AI_EMBEDDING_DIMENSIONS,
  },

  uploads: {
    maxFileSizeBytes: Math.floor(env.MAX_UPLOAD_MB * 1024 * 1024),
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
    ],
    allowedExtensions: ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt'],
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
    max: env.RATE_LIMIT_MAX_REQUESTS,
  },
};

module.exports = config;
