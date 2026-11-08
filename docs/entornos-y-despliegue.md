# Entornos y despliegue de MINGO

**Versión:** 1.0  
**Regla obligatoria:** [reglas-aws.md](reglas-aws.md)  
**Resumen:** desarrollo local con Node.js y Angular; producción exclusivamente serverless (Lambda + API Gateway + S3 + CloudFront) dentro de la capa gratuita.

## 1. Entornos

| Entorno | Propósito | Datos | AWS | IA |
|---|---|---|---|---|
| `development` | Desarrollo diario. | Datos de prueba. | Opcional, sin desplegar. | Clave con límite bajo o mock. |
| `test` | Pruebas automatizadas. | Datos efímeros o mocks. | Mocks. | Mock. |
| `production` | Uso real del MVP. | Datos reales. | Cuenta con presupuesto y alertas. | Clave con tope de gasto. |

Reglas:

- Un proyecto Supabase por entorno. Nunca compartir producción con desarrollo.
- Un bucket S3 por entorno si se despliega AWS en ambos.
- Variables de entorno distintas; nunca reutilizar claves entre entornos.
- Los entornos se definen en la infraestructura como código, no a mano.

## 2. Requisitos locales

| Herramienta | Versión |
|---|---|
| Node.js | 24 LTS (`>=24.0.0`) |
| npm | 11+ |
| Angular CLI | 21 |
| Git | 2.40+ |
| AWS CLI | v2 (solo para desplegar) |
| AWS SAM CLI | 1.110+ (solo para desplegar) |
| Supabase CLI | Última estable (migraciones) |

Verificar:

```bash
node -v
npm -v
aws --version
sam --version
supabase --version
```

## 3. Variables de entorno

### 3.1. Backend

Archivo `backend/.env` (no se versiona). Plantilla en `backend/.env.example`.

| Variable | Obligatoria | Ejemplo | Descripción |
|---|---|---|---|
| `NODE_ENV` | Sí | `development` | `development` \| `test` \| `production`. |
| `PORT` | No | `4000` | Puerto local. |
| `API_PREFIX` | No | `/api` | Prefijo de la API. |
| `CORS_ORIGINS` | Sí | `http://localhost:4200` | Orígenes separados por coma. |
| `SUPABASE_URL` | Sí | `https://xxxx.supabase.co` | URL del proyecto. |
| `SUPABASE_ANON_KEY` | Sí | `eyJ...` | Clave pública. |
| `SUPABASE_SERVICE_ROLE_KEY` | No | `eyJ...` | Operaciones administrativas; nunca al frontend. |
| `AWS_REGION` | Sí | `us-east-1` | Una sola región. |
| `AWS_ACCESS_KEY_ID` | Solo local | `AKIA...` | En Lambda se usa el rol IAM. |
| `AWS_SECRET_ACCESS_KEY` | Solo local | `...` | En Lambda se usa el rol IAM. |
| `AWS_S3_BUCKET` | Sí | `mingo-documentos-dev` | Bucket privado. |
| `AWS_LAMBDA_FUNCTION_NAME` | No | `mingo-document-processor` | Función procesadora. |
| `AWS_SNS_TOPIC_ARN` | No | `arn:aws:sns:...` | Recordatorios por email. |
| `AWS_SQS_QUEUE_URL` | No | `https://sqs...` | Cola de documentos. |
| `AI_PROVIDER` | Sí | `openai` | Proveedor de IA. |
| `AI_API_KEY` | Sí en prod | `sk-...` | Clave privada. |
| `AI_BASE_URL` | No | `https://api.openai.com/v1` | Endpoint alternativo. |
| `AI_CHAT_MODEL` | Sí | `gpt-4o-mini` | Modelo de chat. |
| `AI_EMBEDDING_MODEL` | Sí | `text-embedding-3-small` | Modelo de embeddings. |
| `AI_EMBEDDING_DIMENSIONS` | Sí | `1536` | Debe coincidir con `vector(n)`. |
| `MAX_UPLOAD_MB` | No | `20` | Tamaño máximo de archivo. |
| `RATE_LIMIT_WINDOW_MINUTES` | No | `15` | Ventana de rate limit. |
| `RATE_LIMIT_MAX_REQUESTS` | No | `300` | Máximo por ventana. |

> En producción las variables se cargan desde el entorno de Lambda definido en SAM/CloudFormation. Los secretos se inyectan desde GitHub Actions o Parameter Store; nunca se escriben en el repositorio.

### 3.2. Frontend

La configuración local vive en `frontend/.env` (no se versiona). Plantilla en `frontend/.env.example`:

```bash
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-clave-publica-anon
```

Archivos:

- `frontend/src/environments/environment.model.ts` (contrato `Environment`, versionado)
- `frontend/src/environments/environment.ts` (desarrollo, reexporta el archivo generado)
- `frontend/src/environments/environment.production.ts` (producción, reexporta el archivo generado)
- `frontend/src/environments/environment.generated.ts` y `environment.production.generated.ts` (generados, **no** versionados)

| Variable de `.env` | Campo generado | Descripción |
|---|---|---|
| `SUPABASE_URL` | `supabaseUrl` | URL pública del proyecto. |
| `SUPABASE_ANON_KEY` | `supabaseAnonKey` | Clave pública `anon` o `publishable`. |

**Generación:**

```bash
cd frontend
npm run env:generate
```

Ese comando crea los archivos `*.generated.ts` a partir de `frontend/.env`. Los scripts `npm start`, `npm run build` y `npm test` lo ejecutan automáticamente (`prestart`, `prebuild`, `pretest`), por lo que no hace falta correrlo a mano.

**Reglas:**

- Las claves **no** se escriben en archivos versionados. Solo viven en `frontend/.env` local o en variables del pipeline.
- El frontend solo usa la clave pública `anon`/`publishable`. Nunca `service_role`, AWS keys ni claves de IA.
- `apiUrl` en desarrollo puede ser `/api` con proxy; en producción apunta a API Gateway.
- En CI, definir `SUPABASE_URL` y `SUPABASE_ANON_KEY` como variables del pipeline; el script las toma del entorno si no existe `frontend/.env`.
- Si faltan las variables, el build funciona pero el inicio de sesión queda deshabilitado y se muestra una advertencia.

## 4. Ejecución local

### 4.1. Backend

```bash
cd backend
npm install
copy .env.example .env
# completar variables
npm run dev
```

Verificar:

```bash
curl http://localhost:4000/api/health
```

Salida esperada:

```json
{ "success": true, "data": { "service": "MINGO API", "status": "ok" } }
```

### 4.2. Frontend

```bash
cd frontend
npm install
copy .env.example .env
# completar SUPABASE_URL y SUPABASE_ANON_KEY
npm start
```

Abrir `http://localhost:4200`. El proxy envía `/api` a `http://localhost:4000`.

### 4.3. Ambos a la vez

Dos terminales:

```bash
# terminal 1
cd backend && npm run dev

# terminal 2
cd frontend && npm start
```

### 4.4. Base de datos local (opcional)

Con Supabase CLI:

```bash
npx supabase start
npx supabase db reset
```

Aplicar migraciones:

```bash
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```

Si no usas la CLI, abre **SQL Editor** en el panel de Supabase, pega el contenido de `supabase/migrations/0001_hu01_auth.sql` y ejecútalo una vez. Es idempotente.

### 4.5. Usuarios de prueba de HU01

El registro público de Supabase exige confirmación de correo y tiene un límite de envíos. Para desarrollo se crearon dos cuentas confirmadas directamente en el proyecto:

| Correo | Rol |
|---|---|
| `estudiante@mingoacademico.com` | `estudiante` |
| `admin@mingoacademico.com` | `administrador` |

La contraseña de estas cuentas se comparte por el canal interno del equipo y no se versiona en el repositorio. Para crear más cuentas de prueba, usa el panel de Supabase o `supabase.auth.admin.createUser` con la clave `service_role` desde un script local que no se commitee.

> Las cuentas de prueba solo deben existir en el proyecto de desarrollo. No crearlas en producción.

## 5. Empaquetado del backend para Lambda

El backend Express se despliega con un adaptador (`serverless-http`).

### 5.1. Punto de entrada

```js
// backend/src/lambda.js
const serverless = require('serverless-http');
const app = require('./app');

module.exports.handler = serverless(app);
```

### 5.2. Reglas de empaquetado

- Node.js 24 en Lambda (o el runtime LTS disponible al desplegar).
- Arquitectura ARM64.
- Solo dependencias de producción: `npm ci --omit=dev`.
- ZIP menor a 50 MB (límite directo de Lambda); si crece, usar capas o revisar dependencias.
- Sin `.env`, `tests/`, `node_modules` de desarrollo ni archivos temporales.
- `handler: src/lambda.handler`.

### 5.3. Script de build

```json
{
  "scripts": {
    "build:lambda": "npm ci --omit=dev && npm prune --omit=dev"
  }
}
```

En CI se recomienda construir en un directorio limpio para evitar residuos.

## 6. Infraestructura con AWS SAM

### 6.1. Recursos permitidos

| Recurso | Uso |
|---|---|
| `AWS::Serverless::Function` | API y procesador de documentos. |
| `AWS::Serverless::HttpApi` | API Gateway HTTP API. |
| `AWS::S3::Bucket` | Documentos. |
| `AWS::SQS::Queue` | Cola y DLQ. |
| `AWS::SNS::Topic` | Notificaciones email. |
| `AWS::Scheduler::Schedule` | Recordatorios (opcional). |
| `AWS::Logs::LogGroup` | Logs con retención. |
| `AWS::Budgets::Budget` | Presupuesto (crear una vez). |

**Prohibido:** EC2, ECS, EKS, RDS, ElastiCache, NAT Gateway, load balancers, IP elástica, VPC, contenedores permanentes.

### 6.2. Plantilla mínima de referencia

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: MINGO API serverless

Globals:
  Function:
    Runtime: nodejs24.x
    Architectures: [arm64]
    MemorySize: 512
    Timeout: 30
    Environment:
      Variables:
        NODE_ENV: production
        SUPABASE_URL: !Ref SupabaseUrl
        SUPABASE_ANON_KEY: !Ref SupabaseAnonKey
        SUPABASE_SERVICE_ROLE_KEY: !Ref SupabaseServiceRoleKey
        AWS_S3_BUCKET: !Ref DocumentBucket
        AI_PROVIDER: !Ref AiProvider
        AI_API_KEY: !Ref AiApiKey
        AI_CHAT_MODEL: !Ref AiChatModel
        AI_EMBEDDING_MODEL: !Ref AiEmbeddingModel
        AI_EMBEDDING_DIMENSIONS: '1536'
    Tags:
      Project: MINGO
      Environment: prod
      Owner: equipo-mingo
      ManagedBy: sam
      CostCenter: academico

Parameters:
  SupabaseUrl:
    Type: String
  SupabaseAnonKey:
    Type: String
    NoEcho: true
  SupabaseServiceRoleKey:
    Type: String
    NoEcho: true
  AiProvider:
    Type: String
    Default: openai
  AiApiKey:
    Type: String
    NoEcho: true
  AiChatModel:
    Type: String
    Default: gpt-4o-mini
  AiEmbeddingModel:
    Type: String
    Default: text-embedding-3-small

Resources:
  MingoApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      StageName: prod
      DefaultRouteSettings:
        ThrottlingBurstLimit: 40
        ThrottlingRateLimit: 20

  MingoApiFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: backend/
      Handler: src/lambda.handler
      ReservedConcurrentExecutions: 10
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref MingoApi
            Path: /{proxy+}
            Method: ANY

  DocumentBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub 'mingo-documentos-${AWS::AccountId}'
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        BlockPublicPolicy: true
        IgnorePublicAcls: true
        RestrictPublicBuckets: true
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
      LifecycleConfiguration:
        Rules:
          - Id: AbortIncomplete
            Status: Enabled
            AbortIncompleteMultipartUpload:
              DaysAfterInitiation: 1
          - Id: ExpirarTemporales
            Status: Enabled
            Prefix: temporales/
            ExpirationInDays: 7

  DocumentosQueue:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: mingo-documentos
      MessageRetentionPeriod: 345600
      RedrivePolicy:
        deadLetterTargetArn: !GetAtt DocumentosDlq.Arn
        maxReceiveCount: 3

  DocumentosDlq:
    Type: AWS::SQS::Queue
    Properties:
      QueueName: mingo-documentos-dlq
      MessageRetentionPeriod: 1209600

  MingoLogGroup:
    Type: AWS::Logs::LogGroup
    Properties:
      LogGroupName: !Sub '/aws/lambda/${MingoApiFunction}'
      RetentionInDays: 30

Outputs:
  ApiUrl:
    Value: !Sub 'https://${MingoApi}.execute-api.${AWS::Region}.amazonaws.com'
```

> Los valores `NoEcho` no deben quedar en el historial del shell. En CI se pasan como parámetros seguros.

### 6.3. Despliegue

```bash
sam validate
sam build
sam deploy --guided
```

En el primer despliegue:

- Región `us-east-1`.
- Confirmar que no se crea VPC, NAT ni balanceadores.
- Revisar los recursos del change set antes de aprobar.
- Verificar etiquetas y límites.

### 6.4. Presupuestos

Los presupuestos se crean una vez en la cuenta, no en cada despliegue:

```bash
aws budgets create-budget --account-id <ACCOUNT_ID> --budget file://budget.json
```

Configurar alertas al 50 %, 80 % y 100 %, y una segunda alerta a $5.

## 7. Frontend en S3 + CloudFront

### 7.1. Build

```bash
cd frontend
npm run build -- --configuration production
```

Salida: `frontend/dist/<proyecto>/browser`.

### 7.2. Publicación

```bash
aws s3 sync dist/<proyecto>/browser s3://<bucket-frontend> --delete
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"
```

Reglas:

- Bucket privado; acceso solo por CloudFront (Origin Access Control).
- Sin versionado ilimitado.
- Cache-Control largo para assets con hash y corto para `index.html`.
- Una sola distribución.
- Sin Lambda@Edge ni WAF.
- HTTPS con certificado ACM gratuito.

### 7.3. Alternativa sin costo AWS

Si se prefiere no usar CloudFront, se puede publicar el frontend en un hosting estático gratuito externo (por ejemplo, GitHub Pages, Netlify o Vercel en plan gratuito) apuntando a la API Gateway. La decisión debe documentarse.

## 8. CI/CD con GitHub Actions

### 8.1. Flujo

```text
push / pull request
      |
      v
lint + tests + build (backend y frontend)
      |
      v
si es main: sam deploy y sync del frontend
      |
      v
smoke test de /api/health
      |
      v
notificación
```

### 8.2. Reglas

- Usar OIDC de GitHub Actions hacia AWS, sin claves estáticas si es posible.
- Si se usan claves, guardarlas como secretos del repositorio y rotarlas cada 90 días.
- No ejecutar despliegues desde ramas de features.
- Requerir aprobación manual para producción.
- El pipeline falla si el lint o las pruebas fallan.
- No desplegar si el presupuesto está en alerta crítica.

### 8.3. Ejemplo de workflow (resumen)

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm test

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run build
      - run: npm test -- --watch=false

  deploy:
    if: github.ref == 'refs/heads/main'
    needs: [backend, frontend]
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}
          aws-region: us-east-1
      - run: sam build && sam deploy --no-confirm-changeset
        working-directory: .
```

> Ajustar rutas y nombres reales. No copiar el workflow sin revisar los secretos y permisos.

## 9. Smoke tests después del despliegue

```bash
curl -f https://<api>/api/health
```

Verificar:

- [ ] `/api/health` responde 200.
- [ ] Un endpoint autenticado responde 401 sin token.
- [ ] El frontend carga y apunta a la API correcta.
- [ ] El login con Supabase funciona.
- [ ] La carga de un archivo pequeño funciona.
- [ ] El procesamiento actualiza el estado.
- [ ] No hay errores 5xx en CloudWatch.
- [ ] La factura sigue en $0.

## 10. Rollback

### 10.1. Backend

- SAM guarda versiones anteriores del stack. Usar el change set anterior o volver a desplegar el commit estable.

```bash
git revert <commit>
sam build && sam deploy
```

- Si el problema es de datos, no revertir la migración sin respaldo.
- Si el problema es de costo, poner la concurrencia de Lambda en 0 primero.

### 10.2. Frontend

- Volver a publicar el build anterior en S3 e invalidar CloudFront.
- Mantener al menos el build anterior identificable por commit.

### 10.3. Base de datos

- Las migraciones destructivas requieren respaldo previo.
- Preferir migraciones compatibles hacia atrás.
- No eliminar columnas en el mismo despliegue que deja de usarlas; hacerlo en dos fases.

## 11. Monitoreo mínimo

| Señal | Dónde | Acción |
|---|---|---|
| Errores 5xx | CloudWatch | Revisar logs y corregir. |
| Throttles de Lambda | CloudWatch | Ajustar límites o revisar tráfico. |
| Mensajes en DLQ | CloudWatch / SQS | Revisar causa y reprocesar. |
| Duración y memoria | CloudWatch | Optimizar si se acerca al límite. |
| Facturación | Billing / Budgets | Detener consumo si hay cobro. |
| Consumo de IA | Registro propio | Ajustar cuotas. |
| Supabase | Panel de Supabase | Revisar almacenamiento y conexiones. |

Retención de logs: 7 días en desarrollo, 30 días en producción.

## 12. Checklist del primer despliegue

- [ ] Cuenta AWS con MFA en root y sin access keys de root.
- [ ] Usuario o rol IAM de despliegue con mínimo privilegio.
- [ ] Presupuestos de $1 y $5 con alertas.
- [ ] Free Tier alerts activadas.
- [ ] Región única definida.
- [ ] Variables de entorno cargadas de forma segura.
- [ ] Proyecto Supabase de producción creado.
- [ ] Migraciones aplicadas y RLS verificado.
- [ ] Bucket S3 privado con lifecycle.
- [ ] Lambda con concurrencia reservada y sin concurrencia provisionada.
- [ ] API Gateway con throttling y sin caché.
- [ ] Logs con retención configurada.
- [ ] Frontend apuntando a la API de producción.
- [ ] Smoke tests aprobados.
- [ ] Cost Explorer revisado al día siguiente.

## 13. Errores frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `503` en rutas autenticadas | Supabase no configurado. | Completar variables de entorno. |
| `401` con token válido | Token vencido o `aud` incorrecto. | Renovar sesión; revisar configuración. |
| `403` en admin | Rol no asignado. | Asignar rol en `usuario_roles`. |
| `413` al subir | Archivo mayor a 20 MB. | Reducir o dividir el archivo. |
| `429` en chat | Cuota de IA agotada. | Esperar o ajustar cuota. |
| Lambda sin acceso a S3 | Rol IAM sin permisos. | Revisar política del rol. |
| CORS bloqueado | Origen no incluido. | Actualizar `CORS_ORIGINS`. |
| Build de Angular falla por presupuesto | Bundle mayor al límite. | Revisar imports y lazy loading. |
| Cold start alto | Paquete grande. | Reducir dependencias. |
