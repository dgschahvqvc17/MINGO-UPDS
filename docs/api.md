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
6. Los identificadores de usuario (`perfiles.id`, `usuario_id`) son UUID; los identificadores de recursos de dominio (materias, tareas, documentos, conversaciones, etc.) son enteros (`SERIAL`).
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

El frontend inicia sesión directamente con Supabase Auth y envía el token al backend. El backend valida el token con Supabase y obtiene `id`, `email` y `role`.

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

Cierra la sesión en Supabase (revoca el refresh token del cliente). El frontend también puede hacerlo directamente.

### 4.4. `GET /api/auth/me`

Devuelve el perfil y los roles del usuario autenticado.

```json
{
  "success": true,
  "data": {
    "id": "3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01",
    "correo": "ana@universidad.edu",
    "nombre": "Ana",
    "apellido": "Pérez",
    "roles": ["estudiante"],
    "estado": "activo"
  }
}
```

## 5. Perfil

### `GET /api/usuarios/perfil`

Devuelve el perfil del usuario autenticado (HU01, HU02).

### `PUT /api/usuarios/perfil`

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
| GET | `/api/tareas` | HU04 | Lista tareas con filtros. |
| POST | `/api/tareas` | HU04 | Crea una tarea. |
| GET | `/api/tareas/:id` | HU04 | Detalle. |
| PUT | `/api/tareas/:id` | HU04 | Actualiza. |
| PATCH | `/api/tareas/:id/estado` | HU04 | Cambia solo el estado. |
| DELETE | `/api/tareas/:id` | HU04 | Elimina. |
| GET | `/api/tareas/proximas` | HU04, HU06 | Tareas próximas a vencer. |

**Filtros**

`materia_id`, `estado` (`pendiente` \| `en_progreso` \| `completada`), `prioridad` (`baja` \| `media` \| `alta`), `desde`, `hasta`, `q`, `page`, `limit`.

**Body `POST /api/tareas`**

```json
{
  "materia_id": 1,
  "unidad_id": null,
  "titulo": "Taller de derivadas",
  "descripcion": "Ejercicios 1 al 20.",
  "tipo": "taller",
  "prioridad": "alta",
  "fecha_asignacion": "2026-11-01T00:00:00.000Z",
  "fecha_entrega": "2026-11-12T23:59:00.000Z"
}
```

**Reglas**

- `fecha_entrega` no puede ser anterior a `fecha_asignacion`.
- `materia_id` debe pertenecer al usuario.
- Al crear una tarea con `fecha_entrega`, se puede generar automáticamente un evento de calendario.
- `PATCH /estado` body: `{ "estado": "completada" }`.

## 9. Calendario

| Método | Endpoint | Historia | Descripción |
|---|---|---|---|
| GET | `/api/calendario` | HU05 | Eventos en un rango de fechas. |
| POST | `/api/calendario` | HU05 | Crea un evento. |
| GET | `/api/calendario/:id` | HU05 | Detalle. |
| PUT | `/api/calendario/:id` | HU05 | Actualiza. |
| DELETE | `/api/calendario/:id` | HU05 | Elimina. |
| GET | `/api/calendario/proximos` | HU05, HU06 | Próximos eventos. |

**Parámetros obligatorios de `GET /api/calendario`**

```text
?desde=2026-11-01T00:00:00.000Z&hasta=2026-11-30T23:59:59.999Z
```

**Body `POST /api/calendario`**

```json
{
  "materia_id": 1,
  "tarea_id": null,
  "titulo": "Examen parcial",
  "descripcion": "Unidades 1 a 3.",
  "tipo_evento": "examen",
  "fecha_inicio": "2026-11-20T14:00:00.000Z",
  "fecha_fin": "2026-11-20T16:00:00.000Z",
  "recordatorio": 60
}
```

- `recordatorio` se expresa en minutos antes del evento; `null` significa sin recordatorio.
- `tipo_evento`: `examen`, `entrega`, `clase`, `estudio`, `personal`, `otro`.

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

- `page`: entero ≥ 1, por defecto 1.
- `limit`: entero entre 1 y 50, por defecto 20.
- `sort`: campo permitido por módulo, por defecto `fecha_creacion`.
- `order`: `asc` \| `desc`, por defecto `desc`.
- Los campos de ordenamiento se validan contra una lista blanca; nunca se interpolan en SQL.

Ejemplo:

```text
GET /api/tareas?estado=pendiente&prioridad=alta&sort=fecha_entrega&order=asc&page=1&limit=20
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
