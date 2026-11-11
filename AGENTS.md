# Reglas del proyecto MINGO para agentes de IA

**Estado:** obligatorio
**Aplica a:** cualquier agente o persona que modifique este repositorio
**Última actualización:** 2026-11-07

Este archivo es el punto de entrada. OpenCode lo carga automáticamente al iniciar una sesión en este repositorio. Los documentos detallados se cargan además mediante `opencode.jsonc` (`instructions`). Si hay conflicto entre un documento y este archivo, **manda este archivo** y se debe avisar al usuario.

---

## 1. Contexto del proyecto

MINGO es una plataforma académica inteligente para estudiantes universitarios.

| Componente | Tecnología |
|---|---|
| Backend | Node.js 24 + Express 5 (CommonJS), arquitectura por capas |
| Base de datos | PostgreSQL en Supabase + `pgvector` |
| Autenticación | Supabase Auth (JWT) |
| Frontend | Angular 21, componentes standalone, signals, Bootstrap 5 |
| IA | Proveedor externo con API compatible con OpenAI; RAG sobre pgvector |
| Infraestructura | AWS **solo serverless** y **solo capa gratuita** |
| Pruebas | Jest + Supertest (backend), Vitest (frontend) |

Estructura del repositorio:

```text
MINGO/
├── backend/          API Express por capas
│   ├── src/
│   │   ├── config/         configuración y clientes (Supabase, AWS)
│   │   ├── models/         esquemas Zod
│   │   ├── controllers/    capa HTTP
│   │   ├── services/       reglas de negocio
│   │   ├── repositories/   acceso a datos
│   │   ├── middlewares/    auth, roles, validación, errores
│   │   ├── routes/         definición de endpoints
│   │   ├── utils/          ApiError, asyncHandler, helpers
│   │   ├── app.js          app Express exportada para tests
│   │   └── server.js       arranque local
│   └── tests/
├── frontend/         SPA Angular
│   └── src/app/
│       ├── core/           servicios singleton, guards, interceptores, modelos
│       ├── shared/         componentes, pipes y directivas reutilizables
│       ├── features/       módulos funcionales con rutas lazy
│       └── layout/         shell de la aplicación
├── docs/             documentación técnica y reglas
├── AGENTS.md         este archivo
└── opencode.jsonc    configuración de carga de instrucciones
```

---

## 2. Documentos que se deben consultar

| Documento | Cuándo leerlo |
|---|---|
| [docs/reglas-aws-agente.md](docs/reglas-aws-agente.md) | **Siempre** antes de tocar AWS, infraestructura, costos, despliegue o dependencias cloud. |
| [docs/reglas-aws.md](docs/reglas-aws.md) | Detalle completo de límites, lista blanca/negra, presupuestos y excepciones. |
| [docs/buenas-practicas.md](docs/buenas-practicas.md) | Clean Code, SOLID, nombres, funciones, errores y pruebas. |
| [docs/buenas-practicas-backend.md](docs/buenas-practicas-backend.md) | Antes de escribir o modificar código backend. |
| [docs/buenas-practicas-frontend.md](docs/buenas-practicas-frontend.md) | Antes de escribir o modificar código frontend. |
| [docs/arquitectura.md](docs/arquitectura.md) | Para ubicar un cambio y entender flujos. |
| [docs/base-datos.md](docs/base-datos.md) | Antes de crear tablas, consultas, políticas RLS o migraciones. |
| [docs/api.md](docs/api.md) | Antes de implementar o consumir endpoints. |
| [docs/seguridad.md](docs/seguridad.md) | En todo cambio que toque datos, accesos, secretos o archivos. |
| [docs/ia-rag.md](docs/ia-rag.md) | En todo cambio de chat, embeddings, prompts o citas. |
| [docs/convenciones.md](docs/convenciones.md) | Estilo, ramas, commits, PR y Definition of Done. |
| [docs/plan-pruebas.md](docs/plan-pruebas.md) | Al escribir o ejecutar pruebas. |
| [docs/entornos-y-despliegue.md](docs/entornos-y-despliegue.md) | Antes de desplegar o cambiar variables de entorno. |

---

## 3. Reglas de AWS (resumen obligatorio)

> El detalle completo está en [docs/reglas-aws-agente.md](docs/reglas-aws-agente.md) y [docs/reglas-aws.md](docs/reglas-aws.md).

1. **Solo capa gratuita.** El costo esperado y aceptable es **$0 USD**. Cualquier cobro es un incidente.
2. **Solo serverless.** Nada de servidores ni recursos encendidos 24/7.
3. **Prohibidas las máquinas virtuales y equivalentes:** EC2, Lightsail, ECS/Fargate, EKS, Elastic Beanstalk, App Runner, RDS/Aurora y cualquier recurso con capacidad provisionada.
4. **Cero recursos ociosos.** Nada de NAT Gateway, balanceadores, IP elástica, clústeres, caché administrada ni discos permanentes.
5. **Solo lista blanca.** Lambda, API Gateway HTTP API, S3, SNS, SQS, EventBridge Scheduler, CloudWatch básico, IAM, Budgets, SAM/CloudFormation, ACM, Parameter Store Standard y CloudFront.
6. **Límites antes de desplegar:** concurrencia, throttling, tamaño, retención de logs, lifecycle y presupuesto con alertas.
7. **Sin excepciones silenciosas.** Toda excepción requiere justificación escrita, aprobación del usuario y fecha de revisión.

### Regla de consulta obligatoria

**Si existe cualquier duda sobre AWS, costos, capa gratuita, límites, región, retención o un servicio no listado, el agente debe detenerse y preguntar al usuario antes de actuar.** No se asume que un servicio es gratuito. No se crea nada "para probar". No se despliega nada sin autorización explícita.

El agente **nunca** debe:

- Crear, modificar o eliminar recursos AWS por su cuenta.
- Ejecutar comandos `aws` que creen o alteren infraestructura.
- Crear usuarios, roles, claves de acceso o secretos.
- Cambiar la configuración de facturación, presupuestos o regiones.
- Aprobar una excepción a las reglas de AWS.

Solo puede proponer el cambio, explicar el costo y esperar la confirmación del usuario.

### Ejecución de infraestructura por el agente (decisión 2026-11-11)

Por decisión explícita del dueño del proyecto (2026-11-11), y **solo** bajo estas
condiciones, el agente puede ejecutar comandos `aws`/`sam` de creación o despliegue
de recursos incluidos en la lista blanca:

1. **Solo servicios serverless de la lista blanca** (punto 5). Nada que esté
   encendido siempre: sin máquinas virtuales, sin contenedores permanentes, sin
   capacidad provisionada (puntos 2–4).
2. **Solo servicios activos en la capa gratuita**, o con costo verificado de **$0**
   para el caso de uso concreto.
3. El agente **explica antes de implementar** qué recurso creará, para qué, con qué
   límites y qué costo estimado, y espera la aprobación explícita del usuario para
   ese cambio concreto, en el momento de ejecutarlo.
4. Los Budgets `mingo-alerta-baja` ($1) y `mingo-alerta-media` ($5) deben estar
   verificados activos antes del despliegue.
5. Las credenciales son únicamente locales del usuario (SSO, perfil CLI o variables
   en su `.env` local ignorado por git) o OIDC desde el CI. Jamás credenciales en el
   chat, en git ni en el frontend.
6. Antes de desplegar, verificación de solo lectura de cuenta, región, presupuestos
   y free tier. Si algo no cuadra, el agente se detiene y avisa.
7. Tras desplegar, el agente informa qué se creó, los límites aplicados y el costo
   estimado por mes.

Sigue prohibido para el agente: crear usuarios, roles, claves de acceso o secretos;
cambiar la facturación, los presupuestos o la región; aprobar excepciones a la lista
blanca; y crear recursos fuera de la lista blanca (siguen requiriendo justificación
escrita, aprobación del usuario y fecha de revisión).

---

## 4. Reglas de código (resumen obligatorio)

- Aplicar **Clean Code** y **SOLID** en todo el código. Ver [docs/buenas-practicas.md](docs/buenas-practicas.md).
- Una función = una responsabilidad. Nombres claros, sin abreviaturas ambiguas.
- Sin números mágicos, sin duplicación, sin código muerto y sin comentarios que expliquen lo obvio.
- Sin lógica de negocio en rutas ni controladores.
- Sin SQL ni acceso a Supabase en controladores.
- Toda entrada se valida con **Zod** (`body`, `query` y `params`).
- Errores con `ApiError` y el middleware central. Nunca exponer `stack` ni detalles internos en producción.
- El backend nunca confía en `usuario_id`, roles o estados enviados por el cliente: los obtiene del token o los calcula.
- RLS activo en toda tabla. Un recurso ajeno responde `404`.
- Sin secretos en el repositorio ni en el frontend.
- Backend en CommonJS, `async/await`, sin `console.log` en producción.
- Frontend con componentes standalone, `OnPush`, `inject()`, signals para estado local y RxJS para asincronía.
- No usar `innerHTML` con contenido generado por IA.
- Toda lista muestra estados de **carga, vacío y error**.

### Idioma

| Elemento | Idioma |
|---|---|
| Identificadores de código | inglés |
| Tablas y columnas | español, `snake_case` |
| Endpoints | español, sustantivos en plural |
| Mensajes al usuario y documentación | español |
| Commits | español o inglés, consistente |

---

## 5. Comandos obligatorios antes de terminar

Backend:

```bash
cd backend
npm run lint
npm test
```

Frontend:

```bash
cd frontend
npm run build
npm test -- --watch=false
```

Si un comando falla, se corrige antes de dar la tarea por terminada. No se entrega código con lint rojo, pruebas rojas o build roto.

---

## 6. Flujo de trabajo del agente

1. **Leer** este archivo y los documentos relacionados con la tarea.
2. **Entender** el código existente antes de modificarlo. No borrar ni sobrescribir trabajo del usuario sin investigar.
3. **Planear** el cambio y avisar si afecta arquitectura, base de datos, seguridad o AWS.
4. **Implementar** respetando capas, convenciones y buenas prácticas.
5. **Validar** con lint, pruebas y build.
6. **Actualizar documentación** si cambia arquitectura, API, modelo de datos, variables de entorno o servicios AWS.
7. **Commit** con Conventional Commits y push a la rama correspondiente.

### Cuándo preguntar al usuario (obligatorio)

- Cualquier duda de AWS, costos, capa gratuita o servicios.
- Necesidad de agregar un servicio, dependencia pesada o recurso cloud.
- Cambios destructivos de base de datos o pérdida de datos.
- Cambios de arquitectura, autenticación o modelo de permisos.
- Ambigüedad funcional que cambie el comportamiento del producto.
- Conflictos entre documentos.
- Cualquier acción irreversible.

La pregunta debe ser concreta, con opciones y con el impacto (costo, riesgo, alternativa). No se avanza con suposiciones.

---

## 7. Git y commits

- `main` es la rama desplegable; `develop` es la rama de integración.
- Ramas: `feature/<hu>-<descripcion>`, `fix/<descripcion>`, `docs/<descripcion>`, `chore/<descripcion>`, `refactor/<descripcion>`.
- Conventional Commits: `<tipo>(<alcance>): <descripcion>`.
- Un commit = un cambio lógico.
- No commitear `node_modules`, archivos generados, `.env` ni credenciales.
- Actualizar los documentos afectados en el mismo PR.

---

## 8. Checklist final

- [ ] Leí las reglas de AWS y no creé recursos fuera de la lista blanca.
- [ ] Si tuve dudas de costos o servicios, pregunté al usuario.
- [ ] Apliqué Clean Code y SOLID.
- [ ] Respeté las capas del backend y la estructura del frontend.
- [ ] Validé entradas con Zod y manejé errores con `ApiError`.
- [ ] No expuse secretos, tokens ni datos personales.
- [ ] Verifiqué RLS y control de acceso.
- [ ] Actualicé pruebas y documentación.
- [ ] Lint, pruebas y build pasan.
- [ ] El commit sigue Conventional Commits.
