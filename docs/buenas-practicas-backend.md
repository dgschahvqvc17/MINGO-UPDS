# Buenas prácticas de backend — MINGO

**Versión:** 1.0
**Fecha:** 2026-11-07
**Stack:** Node.js 24, Express 5 (CommonJS), Supabase PostgreSQL + Auth, AWS SDK v3, Zod, Jest + Supertest
**Objetivo:** una API por capas, segura, validada, testeable y de costo $0.

> Antes de leer este documento, aplica las reglas generales de [buenas-practicas.md](buenas-practicas.md) y las reglas de AWS de [reglas-aws-agente.md](reglas-aws-agente.md).

---

## 1. Estructura y capas

```text
backend/src/
├── config/          environment.js, supabase.js, aws.js
├── models/          esquemas Zod y constantes de dominio
├── controllers/     traducen HTTP -> servicio -> HTTP
├── services/        reglas de negocio
├── repositories/    acceso a Supabase / AWS / IA
├── middlewares/     auth, roles, validación, errores
├── routes/          definición de endpoints y middlewares
├── utils/           ApiError, asyncHandler, helpers puros
├── app.js           configuración de Express (exportada para tests)
└── server.js        arranque del servidor local
```

### Regla de dependencias

```text
route -> controller -> service -> repository -> infrastructure
```

Nunca al revés. Un repository no conoce HTTP. Un service no conoce `req` ni `res`. Un controller no ejecuta SQL.

| Capa | Responsabilidad | Prohibido |
|---|---|---|
| `route` | Método, ruta, middlewares. | Lógica de negocio, consultas. |
| `controller` | Leer `req`, llamar al servicio, responder. | SQL, reglas complejas, acceso directo a Supabase. |
| `service` | Reglas, autorización de dominio, transacciones, IA, AWS. | `req`, `res`, SQL directo. |
| `repository` | Consultas, mapeo de filas, llamadas a SDK. | HTTP, reglas de negocio. |
| `middleware` | Auth, roles, validación, errores. | Lógica de un módulo. |

### Ejemplo completo de una funcionalidad

```js
// models/task.model.js
const { z } = require('zod');

const createTaskSchema = z.object({
  subjectId: z.coerce.number().int().positive(),
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  priority: z.enum(['baja', 'media', 'alta']).default('media'),
  dueDate: z.coerce.date().optional(),
});

const taskIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

module.exports = { createTaskSchema, taskIdSchema };
```

```js
// repositories/task.repository.js
class TaskRepository {
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  async findByUser(userId) {
    const { data, error } = await this.supabase
      .from('tareas')
      .select('id, usuario_id, materia_id, titulo, descripcion, prioridad, fecha_entrega, estado, fecha_creacion')
      .eq('usuario_id', userId)
      .order('fecha_entrega', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return data;
  }

  async create(task) {
    const { data, error } = await this.supabase
      .from('tareas')
      .insert(task)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

module.exports = TaskRepository;
```

```js
// services/task.service.js
const ApiError = require('../utils/ApiError');

class TaskService {
  constructor({ taskRepository, subjectRepository }) {
    this.taskRepository = taskRepository;
    this.subjectRepository = subjectRepository;
  }

  async listForUser(userId) {
    return this.taskRepository.findByUser(userId);
  }

  async createForUser(userId, input) {
    // La materia debe pertenecer al usuario; no se confía en el cliente.
    const subject = await this.subjectRepository.findById(input.subjectId);

    if (!subject || subject.usuario_id !== userId) {
      throw ApiError.notFound('Materia no encontrada.');
    }

    return this.taskRepository.create({
      usuario_id: userId,
      materia_id: subject.id,
      titulo: input.title,
      descripcion: input.description ?? null,
      prioridad: input.priority,
      fecha_entrega: input.dueDate ?? null,
    });
  }
}

module.exports = TaskService;
```

```js
// controllers/task.controller.js
class TaskController {
  constructor({ taskService }) {
    this.taskService = taskService;
  }

  list = async (req, res) => {
    const tasks = await this.taskService.listForUser(req.user.id);
    res.json({ success: true, data: tasks });
  };

  create = async (req, res) => {
    const task = await this.taskService.createForUser(req.user.id, req.validated.body);
    res.status(201).json({ success: true, data: task });
  };
}

module.exports = TaskController;
```

```js
// routes/task.routes.js
const { Router } = require('express');
const validate = require('../middlewares/validation.middleware');
const { createTaskSchema, taskIdSchema } = require('../models/task.model');
const { taskController } = require('../container');

const router = Router();

router.get('/', taskController.list);
router.post('/', validate({ body: createTaskSchema }), taskController.create);

module.exports = router;
```

> **Nota:** MINGO aún no tiene un contenedor de dependencias. Hasta que exista, se instancian servicios y repositorios en un módulo de composición (`container.js`) o al inicio de la ruta, nunca dentro de la función que atiende la petición. Evitar crear clientes por solicitud.

---

## 2. Estilo y legibilidad

- CommonJS: `require` / `module.exports`.
- `async/await` siempre. Nada de callbacks anidados ni `.then()` encadenados largos.
- Funciones pequeñas, con guard clauses.
- Sin `console.log` en producción. Usar el logger definido o `console.error` solo para errores no controlados en el middleware.
- Sin variables globales mutables.
- Sin `var`.
- Preferir `const`; usar `let` solo cuando se reasigna.
- No mutar parámetros de entrada.
- Nombres de archivo `kebab-case` con sufijo de capa: `task.service.js`, `task.routes.js`.
- Clases en `PascalCase`, funciones en `camelCase`, constantes en `UPPER_SNAKE_CASE`.
- Un archivo exporta una responsabilidad principal.

### Tamaño y complejidad

| Elemento | Límite recomendado |
|---|---|
| Función | 30 líneas |
| Archivo | 300 líneas |
| Parámetros | 3 |
| Anidamiento | 2 niveles |
| Complejidad ciclomática | 10 |

Si se supera, dividir.

---

## 3. Validación con Zod

### 3.1. Reglas

- **Todo** endpoint valida `body`, `query` y `params` según corresponda.
- Se usa el middleware `validate` y se lee `req.validated`, no `req.body` directo.
- Un esquema por operación, no un esquema gigante reutilizado para todo.
- Mensajes de error en español y orientados al usuario.
- Límites de longitud en todos los strings.
- IDs de dominio: entero positivo (`z.coerce.number().int().positive()`).
- `usuario_id`: UUID (normalmente no viene del cliente, se obtiene del token).
- Fechas ISO 8601; validar coherencia (`start <= end`).
- Enums cerrados para estados, prioridades, roles y tipos.
- Lista blanca de campos: Zod elimina lo no declarado.
- No aceptar `usuario_id`, `rol`, `estado` ni campos calculados desde el cliente.

### 3.2. Esquemas comunes

```js
// models/common.model.js
const { z } = require('zod');

const idSchema = z.coerce.number().int().positive();
const uuidSchema = z.string().uuid();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const dateRangeSchema = z
  .object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine(({ from, to }) => !from || !to || from <= to, {
    message: 'La fecha inicial no puede ser posterior a la final.',
    path: ['from'],
  });

module.exports = { idSchema, uuidSchema, paginationSchema, dateRangeSchema };
```

### 3.3. Validar reglas de negocio en el servicio

Zod valida forma y tipos. Las reglas que dependen de la base de datos (propiedad, existencia, transiciones) se validan en el **servicio**.

```js
if (!subject || subject.usuario_id !== userId) {
  throw ApiError.notFound('Materia no encontrada.');
}
```

---

## 4. Manejo de errores

### 4.1. `ApiError`

Usar los helpers existentes:

```js
const ApiError = require('../utils/ApiError');

throw ApiError.badRequest('Datos invalidos.', details);
throw ApiError.unauthorized();
throw ApiError.forbidden('No tienes permiso para esta accion.');
throw ApiError.notFound('Tarea no encontrada.');
throw ApiError.conflict('La tarea ya fue completada.');
throw ApiError.serviceUnavailable('El servicio de IA no esta disponible.');
```

- No crear `new Error('...')` para errores esperados.
- No devolver `res.status(400).json(...)` disperso; lanzar y dejar que el middleware central responda.
- No exponer `error.stack` en producción. El middleware ya lo controla.
- No incluir datos sensibles en `details`.

### 4.2. `asyncHandler`

Envolver controladores asíncronos para que los rechazos lleguen al middleware de errores:

```js
const asyncHandler = require('../utils/asyncHandler');

router.get('/', asyncHandler(taskController.list));
```

Si el controlador se define como método de clase y Express 5 ya captura promesas rechazadas, se puede omitir, pero mantener el patrón consistente en todo el proyecto.

### 4.3. Errores de Supabase

Los errores del SDK no se devuelven crudos al cliente. El repositorio los propaga; el servicio o el middleware los traduce.

```js
// repository
if (error) {
  throw error;
}

// service
try {
  return await this.repository.create(payload);
} catch (error) {
  if (error.code === '23505') {
    throw ApiError.conflict('Ya existe un registro con esos datos.');
  }
  throw error;
}
```

### 4.4. Formato de respuesta

Éxito:

```json
{ "success": true, "data": { } }
```

Lista:

```json
{
  "success": true,
  "data": [],
  "meta": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "message": "Materia no encontrada.",
    "details": { "source": "body", "issues": [] }
  }
}
```

Nunca devolver `service_role`, claves, tokens, contraseñas ni rutas internas del servidor.

---

## 5. Autenticación y autorización

- `authMiddleware` valida el JWT de Supabase y deja `req.user` (`id`, `email`, `role`) y `req.accessToken`.
- El `userId` **siempre** sale de `req.user.id`, nunca de `req.body` ni de `req.query`.
- Los roles se validan con el middleware de roles; no confiar en un rol enviado por el cliente.
- Un recurso de otro usuario responde `404`, no `403`, para no revelar su existencia.
- El administrador no obtiene acceso automático a contenido privado (documentos, conversaciones, cuestionarios).
- Las rutas públicas se declaran explícitamente antes de `router.use(authMiddleware)`.

```js
// routes/public.routes.js
router.get('/health', healthController.check);

// routes/private.routes.js
router.use(authMiddleware);
router.use(requireRole('administrador'));
```

### Cliente de Supabase

| Cliente | Uso |
|---|---|
| `supabaseAdmin` (`service_role`) | Operaciones administrativas controladas, tareas internas, triggers de negocio. |
| `createSupabaseClient(req.accessToken)` | Consultas en nombre del usuario para que RLS se aplique. Preferido para datos de dominio. |

Reglas:

- `service_role` nunca se expone al frontend ni se registra en logs.
- Aun con `service_role`, el repository filtra por `usuario_id` cuando corresponde.
- No se usa `supabaseAdmin` para "saltarse" RLS sin justificación y comentario.

---

## 6. Repositorios y base de datos

- Toda consulta vive en `repositories/`.
- Seleccionar columnas explícitas; evitar `select('*')` en producción.
- Paginar siempre las listas (`range` o `limit`/`offset`).
- Usar índices existentes en filtros (`usuario_id`, `materia_id`, `estado`, fechas).
- Evitar consultas N+1: usar `select` con relaciones o consultas por lote.
- No construir SQL concatenando strings. Usar el query builder o parámetros.
- Mapear `snake_case` de la base a `camelCase` del dominio en el repositorio.
- No devolver filas completas si el cliente solo necesita un subconjunto.
- Respetar el modelo de IDs: `perfiles.id` UUID, IDs de dominio enteros (`SERIAL`).

### Paginación

```js
async findByUser(userId, { page, limit }) {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const { data, error, count } = await this.supabase
    .from('tareas')
    .select('id, titulo, estado, fecha_entrega', { count: 'exact' })
    .eq('usuario_id', userId)
    .order('fecha_entrega', { ascending: true })
    .range(from, to);

  if (error) throw error;
  return { items: data, total: count ?? 0 };
}
```

### Transacciones

Supabase no expone transacciones multi-tabla desde el cliente REST. Si una operación requiere atomicidad:

- Usar una función RPC en PostgreSQL (`create or replace function ...`) y llamarla con `.rpc()`.
- Documentar la función en [base-datos.md](base-datos.md).
- Validar permisos dentro de la función o antes de llamarla.

---

## 7. Servicios

- Contienen las reglas de negocio y la autorización de dominio.
- No conocen `req` ni `res`.
- Reciben dependencias por constructor para poder probarlos.
- Orquestan repositorios, IA y AWS.
- Devuelven datos de dominio, no filas crudas.
- Lanzan `ApiError` para errores esperados.
- No hacen logging de datos personales.

### Reglas de negocio que siempre van en el servicio

- Propiedad del recurso (`usuario_id`).
- Existencia y estado de entidades relacionadas.
- Transiciones de estado.
- Cálculos (promedios, puntajes, fechas).
- Límites de cuota de IA.
- Validación de tamaño y tipo de archivo antes de firmar la URL.

---

## 8. AWS en el backend

> Leer [reglas-aws-agente.md](reglas-aws-agente.md) antes de escribir cualquier código que use AWS.

- Solo SDK v3 (`@aws-sdk/client-*`).
- Un cliente por servicio, creado una vez y reutilizado (fuera del handler si es posible).
- S3: bucket privado, URL prefirmada de subida/descarga con expiración máxima de 15 minutos.
- Validar tipo MIME, extensión y tamaño **antes** de firmar.
- La `objectKey` debe empezar con `usuarios/<usuario_id>/`.
- SQS: mensajes idempotentes, con `documentId` y `userId`, DLQ y `maxReceiveCount = 3`.
- SNS: solo email, sin datos sensibles en el mensaje.
- Lambda: sin VPC, sin concurrencia provisionada, timeout acotado.
- Nunca crear recursos AWS desde código en tiempo de ejecución.
- No registrar `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` ni ARNs completos innecesarios.

### URL prefirmada

```js
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand } = require('@aws-sdk/client-s3');

async function createUploadUrl({ s3Client, bucket, userId, documentId, contentType }) {
  const key = `usuarios/${userId}/documentos/${documentId}/original`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  return { uploadUrl, objectKey: key };
}
```

Si falta configuración de AWS, el servicio debe responder `503` con un mensaje claro, no intentar una llamada que fallará con un error críptico.

---

## 9. IA y RAG

- El proveedor de IA es externo; su costo también se controla.
- La clave de IA vive en variables de entorno del backend. **Nunca** en el frontend.
- Limitar tokens de entrada y salida por solicitud.
- Generar embeddings una sola vez por fragmento; no regenerar si el contenido no cambió.
- Buscar siempre filtrando por `usuario_id`.
- Recuperar como máximo 20 fragmentos por consulta.
- Incluir citas (`documento_id`, `numero_pagina`, `fragmento_id`) cuando la respuesta se base en documentos.
- Si el proveedor falla o se agota la cuota, degradar con un mensaje claro; no reintentar en bucle.
- No registrar prompts completos ni contenido de documentos si incluyen datos personales.
- No enviar a la IA más contexto del necesario.
- Validar y sanear la salida antes de guardarla o mostrarla.

```js
const MAX_CONTEXT_CHUNKS = 8;
const MAX_OUTPUT_TOKENS = 800;

async function buildContext({ chunkRepository, userId, queryEmbedding }) {
  const chunks = await chunkRepository.searchSimilar({
    userId,
    embedding: queryEmbedding,
    limit: MAX_CONTEXT_CHUNKS,
    threshold: 0.7,
  });

  return chunks.map((chunk) => ({
    documentId: chunk.documento_id,
    page: chunk.numero_pagina,
    content: chunk.contenido,
  }));
}
```

---

## 10. Seguridad

- Helmet, CORS restringido, rate limiting y límite de tamaño de body ya están configurados en `app.js`. No desactivarlos.
- Validar `Content-Type` y tamaño de archivos.
- No confiar en el nombre de archivo del cliente; generar la clave en el servidor.
- No ejecutar comandos del sistema con entrada del usuario.
- No usar `eval`, `Function` ni deserialización insegura.
- No exponer rutas de disco ni trazas internas.
- No registrar tokens, cookies, contraseñas ni claves.
- Revisar `npm audit --omit=dev` antes de fusionar.
- No agregar dependencias sin justificar y sin revisar licencia y mantenimiento.
- Los secretos van en `.env` local o en el gestor de secretos del pipeline; `.env` está en `.gitignore`.

### Subida de archivos

```text
1. Validar sesión y propiedad de la materia.
2. Validar extensión, MIME y tamaño.
3. Generar objectKey con userId y documentId.
4. Firmar URL de subida (15 min).
5. Guardar metadatos con estado "pendiente".
6. Encolar el procesamiento.
```

Nunca recibir el archivo por Lambda para luego subirlo a S3: duplica tiempo y costo.

---

## 11. Logging y observabilidad

- Nivel `info` o `warn` en producción; `debug` solo en desarrollo.
- Logs estructurados cuando se agregue un logger (JSON con `level`, `message`, `requestId`, `userId` cuando aplique).
- No registrar:
  - contenido de documentos;
  - embeddings;
  - tokens JWT;
  - claves de API;
  - correos completos ni datos personales innecesarios.
- Incluir un identificador de correlación por solicitud.
- Errores 5xx se registran con stack en el servidor, nunca en la respuesta.
- Alertas mínimas: errores 5xx, throttles, mensajes en DLQ y presupuesto.

---

## 12. Pruebas

### 12.1. Unitarias de servicio

```js
const TaskService = require('../../src/services/task.service');
const ApiError = require('../../src/utils/ApiError');

describe('TaskService', () => {
  it('rechaza una materia de otro usuario', async () => {
    const taskRepository = { create: jest.fn() };
    const subjectRepository = {
      findById: jest.fn().mockResolvedValue({ id: 10, usuario_id: 'otro-usuario' }),
    };
    const service = new TaskService({ taskRepository, subjectRepository });

    await expect(
      service.createForUser('usuario-a', { subjectId: 10, title: 'Tarea' }),
    ).rejects.toThrow(ApiError);

    expect(taskRepository.create).not.toHaveBeenCalled();
  });
});
```

### 12.2. Integración con Supertest

```js
const request = require('supertest');
const app = require('../../src/app');

describe('GET /api/health', () => {
  it('responde 200 con el estado del servicio', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
```

### 12.3. Reglas

- Mocks de Supabase, AWS y proveedor de IA en pruebas unitarias.
- Sin llamadas reales a servicios externos.
- Sin depender de datos de producción.
- Probar casos felices, bordes y errores.
- Probar autorización con dos usuarios distintos.
- Ejecutar `npm test` antes de cada commit.
- Cobertura mínima razonable: servicios y validaciones por encima del 80 %; no obsesionarse con el número.

---

## 13. Rendimiento y costo

- Reutilizar clientes de Supabase y AWS.
- Evitar consultas dentro de bucles.
- Seleccionar solo columnas necesarias.
- Paginar y limitar resultados.
- Cachear en memoria datos de catálogo que cambian poco (roles, configuraciones).
- No usar polling ni `setInterval` en el backend.
- Procesar documentos de forma asíncrona.
- Empaquetar Lambda solo con dependencias de producción (`npm ci --omit=dev`).
- Medir antes de optimizar.

---

## 14. Checklist de backend

- [ ] El endpoint está en `routes/` y usa los middlewares correctos.
- [ ] El controlador solo traduce HTTP y llama al servicio.
- [ ] La lógica está en el servicio y el acceso a datos en el repositorio.
- [ ] `body`, `query` y `params` se validan con Zod.
- [ ] `userId` sale del token, nunca del cliente.
- [ ] Se verifica la propiedad del recurso.
- [ ] Los errores usan `ApiError` y el formato estándar.
- [ ] No se exponen datos internos ni secretos.
- [ ] Las listas están paginadas y seleccionan columnas explícitas.
- [ ] RLS sigue activo y probado.
- [ ] AWS se usa solo dentro de la lista blanca y sin recursos ociosos.
- [ ] La IA tiene límites de tokens y cuota.
- [ ] Hay pruebas unitarias o de integración.
- [ ] `npm run lint` y `npm test` pasan.
- [ ] La documentación afectada está actualizada.
