# Arquitectura de MINGO

**Versión:** 1.0  
**Base:** [tecnologias.md](../tecnologias.md)  
**Regla de infraestructura:** [reglas-aws.md](reglas-aws.md)

## 1. Resumen

MINGO es una aplicación web académica con arquitectura cliente-servidor:

- **Frontend:** Angular 21 + TypeScript + Bootstrap.
- **Backend:** Node.js + Express, organizado en MVC + Services + Repositories.
- **Datos:** Supabase PostgreSQL + pgvector + Supabase Auth + RLS.
- **Infraestructura:** AWS exclusivamente serverless y dentro de la capa gratuita.
- **IA:** proveedor externo de modelos, con RAG sobre los documentos del estudiante.

## 2. Principios

1. **Separación de responsabilidades:** el frontend no accede a credenciales privadas ni a la base de datos directamente.
2. **Modularidad:** cada funcionalidad vive en su módulo de `features/` (frontend) y en su ruta/controlador/servicio (backend).
3. **Seguridad por defecto:** autenticación con Supabase JWT, roles, RLS y mínimo privilegio.
4. **Serverless y bajo costo:** todo recurso debe escalar a cero y no generar cobros ociosos.
5. **IA con fuentes:** el agente responde con documentos del usuario y cita las referencias.
6. **Trazabilidad:** estados de procesamiento, historial de conversaciones y registros de operaciones importantes.

## 3. Vista de componentes

```text
┌─────────────────────────────────────────────────────────────┐
│                        ESTUDIANTE                           │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS
                            v
┌─────────────────────────────────────────────────────────────┐
│  ANGULAR 21 (frontend)                                      │
│  core: guards, interceptors, services, models               │
│  features: auth, dashboard, materias, tareas, calendario,   │
│            notificaciones, biblioteca, centro-estudio,      │
│            asistente-ia, admin                              │
│  layout: shell con navegacion                               │
└───────────────────────────┬─────────────────────────────────┘
                            │ /api + Bearer JWT
                            v
┌─────────────────────────────────────────────────────────────┐
│  API GATEWAY HTTP API  (serverless, con throttling)          │
└───────────────────────────┬─────────────────────────────────┘
                            v
┌─────────────────────────────────────────────────────────────┐
│  AWS LAMBDA: backend Express                                 │
│  routes -> middlewares -> controllers -> services            │
│                                      -> repositories         │
└───────┬──────────────────┬──────────────────┬────────────────┘
        │                  │                  │
        v                  v                  v
┌───────────────┐  ┌───────────────┐  ┌──────────────────────┐
│ SUPABASE      │  │ AMAZON S3     │  │ PROVEEDOR IA         │
│ Auth + Postgres│  │ documentos    │  │ chat + embeddings    │
│ pgvector + RLS│  │ URLs firmadas │  │ cuotas controladas   │
└───────────────┘  └───────┬───────┘  └──────────────────────┘
                           │ evento
                           v
                    ┌─────────────┐
                    │ AMAZON SQS  │
                    └──────┬──────┘
                           v
                    ┌──────────────────────────┐
                    │ AWS LAMBDA procesadora   │
                    │ extrae texto, fragmenta, │
                    │ genera embeddings        │
                    └──────────────────────────┘
```

Flujo de recordatorios (HU18):

```text
EventBridge Scheduler (1 schedule horario; OFF en dev)
  -> Lambda recordatorios (service_role, sin VPC, sin reintentos)
      -> Supabase: tareas, evaluaciones, sesiones y preferencias
      -> Supabase: notificaciones (ON CONFLICT DO NOTHING)
      -> SNS email (solo si el usuario activó `canal_email`; máx. 30 correos/día)

Angular /notificaciones
  -> API /api/notificaciones (JWT) -> Supabase con RLS
```

## 4. Flujo de una petición

```text
Angular
  -> interceptor agrega Authorization: Bearer <token>
  -> API Gateway
  -> Lambda (Express)
  -> auth.middleware (verifica JWT, perfil, roles desde BD y clave temporal)
  -> roles.middleware (si aplica; admin/docente en gestión)
  -> validation.middleware (Zod)
  -> controller
  -> service (reglas de negocio, IA, AWS)
  -> repository (Supabase)
  -> respuesta JSON { success, data }
```

Errores:

```json
{ "success": false, "error": { "message": "...", "details": [] } }
```

## 5. Capas del backend

| Capa | Responsabilidad | No debe hacer |
|---|---|---|
| `routes` | Definir endpoints y middlewares. | Lógica de negocio ni SQL. |
| `controllers` | Validar entrada, invocar servicios, responder HTTP. | Consultas directas ni reglas complejas. |
| `services` | Reglas de negocio, coordinación, IA, AWS. | SQL directo ni detalles de Express. |
| `repositories` | Consultas a Supabase/PostgreSQL. | Reglas de negocio ni respuestas HTTP. |
| `models` | Estructuras del dominio y esquemas. | Acceso a infraestructura. |
| `middlewares` | Auth, roles, validación, errores. | Lógica de módulos. |

## 6. Módulos funcionales

| Módulo | Sprint | Historias |
|---|---|---|
| Autenticación y perfiles | 1 | HU01, HU02 (roles `estudiante`, `docente`, `administrador` y clave temporal). |
| Dashboard académico | 1 | HU06 |
| Materias, docente responsable e inscripciones | 1 | HU03; migración `0018`. |
| Tareas compartidas y estado por estudiante | 1 | HU04; migración `0018`. |
| Calendario académico | 1 | HU05 |
| Biblioteca documental | 2 | HU07, HU08 |
| Procesamiento de documentos | 2 | HU09 |
| Resúmenes y búsqueda semántica | 2 | HU10, HU11 |
| Chat académico con RAG | 2 | HU12 |
| Cuestionarios y flashcards | 3 | HU13, HU14 |
| Planificación de estudio | 3 | HU15 |
| Evaluación y retroalimentación | 3 | HU16 |
| Objetivos y progreso | 3 | HU17 |
| Notificaciones | 3 | HU18 |

## 7. Despliegue serverless aprobado

| Componente | Destino |
|---|---|
| Frontend Angular | S3 privado + CloudFront (o hosting estático gratuito externo) |
| Backend Express | Lambda + API Gateway HTTP API |
| Procesamiento documental | S3 → SQS → Lambda |
| Recordatorios | Un EventBridge Scheduler horario → Lambda de recordatorios (deshabilitado en `dev`). |
| Notificaciones | Historial en Supabase con RLS; SNS email solo para canales habilitados y con tope de 30 correos por día. |
| Base de datos | Supabase PostgreSQL |
| Embeddings | pgvector en Supabase |
| IA | API externa con cuota |
| CI/CD | GitHub Actions + AWS SAM |

**No se usa:** EC2, ECS, EKS, RDS, ElastiCache, NAT Gateway, balanceadores, contenedores permanentes ni ningún recurso con costo por hora. Ver [reglas-aws.md](reglas-aws.md).

> Los cambios de roles docente, inscripciones y estados de tarea de la rama `feature/roles-docente-inscripciones` están validados en local (`528/528` pruebas backend, `213/213` frontend y build de producción) y desplegados solo en `dev` el 25/11/2026. Se usó el perfil AWS local `mingo-agente` en `us-east-1` sobre los stacks `mingo-hu09-dev` y `mingo-frontend-dev`, con costo estimado `$0` y presupuesto compartido `ConcesionariaBMW-1USD`. No se crearon recursos nuevos: la migración `0018` se aplicó manualmente, el código Lambda se actualizó directamente y el frontend se sincronizó a S3 con invalidación de CloudFront. `prod` queda fuera de alcance sin autorización separada.

## 8. Decisiones clave

| Decisión | Motivo |
|---|---|
| Angular + TypeScript | Tipado, modularidad y ecosistema para una SPA académica. |
| Express + MVC | Curva de aprendizaje baja y separación clara de responsabilidades. |
| Supabase | Auth, PostgreSQL, RLS y pgvector en un solo proveedor gratuito. |
| AWS solo serverless | Evitar facturas por recursos encendidos y aprovechar Free Tier. |
| RAG con pgvector | Respuestas basadas en los documentos del estudiante. |
| IA desde el backend | Proteger claves y controlar consumo. |
| Idempotencia de recordatorios | Clave única por usuario, actividad, fecha y anticipación. | Evita duplicados y reenvíos si el schedule se ejecuta más de una vez. |
| Bootstrap | Interfaz rápida, responsiva y sin dependencias de pago. |

## 9. Fuera de alcance del MVP

- Integración directa con Moodle mediante servicios web institucionales.
- Espacios compartidos distintos de los habilitados por `docente_id` e inscripciones por materia.
- Notificaciones push nativas.
- Aplicación móvil.
- Multi-región o alta disponibilidad empresarial.
- Microservicios o agentes autónomos múltiples.

## 10. Documentos relacionados

- [Reglas AWS](reglas-aws.md)
- [Base de datos](base-datos.md)
- [API](api.md)
- [Seguridad](seguridad.md)
- [IA y RAG](ia-rag.md)
- [Convenciones](convenciones.md)
- [Entornos y despliegue](entornos-y-despliegue.md)
- [Plan de pruebas](plan-pruebas.md)
- [Tecnologías del proyecto](../tecnologias.md)
