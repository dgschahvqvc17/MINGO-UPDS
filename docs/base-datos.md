# Base de datos de MINGO

**Motor:** PostgreSQL administrado por Supabase  
**Extensiones:** `pgvector` para embeddings  
**Seguridad:** Row Level Security (RLS) obligatorio  
**Diseño de referencia:** [tecnologias.md](../tecnologias.md), sección 5 y 6

## 1. Convenciones

| Elemento | Convención |
|---|---|
| Tablas | `snake_case`, en plural: `materias`, `documentos`, `eventos_calendario`. |
| Columnas | `snake_case`: `fecha_entrega`, `estado_procesamiento`. |
| Claves primarias | `id uuid primary key default gen_random_uuid()`. |
| Fechas | `timestamptz`, en UTC. La zona horaria se presenta en el frontend. |
| Booleanos | `boolean not null default false`. |
| Estados | `text` con `check` o tabla catálogo, nunca texto libre. |
| Dinero/cantidades | `numeric` cuando aplique; el proyecto no maneja pagos. |
| Borrado | Preferir `estado = 'archivado'` para datos académicos; borrado físico solo con cascada controlada. |
| Auditoría | `fecha_creacion` y `fecha_actualizacion` con `default now()`. |

## 2. Identidad y propietario de los datos

Para simplificar RLS y evitar joins innecesarios:

- `perfiles.id` es **el mismo UUID del usuario de Supabase Auth** (`auth.users.id`).
- `perfiles.auth_user_id` se mantiene como referencia explícita y única.
- En las tablas del dominio, `usuario_id` referencia `perfiles(id)`.
- Las políticas RLS comparan directamente `auth.uid() = usuario_id`.

```sql
create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  nombre text not null default '',
  apellido text not null default '',
  correo text not null,
  foto_perfil text,
  universidad text,
  carrera text,
  semestre integer,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  fecha_creacion timestamptz not null default now()
);
```

Trigger recomendado para crear el perfil al registrarse:

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.perfiles (id, auth_user_id, correo, nombre, apellido)
  values (
    new.id,
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
```

> Los roles se guardan en `roles` + `usuario_roles` y también pueden viajar en `app_metadata.role` del JWT para autorización rápida en el backend. La fuente de verdad es la base de datos.

## 3. Grupos de tablas

| Grupo | Tablas |
|---|---|
| A. Usuarios | `perfiles`, `roles`, `usuario_roles` |
| B. Organización académica | `periodos_academicos`, `materias`, `unidades` |
| C. Tareas y calendario | `tareas`, `eventos_calendario` |
| D. Biblioteca | `documentos`, `fragmentos_documento` |
| E. IA | `conversaciones`, `mensajes`, `referencias_respuesta`, `planes_estudio`, `sesiones_estudio` |
| F. Evaluación | `cuestionarios`, `preguntas`, `opciones_pregunta`, `intentos_cuestionario`, `respuestas_usuario` |
| G. Notificaciones | `notificaciones` |
| H. Seguimiento | `objetivos_estudio`, `preferencias_usuario` |

Los campos exactos de cada tabla están en [tecnologias.md](../tecnologias.md), sección 5.2.

## 4. Relaciones e integridad

- `auth.users` 1:1 `perfiles`.
- `perfiles` 1:N `periodos_academicos`, `materias`, `tareas`, `documentos`, `conversaciones`, `planes_estudio`, `cuestionarios`, `objetivos_estudio`, `notificaciones`.
- `periodos_academicos` 1:N `materias`.
- `materias` 1:N `unidades`, `tareas`, `documentos`, `cuestionarios`, `planes_estudio`.
- `documentos` 1:N `fragmentos_documento`.
- `conversaciones` 1:N `mensajes`; `mensajes` 1:N `referencias_respuesta`.
- `planes_estudio` 1:N `sesiones_estudio`.
- `cuestionarios` 1:N `preguntas`; `preguntas` 1:N `opciones_pregunta`.
- `cuestionarios` 1:N `intentos_cuestionario`; `intentos_cuestionario` 1:N `respuestas_usuario`.

Reglas:

- Usar `on delete cascade` solo en relaciones de propiedad clara (por ejemplo, mensajes de una conversación).
- Usar `on delete set null` en referencias opcionales (por ejemplo, `materia_id` de una tarea).
- Todas las claves foráneas deben tener índice.
- No permitir que un registro apunte a una materia o documento de otro usuario: validar en servicio **y** con RLS.

## 5. Índices mínimos

```sql
create index materias_usuario_idx on public.materias (usuario_id);
create index materias_periodo_idx on public.materias (periodo_id);
create index tareas_usuario_estado_idx on public.tareas (usuario_id, estado);
create index tareas_fecha_entrega_idx on public.tareas (fecha_entrega);
create index eventos_usuario_fecha_idx on public.eventos_calendario (usuario_id, fecha_inicio);
create index documentos_usuario_idx on public.documentos (usuario_id);
create index documentos_estado_idx on public.documentos (estado_procesamiento);
create index fragmentos_documento_idx on public.fragmentos_documento (documento_id);
create index conversaciones_usuario_idx on public.conversaciones (usuario_id);
create index mensajes_conversacion_idx on public.mensajes (conversacion_id, fecha_creacion);
create index notificaciones_usuario_leida_idx on public.notificaciones (usuario_id, leida);
```

Evitar índices innecesarios: cada índice consume espacio y escritura.

## 6. Row Level Security (RLS)

**Toda tabla del dominio debe tener RLS activado.** Sin política, el acceso se deniega.

Patrón para tablas con `usuario_id`:

```sql
alter table public.materias enable row level security;

create policy "materias_select_propias"
on public.materias for select
using (auth.uid() = usuario_id);

create policy "materias_insert_propias"
on public.materias for insert
with check (auth.uid() = usuario_id);

create policy "materias_update_propias"
on public.materias for update
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

create policy "materias_delete_propias"
on public.materias for delete
using (auth.uid() = usuario_id);
```

Patrón para tablas hijas sin `usuario_id`:

```sql
alter table public.unidades enable row level security;

create policy "unidades_propietario"
on public.unidades for all
using (
  exists (
    select 1
    from public.materias m
    where m.id = unidades.materia_id
      and m.usuario_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.materias m
    where m.id = unidades.materia_id
      and m.usuario_id = auth.uid()
  )
);
```

### Reglas de RLS

- El frontend usa la clave **anon**; el backend usa la **service role** solo para operaciones administrativas controladas.
- Si el backend consulta con service role, **debe** filtrar por `usuario_id` en el repository. La service role omite RLS.
- Preferir consultas con el token del usuario para que RLS actúe como segunda barrera.
- El rol administrador **no** recibe políticas de lectura sobre documentos, conversaciones ni datos privados de estudio.
- Probar RLS con dos usuarios distintos: uno no debe ver ni modificar datos del otro.
- Las funciones `security definer` son excepcionales, con `search_path` fijo y revisión obligatoria.

## 7. pgvector y búsqueda semántica

```sql
create extension if not exists vector;

alter table public.fragmentos_documento
add column if not exists embedding vector(1536);
```

El tamaño **1536** debe coincidir con el modelo de embeddings configurado (`AI_EMBEDDING_MODEL`). Si cambia el modelo, se debe definir una nueva dimensión y reprocesar los documentos.

Índice (elegir uno según volumen del MVP):

```sql
-- HNSW: buena calidad; construir cuando haya datos
create index fragmentos_embedding_hnsw_idx
on public.fragmentos_documento
using hnsw (embedding vector_cosine_ops);
```

Función de búsqueda con filtro de propietario:

```sql
create or replace function public.match_fragmentos(
  query_embedding vector(1536),
  match_threshold float default 0.70,
  match_count int default 8,
  p_documento_id uuid default null
)
returns table (
  id uuid,
  documento_id uuid,
  contenido text,
  numero_pagina integer,
  similitud float
)
language sql
stable
as $$
  select
    f.id,
    f.documento_id,
    f.contenido,
    f.numero_pagina,
    1 - (f.embedding <=> query_embedding) as similitud
  from public.fragmentos_documento f
  join public.documentos d on d.id = f.documento_id
  where d.usuario_id = auth.uid()
    and f.embedding is not null
    and (p_documento_id is null or f.documento_id = p_documento_id)
    and 1 - (f.embedding <=> query_embedding) >= match_threshold
  order by f.embedding <=> query_embedding
  limit least(match_count, 20);
$$;

grant execute on function public.match_fragmentos to authenticated;
```

Reglas:

- Nunca buscar sin filtrar por propietario.
- Limitar `match_count` (máximo 20) para controlar tokens y costo.
- Guardar `documento_id`, `numero_pagina` y `numero_fragmento` para citar la fuente.
- No regenerar embeddings de fragmentos sin cambios.

## 8. Migraciones

- Usar **Supabase CLI** y migraciones versionadas en `supabase/migrations/`.
- Nunca modificar el esquema de producción desde el panel sin migración.
- Flujo:

```bash
npx supabase init
npx supabase link --project-ref <PROJECT_REF>
npx supabase migration new crear_tablas_iniciales
# editar el SQL generado
npx supabase db push
```

- Cada migración debe ser idempotente cuando sea posible (`if not exists`, `on conflict`).
- Las políticas RLS se crean en la misma migración que la tabla.
- Los cambios destructivos requieren respaldo y aprobación.
- Mantener un script `seed.sql` con roles base:

```sql
insert into public.roles (nombre, descripcion)
values
  ('administrador', 'Administra la plataforma'),
  ('estudiante', 'Usuario principal de MINGO')
on conflict (nombre) do nothing;
```

## 9. Respaldos y retención

- El plan Free de Supabase no garantiza point-in-time recovery. Programar exportaciones periódicas con `pg_dump` si el volumen de datos crece.
- Nunca almacenar el respaldo en un repositorio público.
- Los archivos viven en S3; la base solo guarda metadatos y rutas.
- Al borrar un documento, eliminar también sus fragmentos y el objeto de S3.
- Revisar el tamaño de la base y de los embeddings: los vectores ocupan espacio.

## 10. Checklist antes de crear una tabla

- [ ] ¿Tiene `id uuid` y `usuario_id` cuando corresponde?
- [ ] ¿Todas las claves foráneas tienen índice?
- [ ] ¿Tiene RLS activado y políticas de select/insert/update/delete?
- [ ] ¿Las fechas son `timestamptz`?
- [ ] ¿Los estados están restringidos con `check`?
- [ ] ¿El borrado en cascada es seguro?
- [ ] ¿Se agregó la migración versionada?
- [ ] ¿Se probó con dos usuarios distintos?
- [ ] ¿Se actualizó este documento si cambió el modelo?
