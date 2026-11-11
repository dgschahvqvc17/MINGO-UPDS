# API REST de MINGO

**Versión:** 1.0  
**Base URL local:** `http://localhost:4000/api`  
**Base URL producción:** `https://<api-id>.execute-api.us-east-1.amazonaws.com`  
**Formato:** JSON UTF-8  
**Autenticación:** `Authorization: Bearer <access_token>` (JWT de Supabase Auth)

## 1. Reglas generales

1. Todos los endpoints, excepto `GET /health` y los de autenticación, requieren token válido.
2. El backend **nunca** confía en el `usuario_id` enviado por el frontend: lo obtiene del token.
3. Toda respuesta usa el sobre `{ success, data }` o `{ success, error }`.
4. Las fechas viajan en ISO 8601 UTC: `2026-11-07T18:30:00.000Z`.
5. Las listas se paginan siempre. Sin paginación explícita se aplica `page=1&limit=20`.
6. Los identificadores de usuario (`perfiles.id`, `usuario_id`) son UUID. En la implementación actual, `materias` (HU03) y `tareas` (HU04) también usan `UUID`; el resto de las entidades de dominio migrará a `UUID` cuando se implemente su historia. El cliente no debe asumir el tipo de un ID: lo trata como cadena opaca.
7. Los endpoints que modifican datos validan la entrada con Zod antes de llegar al controlador.
8. Las operaciones de IA y de carga de archivos tienen límites de uso (ver [seguridad.md](seguridad.md) e [ia-rag.md](ia-rag.md)).

## 2. Sobre de respuesta

### Éxito

```json
{
  "success": true,
  "data": {}
}
```

### Éxito con paginación

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 57,
    "totalPages": 3
  }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos enviados no son válidos.",
    "details": [
      { "field": "nombre", "message": "El nombre es obligatorio." }
    ]
  }
}
```

## 3. Códigos de estado

| HTTP | `error.code` | Cuándo se usa |
|---:|---|---|
| 200 | — | Consulta o actualización exitosa. |
| 201 | — | Recurso creado. |
| 204 | — | Eliminación exitosa sin cuerpo. |
| 400 | `VALIDATION_ERROR` | Datos inválidos o faltantes. |
| 400 | `BAD_REQUEST` | Solicitud incoherente (por ejemplo, fechas invertidas). |
| 401 | `UNAUTHORIZED` | Token ausente, vencido o inválido. |
| 403 | `FORBIDDEN` | El usuario no tiene el rol o no es propietario del recurso. |
| 404 | `NOT_FOUND` | El recurso no existe o no pertenece al usuario. |
| 409 | `CONFLICT` | Duplicado (correo, código de materia, recurso ya procesado). |
| 413 | `PAYLOAD_TOO_LARGE` | Archivo mayor al límite. |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | Formato de archivo no permitido. |
| 422 | `UNPROCESSABLE_ENTITY` | Documento no procesado, IA sin contexto suficiente. |
| 429 | `RATE_LIMITED` | Límite de solicitudes o cuota de IA agotada. |
| 503 | `SERVICE_UNAVAILABLE` | Supabase, AWS o proveedor de IA no configurado o caído. |
| 500 | `INTERNAL_ERROR` | Error no controlado (no exponer detalles internos). |

> **Regla de seguridad:** un recurso de otro usuario responde **404**, no 403, para no revelar su existencia.

## 4. Autenticación

El frontend inicia sesión directamente con Supabase Auth y envía el token al backend. El backend valida el token con Supabase, consulta `perfiles` y `usuario_roles`, y obtiene `id`, `email`, `role` y `estado`. El rol **no** se toma de los metadatos del JWT.

> En HU01 solo se implementa `GET /api/auth/me`. El registro y el login desde backend quedan fuera del alcance.

### 4.1. `POST /api/auth/register`

Registro opcional desde backend. Si el frontend usa Supabase Auth directamente, este endpoint no es necesario.

**Body**

```json
{
  "correo": "ana@universidad.edu",
  "password": "Minimo8Caracteres!",
  "nombre": "Ana",
  "apellido": "Pérez"
}
```

**Respuesta `201`**

```json
{
  "success": true,
  "data": {
    "id": "3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01",
    "correo": "ana@universidad.edu",
    "nombre": "Ana",
    "apellido": "Pérez"
  }
}
```

### 4.2. `POST /api/auth/login`

No recomendado si el frontend usa el SDK de Supabase. Si se implementa, devuelve el token y los datos del perfil.

### 4.3. `POST /api/auth/logout`

No se implementa en el backend. El frontend cierra la sesión directamente con `supabase.auth.signOut()`, que revoca el refresh token. El backend rechazará el access token a partir de ese momento.

### 4.4. `GET /api/auth/me`

Devuelve el perfil, el rol y el estado del usuario autenticado. Requiere `Authorization: Bearer <access_token>`.

```json
{
  "success": true,
  "data": {
    "id": "3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01",
    "email": "ana@universidad.edu",
    "nombre": "Ana",
    "apellido": "Pérez",
    "correo": "ana@universidad.edu",
    "estado": "activo",
    "role": "estudiante",
    "roles": ["estudiante"]
  }
}
```

**Errores**

| Código | Causa |
|---|---|
| `401` | Token ausente, vencido o inválido. |
| `403` | Perfil inexistente o cuenta con `estado = 'inactivo'`. |
| `503` | Supabase no configurado en el backend. |

## 5. Perfil

### `GET /api/usuarios/perfil`

Devuelve el perfil del usuario autenticado. En HU01 el frontend usa `GET /api/auth/me`; este endpoint queda para HU02.

### `PUT /api/usuarios/perfil`

Pendiente para HU02. Contrato previsto:

**Body** (todos los campos opcionales)

```json
{
  "nombre": "Ana",
  "apellido": "Pérez",
  "foto_perfil": "https://...",
  "universidad": "Universidad Nacional",
  "carrera": "Ingeniería de Sistemas",
  "semestre": 5
}
```

**Validaciones**

- `nombre` y `apellido`: 1–100 caracteres.
- `semestre`: entero entre 1 y 20.
- `foto_perfil`: URL HTTPS o `null`.

## 6. Materias y unidades

| Método | Endpoint | Historia | Descripción |
|---|---|---|---|
| GET | `/api/materias` | HU03 | Lista materias del usuario. |
| POST | `/api/materias` | HU03 | Crea una materia. |
| GET | `/api/materias/:id` | HU03 | Detalle de una materia. |
| PUT | `/api/materias/:id` | HU03 | Actualiza una materia. |
| DELETE | `/api/materias/:id` | HU03 | Archiva o elimina una materia. |
| GET | `/api/materias/:id/unidades` | HU03 | Lista unidades de la materia. |
| POST | `/api/materias/:id/unidades` | HU03 | Crea una unidad. |
| PUT | `/api/unidades/:id` | HU03 | Actualiza una unidad. |
| DELETE | `/api/unidades/:id` | HU03 | Elimina una unidad. |

**Filtros de `GET /api/materias`**

| Parámetro | Tipo | Ejemplo |
|---|---|---|
| `periodo_id` | entero | `?periodo_id=1` |
| `estado` | `activa` \| `archivada` | `?estado=activa` |
| `q` | texto | `?q=calculo` |
| `page`, `limit` | enteros | `?page=2&limit=10` |

**Body `POST /api/materias`**

```json
{
  "periodo_id": 1,
  "nombre": "Cálculo Diferencial",
  "codigo": "MAT-101",
  "docente": "Ing. Gómez",
  "descripcion": "Límites, derivadas y aplicaciones.",
  "color": "#2563eb"
}
```

**Validaciones**

- `nombre`: obligatorio, 2–120 caracteres.
- `codigo`: opcional, máximo 30 caracteres, único por usuario y periodo.
- `color`: hexadecimal `#RRGGBB`.
- `periodo_id`: debe pertenecer al usuario.

## 7. Periodos académicos

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/periodos` | Lista periodos del usuario. |
| POST | `/api/periodos` | Crea un periodo. |
| PUT | `/api/periodos/:id` | Actualiza un periodo. |
| DELETE | `/api/periodos/:id` | Elimina un periodo sin materias asociadas. |

```json
{
  "nombre": "2026-2",
  "fecha_inicio": "2026-08-01",
  "fecha_fin": "2026-12-15",
  "estado": "activo"
}
```

## 8. Tareas

| Método | Endpoint | Historia | Descripción |
|---|---|---|---|
| GET | `/api/tareas` | HU04 | Lista tareas con filtros y paginación. |
| POST | `/api/tareas` | HU04 | Crea una tarea. |
| GET | `/api/tareas/proximas` | HU04, HU06 | Tareas no completadas próximas a vencer. |
| GET | `/api/tareas/estadisticas` | HU04 | Contadores por estado, prioridad y vencidas. |
| GET | `/api/tareas/:id` | HU04 | Detalle. |
| PUT | `/api/tareas/:id` | HU04 | Actualiza total o parcialmente. |
| PATCH | `/api/tareas/:id/estado` | HU04 | Cambia solo el estado. |
| DELETE | `/api/tareas/:id` | HU04 | Elimina. |

**Objeto `tarea`**

```json
{
  "id": "8f14e45f-ceea-467a-9c2f-7c1d2b0d1a11",
  "usuario_id": "3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01",
  "materia_id": "5c9f2a10-4b7e-4d1a-9f3e-1a2b3c4d5e6f",
  "titulo": "Taller de derivadas",
  "descripcion": "Ejercicios 1 al 20.",
  "tipo": "taller",
  "prioridad": "alta",
  "fecha_asignacion": "2026-11-01T00:00:00.000Z",
  "fecha_entrega": "2026-11-12T23:59:59.000Z",
  "estado": "pendiente",
  "fecha_creacion": "2026-11-01T14:05:00.000Z",
  "fecha_actualizacion": null,
  "materias": { "nombre": "Cálculo Diferencial", "codigo": "MAT101", "color": "#3B82F6" }
}
```

- `id`, `usuario_id` y `materia_id` son UUID.
- `materias` es el resumen embebido de la materia (Supabase puede devolverlo como objeto o como arreglo de un elemento).
- `fecha_entrega` es `null` cuando la actividad no tiene plazo.
- `fecha_actualizacion` la mantiene un trigger de la base de datos.

**Filtros de `GET /api/tareas`**

| Parámetro | Tipo | Ejemplo |
|---|---|---|
| `materia_id` | UUID | `?materia_id=5c9f2a10-...` |
| `estado` | `pendiente` \| `en_progreso` \| `completada` | `?estado=pendiente` |
| `prioridad` | `baja` \| `media` \| `alta` | `?prioridad=alta` |
| `tipo` | `tarea` \| `taller` \| `parcial` \| `examen` \| `proyecto` \| `exposicion` \| `laboratorio` \| `practica` \| `otro` | `?tipo=parcial` |
| `query` | texto (máx. 200) | `?query=derivadas` |
| `desde`, `hasta` | ISO 8601 | `?desde=2026-11-01T00:00:00.000Z` |
| `vencidas` | `true` \| `false` | `?vencidas=true` |
| `sort` | `fecha_entrega` \| `fecha_creacion` \| `titulo` | `?sort=fecha_entrega` |
| `order` | `asc` \| `desc` | `?order=asc` |
| `limit` | entero 1–100 (por defecto 20) | `?limit=10` |
| `offset` | entero ≥ 0 (por defecto 0) | `?offset=20` |

**Respuesta de `GET /api/tareas`**

```json
{
  "success": true,
  "data": [],
  "meta": {
    "paginacion": { "limit": 20, "offset": 0, "total": 0 }
  }
}
```

**Body `POST /api/tareas`**

```json
{
  "materia_id": "5c9f2a10-4b7e-4d1a-9f3e-1a2b3c4d5e6f",
  "titulo": "Taller de derivadas",
  "descripcion": "Ejercicios 1 al 20.",
  "tipo": "taller",
  "prioridad": "alta",
  "fecha_asignacion": "2026-11-01T00:00:00.000Z",
  "fecha_entrega": "2026-11-12T23:59:59.000Z",
  "estado": "pendiente"
}
```

- `titulo`: obligatorio, 3–200 caracteres.
- `descripcion`: opcional, máximo 2000 caracteres.
- `tipo` y `prioridad` tienen valores por defecto `tarea` y `media`.
- `fecha_asignacion` por defecto es la fecha actual; si la actividad ya está vencida y no se envía, se usa `fecha_entrega`.
- `fecha_entrega` es opcional y `null` significa “sin plazo”.
- `estado` por defecto `pendiente`.

**`PATCH /api/tareas/:id/estado`**

```json
{ "estado": "completada" }
```

**`GET /api/tareas/proximas`**

Parámetros `dias` (1–30, por defecto 7) y `limit` (1–50, por defecto 10). Devuelve solo tareas no completadas con `fecha_entrega` dentro del rango:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "total": 0,
    "rango": {
      "dias": 7,
      "desde": "2026-11-10T15:00:00.000Z",
      "hasta": "2026-11-17T15:00:00.000Z"
    }
  }
}
```

**`GET /api/tareas/estadisticas`**

```json
{
  "success": true,
  "data": {
    "total": 42,
    "pendientes": 12,
    "en_progreso": 5,
    "completadas": 25,
    "vencidas": 3,
    "prioridad_alta": 10,
    "prioridad_media": 20,
    "prioridad_baja": 12
  }
}
```

Una tarea cuenta como vencida cuando tiene `fecha_entrega` anterior a ahora y su estado no es `completada`.

**Reglas**

- `fecha_entrega` no puede ser anterior a `fecha_asignacion`.
- `materia_id` debe existir y pertenecer al usuario; en caso contrario responde `404`.
- Una tarea de otro usuario responde `404`, nunca `403`.
- `PUT /api/tareas/:id` acepta actualización parcial: al menos un campo, y los campos no enviados conservan su valor.
- `DELETE /api/tareas/:id` responde `200` con `{ "id": "<uuid>" }`.
- Al crear o actualizar una tarea con `fecha_entrega`, HU05 genera o sincroniza automáticamente un evento de calendario tipo `entrega` (ver §9).

## 9. Calendario

| Método | Endpoint | Historia | Descripción |
|---|---|---|---|
| GET | `/api/calendario` | HU05 | Eventos en un rango de fechas. |
| POST | `/api/calendario` | HU05 | Crea un evento. |
| GET | `/api/calendario/proximos` | HU05, HU06 | Próximos eventos. |
| GET | `/api/calendario/:id` | HU05 | Detalle. |
| PUT | `/api/calendario/:id` | HU05 | Actualiza total o parcialmente. |
| DELETE | `/api/calendario/:id` | HU05 | Elimina. |

**Objeto `evento`**

```json
{
  "id": "0b7f9c1e-2d3a-4f5b-8c6d-7e8f9a0b1c2d",
  "usuario_id": "3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01",
  "materia_id": "5c9f2a10-4b7e-4d1a-9f3e-1a2b3c4d5e6f",
  "tarea_id": null,
  "titulo": "Examen parcial",
  "descripcion": "Unidades 1 a 3.",
  "tipo_evento": "examen",
  "fecha_inicio": "2026-11-20T14:00:00.000Z",
  "fecha_fin": "2026-11-20T16:00:00.000Z",
  "recordatorio": 60,
  "fecha_creacion": "2026-11-10T15:00:00.000Z",
  "fecha_actualizacion": null,
  "materias": { "nombre": "Cálculo Diferencial", "codigo": "MAT101", "color": "#3B82F6" }
}
```

- `id`, `usuario_id`, `materia_id` y `tarea_id` son UUID.
- `materia_id` y `tarea_id` son opcionales: `null` cuando el evento no está asociado a una materia o a una tarea.
- `materias` es el resumen embebido de la materia (puede llegar como objeto o como arreglo de un elemento).
- `fecha_inicio` es obligatorio; `fecha_fin` es opcional y `null` significa que el evento no tiene duración definida.
- `recordatorio` se expresa en minutos antes del evento, entero entre 1 y 10080 (7 días); `null` significa sin recordatorio.
- `tipo_evento`: `examen`, `entrega`, `clase`, `estudio`, `personal` u `otro`. Por defecto `otro`.
- `fecha_actualizacion` la mantiene un trigger de la base de datos.

**Filtros de `GET /api/calendario`**

| Parámetro | Tipo | Ejemplo |
|---|---|---|
| `desde` | ISO 8601 (obligatorio) | `?desde=2026-11-01T00:00:00.000Z` |
| `hasta` | ISO 8601 (obligatorio) | `?hasta=2026-11-30T23:59:59.999Z` |
| `materia_id` | UUID | `?materia_id=5c9f2a10-...` |
| `tipo_evento` | `examen` \| `entrega` \| `clase` \| `estudio` \| `personal` \| `otro` | `?tipo_evento=examen` |
| `query` | texto (máx. 200) | `?query=parcial` |
| `sort` | `fecha_inicio` \| `fecha_creacion` \| `titulo` | `?sort=fecha_inicio` |
| `order` | `asc` \| `desc` | `?order=asc` |
| `limit` | entero 1–100 (por defecto 50) | `?limit=50` |
| `offset` | entero ≥ 0 (por defecto 0) | `?offset=50` |

El rango se aplica sobre `fecha_inicio`. La respuesta incluye `meta.paginacion`:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "paginacion": { "limit": 50, "offset": 0, "total": 0 }
  }
}
```

**Body `POST /api/calendario`**

```json
{
  "materia_id": "5c9f2a10-4b7e-4d1a-9f3e-1a2b3c4d5e6f",
  "tarea_id": null,
  "titulo": "Examen parcial",
  "descripcion": "Unidades 1 a 3.",
  "tipo_evento": "examen",
  "fecha_inicio": "2026-11-20T14:00:00.000Z",
  "fecha_fin": "2026-11-20T16:00:00.000Z",
  "recordatorio": 60
}
```

- `titulo`: obligatorio, 3–200 caracteres.
- `descripcion`: opcional, máximo 2000 caracteres.
- `materia_id` y `tarea_id`: opcionales; si se envían deben existir y pertenecer al usuario.
- `fecha_inicio`: obligatoria.
- `fecha_fin`: opcional y no puede ser anterior a `fecha_inicio`.
- `recordatorio`: opcional, entero entre 1 y 10080.
- `POST` responde `201` con el evento creado.

**`GET /api/calendario/proximos`**

Parámetros `dias` (1–30, por defecto 7) y `limit` (1–50, por defecto 10). Devuelve los eventos del usuario con `fecha_inicio` entre ahora y `ahora + dias`, ordenados por inicio ascendente:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "total": 0,
    "rango": {
      "dias": 7,
      "desde": "2026-11-10T15:00:00.000Z",
      "hasta": "2026-11-17T15:00:00.000Z"
    }
  }
}
```

> Esta ruta se declara antes de `/:id` para que `proximos` no se interprete como un identificador. Cuando la función RPC no está disponible, el repositorio usa una consulta directa equivalente y los elementos incluyen el resumen embebido `materias`; con la RPC los datos de la materia llegan aplanados (`materia_nombre`, `materia_codigo`, `materia_color`).

**Reglas**

- `desde` y `hasta` son obligatorios y `desde` no puede ser posterior a `hasta`.
- `fecha_fin` no puede ser anterior a `fecha_inicio`; al actualizar solo una de las dos fechas, el servicio combina la fecha nueva con la almacenada antes de validar.
- `materia_id` y `tarea_id` deben existir y pertenecer al usuario; en caso contrario responde `404`.
- Un evento de otro usuario responde `404`, nunca `403`.
- `PUT /api/calendario/:id` acepta actualización parcial: al menos un campo, y los campos no enviados conservan su valor.
- `DELETE /api/calendario/:id` responde `200` con `{ "id": "<uuid>" }`.
- **Evento automático desde tareas:** al crear o actualizar una tarea con `fecha_entrega`, el backend invoca la función `crear_evento_desde_tarea`, idempotente, que crea o sincroniza un evento tipo `entrega` vinculado a la tarea (`titulo = "Entrega: <título>"`, `fecha_inicio = fecha_entrega`, `fecha_fin = fecha_entrega + 1 h`). Si la tarea se actualiza sin `fecha_entrega` (`null`), se elimina el evento automático asociado. Si la sincronización falla, la tarea ya quedó guardada y el error solo se registra fuera de producción.

## 10. Documentos y biblioteca

| Método | Endpoint | Historia | Descripción |
|---|---|---|---|
| POST | `/api/documentos/url-carga` | HU07 | Devuelve URL prefirmada para subir a S3. |
| POST | `/api/documentos` | HU07 | Registra metadatos tras la subida. |
| GET | `/api/documentos` | HU08 | Lista documentos con filtros. |
| GET | `/api/documentos/:id` | HU08 | Detalle del documento. |
| GET | `/api/documentos/:id/descarga` | HU08 | URL prefirmada de descarga. |
| DELETE | `/api/documentos/:id` | HU08 | Elimina metadatos, fragmentos y objeto S3. |
| POST | `/api/documentos/:id/procesar` | HU09 | Encola el procesamiento. |
| GET | `/api/documentos/:id/estado` | HU09 | Estado del procesamiento. |
| GET | `/api/documentos/buscar` | HU11 | Búsqueda semántica. |

### 10.1. Flujo de carga (HU07)

```text
1. POST /api/documentos/url-carga
2. Angular sube el archivo a la URL devuelta (PUT directo a S3)
3. POST /api/documentos con la clave del objeto
4. PUT de S3 dispara evento a SQS
5. Lambda procesadora actualiza el estado
```

**Body `POST /api/documentos/url-carga`**

```json
{
  "nombre_archivo": "calculo.pdf",
  "tipo_archivo": "application/pdf",
  "tamano": 4823000,
  "materia_id": 1
}
```

**Respuesta**

```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://mingo-documentos.s3.us-east-1.amazonaws.com/...&X-Amz-Expires=900",
    "objectKey": "usuarios/3f2b7e5c.../documentos/1/calculo.pdf",
    "expiresInSeconds": 900,
    "maxSizeBytes": 20971520
  }
}
```

**Reglas**

- Formatos: PDF, DOC, DOCX, PPT, PPTX, TXT.
- Tamaño máximo: 20 MB.
- La URL prefirmada dura 15 minutos.
- La `objectKey` debe empezar con `usuarios/<usuario_id>/`.
- El backend valida tipo y tamaño declarados; Lambda valida el contenido real.

**Body `POST /api/documentos`**

```json
{
  "objectKey": "usuarios/3f2b7e5c.../documentos/1/calculo.pdf",
  "nombre": "Cálculo Diferencial - Unidad 1",
  "materia_id": 1,
  "unidad_id": null
}
```

### 10.2. Estados de procesamiento

| Estado | Significado |
|---|---|
| `pendiente` | Registrado, aún no procesado. |
| `en_cola` | Enviado a SQS. |
| `procesando` | Lambda trabajando. |
| `procesado` | Texto, fragmentos y embeddings listos. |
| `error` | Falló; revisar `motivo_error`. |

### 10.3. Búsqueda semántica (HU11)

```text
GET /api/documentos/buscar?q=derivadas%20de%20funciones&materia_id=1&limit=8
```

**Respuesta**

```json
{
  "success": true,
  "data": [
    {
      "fragmento_id": 1,
      "documento_id": 1,
      "documento_nombre": "Cálculo Diferencial - Unidad 1",
      "contenido": "La derivada de una función mide...",
      "numero_pagina": 12,
      "similitud": 0.87
    }
  ]
}
```

- `limit` máximo: 20.
- Solo devuelve fragmentos de documentos del usuario autenticado.
- Si no hay resultados con similitud suficiente, devuelve `data: []` y un mensaje en `meta`.

## 11. Asistente de IA

| Método | Endpoint | Historia | Descripción |
|---|---|---|---|
| POST | `/api/asistente/chat` | HU12 | Envía un mensaje y recibe respuesta con citas. |
| GET | `/api/asistente/conversaciones` | HU12 | Lista conversaciones. |
| GET | `/api/asistente/conversaciones/:id` | HU12 | Historial de mensajes. |
| DELETE | `/api/asistente/conversaciones/:id` | HU12 | Elimina una conversación. |
| POST | `/api/asistente/resumen` | HU10 | Genera resumen de un documento. |
| POST | `/api/asistente/cuestionario` | HU13 | Genera cuestionario. |
| POST | `/api/asistente/tarjetas` | HU14 | Genera flashcards. |
| POST | `/api/asistente/plan` | HU15 | Propone plan de estudio. |
| POST | `/api/asistente/evaluar` | HU16 | Evalúa respuestas abiertas. |

**Body `POST /api/asistente/chat`**

```json
{
  "conversacion_id": null,
  "mensaje": "Explícame la regla de la cadena con un ejemplo.",
  "materia_id": 1,
  "documento_ids": [1],
  "usar_documentos": true
}
```

**Respuesta `200`**

```json
{
  "success": true,
  "data": {
    "conversacion_id": 1,
    "mensaje_id": 1,
    "respuesta": "La regla de la cadena permite derivar funciones compuestas...",
    "modelo": "gpt-4o-mini",
    "referencias": [
      {
        "documento_id": 1,
        "documento_nombre": "Cálculo Diferencial - Unidad 1",
        "fragmento_id": 1,
        "numero_pagina": 12,
        "extracto": "Si f y g son diferenciables..."
      }
    ],
    "consumo": {
      "tokens_entrada": 1820,
      "tokens_salida": 340
    }
  }
}
```

**Reglas**

- `mensaje`: 1–4000 caracteres.
- El agente solo usa documentos del usuario autenticado.
- Si no hay contexto suficiente, debe decirlo explícitamente; no inventar.
- Se aplica cuota por usuario (ver [ia-rag.md](ia-rag.md)).
- Si se agota la cuota: `429 RATE_LIMITED` con `error.code = "AI_QUOTA_EXCEEDED"`.

**Body `POST /api/asistente/resumen`**

```json
{
  "documento_id": 1,
  "profundidad": "media",
  "guardar": true
}
```

`profundidad`: `breve` \| `media` \| `detallada`.

**Body `POST /api/asistente/cuestionario`**

```json
{
  "materia_id": 1,
  "documento_id": null,
  "cantidad_preguntas": 10,
  "dificultad": "intermedia",
  "tipos": ["opcion_multiple", "verdadero_falso"]
}
```

Límites: 5–20 preguntas, 2–4 opciones por pregunta.

**Body `POST /api/asistente/tarjetas`**

```json
{
  "documento_id": 1,
  "cantidad": 15
}
```

**Body `POST /api/asistente/plan`**

```json
{
  "materia_id": 1,
  "objetivo": "Prepararme para el examen parcial",
  "fecha_examen": "2026-11-20",
  "minutos_por_dia": 90,
  "dias_disponibles": ["lunes", "miercoles", "viernes"]
}
```

**Body `POST /api/asistente/evaluar`**

```json
{
  "intento_id": 1,
  "pregunta_id": 1,
  "respuesta": "Texto de la respuesta abierta",
  "criterios": ["claridad", "precisión conceptual"]
}
```

## 12. Estudio, planes y progreso

| Método | Endpoint | Historia | Descripción |
|---|---|---|---|
| GET | `/api/estudio/planes` | HU15 | Lista planes. |
| POST | `/api/estudio/planes` | HU15 | Crea un plan confirmado. |
| GET | `/api/estudio/planes/:id` | HU15 | Detalle con sesiones. |
| PUT | `/api/estudio/planes/:id` | HU15 | Actualiza el plan. |
| DELETE | `/api/estudio/planes/:id` | HU15 | Elimina el plan. |
| POST | `/api/estudio/planes/:id/sesiones` | HU15 | Agrega una sesión. |
| PATCH | `/api/estudio/sesiones/:id` | HU15 | Cambia estado o fecha. |
| GET | `/api/estudio/progreso` | HU17 | Estadísticas del usuario. |
| GET | `/api/estudio/objetivos` | HU17 | Lista objetivos. |
| POST | `/api/estudio/objetivos` | HU17 | Crea objetivo. |
| PUT | `/api/estudio/objetivos/:id` | HU17 | Actualiza objetivo. |
| DELETE | `/api/estudio/objetivos/:id` | HU17 | Elimina objetivo. |

**Respuesta `GET /api/estudio/progreso`**

```json
{
  "success": true,
  "data": {
    "materias_activas": 5,
    "tareas_pendientes": 12,
    "tareas_completadas": 30,
    "cumplimiento_tareas": 0.71,
    "sesiones_completadas": 18,
    "cuestionarios_completados": 6,
    "promedio_cuestionarios": 78.5,
    "objetivos_activos": 3,
    "racha_dias": 4
  }
}
```

## 13. Notificaciones

| Método | Endpoint | Historia | Descripción |
|---|---|---|---|
| GET | `/api/notificaciones` | HU18 | Lista notificaciones. |
| PATCH | `/api/notificaciones/:id/leida` | HU18 | Marca como leída. |
| PATCH | `/api/notificaciones/leer-todas` | HU18 | Marca todas como leídas. |
| GET | `/api/notificaciones/preferencias` | HU18 | Consulta preferencias. |
| PUT | `/api/notificaciones/preferencias` | HU18 | Actualiza preferencias. |

**Filtros:** `leida=true|false`, `tipo`, `page`, `limit`.

**Body `PUT /api/notificaciones/preferencias`**

```json
{
  "notificaciones_activas": true,
  "anticipacion_minutos": 60,
  "canal_email": true,
  "zona_horaria": "America/Bogota",
  "idioma": "es"
}
```

## 14. Administración

Todos requieren rol `administrador`.

| Método | Endpoint | Descripción |
|---|---|---|
| GET | `/api/admin/usuarios` | Lista usuarios con búsqueda y paginación. |
| GET | `/api/admin/usuarios/:id` | Detalle de un usuario. |
| PATCH | `/api/admin/usuarios/:id/estado` | Activa o desactiva una cuenta. |
| PATCH | `/api/admin/usuarios/:id/roles` | Asigna roles. |
| GET | `/api/admin/estadisticas` | Métricas generales agregadas. |
| GET | `/api/admin/auditoria` | Registro de operaciones administrativas. |
| GET | `/api/admin/configuracion-ia` | Límites de IA por rol o usuario. |
| PUT | `/api/admin/configuracion-ia` | Actualiza límites de IA. |

**Body `PATCH /api/admin/usuarios/:id/estado`**

```json
{ "estado": "inactivo" }
```

**Body `PATCH /api/admin/usuarios/:id/roles`**

```json
{ "roles": ["estudiante"] }
```

**Reglas**

- Un administrador **no** puede desactivarse ni quitarse su propio rol.
- El administrador **no** recibe acceso a documentos, conversaciones ni contenido privado de estudio.
- Las estadísticas son agregadas; no incluyen texto de documentos.
- Toda operación administrativa se registra en auditoría.

## 15. Salud del servicio

### `GET /api/health`

No requiere autenticación.

```json
{
  "success": true,
  "data": {
    "service": "MINGO API",
    "status": "ok",
    "environment": "development",
    "uptimeSeconds": 42,
    "timestamp": "2026-11-07T18:30:00.000Z"
  }
}
```

> No debe exponer versiones, rutas internas, variables de entorno ni estado detallado de dependencias.

## 16. Paginación, orden y filtros

- `page`: entero ≥ 1, por defecto 1 (módulos con paginación por páginas).
- `limit`: entero entre 1 y 50, por defecto 20.
- `offset`: entero ≥ 0, por defecto 0 (HU03, HU04 y HU05 paginan con `limit` + `offset` y devuelven `meta.paginacion`).
- `sort`: campo permitido por módulo, por defecto `fecha_creacion`.
- `order`: `asc` \| `desc`, por defecto `desc`.
- Los campos de ordenamiento se validan contra una lista blanca; nunca se interpolan en SQL.

Ejemplo:

```text
GET /api/tareas?estado=pendiente&prioridad=alta&sort=fecha_entrega&order=asc&limit=20&offset=0
```

## 17. Idempotencia

- `POST /api/documentos/:id/procesar` es idempotente: si el documento ya está `procesado`, responde `200` con el estado actual.
- `POST /api/asistente/chat` acepta `Idempotency-Key` opcional para evitar respuestas duplicadas por reintentos.
- Los reintentos desde Angular deben usar el mismo `Idempotency-Key`.

## 18. Rate limiting

- Límite global: 300 solicitudes cada 15 minutos por IP y usuario (configurable).
- Endpoints de IA: límite propio y más estricto.
- Respuesta al exceder:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Has alcanzado el límite de solicitudes. Intenta de nuevo en unos minutos.",
    "details": []
  }
}
```

Cabeceras recomendadas:

```text
Retry-After: 60
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 0
```

## 19. Versionado

- El prefijo `/api` es estable.
- Cambios incompatibles requieren `/api/v2` y periodo de convivencia.
- Los campos nuevos son opcionales y no rompen clientes.
- No se renombran campos existentes sin versión nueva.

## 20. Checklist al crear un endpoint

- [ ] Ruta registrada en `routes/` y montada en `routes/index.js`.
- [ ] Middleware de autenticación aplicado.
- [ ] Middleware de rol si corresponde.
- [ ] Esquema Zod de entrada y salida.
- [ ] Controlador delgado, lógica en el servicio.
- [ ] Repository filtra por `usuario_id`.
- [ ] Paginación y límites aplicados.
- [ ] Códigos de error correctos.
- [ ] Prueba con Supertest.
- [ ] Documentado en este archivo.
