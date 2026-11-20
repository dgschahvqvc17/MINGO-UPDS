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

> En la carga de documentos (HU07) el formato y el tamaño se validan con Zod y,
> si no cumplen, la respuesta es `400`; la implementación actual no usa `413` ni `415`.

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
| DELETE | `/api/documentos/:id` | HU08 | Elimina el objeto S3 y los metadatos. |
| POST | `/api/documentos/:id/procesar` | HU09 | Encola el procesamiento. |
| GET | `/api/documentos/:id/estado` | HU09 | Estado del procesamiento. |
| GET | `/api/documentos/buscar` | HU11 | Búsqueda semántica. |

### 10.1. Flujo de carga (HU07)

```text
1. POST /api/documentos/url-carga
2. Angular sube el archivo a la URL devuelta (PUT directo a S3)
3. POST /api/documentos con la clave del objeto
4. PUT de S3 dispara evento a SQS (se activa con HU09)
5. Lambda procesadora actualiza el estado
```

**Body `POST /api/documentos/url-carga`**

```json
{
  "nombre_archivo": "calculo.pdf",
  "tipo_archivo": "application/pdf",
  "tamano": 4823000,
  "materia_id": "6d1c2a53-4f7e-4b8a-9c1d-2e3f4a5b6c7d"
}
```

**Respuesta**

```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://mingo-documentos-dev-591015654164.s3.us-east-1.amazonaws.com/...&X-Amz-Expires=900",
    "objectKey": "usuarios/3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01/documentos/9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d/calculo.pdf",
    "expiresInSeconds": 900,
    "maxSizeBytes": 20971520
  }
}
```

**Reglas**

- Formatos: PDF, DOCX, PPTX, TXT. La extensión debe coincidir con el `tipo_archivo` declarado.
- Tamaño máximo: 20 MB.
- `materia_id` es un UUID y debe pertenecer al usuario autenticado; si no, la respuesta es `404`.
- La URL prefirmada dura 15 minutos.
- La `objectKey` debe empezar con `usuarios/<usuario_id>/documentos/<uuid>/`; el servidor la genera, el cliente no la elige.
- El backend valida tipo y tamaño declarados; al registrar se vuelven a validar contra el objeto real de S3.
- Si S3 no está configurado, la respuesta es `503`.

**Body `POST /api/documentos`**

```json
{
  "objectKey": "usuarios/3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01/documentos/9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d/calculo.pdf",
  "nombre": "Cálculo Diferencial - Unidad 1",
  "materia_id": "6d1c2a53-4f7e-4b8a-9c1d-2e3f4a5b6c7d",
  "unidad_id": null
}
```

- El tamaño y el tipo se leen de S3 (`HEAD`); no se confía en el cliente.
- `unidad_id` es opcional y queda en `null` hasta que exista HU03 (tabla `unidades`).
- Si el objeto no existe en S3: `400`. Si la clave no es del usuario: `403`. Si ya estaba registrado: `409`.
- La respuesta es `201` con el documento registrado en estado `pendiente`.

### 10.2. Listado y filtros (HU08)

```text
GET /api/documentos?materia_id=6d1c2a53-4f7e-4b8a-9c1d-2e3f4a5b6c7d&q=calculo&estado=procesado&limit=12&offset=0
```

**Respuesta `200`**

```json
{
  "success": true,
  "data": [
    {
      "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
      "usuario_id": "3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01",
      "materia_id": "6d1c2a53-4f7e-4b8a-9c1d-2e3f4a5b6c7d",
      "unidad_id": null,
      "nombre": "Cálculo Diferencial - Unidad 1",
      "nombre_archivo": "calculo.pdf",
      "ruta_almacenamiento": "usuarios/3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01/documentos/9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d/calculo.pdf",
      "tipo_archivo": "application/pdf",
      "tamano": 4823000,
      "estado_procesamiento": "procesado",
      "motivo_error": null,
      "numero_paginas": 24,
      "fecha_carga": "2026-11-12T10:00:00.000Z",
      "fecha_actualizacion": "2026-11-12T10:02:00.000Z",
      "materias": { "nombre": "Cálculo", "codigo": "MAT101", "color": "#3B82F6" }
    }
  ],
  "meta": {
    "paginacion": { "limit": 12, "offset": 0, "total": 1 }
  }
}
```

**Parámetros**

| Parámetro | Tipo | Regla |
|---|---|---|
| `materia_id` | UUID | Opcional. Filtra por materia del usuario. |
| `q` | Texto | Opcional, máximo 120 caracteres. Busca por `nombre` sin distinguir mayúsculas. |
| `estado` | Enum | Opcional. Uno de `pendiente`, `en_cola`, `procesando`, `procesado`, `error`. |
| `limit` | Entero | 1–100, por defecto 20. |
| `offset` | Entero | ≥ 0, por defecto 0. |

**Reglas**

- RLS y filtro explícito por `usuario_id`: el listado solo devuelve documentos del usuario autenticado.
- Orden: `fecha_carga` descendente (el más reciente primero).
- `q` se sanea antes de la consulta (se descartan comas, paréntesis, `%` y `_`) para no alterar el filtro.
- Un `estado` fuera de la lista cerrada responde `400`.

### 10.3. Detalle, descarga y eliminación (HU08)

**`GET /api/documentos/:id`**

Devuelve el documento con el resumen de su materia embebido (`materias`). Un documento de otro usuario o inexistente responde `404` para no revelar su existencia. Un identificador que no es UUID responde `400`.

**`GET /api/documentos/:id/descarga`**

```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://mingo-documentos-dev-591015654164.s3.us-east-1.amazonaws.com/...&X-Amz-Expires=900",
    "nombreArchivo": "calculo.pdf",
    "tipoArchivo": "application/pdf",
    "expiresInSeconds": 900
  }
}
```

- Verifica con `HEAD` que el objeto siga en S3 antes de firmar; si ya no está, responde `404`.
- La URL fuerza la descarga con el nombre original (`Content-Disposition`) y dura 15 minutos.
- El documento debe pertenecer al usuario (`404` en caso contrario).
- Si S3 no está configurado, responde `503`.

**`DELETE /api/documentos/:id`**

```json
{
  "success": true,
  "message": "Documento eliminado exitosamente.",
  "data": { "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d" }
}
```

- Elimina primero el objeto de S3 (tolerando que ya no exista) y después la fila.
- Un documento ajeno o inexistente responde `404`; si la fila desaparece entre la lectura y el borrado, también `404`.
- Si S3 no está configurado, responde `503` y no borra metadatos.

### 10.4. Estados de procesamiento

| Estado | Significado |
|---|---|
| `pendiente` | Registrado, aún no procesado. |
| `en_cola` | Enviado a SQS. |
| `procesando` | Lambda trabajando. |
| `procesado` | Texto, fragmentos y embeddings listos. |
| `error` | Falló; revisar `motivo_error`. |

### 10.5. Procesamiento de documentos (HU09)

**`POST /api/documentos/:id/procesar`**

Encola el documento en SQS. La API no procesa el archivo: responde `202` y el
trabajo real lo ejecuta la Lambda procesadora.

**Respuesta `202`**

```json
{
  "success": true,
  "message": "Documento encolado para procesamiento.",
  "data": { "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d", "estado": "en_cola" }
}
```

**Reglas**

- Un documento ajeno o inexistente responde `404`; un identificador que no es UUID responde `400`.
- Si el documento está en `en_cola` o `procesando` responde `409` para evitar un doble trabajo, **salvo** que haya quedado atascado: sin actualizaciones durante 15 minutos se considera abandonado y se reencola (`202`).
- El reencolado de un documento atascado es condicional: si otro proceso lo actualizó entre la lectura y la escritura, responde `409` en lugar de pisarlo.
- Si la cola no está configurada o no responde, responde `503` y no cambia el estado.
- Los estados `pendiente`, `procesado` y `error` se pueden encolar; el reproceso de un documento ya procesado también responde `202` y vuelve a `en_cola`.
- Al registrar un documento, si la cola está disponible se encola automáticamente; si falla, el registro sigue siendo válido y el usuario puede reintentar con este endpoint.

**`GET /api/documentos/:id/estado`**

**Respuesta `200`**

```json
{
  "success": true,
  "data": {
    "id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
    "estado_procesamiento": "procesado",
    "motivo_error": null,
    "numero_paginas": 24,
    "fecha_actualizacion": "2026-11-14T10:02:00.000Z"
  }
}
```

- Un documento ajeno o inexistente responde `404`.
- El frontend consulta este endpoint mientras el estado es `en_cola` o `procesando`.
- Los errores permanentes se guardan en `error` con `motivo_error`. Un fallo temporal (red, cuota del proveedor de IA, almacenamiento no disponible) devuelve el documento a `en_cola` sin `motivo_error` y relanza el error para que SQS lo reintente.
- Si SQS agota los reintentos (`maxReceiveCount = 3`), el mensaje pasa a la DLQ y el documento queda en `en_cola`; tras 15 minutos el usuario puede reencolarlo con `POST /:id/procesar`.
- El worker recupera un documento que sigue en `en_cola` o `procesando` cuando SQS lo entrega de nuevo (`ApproximateReceiveCount > 1`) o cuando detecta que está atascado.
- Reemplazo de fragmentos: los nuevos se insertan con `numero_fragmento` desplazado y la función `public.confirmar_reemplazo_fragmentos` borra los anteriores y renumera en una sola transacción. Si el reemplazo falla, el documento conserva sus fragmentos previos y el fallo se registra como `error` (permanente) o `en_cola` (temporal).

### 10.6. Búsqueda semántica (HU11)

```text
GET /api/documentos/buscar?q=derivadas%20de%20funciones&materia_id=6d1c2a53-4f7e-4b8a-9c1d-2e3f4a5b6c7d&limit=8
```

**Query params**

| Parámetro | Tipo | Regla |
|---|---|---|
| `q` | string | Obligatorio, 2 a 120 caracteres. Pregunta o concepto a buscar. |
| `materia_id` | UUID | Opcional. Limita la búsqueda a una materia propia. |
| `documento_id` | UUID | Opcional. Limita la búsqueda a un documento propio y procesado. |
| `limit` | entero | Opcional, por defecto `8`. Se recorta a `20` si se envía un valor mayor. |

**Respuesta**

```json
{
  "success": true,
  "data": [
    {
      "fragmento_id": "5f1c9e2a-8b7d-4c3e-9a1f-2e4d6b8c0a13",
      "documento_id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
      "documento_nombre": "Cálculo Diferencial - Unidad 1",
      "contenido": "La derivada de una función mide...",
      "numero_pagina": 12,
      "similitud": 0.87
    }
  ],
  "meta": { "mensaje": null }
}
```

- Requiere la migración `supabase/migrations/0008_hu11_busqueda_semantica.sql` (RPC `match_fragmentos`).
- Solo devuelve fragmentos de documentos del usuario autenticado; la RPC filtra por `auth.uid()` y se usa el cliente JWT, nunca `service_role`.
- Umbral de similitud coseno: `0.55`, calibrado para `gemini-embedding-001`. Los resultados se ordenan de mayor a menor similitud.
- Si no hay resultados con similitud suficiente, devuelve `data: []` y un mensaje orientativo en `meta.mensaje`.
- Errores: `400` validación, `404` documento o materia ajena, `422` documento no procesado, `429` cuota agotada (`AI_QUOTA_EXCEEDED`, 50 búsquedas/día), `503` IA no configurada.

## 11. Asistente de IA

| Método | Endpoint | Historia | Descripción |
|---|---|---|---|
| POST | `/api/asistente/chat` | HU12 | Envía un mensaje y recibe respuesta con citas. |
| GET | `/api/asistente/conversaciones` | HU12 | Lista conversaciones. |
| GET | `/api/asistente/conversaciones/:id` | HU12 | Historial de mensajes. |
| DELETE | `/api/asistente/conversaciones/:id` | HU12 | Elimina una conversación. |
| POST | `/api/asistente/resumen` | HU10 | Genera resumen de un documento. |
| GET | `/api/asistente/resumen/:documento_id` | HU10 | Recupera el último resumen guardado del documento. |
| POST | `/api/asistente/cuestionario` | HU13 | Genera y guarda un cuestionario. |
| GET | `/api/asistente/cuestionarios` | HU13 | Lista los cuestionarios propios. |
| GET | `/api/asistente/cuestionarios/:id` | HU13 | Detalle con preguntas e intentos. |
| DELETE | `/api/asistente/cuestionarios/:id` | HU13 | Elimina un cuestionario propio. |
| POST | `/api/asistente/cuestionarios/:id/intentos` | HU13 | Inicia un intento del cuestionario. |
| GET | `/api/asistente/intentos/:id` | HU13 | Devuelve el intento con sus respuestas. |
| POST | `/api/asistente/intentos/:id/responder` | HU13 | Registra respuestas y finaliza el intento. |
| POST | `/api/asistente/tarjetas` | HU14 | Genera y guarda un conjunto de tarjetas. |
| GET | `/api/asistente/tarjetas/conjuntos` | HU14 | Lista los conjuntos propios. |
| GET | `/api/asistente/tarjetas/conjuntos/:id` | HU14 | Detalle con tarjetas y filtro `estado`. |
| DELETE | `/api/asistente/tarjetas/conjuntos/:id` | HU14 | Elimina un conjunto propio. |
| PATCH | `/api/asistente/tarjetas/:id/estado` | HU14 | Registra el avance de estudio de una tarjeta. |
| POST | `/api/asistente/plan` | HU15 | Propone plan de estudio. |
| POST | `/api/asistente/evaluar` | HU16 | Evalúa respuestas abiertas. |

**Body `POST /api/asistente/chat`**

```json
{
  "conversacion_id": null,
  "mensaje": "Explícame la regla de la cadena con un ejemplo.",
  "materia_id": null,
  "documento_ids": ["9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d"],
  "usar_documentos": true
}
```

`conversacion_id` y `materia_id` son UUID o `null`; `documento_ids` es una lista
de como máximo 5 UUID. `usar_documentos` vale `true` por defecto.

La cabecera opcional `Idempotency-Key` permite reintentar la misma solicitud sin
crear turnos duplicados. Si se envía, debe tener entre 8 y 100 caracteres y solo
admite letras, números y `. _ : -`. Un reintento con la misma clave y el mismo
cuerpo devuelve la respuesta original; la misma clave con otro cuerpo responde
`409`. Ver la sección 17.

**Respuesta `200`**

```json
{
  "success": true,
  "data": {
    "conversacion_id": "c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
    "mensaje_id": "f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f",
    "respuesta": "La regla de la cadena permite derivar funciones compuestas...",
    "modelo": "gpt-4o-mini",
    "referencias": [
      {
        "documento_id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
        "documento_nombre": "Cálculo Diferencial - Unidad 1",
        "fragmento_id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
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

Cuando `usar_documentos` es `true` y no hay fragmentos sobre el umbral, la
respuesta usa `MENSAJE_SIN_INFORMACION`, `modelo: null` y `referencias: []`: no se
llama al proveedor de IA ni se inventa contenido. Con `usar_documentos: false`
se responde desde conocimiento general sin citas.

**Reglas**

- `mensaje`: 1–4000 caracteres; todos los identificadores son UUID.
- El agente solo usa documentos del usuario autenticado; un recurso ajeno responde `404`.
- Se conservan hasta 6 turnos previos para preguntas de seguimiento.
- Si no hay contexto suficiente, debe decirlo explícitamente; no inventar.
- Se aplica cuota por usuario: 30 mensajes/hora y 200/día (ver [ia-rag.md](ia-rag.md)).
- Si se agota la cuota: `429` con `error.details.code = "AI_QUOTA_EXCEEDED"`.
- Fallos del proveedor de IA o embeddings: `503` con mensaje claro.

**`GET /api/asistente/conversaciones`**

Acepta `limit` (1–100, por defecto 20) y `offset` (por defecto 0). Devuelve
`data` con `id`, `titulo`, `tipo_conversacion`, `fecha_creacion` y
`fecha_actualizacion`, más `meta` con `page`, `limit`, `total` y `totalPages`.

**`GET /api/asistente/conversaciones/:id`**

Devuelve la conversación propia con `mensajes`. Cada mensaje incluye
`rol_mensaje` (`user`, `assistant` o `system`), `contenido`, `modelo_utilizado`,
`fecha_creacion` y `referencias`. Un ID inválido responde `400`; uno ajeno o
inexistente, `404`.

**`DELETE /api/asistente/conversaciones/:id`**

Elimina la conversación propia y, en cascada, sus mensajes y referencias.
Devuelve `data: { "id": "<uuid>" }`. Un ID ajeno o inexistente responde `404`.

**Body `POST /api/asistente/resumen`**

```json
{
  "documento_id": 1,
  "profundidad": "media",
  "guardar": true
}
```

`profundidad`: `breve` \| `media` \| `detallada` (por defecto `media`). `guardar`:
`true` por defecto; con `false` se devuelve el resumen sin persistirlo. Los
identificadores de documento son UUID.

**Respuesta `200`**

```json
{
  "success": true,
  "data": {
    "id": "9f1c...",
    "documento_id": "9a8b...",
    "documento_nombre": "Cálculo Diferencial - Unidad 1",
    "profundidad": "media",
    "resumen_general": "El documento introduce el concepto de derivada...",
    "temas_principales": ["Derivadas", "Regla de la cadena"],
    "conceptos_importantes": [
      { "termino": "Derivada", "descripcion": "Mide la tasa de cambio de una función." }
    ],
    "modelo": "gpt-4o-mini",
    "tokens_entrada": 1820,
    "tokens_salida": 340,
    "contenido_truncado": false,
    "guardado": true,
    "reutilizado": false,
    "fecha_creacion": "2026-11-18T18:30:00.000Z"
  }
}
```

**Reglas**

- Solo se resume un documento en estado `procesado`; si no lo está: `422 UNPROCESSABLE_ENTITY`.
- El resumen se cachea por `documento_id` + hash del contenido + `profundidad`;
  un acierto devuelve `reutilizado: true` sin consumir cuota ni llamar a la IA.
- Cuando el documento supera el presupuesto de tokens se resume la parte inicial
  y `contenido_truncado` es `true`.
- Cuota: 20 resúmenes por usuario y día. Al agotarla: `429` con
  `error.details.code = "AI_QUOTA_EXCEEDED"`.
- Proveedor de IA no configurado o con error: `503 SERVICE_UNAVAILABLE` con
  mensaje claro, sin exponer detalles del SDK.
- `GET /api/asistente/resumen/:documento_id` devuelve el último resumen guardado,
  o `data: null` si el documento aún no tiene resumen. Un documento ajeno o
  inexistente responde `404`.

**Body `POST /api/asistente/cuestionario`**

```json
{
  "materia_id": "3f6a1c9e-8b2d-4f5a-9c7e-1d2b3a4c5e6f",
  "documento_id": null,
  "cantidad_preguntas": 10,
  "dificultad": "intermedia",
  "tipos": ["opcion_multiple", "verdadero_falso", "abierta"]
}
```

- `materia_id`: UUID obligatorio y propio del usuario.
- `documento_id`: UUID opcional. Si se omite, se usan los fragmentos de todos
  los documentos procesados de la materia; si no hay material, responde `422`.
- `cantidad_preguntas`: 5–20 (por defecto 10).
- `dificultad`: `basica` \| `intermedia` \| `avanzada` (por defecto `intermedia`).
- `tipos`: 1–3 valores entre `opcion_multiple`, `verdadero_falso` y `abierta`,
  sin repetir (por defecto los tres).

La generación se apoya en los fragmentos de los documentos procesados del
usuario, aplica cuota de 10 cuestionarios por día y registra el consumo en
`consumo_ia` con `operacion = 'cuestionario'`. Si se agota: `429` con
`error.details.code = "AI_QUOTA_EXCEEDED"`. Un fallo del proveedor responde
`503` y un cuestionario inválido descartado por el modelo, `422`.

**Respuesta `201`**

```json
{
  "success": true,
  "data": {
    "id": "8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
    "usuario_id": "c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
    "materia_id": "3f6a1c9e-8b2d-4f5a-9c7e-1d2b3a4c5e6f",
    "materia_nombre": "Cálculo Diferencial",
    "documento_id": null,
    "titulo": "Cuestionario de Cálculo Diferencial",
    "dificultad": "intermedia",
    "cantidad_preguntas": 10,
    "tipos": ["opcion_multiple", "abierta"],
    "modelo": "gemini-3.5-flash-lite",
    "tokens_entrada": 2400,
    "tokens_salida": 900,
    "fecha_creacion": "2026-11-19T18:30:00.000Z",
    "preguntas": [
      {
        "id": "9b8c7d6e-5f4a-4b3c-8d2e-1f0a9b8c7d6e",
        "cuestionario_id": "8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
        "orden": 1,
        "enunciado": "¿Qué mide la derivada de una función?",
        "tipo_pregunta": "opcion_multiple",
        "opciones": [
          { "id": "a1b2...", "contenido": "La tasa de cambio instantánea.", "orden": 1 },
          { "id": "b2c3...", "contenido": "El área bajo la curva.", "orden": 2 }
        ],
        "respuesta_usuario": null,
        "es_correcta": null
      }
    ]
  }
}
```

`respuesta_correcta`, `es_correcta` y `explicacion` no se exponen al generar ni
al consultar un cuestionario: solo aparecen en el resultado cuando el intento
está `finalizado`.

**`GET /api/asistente/cuestionarios`**

Acepta `limit` (1–50, por defecto 20) y `offset` (por defecto 0). Devuelve
`data` con el resumen de cada cuestionario (sin preguntas) y `meta` con `page`,
`limit`, `total` y `totalPages`.

**`GET /api/asistente/cuestionarios/:id`**

Devuelve el cuestionario propio con `preguntas`, sus `opciones` y el historial
de `intentos`. Un ID inválido responde `400`; uno ajeno o inexistente, `404`.

**`DELETE /api/asistente/cuestionarios/:id`**

Elimina el cuestionario propio y, en cascada, sus preguntas, opciones, intentos
y respuestas. Responde `data: { "id": "<uuid>" }`; un ID ajeno o inexistente
devuelve `404`.

**`POST /api/asistente/cuestionarios/:id/intentos`**

Crea un intento en estado `en_progreso` y devuelve `intento` y `cuestionario`
con sus preguntas, sin revelar la corrección. Un cuestionario sin preguntas
responde `422`.

**`GET /api/asistente/intentos/:id`**

Devuelve `intento`, `cuestionario` y `preguntas`. Mientras el intento sigue
`en_progreso` no se revelan `respuesta_correcta`, `explicacion` ni
`es_correcta`; al estar `finalizado` sí. Un intento ajeno responde `404`.

**Body `POST /api/asistente/intentos/:id/responder`**

```json
{
  "respuestas": [
    { "pregunta_id": "9b8c7d6e-5f4a-4b3c-8d2e-1f0a9b8c7d6e", "respuesta": "La tasa de cambio instantánea." }
  ]
}
```

Registra las respuestas, corrige de forma determinista las preguntas objetivas
(comparando el texto normalizado con `respuesta_correcta`) y finaliza el
intento. Las preguntas `abierta` quedan con `es_correcta: null` hasta la
evaluación de HU16. La `puntuacion` es el porcentaje de aciertos sobre las
preguntas objetivas y es `null` si no hay objetivas. Un intento ya finalizado
responde `409`; una pregunta que no pertenece al cuestionario, `400`.

**Respuesta `200` de `responder` y `GET /intentos/:id` (finalizado)**

```json
{
  "success": true,
  "data": {
    "intento": {
      "id": "d4e5f6a7-b8c9-4d0e-8f1a-2b3c4d5e6f7a",
      "estado": "finalizado",
      "total_preguntas": 10,
      "preguntas_objetivas": 7,
      "respuestas_correctas": 5,
      "puntuacion": 71.43,
      "fecha_inicio": "2026-11-19T19:00:00.000Z",
      "fecha_finalizacion": "2026-11-19T19:12:00.000Z"
    },
    "cuestionario": { "id": "8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d", "titulo": "Cuestionario de Cálculo Diferencial" },
    "preguntas": [
      {
        "id": "9b8c7d6e-5f4a-4b3c-8d2e-1f0a9b8c7d6e",
        "tipo_pregunta": "opcion_multiple",
        "enunciado": "¿Qué mide la derivada de una función?",
        "opciones": [
          { "id": "a1b2...", "contenido": "La tasa de cambio instantánea.", "es_correcta": true }
        ],
        "respuesta_usuario": "La tasa de cambio instantánea.",
        "es_correcta": true,
        "respuesta_correcta": "La tasa de cambio instantánea.",
        "explicacion": "La derivada describe cómo cambia la función en un punto."
      }
    ]
  }
}
```

**Notas de idempotencia**

`POST /api/asistente/chat` acepta la cabecera opcional `Idempotency-Key`; el
resto de endpoints de IA no la usan. Ver la sección 17.

**Body `POST /api/asistente/tarjetas`**

```json
{
  "materia_id": "3f6a1c9e-8b2d-4f5a-9c7e-1d2b3a4c5e6f",
  "documento_id": "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d",
  "cantidad_tarjetas": 10
}
```

`materia_id` es obligatorio. `documento_id` es opcional: si se omite o es `null`,
se usan los fragmentos de todos los documentos procesados de la materia. La
cantidad va de 5 a 30 (por defecto `10`). Un documento ajeno responde `404` y la
falta de material procesado responde `422`.

**Respuesta `201`**

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
    "usuario_id": "c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
    "materia_id": "3f6a1c9e-8b2d-4f5a-9c7e-1d2b3a4c5e6f",
    "materia_nombre": "Cálculo Diferencial",
    "documento_id": null,
    "titulo": "Tarjetas de Cálculo Diferencial",
    "cantidad_tarjetas": 5,
    "cantidad_conocidas": 0,
    "cantidad_pendientes": 5,
    "modelo": "gemini-3.5-flash-lite",
    "tokens_entrada": 2400,
    "tokens_salida": 600,
    "fecha_creacion": "2026-11-19T20:00:00.000Z",
    "tarjetas": [
      {
        "id": "9b8c7d6e-5f4a-4b3c-8d2e-1f0a9b8c7d6e",
        "conjunto_id": "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "orden": 1,
        "frente": "¿Qué mide la derivada?",
        "reverso": "La tasa de cambio instantánea.",
        "estado": "sin_revisar",
        "fecha_actualizacion": "2026-11-19T20:00:00.000Z"
      }
    ]
  }
}
```

**`GET /api/asistente/tarjetas/conjuntos`**

Acepta `limit` (1–50, por defecto 20) y `offset` (por defecto 0). Devuelve
resúmenes sin tarjetas y `meta` con `page`, `limit`, `total` y `totalPages`.

**`GET /api/asistente/tarjetas/conjuntos/:id`**

Acepta `estado=todas|pendientes` (por defecto `todas`). Devuelve el conjunto
propio con sus tarjetas ordenadas por `orden`; `pendientes` excluye las marcadas
`conocida`. Un ID inválido responde `400`; uno ajeno o inexistente, `404`.

**`PATCH /api/asistente/tarjetas/:id/estado`**

```json
{ "estado": "conocida" }
```

Estados permitidos: `sin_revisar`, `conocida` y `repaso`. Devuelve la tarjeta
actualizada; una tarjeta ajena responde `404`.

**`DELETE /api/asistente/tarjetas/conjuntos/:id`**

Elimina el conjunto y sus tarjetas en cascada. Responde
`data: { "id": "<uuid>" }`; un ID ajeno o inexistente devuelve `404`.

Cuota: 10 generaciones por usuario y día, registradas en `consumo_ia` con
`operacion = 'tarjeta'` (`429 AI_QUOTA_EXCEEDED`). La interfaz está en
`/tarjetas-memoria`.

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

- `POST /api/documentos/:id/procesar` no es idempotente: cada llamada aceptada encola un trabajo nuevo y responde `202`. Mientras el documento está `en_cola` o `procesando` responde `409` y no duplica el trabajo. Un documento ya `procesado` se puede reprocesar y vuelve a `en_cola`.
- `POST /api/asistente/chat` acepta la cabecera opcional `Idempotency-Key`. La
  cabecera no es obligatoria: sin ella el comportamiento es el anterior.
- La clave se guarda por usuario y endpoint en `solicitudes_idempotentes` con la
  huella SHA-256 del cuerpo normalizado (`conversacion_id`, `mensaje`,
  `materia_id`, `documento_ids` y `usar_documentos`).
- Comportamiento:
  - Primera solicitud: se reserva la clave, se procesa el mensaje y se guarda la
    respuesta `200` con estado `completado`.
  - Reintento con la misma clave y la misma huella: se replica la respuesta
    guardada sin llamar a la IA ni crear turnos nuevos.
  - Misma clave con otra huella: `409`.
  - Misma clave mientras la primera solicitud sigue en curso: `409` con un
    mensaje para esperar la respuesta.
  - Si el procesamiento falla, la reserva se libera y el cliente puede
    reintentar con la misma clave.
- Validación: 8–100 caracteres y solo letras, números y `. _ : -`. Una clave
  inválida responde `400` con `error.details.source = "headers"`.
- Las claves se purgan de forma oportunista después de 24 horas, en la siguiente
  solicitud del mismo usuario al endpoint.
- El frontend genera una clave por mensaje y la reutiliza mientras el envío
  permanezca pendiente; si cambia el contenido, genera una clave nueva.
- DDL: `supabase/migrations/0011_hu12_idempotencia_chat.sql` (idempotente).

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

## 21. Panel principal académico (HU06)

El panel entrega en una sola respuesta los datos que el estudiante necesita al iniciar sesión. Todas las consultas usan el cliente de Supabase del usuario autenticado, por lo que RLS y el filtro por `usuario_id` se aplican en el backend.

| Método | Endpoint | Historia | Descripción |
|---|---|---|---|
| GET | `/api/dashboard` | HU06 | Resumen académico del usuario autenticado. |

**Respuesta `GET /api/dashboard`**

```json
{
  "success": true,
  "data": {
    "materias": { "total": 5, "activas": 4, "archivadas": 1 },
    "tareas": {
      "total": 20,
      "pendientes": 6,
      "en_progreso": 4,
      "completadas": 10,
      "vencidas": 2
    },
    "proximas_actividades": [
      {
        "id": "8f14e45f-ceea-467a-9c2f-7c1d2b0d1a11",
        "titulo": "Taller de derivadas",
        "tipo": "taller",
        "prioridad": "alta",
        "fecha_entrega": "2026-11-12T23:59:59.000Z",
        "estado": "pendiente",
        "materias": { "nombre": "Cálculo Diferencial", "codigo": "MAT101", "color": "#3B82F6" }
      }
    ],
    "proximos_examenes": [],
    "proximos_eventos": [
      {
        "id": "0d6a1f2e-4c3b-4a59-8f70-1b2c3d4e5f60",
        "titulo": "Examen parcial",
        "tipo_evento": "examen",
        "fecha_inicio": "2026-11-20T14:00:00.000Z",
        "materias": { "nombre": "Cálculo Diferencial", "codigo": "MAT101", "color": "#3B82F6" }
      }
    ],
    "progreso": {
      "tareas_totales": 20,
      "tareas_completadas": 10,
      "porcentaje_completado": 50,
      "materias_activas": 4
    },
    "notificaciones": [],
    "generado_en": "2026-11-10T15:00:00.000Z"
  }
}
```

**Ventanas y límites**

| Sección | Ventana | Máximo de elementos |
|---|---|---|
| `proximas_actividades` | 7 días | 6 |
| `proximos_examenes` | 30 días | 5 |
| `proximos_eventos` | 14 días | 5 |

**Reglas**

- `proximas_actividades` y `proximos_examenes` solo incluyen tareas no completadas.
- `proximos_examenes` filtra `tipo in ('examen', 'parcial')`.
- `proximos_eventos` excluye los eventos automáticos `tipo_evento = 'entrega'` para no repetir las tareas.
- `progreso.porcentaje_completado` se calcula como `tareas_completadas / tareas_totales`, redondeado a entero entre 0 y 100.
- `notificaciones` devuelve `[]` hasta que se implemente HU18; el panel muestra un estado vacío explícito.
- No acepta filtros ni identificadores de usuario: el alcance sale del JWT.
- Los errores usan el sobre estándar; un fallo de Supabase responde `503`.
