-- ============================================================================
-- MINGO - HU15: planificar sesiones de estudio
-- ============================================================================
-- Contenido:
--   1. Tablas planes_estudio y sesiones_estudio.
--   2. Vinculacion opcional de sesiones con eventos_calendario.
--   3. Indices, restricciones y triggers de fecha de actualizacion.
--   4. RLS: cada usuario solo accede a sus planes y sesiones.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar mas de una vez sin duplicar objetos.
--
-- Requisito: 0001 (perfiles), materias, 0002 (tareas), 0003 (calendario) y
-- 0007 (consumo_ia) ya ejecutadas.
-- ============================================================================

-- 1. Planes de estudio -------------------------------------------------------

create table if not exists public.planes_estudio (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  materia_id uuid not null references public.materias (id) on delete cascade,
  objetivo varchar(300) not null,
  fecha_examen date not null,
  minutos_por_dia integer not null,
  dias_disponibles varchar(10)[] not null,
  estado varchar(20) not null default 'confirmado',
  modelo varchar(100),
  tokens_entrada integer not null default 0,
  tokens_salida integer not null default 0,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz
);

alter table public.planes_estudio drop constraint if exists planes_estudio_objetivo_check;
alter table public.planes_estudio
  add constraint planes_estudio_objetivo_check
  check (length(btrim(objetivo)) between 5 and 300);

alter table public.planes_estudio drop constraint if exists planes_estudio_minutos_check;
alter table public.planes_estudio
  add constraint planes_estudio_minutos_check
  check (minutos_por_dia between 15 and 480);

alter table public.planes_estudio drop constraint if exists planes_estudio_dias_check;
alter table public.planes_estudio
  add constraint planes_estudio_dias_check
  check (
    cardinality(dias_disponibles) > 0
    and dias_disponibles <@ array[
      'lunes', 'martes', 'miercoles', 'jueves',
      'viernes', 'sabado', 'domingo'
    ]::varchar(10)[]
  );

alter table public.planes_estudio drop constraint if exists planes_estudio_estado_check;
alter table public.planes_estudio
  add constraint planes_estudio_estado_check
  check (estado in ('confirmado', 'descartado'));

alter table public.planes_estudio drop constraint if exists planes_estudio_tokens_check;
alter table public.planes_estudio
  add constraint planes_estudio_tokens_check
  check (tokens_entrada >= 0 and tokens_salida >= 0);

-- 2. Sesiones de estudio -----------------------------------------------------

create table if not exists public.sesiones_estudio (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  plan_id uuid not null references public.planes_estudio (id) on delete cascade,
  evento_calendario_id uuid references public.eventos_calendario (id) on delete set null,
  tema varchar(200) not null,
  actividades text not null,
  tipo varchar(20),
  fecha_inicio timestamptz not null,
  duracion_minutos integer not null,
  orden integer not null,
  estado varchar(20) not null default 'pendiente',
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz
);

alter table public.sesiones_estudio drop constraint if exists sesiones_estudio_tema_check;
alter table public.sesiones_estudio
  add constraint sesiones_estudio_tema_check
  check (length(btrim(tema)) between 2 and 200);

alter table public.sesiones_estudio drop constraint if exists sesiones_estudio_actividades_check;
alter table public.sesiones_estudio
  add constraint sesiones_estudio_actividades_check
  check (length(btrim(actividades)) between 2 and 2000);

alter table public.sesiones_estudio drop constraint if exists sesiones_estudio_tipo_check;
alter table public.sesiones_estudio
  add constraint sesiones_estudio_tipo_check
  check (tipo in ('lectura', 'practica', 'repaso', 'ejercicios'));

alter table public.sesiones_estudio drop constraint if exists sesiones_estudio_duracion_check;
alter table public.sesiones_estudio
  add constraint sesiones_estudio_duracion_check
  check (duracion_minutos between 5 and 480);

alter table public.sesiones_estudio drop constraint if exists sesiones_estudio_orden_check;
alter table public.sesiones_estudio
  add constraint sesiones_estudio_orden_check
  check (orden > 0);

alter table public.sesiones_estudio drop constraint if exists sesiones_estudio_estado_check;
alter table public.sesiones_estudio
  add constraint sesiones_estudio_estado_check
  check (estado in ('pendiente', 'completada'));

create unique index if not exists uq_sesiones_estudio_plan_orden
  on public.sesiones_estudio (plan_id, orden);

-- 3. Integracion con el calendario ------------------------------------------
-- La sesion confirmada se muestra en el calendario global como evento de
-- tipo 'estudio'. La relacion se guarda en la sesion para poder actualizar o
-- eliminar el evento cuando cambie el plan.

create index if not exists idx_sesiones_estudio_evento_calendario
  on public.sesiones_estudio (evento_calendario_id);

comment on column public.sesiones_estudio.evento_calendario_id is
  'Evento de calendario generado para la sesion confirmada (opcional)';

-- 4. Indices -----------------------------------------------------------------

create index if not exists idx_planes_estudio_usuario_fecha
  on public.planes_estudio (usuario_id, fecha_creacion desc);

create index if not exists idx_planes_estudio_materia
  on public.planes_estudio (materia_id);

create index if not exists idx_sesiones_estudio_plan_orden
  on public.sesiones_estudio (plan_id, orden);

create index if not exists idx_sesiones_estudio_usuario_plan
  on public.sesiones_estudio (usuario_id, plan_id);

create index if not exists idx_sesiones_estudio_fecha_inicio
  on public.sesiones_estudio (fecha_inicio);

create index if not exists idx_sesiones_estudio_estado
  on public.sesiones_estudio (plan_id, estado);

-- 5. Triggers de fecha de actualizacion --------------------------------------

create or replace function public.actualizar_fecha_actualizacion_planes_estudio()
returns trigger
language plpgsql
as $$
begin
  new.fecha_actualizacion = now();
  return new;
end;
$$;

drop trigger if exists trigger_actualizar_fecha_planes_estudio on public.planes_estudio;
create trigger trigger_actualizar_fecha_planes_estudio
  before update on public.planes_estudio
  for each row execute function public.actualizar_fecha_actualizacion_planes_estudio();

create or replace function public.actualizar_fecha_actualizacion_sesiones_estudio()
returns trigger
language plpgsql
as $$
begin
  new.fecha_actualizacion = now();
  return new;
end;
$$;

drop trigger if exists trigger_actualizar_fecha_sesiones_estudio on public.sesiones_estudio;
create trigger trigger_actualizar_fecha_sesiones_estudio
  before update on public.sesiones_estudio
  for each row execute function public.actualizar_fecha_actualizacion_sesiones_estudio();

-- 6. Row Level Security -------------------------------------------------------

alter table public.planes_estudio enable row level security;
alter table public.sesiones_estudio enable row level security;

drop policy if exists planes_estudio_select_propios on public.planes_estudio;
create policy planes_estudio_select_propios
  on public.planes_estudio for select to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists planes_estudio_insert_propios on public.planes_estudio;
create policy planes_estudio_insert_propios
  on public.planes_estudio for insert to authenticated
  with check (auth.uid() = usuario_id);

drop policy if exists planes_estudio_update_propios on public.planes_estudio;
create policy planes_estudio_update_propios
  on public.planes_estudio for update to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

drop policy if exists planes_estudio_delete_propios on public.planes_estudio;
create policy planes_estudio_delete_propios
  on public.planes_estudio for delete to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists sesiones_estudio_select_propias on public.sesiones_estudio;
create policy sesiones_estudio_select_propias
  on public.sesiones_estudio for select to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists sesiones_estudio_insert_propias on public.sesiones_estudio;
create policy sesiones_estudio_insert_propias
  on public.sesiones_estudio for insert to authenticated
  with check (
    auth.uid() = usuario_id
    and exists (
      select 1 from public.planes_estudio p
      where p.id = plan_id and p.usuario_id = auth.uid()
    )
  );

drop policy if exists sesiones_estudio_update_propias on public.sesiones_estudio;
create policy sesiones_estudio_update_propias
  on public.sesiones_estudio for update to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

drop policy if exists sesiones_estudio_delete_propias on public.sesiones_estudio;
create policy sesiones_estudio_delete_propias
  on public.sesiones_estudio for delete to authenticated
  using (auth.uid() = usuario_id);

-- 7. Permisos ----------------------------------------------------------------

grant select, insert, update, delete on public.planes_estudio to authenticated;
grant select, insert, update, delete on public.sesiones_estudio to authenticated;

revoke all on public.planes_estudio from anon;
revoke all on public.sesiones_estudio from anon;

grant all on public.planes_estudio to service_role;
grant all on public.sesiones_estudio to service_role;
