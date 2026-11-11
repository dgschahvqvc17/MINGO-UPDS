-- ============================================================================
-- MINGO - HU05: Consultar calendario academico
-- ============================================================================
-- Contenido:
--   1. Tabla eventos_calendario con sus restricciones.
--   2. Indices para filtros y ordenamientos de la interfaz.
--   3. Trigger de fecha de actualizacion.
--   4. RLS: cada usuario solo accede a sus propios eventos.
--   5. Funcion de eventos proximos.
--   6. Funcion para generar eventos automaticos desde tareas.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar mas de una vez sin duplicar objetos.
--
-- Requisito: las tablas public.materias y public.tareas deben existir (HU03, HU04).
-- ============================================================================

-- 1. Tabla -------------------------------------------------------------------

create table if not exists public.eventos_calendario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  materia_id uuid references public.materias (id) on delete set null,
  tarea_id uuid references public.tareas (id) on delete set null,
  titulo varchar(200) not null,
  descripcion text,
  tipo_evento varchar(20) not null default 'otro',
  fecha_inicio timestamptz not null,
  fecha_fin timestamptz,
  recordatorio integer,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz
);

-- Restricciones con nombres estables para poder recrearlas sin duplicar.
alter table public.eventos_calendario drop constraint if exists eventos_calendario_tipo_check;
alter table public.eventos_calendario
  add constraint eventos_calendario_tipo_check
  check (tipo_evento in ('examen', 'entrega', 'clase', 'estudio', 'personal', 'otro'));

alter table public.eventos_calendario drop constraint if exists eventos_calendario_fechas_check;
alter table public.eventos_calendario
  add constraint eventos_calendario_fechas_check
  check (fecha_fin is null or fecha_fin >= fecha_inicio);

alter table public.eventos_calendario drop constraint if exists eventos_calendario_recordatorio_check;
alter table public.eventos_calendario
  add constraint eventos_calendario_recordatorio_check
  check (recordatorio is null or (recordatorio > 0 and recordatorio <= 10080));

-- 2. Indices -----------------------------------------------------------------

create index if not exists idx_eventos_calendario_usuario_id on public.eventos_calendario (usuario_id);
create index if not exists idx_eventos_calendario_materia_id on public.eventos_calendario (materia_id);
create index if not exists idx_eventos_calendario_tarea_id on public.eventos_calendario (tarea_id);
create index if not exists idx_eventos_calendario_tipo_evento on public.eventos_calendario (tipo_evento);
create index if not exists idx_eventos_calendario_fecha_inicio on public.eventos_calendario (fecha_inicio);
create index if not exists idx_eventos_calendario_usuario_fecha_inicio
  on public.eventos_calendario (usuario_id, fecha_inicio);

comment on table public.eventos_calendario is 'Eventos del calendario academico';
comment on column public.eventos_calendario.usuario_id is 'Usuario dueno del evento';
comment on column public.eventos_calendario.materia_id is 'Materia asociada (opcional)';
comment on column public.eventos_calendario.tarea_id is 'Tarea que origino el evento (opcional)';
comment on column public.eventos_calendario.tipo_evento is 'Tipo: examen, entrega, clase, estudio, personal u otro';
comment on column public.eventos_calendario.fecha_inicio is 'Fecha y hora de inicio del evento';
comment on column public.eventos_calendario.fecha_fin is 'Fecha y hora de fin del evento (opcional)';
comment on column public.eventos_calendario.recordatorio is 'Minutos de anticipacion para recordatorio (opcional)';

-- 3. Trigger de fecha de actualizacion ---------------------------------------

create or replace function public.actualizar_fecha_actualizacion_eventos_calendario()
returns trigger
language plpgsql
as $$
begin
  new.fecha_actualizacion = now();
  return new;
end;
$$;

drop trigger if exists trigger_actualizar_fecha_eventos_calendario on public.eventos_calendario;

create trigger trigger_actualizar_fecha_eventos_calendario
  before update on public.eventos_calendario
  for each row execute function public.actualizar_fecha_actualizacion_eventos_calendario();

-- 4. RLS ---------------------------------------------------------------------

alter table public.eventos_calendario enable row level security;

drop policy if exists eventos_calendario_select_propias on public.eventos_calendario;
create policy eventos_calendario_select_propias
  on public.eventos_calendario
  for select
  to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists eventos_calendario_insert_propias on public.eventos_calendario;
create policy eventos_calendario_insert_propias
  on public.eventos_calendario
  for insert
  to authenticated
  with check (auth.uid() = usuario_id);

drop policy if exists eventos_calendario_update_propias on public.eventos_calendario;
create policy eventos_calendario_update_propias
  on public.eventos_calendario
  for update
  to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

drop policy if exists eventos_calendario_delete_propias on public.eventos_calendario;
create policy eventos_calendario_delete_propias
  on public.eventos_calendario
  for delete
  to authenticated
  using (auth.uid() = usuario_id);

grant select, insert, update, delete on public.eventos_calendario to authenticated;
revoke all on public.eventos_calendario from anon;

-- 5. Funcion: obtener eventos proximos ---------------------------------------

create or replace function public.obtener_eventos_proximos(p_usuario_id uuid, p_dias integer default 7, p_limite integer default 10)
returns table (
  id uuid,
  titulo varchar,
  descripcion text,
  tipo_evento varchar,
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  recordatorio integer,
  materia_id uuid,
  materia_nombre varchar,
  materia_codigo varchar,
  materia_color varchar
)
language sql
stable
set search_path = public
as $$
  select
    e.id,
    e.titulo,
    e.descripcion,
    e.tipo_evento,
    e.fecha_inicio,
    e.fecha_fin,
    e.recordatorio,
    e.materia_id,
    m.nombre as materia_nombre,
    m.codigo as materia_codigo,
    m.color as materia_color
  from public.eventos_calendario e
  left join public.materias m on m.id = e.materia_id
  where e.usuario_id = p_usuario_id
    and e.fecha_inicio >= now()
    and e.fecha_inicio <= now() + make_interval(days => p_dias)
  order by e.fecha_inicio asc
  limit p_limite;
$$;

revoke all on function public.obtener_eventos_proximos(uuid, integer, integer) from public;
grant execute on function public.obtener_eventos_proximos(uuid, integer, integer) to authenticated, service_role;

-- 6. Funcion: crear evento automatico desde tarea ----------------------------

create or replace function public.crear_evento_desde_tarea(p_tarea_id uuid, p_usuario_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tarea record;
  v_evento_id uuid;
begin
  -- Obtener la tarea del usuario.
  select t.*
  into v_tarea
  from public.tareas t
  where t.id = p_tarea_id
    and t.usuario_id = p_usuario_id;

  if not found then
    raise exception 'Tarea no encontrada o no pertenece al usuario';
  end if;

  -- Si la tarea ya no tiene fecha_entrega, eliminar el evento automatico previo.
  if v_tarea.fecha_entrega is null then
    delete from public.eventos_calendario
    where tarea_id = p_tarea_id
      and usuario_id = p_usuario_id
      and tipo_evento = 'entrega';
    return null;
  end if;

  -- Verificar si ya existe el evento automatico de esta tarea (idempotente).
  -- Se restringe a tipo 'entrega' para no sobrescribir eventos manuales
  -- que el usuario haya vinculado a la misma tarea.
  select id into v_evento_id
  from public.eventos_calendario
  where tarea_id = p_tarea_id
    and usuario_id = p_usuario_id
    and tipo_evento = 'entrega'
  order by fecha_creacion asc
  limit 1;

  if v_evento_id is not null then
    -- Actualizar evento existente si la fecha cambio.
    -- fecha_actualizacion la mantiene el trigger.
    update public.eventos_calendario
    set titulo = left('Entrega: ' || v_tarea.titulo, 200),
        descripcion = v_tarea.descripcion,
        fecha_inicio = v_tarea.fecha_entrega,
        fecha_fin = v_tarea.fecha_entrega + interval '1 hour',
        materia_id = v_tarea.materia_id,
        tipo_evento = 'entrega'
    where id = v_evento_id;
    return v_evento_id;
  end if;

  -- Crear nuevo evento
  insert into public.eventos_calendario (
    usuario_id,
    materia_id,
    tarea_id,
    titulo,
    descripcion,
    tipo_evento,
    fecha_inicio,
    fecha_fin
  ) values (
    p_usuario_id,
    v_tarea.materia_id,
    p_tarea_id,
    left('Entrega: ' || v_tarea.titulo, 200),
    v_tarea.descripcion,
    'entrega',
    v_tarea.fecha_entrega,
    v_tarea.fecha_entrega + interval '1 hour'
  )
  returning id into v_evento_id;

  return v_evento_id;
end;
$$;

revoke all on function public.crear_evento_desde_tarea(uuid, uuid) from public;
grant execute on function public.crear_evento_desde_tarea(uuid, uuid) to authenticated, service_role;