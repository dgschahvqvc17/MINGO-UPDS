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
| `CORS_ORIGINS` | Sí | `http://localhost:4200,http://localhost:4300,https://d4qnw8e73f6co.cloudfront.net` | Orígenes separados por coma; deben coincidir con `AllowedOrigins` de la plantilla. |
| `SUPABASE_URL` | Sí | `https://xxxx.supabase.co` | URL del proyecto. |
| `SUPABASE_ANON_KEY` | Sí | `eyJ...` | Clave pública. |
| `SUPABASE_SERVICE_ROLE_KEY` | No | `eyJ...` | Operaciones administrativas; nunca al frontend. |
| `AWS_REGION` | Sí | `us-east-1` | Una sola región. |
| `AWS_ACCESS_KEY_ID` | Solo local | `AKIA...` | En Lambda se usa el rol IAM. |
| `AWS_SECRET_ACCESS_KEY` | Solo local | `...` | En Lambda se usa el rol IAM. |
| `AWS_S3_BUCKET` | Sí | `mingo-documentos-dev-591015654164` | Bucket privado creado por el stack SAM; debe coincidir con `BucketName`. |
| `AWS_LAMBDA_FUNCTION_NAME` | No | `mingo-document-processor` | Función procesadora. |
| `AWS_SNS_TOPIC_ARN` | Solo worker | `arn:aws:sns:...` | Topic del stack SAM para recordatorios; si falta, la notificación interna sigue funcionando. |
| `AWS_SQS_QUEUE_URL` | No | `https://sqs...` | Cola de documentos. |
| `AI_PROVIDER` | Sí | `gemini` \| `openai` | Proveedor de IA. |
| `AI_API_KEY` | Sí en prod | `AIza...` o `sk-...` | Clave privada. Nunca al frontend. |
| `AI_BASE_URL` | No | `https://generativelanguage.googleapis.com/v1beta/openai/` | Endpoint compatible con OpenAI. Vacío usa el de OpenAI. |
| `AI_CHAT_MODEL` | Sí | `gemini-3.5-flash-lite` \| `gpt-4o-mini` | Modelo de chat. Los modelos `2.5` ya no están disponibles para cuentas nuevas de Gemini. |
| `AI_EMBEDDING_MODEL` | Sí | `gemini-embedding-001` \| `text-embedding-3-small` | Modelo de embeddings. |
| `AI_EMBEDDING_DIMENSIONS` | Sí | `1536` | Debe coincidir con `vector(n)` y con el modelo. |
| `MAX_UPLOAD_MB` | No | `20` | Tamaño máximo de archivo. |
| `RATE_LIMIT_WINDOW_MINUTES` | No | `15` | Ventana de rate limit. |
| `RATE_LIMIT_MAX_REQUESTS` | No | `300` | Máximo por ventana. |

> En producción las variables se cargan desde el entorno de Lambda definido en SAM/CloudFormation. Los secretos se inyectan desde GitHub Actions o Parameter Store; nunca se escriben en el repositorio.

**Proveedor de IA por entorno:**

| Entorno | Proveedor | Modelo de embeddings | Dimensiones | Costo |
|---|---|---|---|---|
| Desarrollo y demo | Google Gemini (tier gratuito) | `gemini-embedding-001` | 1536 | $0, con límites de RPM/RPD por proyecto |
| Producción | OpenAI | `text-embedding-3-small` | 1536 | ≈ $0.02 por millón de tokens |

Reglas:

- Antes de procesar documentos, comprobar la configuración con `cd backend && npm run verificar:embeddings`. El script imprime proveedor, modelo, dimensiones y latencia, y falla si la dimensión no coincide con `AI_EMBEDDING_DIMENSIONS`. No necesita AWS.
- El tier gratuito de Gemini usa el contenido enviado para mejorar sus productos: solo documentos de prueba en desarrollo.
- No mezclar modelos en un mismo corpus: al cambiar de proveedor hay que borrar los fragmentos y reprocesar.
- Cambiar de 1536 dimensiones exige migración de la columna `vector(n)` y del índice HNSW antes de procesar.

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
- `apiUrl` es `/api` en desarrollo (proxy de Angular) y en producción (CloudFront
  envía `/api/*` a la API Gateway HTTP API; el navegador ve el mismo origen).
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

### 5.1. Puntos de entrada

| Función | Archivo | Handler | Estado |
|---|---|---|---|
| Procesadora de documentos (HU09) | `backend/src/lambda/procesador.js` | `src/lambda/procesador.handler` | Definida en `infra/template.yaml`. |
| Recordatorios (HU18) | `backend/src/lambda/recordatorios.js` | `src/lambda/recordatorios.handler` | Definida en `infra/template.yaml`; invocada por un schedule horario. |
| API HTTP (Express) | `backend/src/lambda/api.js` | `src/lambda/api.handler` | Definida en `infra/template.yaml` con `serverless-http`. |

Las tres funciones forman parte de `infra/template.yaml`. La API HTTP usa el
mismo paquete del backend y se expone mediante una API Gateway HTTP API con una
ruta `/{proxy+}`. CloudFront reenvía `/api/*` a esa API.

### 5.2. Reglas de empaquetado

- Node.js 22 en Lambda: el runtime configurado es `nodejs22.x`.
- Arquitectura ARM64.
- Solo dependencias de producción: `sam build` instala las dependencias de `backend/package.json`.
- ZIP menor a 50 MB (límite directo de Lambda); si crece, revisar dependencias.
- Sin `.env`, `tests/`, `node_modules` de desarrollo ni archivos temporales.
- `CodeUri: ../backend/` es relativo a `infra/template.yaml`.
- `handler: src/lambda/procesador.handler` para la procesadora,
  `src/lambda/recordatorios.handler` para los recordatorios y
  `src/lambda/api.handler` para la API HTTP.

### 5.3. Empaquetado

El backend **no** tiene un script `build:lambda`; el empaquetado lo hace SAM a
partir de la plantilla:

```bash
sam build --template-file infra/template.yaml
```

Para revisar el paquete generado:

```bash
sam package --template-file infra/template.yaml --output-template-file packaged.yaml
```

No se versiona `packaged.yaml` ni `.aws-sam/`: son artefactos de build. Si se
necesita un ZIP manual, se construye en un directorio limpio con
`npm ci --omit=dev` dentro de `backend/`.

## 6. Infraestructura con AWS SAM

### 6.1. Recursos permitidos

| Recurso | Uso |
|---|---|
| `AWS::Serverless::Function` | API y procesador de documentos. |
| `AWS::Serverless::HttpApi` | API Gateway HTTP API. |
| `AWS::S3::Bucket` | Documentos. |
| `AWS::SQS::Queue` | Cola y DLQ. |
| `AWS::SNS::Topic` | Un topic privado para notificaciones email; suscripción solo si se pasa `NotificacionesEmail`. |
| `AWS::Scheduler::Schedule` | Un schedule horario de recordatorios, deshabilitado en `dev`. |
| `AWS::IAM::Role` | Solo el rol ya existente del procesador; los roles de HU18 los crea el usuario y se pasan por ARN. |
| `AWS::Logs::LogGroup` | Logs con retención (7 días en `dev`, 30 en `prod`). |
| `AWS::Budgets::Budget` | Presupuesto (crear una vez). |

**Prohibido:** EC2, ECS, EKS, RDS, ElastiCache, NAT Gateway, load balancers, IP elástica, VPC, contenedores permanentes.

### 6.2. Plantilla mínima de referencia

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Description: MINGO API serverless

Globals:
  Function:
    Runtime: nodejs22.x
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

Parámetros SAM de HU18: `NotificacionesEmail` (vacío desactiva la suscripción),
`RecordatorioCron` (por defecto `cron(0 * * * ? *)`, cada hora en punto en UTC),
`RecordatoriosRoleArn` y `SchedulerInvocationRoleArn` (ARN de roles que crea el
usuario; el agente no crea roles IAM).

Recursos de HU18 incluidos en la plantilla: un topic SNS con suscripción email
opcional, un log group, una Lambda ARM64 de 512 MB con timeout de 30 s y un
schedule horario sin reintentos. El schedule queda `DISABLED` en `dev` y
`ENABLED` en `prod`.

Parámetros de la API HTTP: `ApiRoleArn` (ARN de un rol IAM que crea el usuario;
el agente no crea roles), `ApiConcurrency` (solo se aplica en `prod`) y
`AllowedOrigins` (orígenes separados por coma; por defecto `localhost:4200`,
`localhost:4300` y el dominio de CloudFront de `dev`). Ese mismo parámetro
configura el CORS de S3 para la subida directa y el `CORS_ORIGINS` de Express.
La Lambda de la API usa `serverless-http`,
ARM64, 512 MB, timeout de 30 s y un log group con retención de 7 días en `dev`.
La API Gateway HTTP API tiene un stage `$default`, throttling de 20 req/s con
bursto de 40 y sin logs de acceso ni caché. Gasto esperado `$0` con tráfico de
dev: por debajo del free tier de 1 M peticiones/mes de API Gateway y de Lambda.
**No ejecutar el changeset sin la aprobación explícita del usuario.**

Los parámetros `SupabaseAnonKey`, `SupabaseServiceRoleKey` y `AiApiKey` deben
mantenerse sincronizados con `backend/.env`. Si el stack quedó con valores
placeholder, `/api/auth/me` responde `401 Token invalido o expirado` aunque el
login de Supabase funcione, porque la Lambda valida el token contra otro
proyecto o con una clave equivocada.

El rol de la API (`mingo-api-dev-lambda-role`) debe confiar en
`lambda.amazonaws.com`, adjuntar `AWSLambdaBasicExecutionRole` y permitir
`s3:GetObject`/`PutObject`/`DeleteObject` en `mingo-documentos-dev-591015654164/*`,
`sqs:SendMessage` en la cola de procesamiento y `sns:Publish` en el topic de
notificaciones. Se pasa como parámetro `ApiRoleArn`; la plantilla no crea roles.

Costo verificado para el cambio horario: 744 invocaciones/mes de Scheduler
(free tier de 14 millones), 744 invocaciones de Lambda con 512 MB ARM64 (free
tier de 1 millón de peticiones y 400.000 GB-s) y como máximo 30 correos SNS/día
(930/mes, por debajo de los 1.000 correos email gratuitos). Gasto esperado
`$0`. **No ejecutar `sam deploy` sin la aprobación explícita del usuario sobre
esta plantilla y sus límites.**

### 6.4. Presupuestos

Los presupuestos se crean una vez en la cuenta, no en cada despliegue:

```bash
aws budgets create-budget --account-id <ACCOUNT_ID> --budget file://budget.json
```

MINGO usa un único presupuesto compartido de **$1/mes** (`ConcesionariaBMW-1USD`),
con alertas al 80 % real y 100 % pronosticado. No se crea un presupuesto de $5
(decisión del 2026-11-12, revisión 2027-02-12).

### 6.5. Estado desplegado en `dev` (2026-11-26)

| Stack | Output | Valor |
|---|---|---|
| `mingo-hu09-dev` | `ApiInvokeUrl` | `https://ioqyer0j8l.execute-api.us-east-1.amazonaws.com` |
| `mingo-hu09-dev` | `ApiFunctionName` | `mingo-hu09-dev-api` |
| `mingo-frontend-dev` | `FrontendUrl` | `https://d4qnw8e73f6co.cloudfront.net` |
| `mingo-frontend-dev` | `DistributionId` | `E3KT1CRPPEGF3B` |

El navegador llama siempre a `https://d4qnw8e73f6co.cloudfront.net/api/*`;
CloudFront reenvía esas peticiones a la API sin CORS entre dominios. La URL
`execute-api` queda como salida de referencia, no se expone al frontend.

Actualización anterior autorizada (2026-11-26): el usuario aplicó manualmente la
migración `0022` en Supabase `dev`; luego se actualizó `mingo-hu09-dev-api` con
el código de `e7cd0a1` (`CodeSha256:
xVhlfNLlQmt9TCwpfyy/1J4TBQiBZlxZXWrLp1X1Q9s=`, `CodeSize: 32469321`,
`State: Active`, `LastUpdateStatus: Successful`). Se sincronizó el frontend al
bucket `mingo-frontend-dev-591015654164` sin `--delete`. El primer `sync` usó
`dist/frontend` y no sobrescribió el `index.html` de la raíz, que seguía
apuntando a `main-WAWNAWX5.js`; se corrigió sincronizando
`dist/frontend/browser` a la raíz del bucket, según la sección 7.4. Las
invalidaciones autorizadas fueron `IBFC0ZBJND39NDD91VDVX2CS4G` e
`I9ZQT41V1PH6EXI51X7VU9IG3A`; la segunda fue necesaria porque la primera se
ejecutó antes de corregir el `index.html`. CloudFront sirve el bundle
`main-MQH2N2PN.js` (verificado con `HTTP 200`). `GET /api/health` respondió
`200` después del despliegue. `prod` no se tocó.

Última actualización autorizada (2026-11-26): el usuario aplicó manualmente la
migración `0023` en Supabase `dev`; luego se actualizó directamente el código de
`mingo-hu09-dev-api` con el commit `e5c93e4` (`CodeSha256:
KfdAqCNgrEq7LnTYPIMcdoxSJMFwLkm8fUl7E+zfJLk=`, `CodeSize: 35672113`,
`State: Active`, `LastUpdateStatus: Successful`). El ZIP se construyó con
`npm ci --omit=dev --omit=optional` en un directorio temporal, excluyendo mapas,
pruebas, documentación, bundles de navegador de `officeparser` y envoltorios
base64 de `tesseract.js-core`; no incluyó `.env`. Se sincronizó
`dist/frontend/browser` a la raíz del bucket sin `--delete` y se creó la
invalidación `I8D2RYEK81OPNTAG1DGUUTZZ0H`. CloudFront sirve
`main-F3UHZPRX.js` (verificado con `HTTP 200`) y `GET /api/health` respondió
`200`. No se crearon recursos AWS nuevos, no se cambiaron roles, variables de
entorno ni presupuestos; el presupuesto compartido estaba activo con gasto real
`$0` y pronosticado `$0.007`. `prod` no se tocó.

Cambio adicional autorizado el mismo día: en Chrome, el `POST
/api/asistente/plan` terminaba en `net::ERR_CONNECTION_CLOSED` antes de llegar
a API Gateway; con QUIC desactivado en el navegador funcionaba. Se actualizó
`infra/frontend-template.yaml` y se creó/ejecutó el changeset
`mingo-frontend-http2-20261126`, pero CloudFormation no pudo completarlo porque
el perfil `mingo-agente` carece de `cloudfront:GetFunction`; el rollback devolvió
la distribución a `http2and3`. Con autorización explícita se aplicó el mismo
cambio con `aws cloudfront update-distribution` (ETag `E1PA6795UKMFR9`) sobre
`E3KT1CRPPEGF3B`: `HttpVersion: http2`. La distribución quedó `Deployed` y
verificada con `HttpVersion: http2`, `GET /api/health` → `200` y bundle
`main-F3UHZPRX.js`. No se crearon recursos ni se cambiaron roles, variables ni
presupuestos; `prod` no se tocó. El stack `mingo-frontend-dev` quedó en
`UPDATE_ROLLBACK_COMPLETE` por el fallo de permisos de CloudFormation; la
plantilla del repositorio ya declara `http2`, pero el stack no se pudo
sincronizar con CloudFormation. No se requiere desactivar QUIC en el navegador.

Nota: la Lambda `dev` conserva `NODE_ENV=production` en su configuración,
valor previo a este cambio; no se modificó porque cambiar variables de entorno
requiere autorización explícita separada.

El paquete Lambda se construyó con `npm ci --omit=dev --omit=optional` en un
directorio temporal, excluyendo mapas, pruebas, documentación, bundles de
navegador de `officeparser` y envoltorios base64 de `tesseract.js-core`. El ZIP
resultante usa rutas POSIX y tiene 32,5 MB, por debajo del límite directo de
Lambda. No se incluyó `.env`, `tests/` ni binarios nativos de Windows.

El changeset anterior `mingo-dev-cors-20261126` dejó el parámetro
`AllowedOrigins` en `UPDATE_COMPLETE`. No se borraron los objetos heredados
bajo el prefijo `browser/` del bucket frontend: la publicación usa la raíz del
bucket y no se autorizó una eliminación.

Permisos observables del perfil `mingo-agente`: `describe-stacks
--stack-name mingo-frontend-dev` y las actualizaciones autorizadas funcionan;
`cloudfront:GetInvalidation`, `cloudfront:GetFunction`,
`cloudfront:GetOriginRequestPolicy`, `iam:SimulatePrincipalPolicy` y
`cloudformation:ListStacks` devuelven `AccessDenied`. Esto no autoriza por sí solo nuevas operaciones: cada
reedición o redespliegue requiere aprobación explícita en el momento.

## 7. Frontend en S3 + CloudFront

### 7.0. Infraestructura

La infraestructura del frontend está en `infra/frontend-template.yaml` y se
despliega como un stack **independiente** (`mingo-frontend-dev`), separado del
backend. Crea un bucket S3 privado distinto al de documentos, un Origin Access
Control (OAC) y una sola distribución CloudFront `pay-as-you-go`. El parámetro
`ApiDomainName` (por ejemplo,
`abc123.execute-api.us-east-1.amazonaws.com`) agrega un comportamiento `/api/*`
hacia la API Gateway HTTP API del stack del backend.

```text
Servicio: CloudFront pay-as-you-go + S3 privado con OAC + proxy /api/*.
Costo esperado: $0/mes dentro del Always Free (1 TB y 10 M peticiones).
Límites: 1 distribución, PriceClass_100, HttpVersion http2 (sin HTTP/3),
sin WAF, sin Lambda@Edge,
sin Origin Shield, sin logs en tiempo real, sin dominio propio
(se usa el dominio *.cloudfront.net, por lo que no se necesitan
ACM ni Route 53). Invalidación máxima: 1.000 paths/mes (gratis).
El comportamiento /api/* usa CachingDisabled y reenvía todas las cabeceras
del viewer excepto Host.
```

El despliegue de la infraestructura se hace con un changeset. El perfil
`mingo-agente` puede crear el changeset; ejecutarlo o cualquier otra operación
de escritura requiere la aprobación explícita previa del usuario sobre la
plantilla exacta y su costo estimado:

```bash
aws cloudformation create-change-set \
  --stack-name mingo-frontend-dev \
  --change-set-name mingo-frontend-inicial \
  --change-set-type CREATE \
  --template-body file://infra/frontend-template.yaml \
  --profile mingo-agente --region us-east-1
```

Tras ejecutar el changeset, los valores de salida (`FrontendBucketName`,
`DistributionId`, `DistributionDomainName`, `FrontendUrl`) se leen con:

```bash
aws cloudformation describe-stacks --stack-name mingo-frontend-dev \
  --profile mingo-agente --region us-east-1 \
  --query "Stacks[0].Outputs"
```

### 7.1. Build

```bash
cd frontend
npm run build -- --configuration production
```

Salida: `frontend/dist/frontend/browser` (el proyecto se llama `frontend`; la
configuración `production` ya aplica `outputHashing: all`).

### 7.2. Publicación

```bash
cd frontend
aws s3 sync dist/frontend/browser s3://mingo-frontend-dev-591015654164 \
  --profile mingo-agente --region us-east-1 --delete
aws cloudfront create-invalidation --distribution-id <DIST_ID> --paths "/*"
```

La invalidación no es necesaria en el flujo normal: `index.html` se revalida
en cada petición y los assets llevan hash en el nombre. Solo se usa si se
publica un cambio fuera de `/index.html` con el mismo nombre de archivo.

Reglas:

- Bucket privado; acceso solo por CloudFront (Origin Access Control).
- Sin versionado ilimitado.
- Cache-Control largo para assets con hash y corto para `index.html`. La
  distribución usa la política administrada `CachingOptimized`
  (`658327ea-f89d-4fab-a63d-7e88639e58f6`), que respeta el `Cache-Control`
  del origen sin reenviar cabeceras al bucket.
- Una sola distribución.
- Sin Lambda@Edge ni WAF.
- HTTPS con el certificado por defecto de `*.cloudfront.net` (no se crea ACM
  ni se usa Route 53; están fuera de la lista blanca de MINGO).
- Una CloudFront Function reescribe las rutas del SPA a `/index.html`, salvo
  `/api/*` y las rutas con extensión (assets). Antes se usaban respuestas de
  error personalizadas, que enmascaraban los 404 reales de la API.
- `/api/*` se envía a la API Gateway HTTP API con `CachingDisabled`, sin
  reenvío del `Host` del navegador. El frontend usa `apiUrl: '/api'` y no
  necesita CORS entre dominios.

#### Diagnóstico del 404 con OAC

Si CloudFront responde `404 NotFound` con `Server: AmazonS3` aunque los objetos
existen, verifica en este orden: origen regional, `DefaultRootObject`, OAC
(`sigv4` / `always` / tipo `s3`), bucket policy con `AWS:SourceArn` exacto y
`CustomErrorResponses`. Si todo eso está correcto, revisa la **CachePolicy**:
la política administrada `UseOriginCacheControlHeaders`
(`83da9c7e-98b4-4e11-a168-04f0df8e2c65`) produjo este síntoma en MINGO;
`CachingOptimized` lo resolvió sin quitar el cacheo de los assets con hash.
La invalidación `/*` y un redeploy de la distribución no fueron suficientes.

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
curl -f https://d4qnw8e73f6co.cloudfront.net/api/health
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
- [ ] Presupuesto compartido de $1 con alertas (sin presupuesto de $5).
- [ ] Free Tier alerts activadas.
- [ ] Región única definida.
- [ ] Variables de entorno cargadas de forma segura.
- [ ] Proyecto Supabase de producción creado.
- [ ] Migraciones aplicadas y RLS verificado.
- [ ] Bucket S3 privado con lifecycle.
- [ ] Lambda sin concurrencia provisionada; reservada en prod y, en dev, según `docs/excepciones-aws.md` (EXC-001).
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
| CORS bloqueado al subir a S3 | Origen no incluido en el bucket. | Redesplegar con `AllowedOrigins` actualizado. |
| Build de Angular falla por presupuesto | Bundle mayor al límite. | Revisar imports y lazy loading. |
| Cold start alto | Paquete grande. | Reducir dependencias. |
