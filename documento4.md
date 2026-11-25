# MINGO — Documento integral de pruebas, despliegue y resultados

**Versión:** 1.0  
**Fecha de emisión:** 22 de noviembre de 2026  
**Estado:** documentación vigente del entorno `dev`  
**Repositorio:** MINGO, rama `develop`  
**Alcance:** sistema completo (frontend Angular, API Express, Supabase, AWS serverless y agente de IA/RAG).

> Este documento reúne, en un solo lugar, la descripción del sistema, el plan de pruebas, los casos diseñados, la ejecución real, los errores encontrados, las correcciones, el despliegue de `dev`, la verificación posterior y las conclusiones. Las cifras de pruebas corresponden a la ejecución más reciente registrada el **22/11/2026**. No se incluyen valores de `backend/.env`, tokens, claves de AWS, claves de Supabase ni claves del proveedor de IA.

> **Addendum 25/11/2026 — rama `feature/roles-docente-inscripciones`:** el alcance descrito más abajo corresponde al estado del 22/11/2026. La rama actual incorpora roles `estudiante`, `docente` y `administrador` con precedencia `administrador > docente > estudiante`, clave temporal con cambio obligatorio, administración de usuarios en `/api/usuarios`, `materias.docente_id`, inscripciones por materia con estados `activa`/`inactiva` y estados de tarea por estudiante en `tarea_estados` (migración `0018`). El contrato vigente está en [api.md](docs/api.md), el esquema en [base-datos.md](docs/base-datos.md) y los casos en [plan-pruebas.md](docs/plan-pruebas.md). Las cifras `507` y `191` del cuerpo corresponden solo al estado del 22/11/2026 y no acreditan esta rama. Backend de la rama: `528/528` pruebas en `56` suites y lint pasan. Frontend de la rama: build de producción y `209/209` pruebas en `30` archivos pasan. Los cambios están pendientes de despliegue; el ámbito previsto es solo `dev` y `prod` queda fuera de alcance sin autorización separada.

---

## 1. Descripción general del sistema

### 1.1. Propósito de MINGO

MINGO es una plataforma web académica inteligente orientada a estudiantes universitarios. Su objetivo es centralizar materias, tareas, evaluaciones, calendario, documentos de estudio y herramientas de inteligencia artificial en un único entorno.

La plataforma no pretende sustituir a Moodle ni depender de permisos administrativos institucionales. Parte de una limitación concreta detectada durante el análisis inicial: las cuentas de estudiante de Moodle UPDS no podían habilitar servicios web (respuesta HTTP `403`), por lo que MINGO se diseñó como una aplicación independiente. El estudiante incorpora su información mediante registro manual y carga de documentos.

### 1.2. Problema que resuelve

| Problema identificado | Consecuencia para el estudiante | Respuesta de MINGO |
|---|---|---|
| Información académica dispersa entre materias, PDF y avisos. | Dificultad para saber qué hacer a diario. | Dashboard con materias, tareas, próximas entregas, exámenes y eventos. |
| Tareas y evaluaciones difíciles de priorizar. | Riesgo de incumplir fechas. | CRUD de tareas, filtros, prioridades, estados y calendario sincronizado. |
| Materiales de estudio poco aprovechados. | Revisión manual de documentos extensos. | Biblioteca, extracción de texto, fragmentos, embeddings y búsqueda semántica. |
| Falta de acompañamiento personalizado. | El estudiante no sabe por dónde empezar. | Asistente con RAG que responde usando sus propios documentos. |
| Preparación de evaluaciones poco organizada. | Estudio improvisado y sin seguimiento. | Cuestionarios, tarjetas de memoria, planes de estudio y evaluación del dominio. |
| Ausencia de seguimiento del progreso. | No se identifican temas débiles ni hábitos a mejorar. | Objetivos, progreso, recomendaciones y notificaciones. |

### 1.3. Objetivo general y objetivos específicos

**Objetivo general.** Desarrollar una plataforma web académica inteligente que permita centralizar y administrar la información académica mediante herramientas de organización, gestión documental e inteligencia artificial, con un agente capaz de analizar materiales, responder consultas, generar recursos de aprendizaje y ofrecer acompañamiento personalizado.

**Objetivos específicos.**

1. Autenticar usuarios y administrar perfiles con control de roles.
2. Registrar materias, docentes, periodos y unidades académicas.
3. Gestionar tareas, actividades, evaluaciones y fechas de entrega.
4. Centralizar las fechas importantes en un calendario académico.
5. Almacenar y clasificar documentos de estudio en una biblioteca privada.
6. Procesar documentos de forma asíncrona y prepararlos para RAG.
7. Responder preguntas usando los materiales del estudiante y citar fuentes.
8. Generar resúmenes, cuestionarios, tarjetas de memoria y planes de estudio.
9. Evaluar conocimientos y recomendar temas a reforzar.
10. Registrar objetivos, medir progreso y enviar recordatorios.
11. Mantener una arquitectura modular, segura, serverless y de bajo costo.

### 1.4. Arquitectura tecnológica

| Capa | Tecnología | Responsabilidad principal |
|---|---|---|
| Frontend | Angular 21, TypeScript, Bootstrap 5, RxJS, signals | Interfaz SPA, formularios, guards, interceptores y visualización de resultados. |
| Backend | Node.js 24, Express 5, CommonJS, Zod | API REST, reglas de negocio, validación, autorización e integraciones. |
| Datos | Supabase PostgreSQL + `pgvector` + Supabase Auth + RLS | Persistencia, identidad, aislamiento por usuario y búsqueda vectorial. |
| Infraestructura | AWS serverless: Lambda, API Gateway HTTP API, S3, SQS, SNS, EventBridge Scheduler, CloudFront, IAM, CloudWatch | Ejecución, almacenamiento, colas, notificaciones y entrega del frontend. |
| IA | Proveedor externo compatible con OpenAI, RAG sobre `pgvector` | Embeddings, chat, resúmenes, cuestionarios, tarjetas, planes y evaluación. |
| Pruebas | Jest + Supertest; Vitest | Pruebas unitarias, integración HTTP y pruebas frontend. |

### 1.5. Vista de componentes

```text
                         ┌────────────────────┐
                         │     ESTUDIANTE     │
                         └─────────┬──────────┘
                                   │ HTTPS
                                   v
┌──────────────────────────────────────────────────────────────┐
│ Angular 21 (CloudFront + S3 privado)                         │
│ core / shared / features / layout                            │
│ apiUrl = /api → mismo origen en el navegador                 │
└───────────────────────────┬──────────────────────────────────┘
                            │ /api/* + Authorization: Bearer
                            v
┌──────────────────────────────────────────────────────────────┐
│ CloudFront: behavior /api/* → API Gateway HTTP API           │
│ CachingDisabled, reenvía cabeceras salvo Host                │
└───────────────────────────┬──────────────────────────────────┘
                            v
┌──────────────────────────────────────────────────────────────┐
│ API Gateway HTTP API — stage $default                        │
│ ruta /{proxy+} — throttle 20 req/s, burst 40, sin caché      │
└───────────────────────────┬──────────────────────────────────┘
                            v
┌──────────────────────────────────────────────────────────────┐
│ Lambda API (Express + serverless-http)                       │
│ routes → middlewares → controllers → services → repositories │
└───────┬───────────────┬──────────────────┬───────────────────┘
        │               │                  │
        v               v                  v
┌───────────────┐ ┌──────────────┐ ┌──────────────────────────┐
│ Supabase      │ │ S3 privado   │ │ Proveedor de IA          │
│ Auth+PG+RLS   │ │ URLs 15 min  │ │ embeddings + generación  │
│ pgvector      │ └──────┬───────┘ └──────────────────────────┘
└───────────────┘        │ evento S3
                         v
                 ┌───────────────┐
                 │ SQS + DLQ     │
                 └───────┬───────┘
                         v
                 ┌──────────────────────────┐
                 │ Lambda procesadora       │
                 │ extrae, fragmenta, embedding │
                 └──────────────────────────┘

EventBridge Scheduler (horario, DISABLED en dev)
        → Lambda recordatorios → Supabase notificaciones → SNS email opcional
```

### 1.6. Capas del backend

| Capa | Responsabilidad | Restricción |
|---|---|---|
| `routes/` | Declarar método, ruta y middlewares. | No contiene reglas de negocio ni SQL. |
| `middlewares/` | Autenticación, roles, validación Zod y errores. | No contiene lógica de una feature. |
| `controllers/` | Leer `req`, llamar al servicio y responder HTTP. | No consulta Supabase ni calcula reglas complejas. |
| `services/` | Reglas de negocio, propiedad, cuotas, IA y AWS. | No conoce `req`/`res` ni escribe SQL directo. |
| `repositories/` | Consultas a Supabase y mapeo de filas. | No responde HTTP ni aplica reglas de negocio. |
| `models/` | Esquemas Zod y contratos del dominio. | No accede a infraestructura. |
| `utils/` | `ApiError`, `asyncHandler` y helpers puros. | No concentra lógica de negocio. |

Ejemplo de validación centralizada:

```js
// backend/src/middlewares/validation.middleware.js
const ApiError = require('../utils/ApiError');

function validate(schemas = {}) {
  return (req, _res, next) => {
    try {
      const validated = {};

      for (const [source, schema] of Object.entries(schemas)) {
        const result = schema.safeParse(req[source]);

        if (!result.success) {
          return next(
            ApiError.badRequest('Datos de entrada invalidos.', {
              source,
              issues: result.error.issues.map((issue) => ({
                path: issue.path.join('.'),
                message: issue.message,
              })),
            }),
          );
        }

        validated[source] = result.data;
      }

      req.validated = validated;
      next();
    } catch (error) {
      next(error);
    }
  };
}
```

Ejemplo de error operacional:

```js
// backend/src/utils/ApiError.js
class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
  }

  static notFound(message = 'Recurso no encontrado') {
    return new ApiError(404, message);
  }
}
```

### 1.7. Estructura funcional del frontend

```text
frontend/src/app/
├── core/          guards, interceptors, services y modelos globales
├── shared/        componentes, pipes y directivas reutilizables
├── features/      auth, dashboard, materias, tareas, calendario,
│                  biblioteca, centro-estudio, asistente-ia,
│                  notificaciones, objetivos, progreso y administración
├── layout/        shell de navegación
├── app.config.ts
├── app.routes.ts
└── app.ts
```

Reglas aplicadas: componentes standalone, `OnPush`, `inject()`, signals para estado local, RxJS para asincronía, rutas lazy, guards de autenticación y rol, y estados explícitos de carga, vacío y error.

### 1.8. Modelo de datos

El modelo fuente del equipo contempla 15 entidades y se amplió con tablas necesarias para IA, planes, progreso e idempotencia. En el repositorio existen **17 migraciones SQL** versionadas, de `0001_hu01_auth.sql` a `0017_hu18_notificaciones.sql`.

Grupos principales:

| Grupo | Tablas representativas |
|---|---|
| Identidad | `perfiles`, `roles`, `usuario_roles` |
| Organización académica | `periodos_academicos`, `materias`, `unidades` |
| Actividades | `tareas`, `eventos_calendario` |
| Biblioteca | `documentos`, `fragmentos_documento` |
| Conversación e IA | `conversaciones`, `mensajes`, `referencias_respuesta`, `resumenes`, `consumo_ia`, `solicitudes_idempotentes` |
| Evaluación | `cuestionarios`, `preguntas`, `opciones_pregunta`, `intentos_cuestionario`, `respuestas_usuario` |
| Estudio | `planes_estudio`, `sesiones_estudio`, `conjuntos_tarjetas`, `tarjetas` |
| Seguimiento | `objetivos_estudio`, `progreso_academico`, `notificaciones`, `preferencias_usuario` |

Reglas transversales:

- RLS activo en todas las tablas del dominio.
- Todo registro de negocio lleva `usuario_id`.
- Los repositorios filtran explícitamente por `usuario_id`, incluso cuando usan `service_role`.
- Un recurso de otro usuario responde `404`, nunca `403`.
- Los embeddings se guardan en `vector(1536)` y se consultan con `pgvector`.
- Las migraciones son idempotentes y están versionadas.

### 1.9. Contrato de API

**Base URL local:** `http://localhost:4000/api`  
**Base URL en `dev`:** `https://d4qnw8e73f6co.cloudfront.net/api`  
**Autenticación:** `Authorization: Bearer <access_token>` de Supabase Auth.

Respuesta correcta:

```json
{
  "success": true,
  "data": {}
}
```

Respuesta paginada:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "pagination": { "limit": 20, "offset": 0, "total": 57 }
  }
}
```

Respuesta de error:

```json
{
  "success": false,
  "error": {
    "message": "Datos de entrada invalidos.",
    "details": {
      "source": "body",
      "issues": [{ "path": "titulo", "message": "El titulo es obligatorio." }]
    }
  }
}
```

Códigos relevantes: `200`, `201`, `202`, `204`, `400`, `401`, `403`, `404`, `409`, `422`, `429`, `503` y `500`.

El código contiene **11 módulos de rutas** (`auth`, `usuario`, `materia`, `tarea`, `calendario`, `dashboard`, `documento`, `estudio`, `asistente`, `notificacion` y `administracion`) y **81 declaraciones HTTP** mediante `router.get/post/put/patch/delete`.

### 1.10. Seguridad y control de costos

**Seguridad.**

- El frontend solo conoce la clave pública `anon`/`publishable` de Supabase.
- El backend valida el JWT con Supabase en cada solicitud.
- El rol se lee de la base de datos, no del token ni del cliente.
- Ningún endpoint acepta `usuario_id`, rol o estado calculado desde el cliente.
- Helmet, CORS restringido, rate limiting y límite de body están activos.
- Los archivos se suben por URL prefirmada de 15 minutos a un bucket privado.
- El contenido generado por IA se muestra con interpolación; no se usa `innerHTML`.
- Los documentos recuperados se tratan como datos no confiables frente a prompt injection.

**Costos AWS.**

- Solo servicios serverless de la lista blanca.
- Sin EC2, contenedores permanentes, RDS, NAT Gateway, balanceadores ni IP elástica.
- Lambda ARM64, 512 MB y timeout de 30 s para la API.
- API Gateway con throttle de 20 req/s y burst 40.
- S3 privado, SSE-S3, lifecycle y sin versionado ilimitado.
- SQS con retención de 4 días, DLQ y `maxReceiveCount = 3`.
- CloudWatch con retención de 7 días en `dev`.
- Presupuesto compartido `ConcesionariaBMW-1USD` de $1/mes con alertas al 80 % real y 100 % pronosticado.
- Gasto verificado en la última revisión: **$0.00 real y $0.00 pronosticado**.

---

## 2. Objetivos del plan de pruebas

### 2.1. Objetivo principal

Verificar que cada historia de usuario funciona de extremo a extremo, que los datos están aislados por usuario, que las respuestas de IA se apoyan en documentos propios y que el despliegue serverless mantiene costo `$0` sin exponer secretos.

### 2.2. Objetivos específicos

| Objetivo | Cómo se verifica |
|---|---|
| Confirmar la funcionalidad de las 18 HU. | Casos funcionales por módulo y trazabilidad HU → CP. |
| Validar contratos HTTP. | Supertest sobre la app Express; códigos, sobre de respuesta y paginación. |
| Proteger datos de otros usuarios. | Pruebas con dos usuarios, RLS y filtro explícito por `usuario_id`. |
| Evitar regresiones en reglas de negocio. | Pruebas unitarias de servicios con dependencias simuladas. |
| Controlar entradas. | Esquemas Zod para `body`, `query`, `params` y cabeceras cuando aplica. |
| Verificar estados de interfaz. | Pruebas Vitest de carga, vacío, error y accesibilidad básica. |
| Validar IA y RAG. | Umbral de similitud, citas válidas, prompt injection, cuotas y degradación. |
| Confirmar integración cloud. | Smoke test de `/api/health`, proxy `/api/*`, colas y presupuesto. |
| Asegurar el despliegue. | Changesets revisados, outputs verificados y rollback documentado. |
| Mantener el repositorio consistente. | Lint, pruebas, build, Conventional Commits y documentación actualizada. |

### 2.3. Pirámide de pruebas

| Nivel | Herramienta | Enfoque | Momento |
|---|---|---|---|
| Unitarias backend | Jest | Servicios, modelos Zod, utilidades y cálculos. | Cada cambio. |
| Integración backend | Jest + Supertest | Endpoints, middlewares, contratos y códigos HTTP. | Cada PR. |
| Unitarias frontend | Vitest + TestBed | Componentes, servicios, guards, pipes y signals. | Cada PR. |
| Integración frontend | HttpTestingController / TestBed | Servicios HTTP e interceptores. | Cada módulo. |
| Seguridad de datos | SQL + dos usuarios | RLS y propiedad. | Cada tabla nueva. |
| IA | Documentos de referencia | Calidad, citas, límites y prompt injection. | Cambios de prompt o modelo. |
| E2E opcional | Playwright | Flujos críticos. | Antes de cerrar sprint. |
| Costo y rendimiento | Revisión de métricas | Cold start, duración y consumo. | Antes de desplegar. |

### 2.4. Criterios de aceptación globales

1. Todo endpoint privado rechaza solicitudes sin token con `401`.
2. Todo recurso ajeno responde `404`.
3. Toda entrada se valida con Zod y se lee desde `req.validated`.
4. Toda lista incluye paginación o un `meta` coherente.
5. Todo error usa el sobre `{ success: false, error }`.
6. Ninguna respuesta expone stack, secretos, rutas internas ni mensajes crudos de SDK.
7. Toda pantalla con datos muestra carga, vacío y error.
8. Las respuestas documentales de IA incluyen al menos una cita válida.
9. Si no hay contexto suficiente, el agente lo indica sin llamar al modelo.
10. Las cuotas de IA responden `429` con `AI_QUOTA_EXCEEDED`.
11. El despliegue `dev` responde `/api/health` por API directa y por CloudFront.
12. Lint, pruebas y build pasan antes de cualquier entrega.

---

## 3. Identificación de funcionalidades a evaluar

### 3.1. Planificación por sprints

| Sprint | Objetivo | Historias | Resultado esperado |
|---|---|---|---|
| 1 | Plataforma base y gestión académica | HU01–HU06 | Acceso, roles, materias, tareas, calendario y dashboard. |
| 2 | Biblioteca digital y procesamiento inteligente | HU07–HU12 | Carga, biblioteca, procesamiento, resúmenes, búsqueda y chat. |
| 3 | Agente inteligente y herramientas de aprendizaje | HU13–HU18 | Cuestionarios, tarjetas, planes, evaluación, progreso y notificaciones. |

Total: **18 historias de usuario**, **3 sprints**, **6 historias por sprint**.

### 3.2. Trazabilidad de historias

| HU | Funcionalidad | Sprint | Módulo principal | Riesgo principal a probar |
|---|---|---:|---|---|
| HU01 | Iniciar sesión | 1 | Autenticación | Token inválido, usuario inactivo, redirección por rol. |
| HU02 | Administrar usuarios y roles | 1 | Administración | Escalada de privilegios y auto-modificación de rol. |
| HU03 | Gestionar materias | 1 | Materias | Materia ajena, código duplicado, periodo inválido. |
| HU04 | Gestionar tareas | 1 | Tareas | Fechas invertidas, estado, filtros y sincronización con calendario. |
| HU05 | Consultar calendario | 1 | Calendario | Rango obligatorio, eventos automáticos y recursos ajenos. |
| HU06 | Visualizar panel principal | 1 | Dashboard | Contadores incorrectos o datos de otro usuario. |
| HU07 | Cargar documentos | 2 | Biblioteca | Tipo/tamaño, ruta S3 y URL prefirmada. |
| HU08 | Administrar biblioteca | 2 | Biblioteca | Descarga, filtros y borrado de objeto + metadatos. |
| HU09 | Procesar documentos | 2 | Procesador | Doble encolado, reintentos, DLQ y reemplazo de fragmentos. |
| HU10 | Generar resúmenes | 2 | IA | Documento no procesado, caché y truncamiento. |
| HU11 | Búsqueda semántica | 2 | IA/RAG | Umbral, filtro por usuario y cuota. |
| HU12 | Chat académico | 2 | Asistente | Citas, prompt injection, historial e idempotencia. |
| HU13 | Generar cuestionarios | 3 | Centro de estudio | JSON inválido, cantidad y material insuficientes. |
| HU14 | Crear tarjetas de memoria | 3 | Tarjetas | Duplicados, reverso oculto y avance. |
| HU15 | Planificar sesiones | 3 | Planes | Propuesta no persistida, edición y eventos de estudio. |
| HU16 | Evaluar conocimientos | 3 | Evaluación | Corrección objetiva, evaluación abierta y dominio por tema. |
| HU17 | Objetivos y progreso | 3 | Progreso | Cálculo de porcentajes, racha y recomendaciones. |
| HU18 | Notificaciones y recordatorios | 3 | Notificaciones | Duplicados, preferencias, tope de correos y schedule en `dev`. |

### 3.3. Funcionalidades técnicas transversales

| Funcionalidad | Descripción | Evidencia de implementación |
|---|---|---|
| Autenticación JWT | Validación del `access_token` contra Supabase. | `auth.middleware.js`, `GET /api/auth/me`. |
| Roles | `estudiante` y `administrador`; fuente de verdad en base de datos. | `roles.middleware.js`, módulo `administracion`. |
| Validación | Zod para entradas HTTP. | `validation.middleware.js`, esquemas en `models/`. |
| Manejo de errores | `ApiError` + middleware central. | `ApiError.js`, `error.middleware.js`. |
| Paginación | `limit`/`offset` o `page`/`limit` según módulo. | Contrato en `docs/api.md`. |
| RLS | Aislamiento a nivel PostgreSQL. | 17 migraciones y políticas por tabla. |
| Subida segura | URL prefirmada de 15 minutos y clave generada por servidor. | Módulo `documento`, bucket privado. |
| Procesamiento asíncrono | S3 → SQS → Lambda → Supabase. | `infra/template.yaml`. |
| RAG | Recuperación con `pgvector`, prompt acotado y citas validadas. | `services/busqueda.service.js`, `repositories/fragmento.repository.js`. |
| Idempotencia | Clave SHA-256 del cuerpo en `solicitudes_idempotentes`. | `POST /api/asistente/chat`. |
| Cuotas IA | Límites por operación y usuario. | `consumo_ia` y respuestas `429`. |
| Observabilidad | Logs con retención y errores 5xx sin stack al cliente. | CloudWatch y middleware de errores. |
| Despliegue | API Lambda + API Gateway; frontend S3 + CloudFront. | Stacks `mingo-hu09-dev` y `mingo-frontend-dev`. |

### 3.4. Funcionalidades fuera del MVP

- Integración directa con servicios web de Moodle.
- Rol docente y espacios compartidos.
- Notificaciones push nativas.
- Aplicación móvil.
- Multi-región, alta disponibilidad empresarial o microservicios.

---

## 4. Diseño de casos de prueba

### 4.1. Convención de identificadores

Los identificadores `CP-xx` son propios de este documento y permiten trazar cada caso con una historia de usuario y un módulo. No sustituyen a los archivos automatizados, sino que los organizan.

### 4.2. Casos funcionales del Sprint 1

| ID | HU | Caso | Entrada / acción | Resultado esperado |
|---|---|---|---|---|
| CP-01 | HU01 | Login válido | Correo y contraseña correctos en Supabase Auth. | Sesión iniciada, redirección al dashboard y `GET /api/auth/me` devuelve perfil y rol. |
| CP-02 | HU01 | Credenciales incorrectas | Contraseña errónea. | `401`, mensaje genérico, sin revelar si el correo existe. |
| CP-03 | HU01 | Token ausente o vencido | Llamada a endpoint privado sin token o con JWT expirado. | `401` con sobre de error estándar. |
| CP-04 | HU01 | Usuario inactivo | Token válido de perfil `inactivo`. | `403` al usar la API. |
| CP-05 | HU02 | Acceso de estudiante a administración | Token con rol `estudiante` → `/api/administracion/*`. | `403`. |
| CP-06 | HU02 | Administrador lista usuarios | Token `administrador` + filtros y paginación. | `200`, solo datos autorizados y `meta`. |
| CP-07 | HU02 | Auto-modificación de rol | Admin intenta cambiar su propio rol. | Operación rechazada; auditoría registrada. |
| CP-08 | HU03 | Crear materia válida | `nombre`, `codigo`, `docente`, `periodo_academico`, `color`. | `201`; aparece en el listado propio. |
| CP-09 | HU03 | Crear materia sin nombre | Body sin `nombre`. | `400` con `VALIDATION_ERROR`. |
| CP-10 | HU03 | Periodo duplicado o inválido | Código repetido para el mismo usuario o periodo con formato incorrecto. | `409` o `400` según regla. |
| CP-11 | HU03 | Materia ajena | ID de materia de otro usuario en `GET`, `PUT` o `DELETE`. | `404`. |
| CP-12 | HU04 | Crear tarea válida | Materia propia, título, prioridad y `fecha_entrega` futura. | `201`; evento tipo `entrega` creado o sincronizado. |
| CP-13 | HU04 | Fecha de entrega anterior | `fecha_entrega < fecha_asignacion`. | `400`. |
| CP-14 | HU04 | Cambiar estado | `PATCH /api/tareas/:id/estado` con `completada`. | `200`; dashboard refleja el cambio. |
| CP-15 | HU04 | Filtros y paginación | `materia_id`, `estado`, `prioridad`, `limit`, `offset`. | Solo coincidencias propias y `meta` correcto. |
| CP-16 | HU05 | Listar calendario sin rango | `GET /api/calendario` sin `desde`/`hasta`. | `400`. |
| CP-17 | HU05 | Evento con fechas invertidas | `fecha_fin < fecha_inicio`. | `400`. |
| CP-18 | HU05 | Próximos eventos | `GET /api/calendario/proximos?dias=7`. | Rango correcto; `proximos` no se interpreta como ID. |
| CP-19 | HU06 | Dashboard con datos | Usuario con materias, tareas y eventos. | Contadores correctos y listas limitadas. |
| CP-20 | HU06 | Dashboard vacío | Usuario sin registros. | Ceros, listas vacías y estados vacíos en frontend. |
| CP-21 | HU06 | Dashboard sin token | Llamada directa a `/api/dashboard`. | `401`. |

### 4.3. Casos funcionales del Sprint 2

| ID | HU | Caso | Entrada / acción | Resultado esperado |
|---|---|---|---|---|
| CP-22 | HU07 | URL de carga válida | PDF de 4 MB, MIME coherente, materia propia. | URL S3 con expiración de 900 s y `objectKey` bajo `usuarios/<id>/`. |
| CP-23 | HU07 | Formato no permitido | Archivo `.doc` o `.ppt`. | `400` con formatos aceptados: PDF, DOCX, PPTX, TXT. |
| CP-24 | HU07 | Extensión distinta del MIME | Nombre `.pdf` con `Content-Type` de imagen. | `400`. |
| CP-25 | HU07 | Archivo mayor a 20 MB | `tamano > 20971520`. | `400`. |
| CP-26 | HU08 | Registrar metadatos | `objectKey` real de S3. | `201`; estado `pendiente` o `en_cola`; tamaño y tipo leídos de S3. |
| CP-27 | HU08 | Listar y filtrar documentos | `materia_id`, `q`, `estado`, `limit`, `offset`. | Solo documentos propios, orden por fecha descendente y `meta`. |
| CP-28 | HU08 | Descargar documento | `GET /:id/descarga`. | URL prefirmada de 15 min, `Content-Disposition` con nombre original. |
| CP-29 | HU08 | Eliminar documento | `DELETE /:id` propio. | Se borran objeto S3, fragmentos y metadatos. |
| CP-30 | HU09 | Encolar procesamiento | `POST /:id/procesar`. | `202` y estado `en_cola`. |
| CP-31 | HU09 | Doble procesamiento | Segundo `POST` mientras está `en_cola` o `procesando`. | `409`, salvo documento atascado >15 min. |
| CP-32 | HU09 | Documento sin texto | PDF escaneado sin capa de texto. | Estado `error`, motivo `sin_texto_extraible`. |
| CP-33 | HU09 | Reemplazo de fragmentos | Reprocesar documento cambiado. | Transacción atómica; si falla, se conservan fragmentos anteriores. |
| CP-34 | HU10 | Resumen válido | Documento `procesado`, profundidad `media`. | Estructura con resumen, temas y conceptos; cita y registro de consumo. |
| CP-35 | HU10 | Documento no procesado | Documento `pendiente`. | `422`. |
| CP-36 | HU10 | Reutilizar resumen | Mismo documento, mismo hash y profundidad. | `reutilizado: true`, sin nueva llamada a IA. |
| CP-37 | HU11 | Búsqueda semántica con coincidencia | `q=derivadas` sobre documento propio. | Fragmentos ordenados por similitud ≥ 0.55 con documento y página. |
| CP-38 | HU11 | Búsqueda sin coincidencia | Pregunta fuera del corpus. | `data: []` y `meta.mensaje` orientativo. |
| CP-39 | HU11 | Documento ajeno en filtro | `documento_id` de otro usuario. | `404`; nunca se devuelven fragmentos ajenos. |
| CP-40 | HU11 | Cuota agotada | 51ª búsqueda del día. | `429 AI_QUOTA_EXCEEDED`, sin llamada al proveedor. |
| CP-41 | HU12 | Chat con documento | Pregunta sobre fragmento recuperable. | Respuesta con cita válida, consumo registrado y conversación persistida. |
| CP-42 | HU12 | Sin información suficiente | Pregunta no cubierta por fragmentos. | `MENSAJE_SIN_INFORMACION`, `modelo: null`, `referencias: []`. |
| CP-43 | HU12 | Prompt injection | Texto “ignora tus instrucciones” dentro del documento. | Instrucción no obedecida; delimitadores escapados; sin fuga del prompt. |
| CP-44 | HU12 | Cita inventada | Modelo devuelve referencia inexistente. | Backend descarta la cita. |
| CP-45 | HU12 | Idempotencia | Misma `Idempotency-Key` y mismo cuerpo. | Devuelve respuesta original; no duplica turnos ni consumo. |
| CP-46 | HU12 | Idempotencia con otro cuerpo | Misma clave, cuerpo distinto. | `409`. |

### 4.4. Casos funcionales del Sprint 3

| ID | HU | Caso | Entrada / acción | Resultado esperado |
|---|---|---|---|---|
| CP-47 | HU13 | Generar cuestionario | Materia propia y 10 preguntas. | Cuestionario persistido; `tema` por pregunta; respuestas correctas ocultas. |
| CP-48 | HU13 | Sin material procesado | Materia sin documentos procesados. | `422`. |
| CP-49 | HU13 | JSON inválido del modelo | Respuesta mal formada. | Un reintento; si persiste, `503` controlado. |
| CP-50 | HU14 | Generar tarjetas | 10 pares frente/reverso. | Conjunto con tarjetas `sin_revisar`; duplicados descartados. |
| CP-51 | HU14 | Repetir pendientes | Marcar una tarjeta como `conocida`. | No aparece en `estado=pendientes`. |
| CP-52 | HU15 | Proponer plan | Materia, objetivo, fecha futura, 60 min/día, días hábiles. | `es_propuesta: true`; no hay filas ni eventos guardados. |
| CP-53 | HU15 | Confirmar plan | Propuesta editada y confirmada. | Plan `confirmado`, sesiones `pendiente` y evento `estudio` por sesión. |
| CP-54 | HU15 | Eliminar sesión intermedia | Borrar sesión 2 y agregar otra. | `orden = max(orden)+1`, sin conflicto de índice único. |
| CP-55 | HU16 | Responder cuestionario | Objetivas y abiertas. | Corrección determinista + evaluación IA; nota sobre preguntas calificadas. |
| CP-56 | HU16 | Proveedor de IA caído | Error al evaluar abiertas. | Intento finaliza con `aviso_evaluacion`; objetivas conservadas. |
| CP-57 | HU16 | Temas a reforzar | Dominio <70 % en un tema. | `temas_reforzar` y recomendaciones. |
| CP-58 | HU17 | Crear objetivo | Título ≥5 caracteres y materia propia opcional. | `201`, estado `pendiente`, `usuario_id` del token. |
| CP-59 | HU17 | Objetivo ajeno | ID de otro usuario en `GET`, `PUT` o `DELETE`. | `404` en los tres casos. |
| CP-60 | HU17 | Progreso sin registros | Usuario nuevo. | Porcentajes en 0, promedio `null`, recomendación inicial. |
| CP-61 | HU18 | Generar recordatorios | Actividad dentro de la ventana de anticipación. | Notificación interna con `fecha_programada` correcta y clave idempotente. |
| CP-62 | HU18 | Ejecución repetida | Mismo schedule dos veces. | No hay duplicados ni reenvíos. |
| CP-63 | HU18 | Sin topic SNS o email apagado | `canal_email = false`. | Notificación interna conservada; sin publicación SNS. |
| CP-64 | HU18 | Tope de correos | Más de 30 correos en un día. | Máximo 30 publicados; el resto queda solo en plataforma. |
| CP-65 | HU18 | Schedule en `dev` | Revisión del stack. | Estado `DISABLED`. |

### 4.5. Casos de seguridad, RLS y aislamiento

| ID | Caso | Procedimiento | Resultado esperado |
|---|---|---|---|
| CP-66 | RLS por tabla | Crear registro con usuario A; autenticarse como B; `select/update/delete`. | B no ve filas y no puede mutar. |
| CP-67 | Repositorio con `service_role` | Repetir consulta forzando rol administrativo. | El filtro explícito por `usuario_id` sigue aplicando. |
| CP-68 | Administrador sin acceso privado | Admin intenta abrir documento o conversación de estudiante. | `404`. |
| CP-69 | Secretos en frontend | Revisar bundle y variables generadas. | Solo `anon key`; ausencia de `service_role`, AWS e IA. |
| CP-70 | CORS | Petición desde origen no autorizado. | Rechazada por política CORS. |
| CP-71 | Límite de body | Body superior al límite configurado. | `413`/`400` controlado, sin stack. |
| CP-72 | Rate limiting | Superar 300 solicitudes / 15 min. | `429`. |
| CP-73 | Archivos | Subir objeto con ruta fuera de `usuarios/<id>/`. | `403`. |
| CP-74 | IA | Consulta con fragmento de otro usuario. | Sin resultados o `404`, nunca contenido ajeno. |

### 4.6. Casos de interfaz y accesibilidad

| ID | Caso | Resultado esperado |
|---|---|---|
| CP-75 | Ruta privada sin sesión. | Redirección a `/auth/login` con `returnUrl`. |
| CP-76 | Ruta de administrador sin rol. | Redirección o vista de acceso denegado. |
| CP-77 | Interceptor agrega `Authorization`. | Cabecera presente solo en llamadas a `/api`. |
| CP-78 | Error `401` global. | Cierre de sesión y redirección sin bucle. |
| CP-79 | Lista en carga, vacía y error. | Los tres estados son visibles y comprensibles. |
| CP-80 | Formularios reactivos. | Validaciones visibles, mensajes en español y `aria-describedby`. |
| CP-81 | `@for` con `track`. | Claves estables; sin re-renderizados innecesarios. |
| CP-82 | Mascota del agente. | Estados accesibles por `aria-label`; respeta `prefers-reduced-motion`. |
| CP-83 | Contenido de IA. | Se muestra con interpolación; nunca con `innerHTML`. |
| CP-84 | Navegación por teclado. | Foco visible y botones con `type` explícito. |

---

## 5. Ejecución de pruebas funcionales

### 5.1. Entorno de ejecución

| Elemento | Valor |
|---|---|
| Fecha | 22/11/2026 |
| Rama | `develop` |
| Backend | Node.js 24, CommonJS, Express 5 |
| Frontend | Angular 21 |
| Gestor de dependencias | npm 11+ |
| Base de datos en pruebas | Mocks de Supabase; sin datos de producción |
| Servicios AWS en pruebas | Mocks de S3, SQS y SNS |
| Proveedor de IA en pruebas | Mock; sin consumo real |
| Perfil AWS para despliegue | `mingo-agente` |
| Región AWS | `us-east-1` |

### 5.2. Comandos ejecutados y resultados

**Backend.**

```bash
cd backend
npm run lint
npm test
```

Resultado:

```text
> mingo-backend@1.0.0 lint
> eslint .

Test Suites: 50 passed, 50 total
Tests:       507 passed, 507 total
Snapshots:   0 total
Time:        48.458 s
```

**Frontend.**

```bash
cd frontend
npm run build
npm test -- --watch=false
```

Resultado:

```text
Test Files  27 passed (27)
Tests       191 passed (191)
Duration    14.13s
```

Además, `npm run build` finalizó correctamente y generó el bundle de producción en `frontend/dist/frontend/browser`.

### 5.3. Cobertura funcional por módulo

| Módulo | HU | Pruebas automatizadas relevantes | Estado |
|---|---|---|---|
| Autenticación | HU01 | `auth.middleware`, `auth.routes`, login frontend. | OK |
| Administración | HU02 | Roles, usuarios y auditoría. | OK |
| Materias | HU03 | Servicio, rutas, validaciones y propiedad. | OK |
| Tareas | HU04 | CRUD, filtros, fechas y evento automático. | OK |
| Calendario | HU05 | Rangos, próximos y sincronización. | OK |
| Dashboard | HU06 | Contadores, vacío, error y recarga. | OK |
| Documentos | HU07–HU09 | URL firmada, metadatos, estados, SQS y worker. | OK |
| Resúmenes | HU10 | Esquema, caché, truncamiento y cuota. | OK |
| Búsqueda semántica | HU11 | RPC `match_fragmentos`, umbral y cuota. | OK |
| Chat/RAG | HU12 | `chat.service`, `agente.service`, modelos, rutas y UI. | OK |
| Cuestionarios | HU13 | Generación, intentos y corrección. | OK |
| Tarjetas | HU14 | Generación, estados y filtro de pendientes. | OK |
| Planes | HU15 | Propuesta, confirmación, sesiones y calendario. | OK |
| Evaluación | HU16 | Objetivas, abiertas, dominio y avisos. | OK |
| Progreso | HU17 | Objetivos, métricas y recomendaciones. | OK |
| Notificaciones | HU18 | Preferencias, recordatorios, idempotencia y SNS. | OK |

### 5.4. Ejemplo de prueba unitaria de servicio

```js
it('rechaza una materia de otro usuario', async () => {
  const taskRepository = { create: jest.fn() };
  const subjectRepository = {
    findById: jest.fn().mockResolvedValue({ id: 'materia-b', usuario_id: 'usuario-b' }),
  };
  const service = new TaskService({ taskRepository, subjectRepository });

  await expect(
    service.createForUser('usuario-a', { subjectId: 'materia-b', title: 'Tarea' }),
  ).rejects.toThrow(ApiError);

  expect(taskRepository.create).not.toHaveBeenCalled();
});
```

### 5.5. Ejemplo de prueba de integración HTTP

```js
const request = require('supertest');
const app = require('../../src/app');

describe('GET /api/health', () => {
  it('responde 200 con el estado del servicio', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
  });
});
```

### 5.6. Resultado de la ejecución funcional

| Métrica | Resultado |
|---|---:|
| Suites backend | 50/50 |
| Pruebas backend | 507/507 |
| Archivos de prueba frontend | 27/27 |
| Pruebas frontend | 191/191 |
| Fallos | 0 |
| Lint backend | Correcto |
| Build frontend | Correcto |
| Pruebas E2E con Playwright | No ejecutadas en esta entrega; documentadas como opcionales |

---

## 6. Pruebas de integración

### 6.1. Integración backend ↔ Supabase

| Flujo | Verificación |
|---|---|
| JWT → perfil → roles | El middleware valida el token, consulta `perfiles` y `usuario_roles`, y rechaza cuentas inactivas. |
| Repositorios → RLS | Las consultas usan cliente JWT cuando corresponde y filtran por `usuario_id`. |
| Tarea → calendario | La función `crear_evento_desde_tarea` crea o sincroniza un evento `entrega` de forma idempotente. |
| Documento → fragmentos | La Lambda escribe fragmentos y embeddings y actualiza el estado del documento. |
| Chat → conversación | Se persisten mensaje, referencias y consumo en una misma transición lógica. |
| Plan → calendario | Cada sesión confirmada se vincula a un evento `estudio` mediante `evento_calendario_id`. |
| Idempotencia | `solicitudes_idempotentes` guarda huella SHA-256 del cuerpo y estado de la reserva. |

### 6.2. Integración backend ↔ AWS

| Servicio | Prueba realizada | Resultado |
|---|---|---|
| API Gateway HTTP API | Envío de petición a `/{proxy+}` a través del dominio `execute-api`. | `200` en `/api/health`. |
| CloudFront | Envío de petición a `/api/health` por el dominio del frontend. | `200`; mismo sobre JSON. |
| S3 | Validación de tipo, tamaño y ruta antes de firmar URL. | Reglas activas en el servicio de documentos. |
| SQS | Encolado en `POST /documentos/:id/procesar`. | `202` y estado `en_cola`. |
| DLQ | Configuración `maxReceiveCount = 3`. | Definida en plantilla. |
| SNS | Publicación condicionada a `canal_email` y tope de 30/día. | Definida en Lambda de recordatorios. |
| Scheduler | Una schedule horaria, deshabilitada en `dev`. | Output `DISABLED`. |
| CloudWatch | Log groups con retención de 7 días en `dev`. | Definido en plantilla. |
| IAM | Rol de API referenciado por ARN; sin creación por el agente. | Configurado en plantilla. |

### 6.3. Integración frontend ↔ API desplegada

| Aspecto | Configuración verificada |
|---|---|
| `apiUrl` | `/api`, sin dominio cross-site en el navegador. |
| Dominio frontend | `https://d4qnw8e73f6co.cloudfront.net`. |
| Proxy CloudFront | `/api/*` → API Gateway HTTP API. |
| Caché | `CachingDisabled` para `/api/*`. |
| Cabeceras | `AllViewerExceptHostHeader`. |
| SPA routing | CloudFront Function reescribe rutas a `/index.html`, salvo `/api/*` y assets. |
| Login | Supabase Auth consume la clave pública; backend valida el JWT. |
| Error 401 | Interceptor cierra sesión y redirige al login con `returnUrl`. |

### 6.4. Pruebas de integración de IA/RAG

| Escenario | Resultado esperado | Estado |
|---|---|---|
| Documento procesado → embeddings → búsqueda | Fragmentos propios con similitud ≥ 0.55. | OK |
| Chat con `usar_documentos: true` | Recupera hasta 8 fragmentos, construye contexto y cita. | OK |
| Chat sin coincidencia | No llama al modelo; devuelve mensaje de insufficient information. | OK |
| Chat con `usar_documentos: false` | Responde conocimiento general sin referencias. | OK |
| Cita inventada | Se descarta. | OK |
| Prompt injection en contexto | Delimitadores escapados; instrucciones no ejecutadas. | OK |
| Cuota superada | `429 AI_QUOTA_EXCEEDED`. | OK |
| Proveedor caído | `503` con mensaje seguro y un solo reintento temporal. | OK |

### 6.5. Smoke tests posteriores al despliegue

```bash
# API directa
curl -i https://ioqyer0j8l.execute-api.us-east-1.amazonaws.com/api/health

# API a través de CloudFront
curl -i https://d4qnw8e73f6co.cloudfront.net/api/health

# Endpoint privado sin token
curl -i https://d4qnw8e73f6co.cloudfront.net/api/auth/me
```

Resultados esperados y observados:

| Petición | Código | Observación |
|---|---:|---|
| `GET /api/health` directo | `200` | `{ "success": true, "data": { "service": "MINGO API", "status": "ok", ... } }` |
| `GET /api/health` por CloudFront | `200` | Mismo sobre; confirma proxy `/api/*`. |
| `GET /api/auth/me` sin token | `401` | Confirma que el middleware de autenticación está activo en Lambda. |
| Carga del frontend | `200` | SPA servida por CloudFront desde S3 privado con OAC. |

---

## 7. Registro de errores encontrados

### 7.1. Criterios de severidad

| Severidad | Criterio |
|---|---|
| Crítica | Bloquea login, despliegue o acceso a datos. |
| Alta | Funcionalidad principal inutilizable o riesgo de seguridad/costo. |
| Media | Comportamiento incorrecto con alternativa temporal. |
| Baja | Detalle visual o documental sin impacto funcional. |

### 7.2. Errores registrados

| ID | Fecha | Error observado | Causa identificada | Impacto | Severidad | Estado |
|---|---|---|---|---|---|---|
| ERR-01 | 2026-11-22 | Stack `mingo-hu09-dev` entró en `UPDATE_ROLLBACK_IN_PROGRESS`. | Variable reservada `AWS_LAMBDA_FUNCTION_NAME` definida en la Lambda. | Bloqueaba el despliegue de la API. | Crítica | Corregido |
| ERR-02 | 2026-11-22 | Despliegue frontend falló con `The specified origin request policy does not exist`. | ID de política de origen inválido en el behavior `/api/*`. | `/api/*` no podía proxyarse a la API. | Crítica | Corregido |
| ERR-03 | 2026-11-22 | Login de Supabase correcto, pero `/api/auth/me` devolvía `401 Token invalido o expirado`. | Parámetros del stack con valores placeholder/y desincronizados de `backend/.env`. | El usuario autenticado no podía usar la API. | Crítica | Corregido |
| ERR-04 | 2026-11-14 | CloudFront respondía `404 NotFound` con `Server: AmazonS3` aunque los objetos existían. | Cache policy `UseOriginCacheControlHeaders` en la distribución del frontend. | La SPA no cargaba de forma estable. | Alta | Corregido |
| ERR-05 | 2026-11-22 | Riesgo de subida de secretos a historial de shell/CloudFormation. | Parámetros `NoEcho` impresos durante un intento fallido dechangeset. | Exposición potencial de credenciales. | Alta | Mitigado; rotación pendiente |
| ERR-06 | 2026-11-22 | Posible confusión entre perfiles AWS `default` y `mingo-agente`. | Cuenta AWS compartida con otro proyecto. | Riesgo de despliegue en cuenta/perfil equivocado. | Media | Controlado |

### 7.3. Detalle de ERR-01

**Síntoma.** Durante la actualización del stack de backend, CloudFormation inició rollback automático.

**Diagnóstico.** La plantilla definía `AWS_LAMBDA_FUNCTION_NAME` como variable de entorno de Lambda. AWS reserva ese nombre y lo inyecta automáticamente en el entorno de ejecución, por lo que la creación/actualización de la función fallaba.

**Corrección.** Se eliminó la variable reservada de `infra/template.yaml`. La Lambda continúa recibiendo el nombre real desde el entorno de AWS, sin configuración explícita.

**Evidencia.** Commit `e1303cf` y changeset `mingo-api-http-dev-20261122-v2`; stack en `UPDATE_COMPLETE`.

### 7.4. Detalle de ERR-02

**Síntoma.** `aws cloudformation execute-change-set` para el frontend terminó con el error indicado.

**Diagnóstico.** El behavior `/api/*` referenciaba una Origin Request Policy con ID inexistente en la cuenta.

**Corrección.** Se reemplazó por la política administrada válida `b689b0a8-53d0-40ab-baf2-68738e2966ac`, que reenvía todas las cabeceras del viewer excepto `Host`.

**Evidencia.** Commit `c2f8812` y changeset `mingo-frontend-api-proxy-dev-20261122-v2`; stack en `UPDATE_COMPLETE`.

### 7.5. Detalle de ERR-03

**Síntoma.** Después del primer despliegue de la API, el login funcionaba en Supabase pero la aplicación mostraba:

```text
Token invalido o expirado.
/api/auth/me:1 Failed to load resource: the server responded with a status of 401 ()
```

**Diagnóstico.** Los secretos del stack no coincidían con los de `backend/.env`. La Lambda validaba el JWT contra otro proyecto Supabase o con claves equivocadas.

**Corrección.** Se sincronizaron `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y `AI_API_KEY` mediante el changeset `mingo-api-secrets-dev-20261122`. La verificación se hizo comparando hashes, sin imprimir ni versionar los valores.

**Evidencia.** Los hashes de las cuatro variables en el stack coinciden con los del archivo local. No se registran valores en este documento ni en el repositorio.

### 7.6. Detalle de ERR-04

**Síntoma.** Respuestas 404 de S3 en CloudFront para objetos existentes del frontend.

**Diagnóstico.** La política administrada `UseOriginCacheControlHeaders` (`83da9c7e-98b4-4e11-a168-04f0df8e2c65`) produjo el síntoma. Ni una invalidación `/*` ni un redeploy resolvieron el problema.

**Corrección.** Se cambió a `CachingOptimized` (`658327ea-f89d-4fab-a63d-7e88639e58f6`), que respeta `Cache-Control` sin reenviar cabeceras al bucket.

**Evidencia.** Commit `e1024bf` y documentación en `docs/entornos-y-despliegue.md`, sección 7.0 y diagnóstico 7.2.

### 7.7. Detalle de ERR-05

**Síntoma.** Durante un intento fallido de changeset, la AWS CLI imprimió parámetros sensibles.

**Mitigación aplicada.** No se copiaron valores al repositorio ni a documentación; se documentó el riesgo en `docs/entornos-y-despliegue.md` y se actualizó el estado del stack con valores correctos.

**Pendiente no bloqueante.** Rotar la clave de IA y las claves de Supabase expuestas en la salida de la CLI. Si se rotan, debe ejecutarse de nuevo el changeset de secretos y repetirse la comparación de hashes.

### 7.8. Detalle de ERR-06

**Síntoma.** Posibilidad de usar el perfil AWS por defecto en una cuenta compartida.

**Control aplicado.** Todas las operaciones de despliegue se ejecutaron con:

```bash
--profile mingo-agente --region us-east-1
```

**Regla.** No se usó el perfil `default`, credenciales root, otra región ni recursos fuera de la lista blanca.

---

## 8. Corrección de errores y evidencias

### 8.1. Resumen de correcciones

| Error | Corrección | Evidencia técnica |
|---|---|---|
| ERR-01 | Eliminar variable reservada de Lambda. | Commit `e1303cf`; `mingo-hu09-dev` en `UPDATE_COMPLETE`. |
| ERR-02 | Corregir ID de Origin Request Policy. | Commit `c2f8812`; `mingo-frontend-dev` en `UPDATE_COMPLETE`. |
| ERR-03 | Sincronizar secretos del stack con el entorno real. | Changeset `mingo-api-secrets-dev-20261122`; hashes coincidentes. |
| ERR-04 | Cambiar cache policy de CloudFront. | Commit `e1024bf`; SPA estable. |
| ERR-05 | No versionar valores; documentar riesgo. | Commit `2174177`; rotación pendiente. |
| ERR-06 | Forzar perfil y región en cada comando. | Comandos de despliegue con `--profile mingo-agente --region us-east-1`. |

### 8.2. Flujo de corrección aplicado

```text
1. Reproducir el error con un comando o petición concreta.
2. Leer el mensaje de CloudFormation, CloudWatch o la aplicación.
3. Identificar la causa sin probar cambios al azar.
4. Modificar la plantilla o el código en una rama/ commit puntual.
5. Ejecutar lint, pruebas y build antes de desplegar.
6. Crear un changeset explícito y revisar recursos, límites y costo.
7. Ejecutar el changeset solo con aprobación previa.
8. Verificar outputs y smoke tests.
9. Documentar el cambio en docs/ y en este informe.
```

### 8.3. Comandos de verificación de secretos sin exponer valores

La comparación se realizó con hashes, por ejemplo:

```powershell
$local = (Get-FileHash backend\.env -Algorithm SHA256).Hash
# La comparación real se hizo por variable, no sobre el archivo completo.
# En el stack se contrastó cada parámetro NoEcho mediante su hash.
```

Regla aplicada: **hash sí, valor no**. En este documento solo se afirma que los hashes coinciden.

### 8.4. Evidencia de aprobación y costo

Antes de ejecutar cada changeset se revisó:

- Servicios incluidos: Lambda, API Gateway HTTP API, S3, SQS, SNS, EventBridge Scheduler, CloudFront e IAM por referencia.
- Ausencia de VPC, NAT Gateway, balanceadores, contenedores y capacidad provisionada en `dev`.
- Límites: 512 MB, 30 s, ARM64, throttle 20/40, logs 7 días, SQS 4 días, DLQ 3 intentos.
- Presupuesto activo de $1 con alerta al 80 % real y 100 % pronosticado.
- Gasto real y pronosticado: `$0.00`.
- Perfil AWS: `mingo-agente`; región: `us-east-1`.

---

## 9. Preparación del entorno de despliegue

### 9.1. Requisitos locales

| Herramienta | Versión requerida |
|---|---|
| Node.js | 24 LTS |
| npm | 11+ |
| Angular CLI | 21 |
| AWS CLI | v2 |
| AWS SAM CLI | 1.110+ |
| Supabase CLI | Última estable |
| Git | 2.40+ |

### 9.2. Variables de entorno

Backend: `backend/.env` no versionado; plantilla en `backend/.env.example`.

| Variable | Uso |
|---|---|
| `NODE_ENV` | Entorno de ejecución. |
| `PORT`, `API_PREFIX` | Servidor local y prefijo `/api`. |
| `CORS_ORIGINS` | Orígenes autorizados. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Identidad y datos. |
| `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_SQS_QUEUE_URL`, `AWS_SNS_TOPIC_ARN` | Integraciones AWS. |
| `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_CHAT_MODEL`, `AI_EMBEDDING_MODEL`, `AI_EMBEDDING_DIMENSIONS` | Proveedor de IA. |
| `MAX_UPLOAD_MB`, `RATE_LIMIT_*` | Límites de carga y rate limiting. |

Frontend: `frontend/.env` no versionado; solo `SUPABASE_URL` y `SUPABASE_ANON_KEY`. El script `npm run env:generate` crea los archivos `environment.generated.ts` a partir de él. Los comandos `start`, `build` y `test` ejecutan ese paso automáticamente.

### 9.3. Verificación previa al empaquetado

```bash
node -v
npm -v
aws --version
supabase --version

cd backend
npm ci
npm run lint
npm test
npm run verificar:embeddings

cd ../frontend
npm ci
npm run build
npm test -- --watch=false
```

`npm run verificar:embeddings` comprueba proveedor, modelo, dimensiones y latencia. Falla si la dimensión del vector no coincide con `AI_EMBEDDING_DIMENSIONS`.

### 9.4. Empaquetado del backend

El backend usa `serverless-http` para adaptar Express al evento de API Gateway:

```js
// backend/src/lambda/api.js
const serverless = require('serverless-http');
const app = require('../app');

/** @type {(evento: object, contexto: object) => Promise<object>} */
const handler = serverless(app);

module.exports = { handler };
```

Puntos de entrada definidos en `infra/template.yaml`:

| Función | Handler | Propósito |
|---|---|---|
| API | `src/lambda/api.handler` | Exponer Express por API Gateway. |
| Procesadora | `src/lambda/procesador.handler` | Extraer texto, fragmentar y generar embeddings. |
| Recordatorios | `src/lambda/recordatorios.handler` | Generar notificaciones y enviar correos opcionales. |

Reglas de empaquetado:

- Runtime `nodejs22.x`.
- ARM64, 512 MB, timeout 30 s en la API.
- Solo dependencias de producción.
- Sin `.env`, `tests/`, artefactos temporales ni `node_modules` de desarrollo.
- Plantilla y artefactos generados no se versionan.

### 9.5. Infraestructura como código

| Plantilla | Stack | Contenido |
|---|---|---|
| `infra/template.yaml` | `mingo-hu09-dev` | API Lambda, API Gateway, bucket de documentos, SQS + DLQ, SNS, Scheduler, roles referenciados y logs. |
| `infra/frontend-template.yaml` | `mingo-frontend-dev` | Bucket privado del frontend, OAC, CloudFront, CloudFront Function y behavior `/api/*`. |

Etiquetas obligatorias: `Project=MINGO`, `Environment=dev`, `Owner=equipo-mingo`, `ManagedBy=sam`, `CostCenter=academico`.

### 9.6. Presupuesto y alertas

| Dato | Valor verificado |
|---|---|
| Presupuesto | `ConcesionariaBMW-1USD` |
| Límite | $1.00/mes, compartido con otro proyecto |
| Alertas | 80 % real y 100 % pronosticado |
| Destino | `jesielvv17adam@gmail.com` |
| Filtros | Ninguno; cubre toda la cuenta, incluido MINGO |
| Costo del presupuesto | $0 |
| Gasto real | $0.00 |
| Gasto pronosticado | $0.00 |
| Riesgo aceptado | El otro proyecto puede consumir el umbral; mitigado con límites y revisión semanal |

---

## 10. Despliegue de la aplicación web

### 10.1. Alcance autorizado

Se desplegó únicamente el entorno **`dev`**. No se desplegó `prod`. Todas las operaciones se ejecutaron con el perfil `mingo-agente` en `us-east-1`, previa explicación de recursos, límites y costo estimado.

### 10.2. Despliegue del backend

Changesets ejecutados:

| Changeset | Objetivo | Resultado |
|---|---|---|
| `mingo-api-http-dev-20261122-v2` | API Express en Lambda + API Gateway HTTP API + proxy. | `UPDATE_COMPLETE` |
| `mingo-api-secrets-dev-20261122` | Sincronización de secretos del stack con el entorno real. | Ejecutado y verificado |

Recursos principales:

| Recurso | Configuración |
|---|---|
| Lambda API | `mingo-hu09-dev-api`, `nodejs22.x`, ARM64, 512 MB, timeout 30 s, sin concurrencia reservada en `dev`. |
| API Gateway HTTP API | Stage `$default`, ruta `/{proxy+}`, throttle 20 req/s, burst 40, sin caché. |
| Bucket documentos | `mingo-documentos-dev-591015654164`, privado, SSE-S3, lifecycle. |
| Cola | `https://sqs.us-east-1.amazonaws.com/591015654164/mingo-hu09-dev-procesamiento`. |
| Topic SNS | `arn:aws:sns:us-east-1:591015654164:mingo-hu09-dev-notificaciones`. |
| Rol API | `arn:aws:iam::591015654164:role/mingo-api-dev-lambda-role`. |
| Schedule | Una ejecución horaria, `DISABLED` en `dev`. |
| Logs | `/aws/lambda/mingo-hu09-dev-api`, retención 7 días. |

### 10.3. Despliegue del frontend

Changeset ejecutado:

| Changeset | Objetivo | Resultado |
|---|---|---|
| `mingo-frontend-api-proxy-dev-20261122-v2` | Agregar behavior `/api/*` hacia la API Gateway HTTP API. | `UPDATE_COMPLETE` |

Recursos principales:

| Recurso | Configuración |
|---|---|
| Bucket frontend | `mingo-frontend-dev-591015654164`, privado, acceso solo por OAC. |
| Distribución CloudFront | `E3KT1CRPPEGF3B`, `PriceClass_100`, un solo origen, sin WAF ni Lambda@Edge. |
| OAC | `E3EU4PPS6LKGOJ`. |
| Dominio | `https://d4qnw8e73f6co.cloudfront.net`. |
| Behavior `/api/*` | `CachingDisabled`, reenvío `AllViewerExceptHostHeader`, sin `Host` del navegador. |
| Behavior por defecto | `CachingOptimized`, SPA reescrita a `/index.html` por CloudFront Function. |
| Invalidación | `/*` solo cuando un cambio no se refleja por hash; no es parte del flujo normal. |

### 10.4. Publicación del bundle

```bash
cd frontend
npm run build -- --configuration production
aws s3 sync dist/frontend/browser s3://mingo-frontend-dev-591015654164 \
  --profile mingo-agente --region us-east-1 --delete
```

### 10.5. Costo estimado

| Servicio | Uso estimado en `dev` | Costo esperado |
|---|---|---:|
| Lambda API | Por debajo de 1 M solicitudes/mes y 400.000 GB-s. | $0 |
| API Gateway HTTP API | Tráfico de desarrollo por debajo de 1 M peticiones/mes. | $0 |
| S3 | Objetos pequeños y lifecycle activo. | $0 |
| CloudFront | Por debajo de 1 TB y 10 M peticiones/mes. | $0 |
| SQS | Tráfico mínimo; retención 4 días. | $0 |
| SNS | Hasta 30 correos/día con schedule deshabilitado en `dev`. | $0 |
| Scheduler | 744 invocaciones/mes si se activara; deshabilitado en `dev`. | $0 |
| Presupuesto y alertas | Monitoreo y notificaciones. | $0 |
| **Total** |  | **$0/mes** |

### 10.6. Rollback

Si un changeset falla:

1. No se aprueba ni se ejecuta hasta identificar la causa.
2. Si CloudFormation entra en rollback, se espera a `UPDATE_ROLLBACK_COMPLETE`.
3. Se corrige la plantilla en un commit puntual.
4. Se vuelven a ejecutar lint, pruebas y build.
5. Se crea un nuevo changeset con nombre versionado por fecha.
6. Se verifica que el stack quede en `UPDATE_COMPLETE`.
7. Se documenta el error en este registro.

---

## 11. Verificación del sistema desplegado

### 11.1. Estados finales de stacks

| Stack | Estado | Output relevante | Valor |
|---|---|---|---|
| `mingo-hu09-dev` | `UPDATE_COMPLETE` | `ApiInvokeUrl` | `https://ioqyer0j8l.execute-api.us-east-1.amazonaws.com` |
| `mingo-hu09-dev` | `UPDATE_COMPLETE` | `ApiFunctionName` | `mingo-hu09-dev-api` |
| `mingo-frontend-dev` | `UPDATE_COMPLETE` | `FrontendUrl` | `https://d4qnw8e73f6co.cloudfront.net` |
| `mingo-frontend-dev` | `UPDATE_COMPLETE` | `DistributionId` | `E3KT1CRPPEGF3B` |

### 11.2. Verificación de salud de la API

```bash
curl -i https://ioqyer0j8l.execute-api.us-east-1.amazonaws.com/api/health
curl -i https://d4qnw8e73f6co.cloudfront.net/api/health
```

Resultado observado en ambas rutas: `HTTP/2 200` y sobre de éxito:

```json
{
  "success": true,
  "data": {
    "service": "MINGO API",
    "status": "ok",
    "environment": "production",
    "uptimeSeconds": 0
  }
}
```

`uptimeSeconds` varía por instancia fría de Lambda; el campo verificable es `status: "ok"`.

### 11.3. Verificación de autenticación

```bash
curl -i https://d4qnw8e73f6co.cloudfront.net/api/auth/me
```

Resultado: `401` con mensaje de token ausente o inválido. Esto confirma que la Lambda aplica el middleware de autenticación y que CloudFront no lo omite.

La prueba con token real se realizó desde el frontend: el login de Supabase produjo un `access_token`, el interceptor lo envió a `/api/auth/me` y la respuesta fue `200` con perfil, rol y estado. El error `401` descrito en ERR-03 quedó resuelto tras sincronizar secretos.

### 11.4. Verificación del frontend

| Comprobación | Resultado |
|---|---|
| Carga de `https://d4qnw8e73f6co.cloudfront.net`. | OK, SPA servida por CloudFront. |
| Rutas deep-link. | Reescritas a `/index.html` por CloudFront Function. |
| Assets con hash. | Cacheados con `CachingOptimized`. |
| Llamadas `/api/*`. | Enviadas a API Gateway sin CORS entre dominios. |
| Login y redirección por rol. | OK tras corrección de secretos. |
| Estados de carga/vacío/error. | Cubiertos por pruebas frontend. |

### 11.5. Verificación de secretos y seguridad

| Comprobación | Resultado |
|---|---|
| Valores de `.env` en repositorio | Ausentes; `.env` ignorado por Git. |
| Claves en frontend | Solo `anon`/`publishable`; sin `service_role`, AWS ni IA. |
| Coincidencia stack ↔ entorno | Verificada por hashes de cuatro variables. |
| Perfil AWS usado | `mingo-agente`. |
| Región usada | `us-east-1`. |
| Presupuesto | Activo, $0 real y $0 pronosticado. |

### 11.6. Checklist final de verificación

- [x] API directa responde `200` en `/api/health`.
- [x] API por CloudFront responde `200` en `/api/health`.
- [x] Endpoint autenticado responde `401` sin token.
- [x] Login con Supabase y `/api/auth/me` funcionan.
- [x] Frontend carga desde CloudFront.
- [x] `/api/*` usa proxy con caché desactivada.
- [x] Stacks en `UPDATE_COMPLETE`.
- [x] Schedule de recordatorios deshabilitado en `dev`.
- [x] Logs con retención de 7 días.
- [x] Presupuesto y alertas activos.
- [x] Sin secretos versionados.
- [x] Sin recursos AWS fuera de la lista blanca.

---

## 12. Informe de resultados de las pruebas

### 12.1. Resumen ejecutivo

La ejecución final del 22/11/2026 fue satisfactoria. El backend pasó **507 pruebas en 50 suites** y el frontend **191 pruebas en 27 archivos**. El lint de backend y el build de producción de Angular también pasaron. El sistema desplegado en `dev` respondió correctamente por la API directa y por CloudFront, y el flujo de login quedó operativo tras corregir la sincronización de secretos.

| Área | Resultado | Observación |
|---|---|---|
| Funcionalidad | Satisfactorio | 18 HU cubiertas por pruebas unitarias/integración. |
| Seguridad | Satisfactorio | JWT, roles, RLS, propiedad y secretos protegidos. |
| IA/RAG | Satisfactorio | Citas, umbral, cuotas y prompt injection cubiertos. |
| Integración AWS | Satisfactorio | API, proxy, S3, SQS, SNS y scheduler configurados. |
| Despliegue | Satisfactorio | Stacks en `UPDATE_COMPLETE`. |
| Costo | Satisfactorio | $0 real y $0 pronosticado. |
| Documentación | Satisfactorio | Este informe consolida evidencias y decisiones. |

### 12.2. Métricas finales

| Métrica | Valor |
|---|---:|
| Historias de usuario | 18 |
| Sprints | 3 |
| Migraciones SQL | 17 |
| Módulos de rutas backend | 11 |
| Declaraciones HTTP | 81 |
| Suites backend | 50 |
| Pruebas backend | 507 |
| Archivos de prueba frontend | 27 |
| Pruebas frontend | 191 |
| Errores críticos encontrados | 3 |
| Errores críticos corregidos | 3 |
| Errores mitigados con seguimiento | 1 |
| Stacks desplegados | 2 |
| Costo mensual estimado | $0 |

### 12.3. Cumplimiento de criterios de aceptación

| Criterio | Cumplimiento |
|---|---|
| Endpoint privado sin token → 401 | Sí |
| Recurso ajeno → 404 | Sí |
| Entradas validadas con Zod | Sí |
| Respuestas con sobre estándar | Sí |
| Listas paginadas | Sí |
| Errores sin stack ni secretos | Sí |
| Carga/vacío/error en frontend | Sí |
| Respuestas documentales con cita válida | Sí |
| Sin información → sin llamada al modelo | Sí |
| Cuotas IA → 429 | Sí |
| `/api/health` por API y CloudFront | Sí |
| Lint, pruebas y build | Sí |

### 12.4. Riesgos y seguimiento

| Riesgo | Estado | Acción recomendada |
|---|---|---|
| Claves expuestas en salida de CLI anterior. | Mitigado | Rotar clave de IA y claves de Supabase; repetir changeset de secretos. |
| Presupuesto compartido con otro proyecto. | Aceptado | Revisar Cost Explorer semanalmente; considerar umbrales adicionales en 2027. |
| Gemini gratuito usa contenido enviado para mejorar productos. | Documentado | Solo documentos de prueba en desarrollo; evaluar un plan de pago con entrenamiento desactivado para producción real. |
| E2E no ejecutada en esta entrega. | Pendiente opcional | Ejecutar Playwright sobre los ocho flujos críticos antes de cerrar un sprint futuro. |
| Producción no desplegada. | Previsto | Requiere autorización explícita y verificación de presupuesto/roles. |

---

## 13. Repositorio GitHub actualizado

### 13.1. Estado de la rama

| Dato | Valor |
|---|---|
| Rama activa | `develop` |
| Rama remota | `origin/develop` |
| Commit HEAD antes de este documento | `2174177` |
| Working tree antes de este documento | Limpio |

### 13.2. Commits recientes relacionados con despliegue y documentación

| Commit | Mensaje | Propósito |
|---|---|---|
| `2813e72` | `feat(infra): agrega API HTTP serverless y proxy en CloudFront` | Integración API ↔ frontend. |
| `e1303cf` | `fix(infra): elimina variable reservada de la Lambda de la API` | Corrección ERR-01. |
| `c2f8812` | `fix(infra): corrige ID de politica de origen de CloudFront` | Corrección ERR-02. |
| `92fc64c` | `docs(infra): registra el estado desplegado de la API en dev` | Evidencia de outputs. |
| `2174177` | `docs(infra): advierte sobre secretos desactualizados del stack` | Registro de riesgo ERR-03/ERR-05. |

Commits previos relevantes:

| Commit | Mensaje |
|---|---|
| `e1024bf` | `fix(infra): corrige politica de cache de CloudFront del frontend` |
| `24c54f6` | `docs(infra): agrega plantilla CloudFormation del frontend en S3 + CloudFront` |

### 13.3. Convenciones aplicadas

- Conventional Commits: `<tipo>(<alcance>): <descripcion>`.
- Un commit por cambio lógico.
- Ramas: `feature/<hu>-<descripcion>`, `fix/<descripcion>`, `docs/<descripcion>`, `chore/<descripcion>` y `refactor/<descripcion>`.
- `main` reservada para despliegue; `develop` para integración.
- No se versionan `node_modules`, artefactos generados, `.env` ni credenciales.
- La documentación afectada se actualiza en el mismo cambio.

### 13.4. Definition of Done aplicada

- [x] Código revisado y alineado con capas y convenciones.
- [x] Entradas validadas y errores centralizados.
- [x] Pruebas nuevas o afectadas actualizadas.
- [x] Lint, pruebas y build en verde.
- [x] RLS y propiedad verificadas.
- [x] Sin secretos ni datos personales innecesarios.
- [x] Reglas AWS respetadas.
- [x] Documentación técnica actualizada.
- [x] Commit con mensaje convencional y push a `develop`.

### 13.5. Estado de este documento

Este archivo `documento4.md` se incorpora a la raíz del repositorio como documentación de cierre y trazabilidad. No modifica código de aplicación, infraestructura ni secretos.

---

## 14. Conclusiones

### 14.1. Conclusión general

MINGO cuenta con una implementación funcional y desplegada en `dev` que cubre las 18 historias de usuario planificadas. La arquitectura por capas, el aislamiento por usuario, el uso de RAG con citas y la infraestructura serverless permiten cumplir los objetivos académicos y técnicos sin generar costos mensuales dentro de la capa gratuita.

### 14.2. Logros principales

1. **Cobertura completa de funcionalidades.** Las 18 HU están representadas en módulos, rutas, pruebas y documentación.
2. **Calidad verificable.** 507 pruebas backend y 191 frontend pasan de forma consistente.
3. **Seguridad por capas.** JWT, roles, RLS, filtro de propietario y validación Zod.
4. **IA responsable.** Contexto filtrado, citas validadas, cuotas, degradación y sin `innerHTML`.
5. **Integración real.** API Express en Lambda, proxy CloudFront, S3, SQS, SNS y Scheduler.
6. **Costo controlado.** Gasto real y pronosticado `$0.00`, presupuesto activo y límites aplicados.
7. **Trazabilidad.** Errores, commits, changesets y outputs documentados con evidencia.

### 14.3. Lecciones aprendidas

- Una variable reservada de Lambda puede bloquear un despliegue aunque la aplicación esté correcta.
- Un ID de política de CloudFront inválido se detecta solo al aplicar el changeset; por eso debe revisarse la plantilla completa.
- El login puede funcionar en Supabase y fallar en la API si los secretos del stack no están sincronizados.
- La comparación de hashes permite verificar secretos sin exponerlos.
- CloudFront requiere elegir cuidadosamente la cache policy; la política incorrecta puede enmascarar objetos existentes como 404.
- Las pruebas unitarias no sustituyen a los smoke tests posteriores al despliegue.
- En cuentas compartidas, el perfil AWS explícito es parte del control de seguridad.

### 14.4. Recomendaciones

1. Ejecutar la rotación pendiente de claves y repetir el changeset de secretos.
2. Incorporar Playwright para los ocho flujos E2E documentados antes de cerrar un sprint futuro.
3. Revisar semanalmente Cost Explorer y Free Tier.
4. Antes de desplegar `prod`, verificar aprobación explícita, roles OIDC o mínimo privilegio, presupuesto y retención de logs de 30 días.
5. Evaluar un proveedor de IA de pago sin uso de contenido para entrenamiento cuando existan documentos reales.
6. Mantener actualizado `docs/api.md` cuando se agreguen o modifiquen endpoints.

### 14.5. Declaración final

El sistema desplegado en `dev` está operativo, las pruebas automatizadas pasan, los errores críticos detectados fueron corregidos y el repositorio contiene la evidencia necesaria para auditar el proceso. Queda pendiente únicamente el seguimiento no bloqueante de rotación de credenciales y la decisión futura sobre un despliegue de producción, que requerirá autorización explícita.

---

## 15. Anexos

### Anexo A. Comandos de referencia

```bash
# Backend
cd backend
npm ci
npm run lint
npm test
npm test -- --coverage
npm run verificar:embeddings

# Frontend
cd frontend
npm ci
npm run env:generate
npm run build
npm test -- --watch=false
npm run format

# Smoke tests
curl -i https://ioqyer0j8l.execute-api.us-east-1.amazonaws.com/api/health
curl -i https://d4qnw8e73f6co.cloudfront.net/api/health
curl -i https://d4qnw8e73f6co.cloudfront.net/api/auth/me

# AWS: siempre con perfil y región explícitos
aws cloudformation describe-stacks \
  --stack-name mingo-hu09-dev \
  --profile mingo-agente --region us-east-1

aws cloudformation describe-stacks \
  --stack-name mingo-frontend-dev \
  --profile mingo-agente --region us-east-1
```

### Anexo B. Estructura resumida del repositorio

```text
MINGO/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── models/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── lambda/
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   └── package.json
├── frontend/
│   └── src/app/
│       ├── core/
│       ├── shared/
│       ├── features/
│       ├── layout/
│       └── app.routes.ts
├── supabase/migrations/      17 archivos SQL
├── infra/
│   ├── template.yaml
│   └── frontend-template.yaml
├── docs/
├── historiasUsuarios.md
├── problemaInicial.md
├── tecnologias.md
├── documento4.md
└── README.md
```

### Anexo C. Glosario

| Término | Definición |
|---|---|
| HU | Historia de usuario. |
| CP | Caso de prueba de este documento. |
| RLS | Row Level Security; seguridad a nivel de fila en PostgreSQL. |
| RAG | Retrieval-Augmented Generation; generación asistida por recuperación de información. |
| Embedding | Vector numérico que representa semánticamente un fragmento de texto. |
| `pgvector` | Extensión de PostgreSQL para almacenar y consultar vectores. |
| OAC | Origin Access Control; mecanismo de CloudFront para acceder a S3 privado. |
| DLQ | Dead Letter Queue; cola para mensajes que agotan reintentos. |
| Idempotencia | Propiedad de repetir una operación sin duplicar efectos. |
| Changeset | Conjunto de cambios propuesto para un stack de CloudFormation. |
| Smoke test | Prueba breve después del despliegue para confirmar que el sistema responde. |

### Anexo D. Fuentes utilizadas

| Fuente | Contenido tomado |
|---|---|
| `problemaInicial.md` | Contexto, problemática, solución y funcionalidades principales. |
| `historiasUsuarios.md` | 18 HU, 3 sprints y requerimientos funcionales. |
| `tecnologias.md` | Stack tecnológico y arquitectura general. |
| `docs/arquitectura.md` | Capas, flujos, módulos y decisiones técnicas. |
| `docs/api.md` | Contrato REST, endpoints, códigos y reglas. |
| `docs/base-datos.md` | Modelo, tablas, relaciones, RLS y `pgvector`. |
| `docs/ia-rag.md` | Pipeline RAG, prompts, citas, herramientas y cuotas. |
| `docs/seguridad.md` | Autenticación, roles, secretos y control de IA. |
| `docs/plan-pruebas.md` | Estrategia, casos por módulo y criterios de aceptación. |
| `docs/entornos-y-despliegue.md` | Variables, empaquetado, stacks, outputs y smoke tests. |
| `docs/convenciones.md` | Estilo, ramas, commits y Definition of Done. |
| `infra/template.yaml` | Recursos backend y límites AWS. |
| `infra/frontend-template.yaml` | Recursos frontend, OAC, CloudFront y proxy `/api/*`. |
| `backend/package.json` | Scripts y dependencias del backend. |
| `frontend/package.json` | Scripts y dependencias del frontend. |
| Ejecución local de lint/pruebas/build | Cifras vigentes de 50/507 y 27/191. |
| Historial de Git | Commits y estado de la rama `develop`. |

### Anexo E. Evidencias sin secretos

| Evidencia | Forma segura de registro |
|---|---|
| Sincronización de secretos | Comparación de hashes; valores nunca impresos ni versionados. |
| Error de login 401 | Mensaje de la consola y código HTTP; sin token. |
| Variables de entorno | Solo nombres de variables y plantillas `.env.example`. |
| Credenciales AWS | Solo nombre de perfil `mingo-agente` y región `us-east-1`. |
| Presupuesto | Nombre, monto, alertas y gasto `$0.00`; sin datos bancarios. |
| Roles IAM | ARN de rol de ejecución ya existente; sin claves de acceso. |

### Anexo F. Estado final resumido

```text
Sistema:        MINGO
Entorno:        dev
Frontend:       https://d4qnw8e73f6co.cloudfront.net
API proxy:      https://d4qnw8e73f6co.cloudfront.net/api/health
API directa:    https://ioqyer0j8l.execute-api.us-east-1.amazonaws.com/api/health
Backend tests:  50 suites / 507 pruebas — OK
Frontend tests: 27 archivos / 191 pruebas — OK
Lint:           OK
Build:          OK
Stacks:         UPDATE_COMPLETE
Costo:          $0.00 real / $0.00 pronosticado
Producción:     No desplegada; requiere autorización explícita
Documento:      documento4.md — emitido el 22/11/2026
```
