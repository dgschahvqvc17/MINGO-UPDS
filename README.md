# MINGO

Plataforma web academica inteligente. Monorepo con frontend Angular y backend Node.js + Express, base de datos PostgreSQL en Supabase, servicios serverless de AWS y un agente de IA con RAG.

## Estructura

```text
MINGO/
├── backend/                 API REST (Node.js + Express, MVC + Services + Repositories)
│   ├── src/
│   │   ├── config/          environment.js, supabase.js, aws.js
│   │   ├── models/          entidades del dominio
│   │   ├── controllers/     controladores HTTP
│   │   ├── services/        logica de negocio (incluye services/ia/)
│   │   ├── repositories/    acceso a datos (Supabase/PostgreSQL)
│   │   ├── middlewares/     auth, roles, validacion (Zod), errores
│   │   ├── routes/          modulos de la API REST
│   │   ├── utils/           helpers y errores de aplicacion
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/               Jest + Supertest
│   ├── .env.example
│   └── package.json
│
├── frontend/                Angular + TypeScript
│   └── src/app/
│       ├── core/            guards, interceptors, services, models
│       ├── shared/          components, pipes, directives
│       ├── features/        auth, dashboard, materias, tareas, calendario,
│       │                    biblioteca, centro-estudio, asistente-ia, administracion
│       ├── layout/
│       └── app.routes.ts
│
├── docs/                    documentacion tecnica y de proceso
├── AGENTS.md                reglas obligatorias para agentes de IA
├── opencode.jsonc           carga automatica de reglas en OpenCode
├── problemaInicial.md
├── historiasUsuarios.md
└── tecnologias.md
```

## Requisitos

- Node.js 24 LTS (Angular 21 requiere `^20.19.0 || ^22.12.0 || >=24.0.0`)
- npm 11+
- Cuenta de Supabase (opcional para desarrollo inicial)
- Cuenta de AWS con usuario/rol IAM de privilegios minimos (opcional al inicio)

## Puesta en marcha

### Backend

```bash
cd backend
npm install
copy .env.example .env   # completar credenciales
npm run dev              # http://localhost:4000/api
npm test
```

### Frontend

```bash
cd frontend
npm install
npm start                # http://localhost:4200
```

El frontend redirige `/api` al backend mediante `proxy.conf.json`.

## Scripts utiles

| Ubicacion | Comando | Descripcion |
|---|---|---|
| backend | `npm run dev` | API con recarga automatica |
| backend | `npm start` | API en modo normal |
| backend | `npm test` | Pruebas Jest + Supertest |
| backend | `npm run lint` | ESLint |
| backend | `npm run format` | Prettier |
| frontend | `npm start` | Servidor de desarrollo Angular |
| frontend | `npm run build` | Build de produccion |
| frontend | `npm test` | Pruebas unitarias |

## Documentación

La documentación técnica y de proceso vive en [`docs/`](docs/README.md):

| Documento | Contenido |
|---|---|
| [Reglas AWS para agentes](docs/reglas-aws-agente.md) | Obligatorio: solo capa gratuita, solo serverless, prohibición de máquinas virtuales y regla de preguntar al usuario. |
| [Reglas de AWS](docs/reglas-aws.md) | Detalle completo: lista blanca/negra, límites, presupuestos y apagado de emergencia. |
| [Buenas prácticas](docs/buenas-practicas.md) | Clean Code, SOLID, nombres, funciones, errores, pruebas y revisión. |
| [Buenas prácticas backend](docs/buenas-practicas-backend.md) | Capas, Express, Zod, Supabase, AWS, IA, seguridad y pruebas. |
| [Buenas prácticas frontend](docs/buenas-practicas-frontend.md) | Angular 21, signals, RxJS, formularios, accesibilidad, Bootstrap y rendimiento. |
| [Arquitectura](docs/arquitectura.md) | Componentes, flujos, capas y despliegue. |
| [Base de datos](docs/base-datos.md) | Modelo, relaciones, RLS, pgvector y migraciones. |
| [API](docs/api.md) | Contrato REST, endpoints, errores y ejemplos. |
| [Seguridad](docs/seguridad.md) | Autenticación, roles, secretos, archivos, IA e incidentes. |
| [IA y RAG](docs/ia-rag.md) | Pipeline RAG, prompts, citas, herramientas y control de consumo. |
| [Convenciones](docs/convenciones.md) | Estilo, nombres, ramas, commits, PR y Definition of Done. |
| [Entornos y despliegue](docs/entornos-y-despliegue.md) | Variables de entorno, ejecución local, SAM, CI/CD y rollback. |
| [Plan de pruebas](docs/plan-pruebas.md) | Estrategia, casos por módulo, RLS, pruebas de IA y criterios de aceptación. |

> Antes de crear cualquier recurso en AWS, leer [docs/reglas-aws-agente.md](docs/reglas-aws-agente.md) y [docs/reglas-aws.md](docs/reglas-aws.md). Si el servicio no está en la lista blanca, no es serverless o puede generar cobros por estar encendido, no se usa. Ante cualquier duda, se pregunta al usuario.

## Convenciones de API

Respuesta exitosa:

```json
{ "success": true, "data": {} }
```

Respuesta de error:

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

La autenticacion usa tokens JWT de Supabase Auth enviados como `Authorization: Bearer <token>`.
