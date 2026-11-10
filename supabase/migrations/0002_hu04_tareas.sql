-- ============================================================================
-- MINGO - HU04: gestion de tareas y actividades academicas
-- ============================================================================
-- Contenido:
--   1. Tabla tareas con sus restricciones.
--   2. Indices para filtros y ordenamientos de la interfaz.
--   3. Trigger de fecha de actualizacion.
--   4. RLS: cada usuario solo accede a sus propias tareas.
--   5. Funcion de estadisticas agregadas.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar mas de una vez sin duplicar objetos.
--
-- Requisito: la tabla public.materias debe existir (HU03).
-- ============================================================================

-- 1. Tabla -------------------------------------------------------------------

create table if not exists public.tareas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  materia_id uuid not null references public.materias (id) on delete cascade,
  titulo varchar(200) not null,
  descripcion text,
  tipo varchar(20) not null default 'tarea',
  prioridad varchar(10) not null default 'media',
  fecha_asignacion timestamptz not null default now(),
  fecha_entrega timestamptz,
  estado varchar(20) not null default 'pendiente',
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz
);

-- Restricciones con nombres estables para poder recrearlas sin duplicar.
alter table public.tareas drop constraint if exists tareas_tipo_check;
alter table public.tareas
  add constraint tareas_tipo_check
  check (tipo in ('tarea', 'taller', 'parcial', 'examen', 'proyecto', 'exposicion', 'laboratorio', 'practica', 'otro'));

alter table public.tareas drop constraint if exists tareas_prioridad_check;
alter table public.tareas
  add constraint tareas_prioridad_check
  check (prioridad in ('baja', 'media', 'alta'));

alter table public.tareas drop constraint if exists tareas_estado_check;
alter table public.tareas
  add constraint tareas_estado_check
  check (estado in ('pendiente', 'en_progreso', 'completada'));

alter table public.tareas drop constraint if exists tareas_fechas_check;
alter table public.tareas
  add constraint tareas_fechas_check
  check (fecha_entrega is null or fecha_entrega >= fecha_asignacion);

-- 2. Indices -----------------------------------------------------------------

create index if not exists idx_tareas_usuario_id on public.tareas (usuario_id);
create index if not exists idx_tareas_materia_id on public.tareas (materia_id);
create index if not exists idx_tareas_estado on public.tareas (estado);
create index if not exists idx_tareas_prioridad on public.tareas (prioridad);
create index if not exists idx_tareas_fecha_entrega on public.tareas (fecha_entrega);
create index if not exists idx_tareas_usuario_estado_entrega
  on public.tareas (usuario_id, estado, fecha_entrega);

comment on table public.tareas is 'Tareas y actividades academicas de los estudiantes';
comment on column public.tareas.usuario_id is 'Usuario dueno de la tarea';
comment on column public.tareas.materia_id is 'Materia a la que pertenece la tarea';
comment on column public.tareas.tipo is 'Tipo de actividad: tarea, taller, parcial, examen, proyecto, exposicion, laboratorio, practica u otro';
comment on column public.tareas.prioridad is 'Prioridad de la actividad: baja, media o alta';
comment on column public.tareas.fecha_asignacion is 'Fecha en que se asigno la actividad';
comment on column public.tareas.fecha_entrega is 'Fecha limite de entrega; nula si no tiene plazo';
comment on column public.tareas.estado is 'Estado: pendiente, en_progreso o completada';

-- 3. Trigger de fecha de actualizacion ---------------------------------------

create or replace function public.actualizar_fecha_actualizacion_tareas()
returns trigger
language plpgsql
as $$
begin
  new.fecha_actualizacion = now();
  return new;
end;
$$;

drop trigger if exists trigger_actualizar_fecha_tareas on public.tareas;

create trigger trigger_actualizar_fecha_tareas
  before update on public.tareas
  for each row execute function public.actualizar_fecha_actualizacion_tareas();

-- 4. RLS ---------------------------------------------------------------------

alter table public.tareas enable row level security;

drop policy if exists tareas_select_propias on public.tareas;
create policy tareas_select_propias
  on public.tareas
  for select
  to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists tareas_insert_propias on public.tareas;
create policy tareas_insert_propias
  on public.tareas
  for insert
  to authenticated
  with check (auth.uid() = usuario_id);

drop policy if exists tareas_update_propias on public.tareas;
create policy tareas_update_propias
  on public.tareas
  for update
  to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

drop policy if exists tareas_delete_propias on public.tareas;
create policy tareas_delete_propias
  on public.tareas
  for delete
  to authenticated
  using (auth.uid() = usuario_id);

grant select, insert, update, delete on public.tareas to authenticated;
revoke all on public.tareas from anon;

-- 5. Estadisticas ------------------------------------------------------------

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
as $$
  select
    count(*)::integer as total,
    count(*) filter (where estado = 'pendiente')::integer as pendientes,
    count(*) filter (where estado = 'en_progreso')::integer as en_progreso,
    count(*) filter (where estado = 'completada')::integer as completadas,
    count(*) filter (
      where fecha_entrega is not null
        and fecha_entrega < now()
        and estado <> 'completada'
    )::integer as vencidas,
    count(*) filter (where prioridad = 'alta')::integer as prioridad_alta,
    count(*) filter (where prioridad = 'media')::integer as prioridad_media,
    count(*) filter (where prioridad = 'baja')::integer as prioridad_baja
  from public.tareas
  where usuario_id = p_usuario_id;
$$;

grant execute on function public.obtener_estadisticas_tareas(uuid) to authenticated;
revoke all on function public.obtener_estadisticas_tareas(uuid) from anon;
