# MINGO Backend

API REST de MINGO construida con Node.js, Express, Supabase y AWS SDK v3.

## Arquitectura

```text
Request HTTP
  -> Routes
  -> Middlewares (auth, roles, validacion)
  -> Controller
  -> Service (logica de negocio)
  -> Repository (acceso a datos)
  -> Supabase PostgreSQL
  -> Response JSON
```

La capa `services/ia/` concentra el agente, RAG, embeddings, resumen, tutor, evaluador y planificador.

## Estructura

```text
src/
├── config/         environment.js, supabase.js, aws.js
├── models/         entidades del dominio
├── controllers/    controladores HTTP
├── services/       logica de negocio
│   └── ia/         agente, rag, embeddings, resumen, tutor, evaluador, planificador
├── repositories/   acceso a datos
├── middlewares/    auth, roles, validation (Zod), errores
├── routes/         modulos de la API
├── utils/          ApiError, asyncHandler
├── app.js          configuracion de Express
└── server.js       arranque y cierre graceful
```

## Variables de entorno

Copiar `.env.example` a `.env` y completar:

| Variable | Uso |
|---|---|
| `PORT` | Puerto de la API (4000 por defecto) |
| `CORS_ORIGINS` | Origenes permitidos, separados por coma |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave publica (para cliente con token del usuario) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada (solo backend, nunca en frontend) |
| `AWS_REGION` | Region de AWS |
| `AWS_S3_BUCKET` | Bucket privado de documentos |
| `AI_API_KEY` | Clave del proveedor de IA |
| `AI_CHAT_MODEL` | Modelo de lenguaje |
| `AI_EMBEDDING_MODEL` | Modelo de embeddings |

Sin credenciales de Supabase el endpoint `/api/health` funciona, pero las rutas autenticadas responden `503`.

## Endpoints base

| Metodo | Endpoint | Estado |
|---|---|---|
| GET | `/api/health` | Implementado |
| GET/PUT | `/api/usuarios/perfil` | Sprint 1 |
| CRUD | `/api/materias` | Sprint 1 |
| CRUD | `/api/tareas` | Sprint 1 |
| CRUD | `/api/calendario` | Sprint 1 |
| CRUD | `/api/documentos` | Sprint 2 |
| POST | `/api/asistente/chat` | Sprint 2 |
| POST | `/api/asistente/cuestionario` | Sprint 3 |
| GET | `/api/estudio/progreso` | Sprint 3 |
| GET | `/api/notificaciones` | Sprint 3 |
| CRUD | `/api/admin/*` | Sprint 1 (solo administrador) |

## Comandos

```bash
npm run dev      # nodemon
npm start        # produccion/local
npm test         # Jest + Supertest
npm run lint     # ESLint
npm run format   # Prettier
```

## Seguridad

- El frontend nunca recibe `SUPABASE_SERVICE_ROLE_KEY` ni credenciales AWS.
- Auth con JWT de Supabase verificado en `auth.middleware.js`.
- Roles con `roles.middleware.js` (`administrador`, `estudiante`).
- Validacion de entrada con Zod.
- RLS en PostgreSQL y bucket S3 privado con URLs prefirmadas.
- Rate limiting global sobre `/api`.
