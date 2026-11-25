-- ============================================================================
-- MINGO - Roles academicos, inscripciones y tareas por materia
-- ============================================================================
-- Contenido:
--   1. Catalogo de roles: docente.
--   2. Perfil con obligatoriedad de cambio de clave temporal.
--   3. Materia con docente responsable y tabla de inscripciones.
--   4. Tareas como definicion por materia + estado por estudiante.
--   5. RLS de materias, inscripciones, tareas y estados de tarea.
--   6. Acceso a documentos y fragmentos por propiedad, rol o inscripcion activa.
--   7. RPC de busqueda semantica y estadisticas acordes al nuevo modelo.
--
-- Los artefactos derivados (resumenes, conversaciones, cuestionarios,
-- tarjetas y planes de estudio) siguen siendo privados de quien los genera;
-- sus politicas RLS actuales no se modifican.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar mas de una vez sin duplicar objetos.
--
-- Requisito: migraciones 0001 a 0017 y backend/sql/materias.sql ya ejecutadas.
-- No elimina ni reemplaza datos existentes: las tareas anteriores conservan su
-- estado y las materias conservan a su dueno historico en `usuario_id`.
-- ============================================================================

-- 1. Roles y perfil ---------------------------------------------------------

insert into public.roles (nombre, descripcion)
values ('docente', 'Gestiona tareas y documentos de las materias que imparte.')
on conflict (nombre) do nothing;

alter table public.perfiles
  add column if not exists requiere_cambio_clave boolean not null default false;

comment on column public.perfiles.requiere_cambio_clave is
  'Obliga al usuario a cambiar la contraseña temporal antes de usar la API';

-- El registro publico siempre recibe el rol "estudiante". Los roles
-- privilegiados los asigna el backend con service_role desde
-- POST /api/usuarios: los metadatos del JWT son controlados por el cliente y
-- no pueden otorgar permisos por si solos.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rol_estudiante_id integer;
begin
  insert into public.perfiles (
    id,
    auth_user_id,
    nombre,
    apellido,
    correo,
    requiere_cambio_clave
  )
  values (
    new.id,
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_user_meta_data ->> 'apellido', ''),
    coalesce(new.email, new.id::text || '@sin-correo.mingo'),
    false
  )
  on conflict (id) do nothing;

  select id into rol_estudiante_id
  from public.roles
  where nombre = 'estudiante';

  if rol_estudiante_id is not null then
    insert into public.usuario_roles (usuario_id, rol_id)
    values (new.id, rol_estudiante_id)
    on conflict (usuario_id, rol_id) do nothing;
  end if;

  return new;
end;
$$;

-- 2. Materias y docente responsable ----------------------------------------

alter table public.materias
  add column if not exists docente_id uuid references public.perfiles (id) on delete set null;

create index if not exists idx_materias_docente_id on public.materias (docente_id);

-- Conserva el dueno historico. Si no hay docente asignado, se propone un
-- administrador para que las materias existentes sigan teniendo responsable.
update public.materias m
set docente_id = coalesce(
  (
    select p.id
    from public.perfiles p
    join public.usuario_roles ur on ur.usuario_id = p.id
    join public.roles r on r.id = ur.rol_id
    where r.nombre = 'administrador'
    order by p.fecha_creacion
    limit 1
  ),
  m.docente_id
)
where m.docente_id is null;

update public.materias m
set docente = concat_ws(' ', nullif(p.nombre, ''), nullif(p.apellido, ''))
from public.perfiles p
where p.id = m.docente_id
  and (m.docente is null or btrim(m.docente) = '');

comment on column public.materias.docente_id is
  'Docente responsable de la materia; el alta la hace el administrador';

-- 3. Inscripciones -----------------------------------------------------------

create table if not exists public.inscripciones (
  id uuid primary key default gen_random_uuid(),
  materia_id uuid not null references public.materias (id) on delete cascade,
  estudiante_id uuid not null references public.perfiles (id) on delete cascade,
  estado varchar(20) not null default 'activa',
  fecha_inscripcion timestamptz not null default now(),
  fecha_actualizacion timestamptz,
  constraint inscripciones_estado_check check (estado in ('activa', 'inactiva')),
  constraint inscripciones_materia_estudiante_unico unique (materia_id, estudiante_id)
);

create index if not exists idx_inscripciones_materia_id
  on public.inscripciones (materia_id);
create index if not exists idx_inscripciones_estudiante_id
  on public.inscripciones (estudiante_id);
create index if not exists idx_inscripciones_estado
  on public.inscripciones (materia_id, estado);

create or replace function public.actualizar_fecha_actualizacion_inscripciones()
returns trigger
language plpgsql
as $$
begin
  new.fecha_actualizacion = now();
  return new;
end;
$$;

drop trigger if exists trigger_actualizar_fecha_inscripciones on public.inscripciones;
create trigger trigger_actualizar_fecha_inscripciones
  before update on public.inscripciones
  for each row execute function public.actualizar_fecha_actualizacion_inscripciones();

alter table public.inscripciones enable row level security;

drop policy if exists inscripciones_select_accesibles on public.inscripciones;
create policy inscripciones_select_accesibles
  on public.inscripciones
  for select
  to authenticated
  using (
    auth.uid() = estudiante_id
    or exists (
      select 1
      from public.materias m
      where m.id = inscripciones.materia_id
        and m.docente_id = auth.uid()
    )
  );

grant select on public.inscripciones to authenticated;
revoke insert, update, delete on public.inscripciones from anon, authenticated;
grant all on public.inscripciones to service_role;
revoke all on public.inscripciones from anon;

-- 4. Tareas como definicion por materia y estado por estudiante ------------

alter table public.tareas
  add column if not exists docente_id uuid references public.perfiles (id) on delete set null;

create index if not exists idx_tareas_docente_id on public.tareas (docente_id);
create index if not exists idx_tareas_docente_materia
  on public.tareas (docente_id, materia_id);

comment on column public.tareas.docente_id is
  'Docente que creo la definicion; nulo en tareas heredadas del modelo anterior';

create table if not exists public.tarea_estados (
  id uuid primary key default gen_random_uuid(),
  tarea_id uuid not null references public.tareas (id) on delete cascade,
  estudiante_id uuid not null references public.perfiles (id) on delete cascade,
  estado varchar(20) not null default 'pendiente',
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz,
  constraint tarea_estados_estado_check
    check (estado in ('pendiente', 'en_progreso', 'completada')),
  constraint tarea_estados_tarea_estudiante_unico unique (tarea_id, estudiante_id)
);

create index if not exists idx_tarea_estados_estudiante_id
  on public.tarea_estados (estudiante_id);
create index if not exists idx_tarea_estados_tarea_id
  on public.tarea_estados (tarea_id);

create or replace function public.actualizar_fecha_actualizacion_tarea_estados()
returns trigger
language plpgsql
as $$
begin
  new.fecha_actualizacion = now();
  return new;
end;
$$;

drop trigger if exists trigger_actualizar_fecha_tarea_estados on public.tarea_estados;
create trigger trigger_actualizar_fecha_tarea_estados
  before update on public.tarea_estados
  for each row execute function public.actualizar_fecha_actualizacion_tarea_estados();

-- Las tareas creadas antes de esta migracion eran personales: se conserva el
-- estado de cada una como estado de su dueno. Las nuevas definiciones no
-- insertan filas aqui; cada estudiante ve "pendiente" hasta que cambia su estado.
insert into public.tarea_estados (
  tarea_id,
  estudiante_id,
  estado,
  fecha_creacion,
  fecha_actualizacion
)
select t.id, t.usuario_id, t.estado, t.fecha_creacion, t.fecha_actualizacion
from public.tareas t
on conflict (tarea_id, estudiante_id) do nothing;

alter table public.tarea_estados enable row level security;

drop policy if exists tarea_estados_select_accesibles on public.tarea_estados;
create policy tarea_estados_select_accesibles
  on public.tarea_estados
  for select
  to authenticated
  using (
    auth.uid() = estudiante_id
    or exists (
      select 1
      from public.tareas t
      where t.id = tarea_estados.tarea_id
        and (t.docente_id = auth.uid() or t.usuario_id = auth.uid())
    )
  );

drop policy if exists tarea_estados_insert_propias on public.tarea_estados;
create policy tarea_estados_insert_propias
  on public.tarea_estados
  for insert
  to authenticated
  with check (auth.uid() = estudiante_id);

drop policy if exists tarea_estados_update_propias on public.tarea_estados;
create policy tarea_estados_update_propias
  on public.tarea_estados
  for update
  to authenticated
  using (auth.uid() = estudiante_id)
  with check (auth.uid() = estudiante_id);

drop policy if exists tarea_estados_delete_propias on public.tarea_estados;
create policy tarea_estados_delete_propias
  on public.tarea_estados
  for delete
  to authenticated
  using (auth.uid() = estudiante_id);

grant select, insert, update, delete on public.tarea_estados to authenticated;
revoke all on public.tarea_estados from anon;
grant all on public.tarea_estados to service_role;

-- 5. RLS de materias y tareas ------------------------------------------------

drop policy if exists "Usuarios pueden ver sus propias materias" on public.materias;
create policy "Usuarios pueden ver materias accesibles" on public.materias
  for select
  to authenticated
  using (
    auth.uid() = usuario_id
    or auth.uid() = docente_id
    or exists (
      select 1
      from public.inscripciones i
      where i.materia_id = materias.id
        and i.estudiante_id = auth.uid()
        and i.estado = 'activa'
    )
  );

drop policy if exists "Usuarios pueden crear sus propias materias" on public.materias;
create policy "Solo administradores crean materias" on public.materias
  for insert
  to authenticated
  with check (
    auth.uid() = usuario_id
    and exists (
      select 1
      from public.usuario_roles ur
      join public.roles r on r.id = ur.rol_id
      where ur.usuario_id = auth.uid()
        and r.nombre = 'administrador'
    )
  );

drop policy if exists "Usuarios pueden actualizar sus propias materias" on public.materias;
create policy "Usuarios pueden actualizar sus propias materias" on public.materias
  for update
  to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

drop policy if exists "Usuarios pueden eliminar sus propias materias" on public.materias;
create policy "Usuarios pueden eliminar sus propias materias" on public.materias
  for delete
  to authenticated
  using (auth.uid() = usuario_id);

alter table public.tareas enable row level security;

drop policy if exists tareas_select_propias on public.tareas;
create policy tareas_select_accesibles on public.tareas
  for select
  to authenticated
  using (
    auth.uid() = usuario_id
    or auth.uid() = docente_id
    or (
      docente_id is not null
      and exists (
        select 1
        from public.inscripciones i
        where i.materia_id = tareas.materia_id
          and i.estudiante_id = auth.uid()
          and i.estado = 'activa'
      )
    )
  );

drop policy if exists tareas_insert_propias on public.tareas;
create policy tareas_insert_docente on public.tareas
  for insert
  to authenticated
  with check (
    auth.uid() = usuario_id
    and exists (
      select 1
      from public.usuario_roles ur
      join public.roles r on r.id = ur.rol_id
      where ur.usuario_id = auth.uid()
        and r.nombre in ('docente', 'administrador')
    )
  );

drop policy if exists tareas_update_propias on public.tareas;
create policy tareas_update_docente on public.tareas
  for update
  to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

drop policy if exists tareas_delete_propias on public.tareas;
create policy tareas_delete_docente on public.tareas
  for delete
  to authenticated
  using (auth.uid() = usuario_id);

-- 6. Acceso a documentos y fragmentos por inscripcion activa -----------------

-- security definer evita la recursion al consultar documentos desde su propia
-- politica RLS. auth.uid() sigue siendo el usuario de la peticion.
create or replace function public.usuario_puede_leer_documento(p_documento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.documentos d
    where d.id = p_documento_id
      and (
        d.usuario_id = auth.uid()
        or exists (
          select 1
          from public.inscripciones i
          where i.materia_id = d.materia_id
            and i.estudiante_id = auth.uid()
            and i.estado = 'activa'
        )
        or exists (
          select 1
          from public.materias m
          where m.id = d.materia_id and m.docente_id = auth.uid()
        )
        or exists (
          select 1
          from public.usuario_roles ur
          join public.roles r on r.id = ur.rol_id
          where ur.usuario_id = auth.uid() and r.nombre = 'administrador'
        )
      )
  );
$$;

revoke all on function public.usuario_puede_leer_documento(uuid) from public, anon;
grant execute on function public.usuario_puede_leer_documento(uuid) to authenticated;

-- Un documento puede ser gestionado por su subidor, por el docente responsable
-- de la materia o por un administrador. Centralizar la regla evita divergencias
-- entre las politicas de update y delete.
create or replace function public.usuario_puede_gestionar_documento(p_documento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.documentos d
    where d.id = p_documento_id
      and (
        d.usuario_id = auth.uid()
        or exists (
          select 1
          from public.materias m
          where m.id = d.materia_id and m.docente_id = auth.uid()
        )
        or exists (
          select 1
          from public.usuario_roles ur
          join public.roles r on r.id = ur.rol_id
          where ur.usuario_id = auth.uid() and r.nombre = 'administrador'
        )
      )
  );
$$;

revoke all on function public.usuario_puede_gestionar_documento(uuid) from public, anon;
grant execute on function public.usuario_puede_gestionar_documento(uuid) to authenticated;

drop policy if exists documentos_select_propios on public.documentos;
create policy documentos_select_accesibles on public.documentos
  for select
  to authenticated
  using (public.usuario_puede_leer_documento(id));

drop policy if exists documentos_insert_propios on public.documentos;
create policy documentos_insert_docente on public.documentos
  for insert
  to authenticated
  with check (
    auth.uid() = usuario_id
    and (
      exists (
        select 1
        from public.usuario_roles ur
        join public.roles r on r.id = ur.rol_id
        where ur.usuario_id = auth.uid() and r.nombre = 'administrador'
      )
      or exists (
        select 1
        from public.usuario_roles ur
        join public.roles r on r.id = ur.rol_id
        join public.materias m on m.id = materia_id
        where ur.usuario_id = auth.uid()
          and r.nombre = 'docente'
          and m.docente_id = auth.uid()
      )
    )
  );

drop policy if exists documentos_update_propios on public.documentos;
drop policy if exists documentos_update_docente on public.documentos;
create policy documentos_update_docente on public.documentos
  for update
  to authenticated
  using (public.usuario_puede_gestionar_documento(id))
  with check (public.usuario_puede_gestionar_documento(id));

drop policy if exists documentos_delete_propios on public.documentos;
drop policy if exists documentos_delete_docente on public.documentos;
create policy documentos_delete_docente on public.documentos
  for delete
  to authenticated
  using (public.usuario_puede_gestionar_documento(id));

drop policy if exists fragmentos_select_propios on public.fragmentos_documento;
create policy fragmentos_select_accesibles on public.fragmentos_documento
  for select
  to authenticated
  using (public.usuario_puede_leer_documento(documento_id));

-- 7. RPC de busqueda semantica y estadisticas --------------------------------

drop function if exists public.match_fragmentos(vector(1536), double precision, integer, uuid, uuid);
drop function if exists public.match_fragmentos(vector(1536), double precision, integer, integer);

create or replace function public.match_fragmentos(
  query_embedding vector(1536),
  match_threshold double precision default 0.70,
  match_count integer default 8,
  p_documento_id uuid default null,
  p_materia_id uuid default null
)
returns table (
  id uuid,
  documento_id uuid,
  documento_nombre text,
  numero_fragmento integer,
  numero_pagina integer,
  contenido text,
  similitud double precision,
  modelo_embedding varchar(100)
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select
    f.id,
    f.documento_id,
    d.nombre as documento_nombre,
    f.numero_fragmento,
    f.numero_pagina,
    f.contenido,
    1 - (f.embedding <=> query_embedding) as similitud,
    f.modelo_embedding
  from public.fragmentos_documento f
  join public.documentos d on d.id = f.documento_id
  where public.usuario_puede_leer_documento(d.id)
    and f.embedding is not null
    and (p_documento_id is null or f.documento_id = p_documento_id)
    and (p_materia_id is null or d.materia_id = p_materia_id)
    and 1 - (f.embedding <=> query_embedding) >= match_threshold
  order by f.embedding <=> query_embedding
  limit least(match_count, 20);
$$;

comment on function public.match_fragmentos(vector(1536), double precision, integer, uuid, uuid) is
  'Devuelve hasta 20 fragmentos accesibles por propiedad, rol docente/administrador o inscripcion activa (HU11)';

revoke all on function public.match_fragmentos(vector(1536), double precision, integer, uuid, uuid)
  from public, anon;
grant execute on function public.match_fragmentos(vector(1536), double precision, integer, uuid, uuid)
  to authenticated;

create or replace function public.obtener_estadisticas_tareas(p_usuario_id uuid)
returns table (
  total integer,
  pendientes integer,
  en_progreso integer,
  completadas integer,
  vencidas integer,
  prioridad_alta integer,
  prioridad_media integer,
  prioridad_baja integer
)
language sql
stable
set search_path = public
as $$
  with tareas_accesibles as (
    select
      coalesce(te.estado, t.estado) as estado_efectivo,
      t.prioridad,
      t.fecha_entrega
    from public.tareas t
    left join public.tarea_estados te
      on te.tarea_id = t.id
      and te.estudiante_id = p_usuario_id
    where t.usuario_id = p_usuario_id
      or t.docente_id = p_usuario_id
      or (
        t.docente_id is not null
        and exists (
          select 1
          from public.inscripciones i
          where i.materia_id = t.materia_id
            and i.estudiante_id = p_usuario_id
            and i.estado = 'activa'
        )
      )
  )
  select
    count(*)::integer as total,
    count(*) filter (where estado_efectivo = 'pendiente')::integer as pendientes,
    count(*) filter (where estado_efectivo = 'en_progreso')::integer as en_progreso,
    count(*) filter (where estado_efectivo = 'completada')::integer as completadas,
    count(*) filter (
      where fecha_entrega is not null
        and fecha_entrega < now()
        and estado_efectivo <> 'completada'
    )::integer as vencidas,
    count(*) filter (where prioridad = 'alta')::integer as prioridad_alta,
    count(*) filter (where prioridad = 'media')::integer as prioridad_media,
    count(*) filter (where prioridad = 'baja')::integer as prioridad_baja
  from tareas_accesibles;
$$;

grant execute on function public.obtener_estadisticas_tareas(uuid) to authenticated;
revoke all on function public.obtener_estadisticas_tareas(uuid) from anon;
