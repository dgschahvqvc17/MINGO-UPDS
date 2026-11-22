-- ============================================================================
-- MINGO - HU18: notificaciones y recordatorios inteligentes
-- ============================================================================
-- Contenido:
--   1. preferencias_usuario: anticipacion, canales, zona horaria e idioma.
--   2. notificaciones: historial con relacion a la actividad que la origina.
--   3. Indices, restricciones, trigger de fecha de actualizacion y RLS.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar mas de una vez sin duplicar objetos.
--
-- Requisito: 0001 (perfiles), 0002 (tareas), 0003 (calendario) y 0013
-- (sesiones de estudio) ya ejecutadas.
--
-- Nota de idempotencia: clave_idempotencia identifica una actividad, su fecha
-- y la anticipacion aplicada. El generador inserta con ON CONFLICT DO NOTHING,
-- asi que una ejecucion repetida del recordatorio no duplica ni reenvia el aviso.
-- ============================================================================

-- 1. Preferencias de notificacion --------------------------------------------

create table if not exists public.preferencias_usuario (
  usuario_id uuid primary key references public.perfiles (id) on delete cascade,
  notificaciones_activas boolean not null default true,
  anticipacion_minutos integer not null default 60,
  canal_email boolean not null default false,
  zona_horaria varchar(64) not null default 'America/Bogota',
  idioma varchar(10) not null default 'es',
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz
);

alter table public.preferencias_usuario drop constraint if exists preferencias_usuario_anticipacion_check;
alter table public.preferencias_usuario
  add constraint preferencias_usuario_anticipacion_check
  check (anticipacion_minutos between 5 and 10080);

alter table public.preferencias_usuario drop constraint if exists preferencias_usuario_zona_horaria_check;
alter table public.preferencias_usuario
  add constraint preferencias_usuario_zona_horaria_check
  check (length(btrim(zona_horaria)) between 3 and 64);

alter table public.preferencias_usuario drop constraint if exists preferencias_usuario_idioma_check;
alter table public.preferencias_usuario
  add constraint preferencias_usuario_idioma_check
  check (idioma in ('es'));

comment on table public.preferencias_usuario is 'Preferencias de notificaciones del estudiante';
comment on column public.preferencias_usuario.anticipacion_minutos is 'Minimos de anticipacion para los recordatorios (5 a 10080)';

-- 2. Historial de notificaciones ---------------------------------------------

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  tipo varchar(20) not null,
  titulo varchar(200) not null,
  mensaje varchar(500) not null,
  tarea_id uuid references public.tareas (id) on delete set null,
  evento_calendario_id uuid references public.eventos_calendario (id) on delete set null,
  sesion_estudio_id uuid references public.sesiones_estudio (id) on delete set null,
  clave_idempotencia varchar(300) not null,
  fecha_actividad timestamptz not null,
  fecha_programada timestamptz not null,
  leida boolean not null default false,
  fecha_envio timestamptz,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz
);

alter table public.notificaciones drop constraint if exists notificaciones_tipo_check;
alter table public.notificaciones
  add constraint notificaciones_tipo_check
  check (tipo in ('tarea', 'evaluacion', 'sesion'));

alter table public.notificaciones drop constraint if exists notificaciones_titulo_check;
alter table public.notificaciones
  add constraint notificaciones_titulo_check
  check (length(btrim(titulo)) between 3 and 200);

alter table public.notificaciones drop constraint if exists notificaciones_mensaje_check;
alter table public.notificaciones
  add constraint notificaciones_mensaje_check
  check (length(btrim(mensaje)) between 3 and 500);

-- Cada notificacion apunta como maximo a una actividad. Si la actividad se
-- elimina, el historial se conserva con la relacion en null.
alter table public.notificaciones drop constraint if exists notificaciones_actividad_check;
alter table public.notificaciones
  add constraint notificaciones_actividad_check
  check (
    (case when tarea_id is not null then 1 else 0 end)
    + (case when evento_calendario_id is not null then 1 else 0 end)
    + (case when sesion_estudio_id is not null then 1 else 0 end) <= 1
  );

comment on table public.notificaciones is 'Historial de notificaciones y recordatorios del estudiante';
comment on column public.notificaciones.clave_idempotencia is 'Clave unica por usuario, actividad, fecha y anticipacion';
comment on column public.notificaciones.fecha_envio is 'Fecha de envio por el canal externo; null si aun no se envio';

-- 3. Indices -----------------------------------------------------------------

create unique index if not exists uq_notificaciones_idempotencia
  on public.notificaciones (usuario_id, clave_idempotencia);

create index if not exists idx_notificaciones_usuario_creacion
  on public.notificaciones (usuario_id, fecha_creacion desc);

create index if not exists idx_notificaciones_usuario_leida
  on public.notificaciones (usuario_id, leida, fecha_creacion desc);

create index if not exists idx_notificaciones_usuario_tipo
  on public.notificaciones (usuario_id, tipo, fecha_creacion desc);

create index if not exists idx_notificaciones_pendientes_envio
  on public.notificaciones (fecha_programada)
  where fecha_envio is null;

create index if not exists idx_preferencias_usuario_activas
  on public.preferencias_usuario (notificaciones_activas)
  where notificaciones_activas = true;

-- 4. Trigger de fecha de actualizacion ---------------------------------------

create or replace function public.actualizar_fecha_actualizacion_notificaciones()
returns trigger
language plpgsql
as $$
begin
  new.fecha_actualizacion = now();
  return new;
end;
$$;

drop trigger if exists trigger_actualizar_fecha_notificaciones on public.notificaciones;
create trigger trigger_actualizar_fecha_notificaciones
  before update on public.notificaciones
  for each row execute function public.actualizar_fecha_actualizacion_notificaciones();

drop trigger if exists trigger_actualizar_fecha_preferencias on public.preferencias_usuario;
create trigger trigger_actualizar_fecha_preferencias
  before update on public.preferencias_usuario
  for each row execute function public.actualizar_fecha_actualizacion_notificaciones();

-- 5. RLS ---------------------------------------------------------------------

alter table public.notificaciones enable row level security;
alter table public.preferencias_usuario enable row level security;

-- Notificaciones: el estudiante solo lee las suyas y puede marcarlas como leidas.
drop policy if exists notificaciones_select_propias on public.notificaciones;
create policy notificaciones_select_propias
  on public.notificaciones
  for select
  to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists notificaciones_update_propias on public.notificaciones;
create policy notificaciones_update_propias
  on public.notificaciones
  for update
  to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

-- Preferencias: el estudiante gestiona solo las suyas.
drop policy if exists preferencias_usuario_select_propias on public.preferencias_usuario;
create policy preferencias_usuario_select_propias
  on public.preferencias_usuario
  for select
  to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists preferencias_usuario_insert_propias on public.preferencias_usuario;
create policy preferencias_usuario_insert_propias
  on public.preferencias_usuario
  for insert
  to authenticated
  with check (auth.uid() = usuario_id);

drop policy if exists preferencias_usuario_update_propias on public.preferencias_usuario;
create policy preferencias_usuario_update_propias
  on public.preferencias_usuario
  for update
  to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

-- Minimo privilegio: la escritura de notificaciones la hace el worker con service_role.
grant select, update on public.notificaciones to authenticated;
grant all on public.notificaciones to service_role;
revoke all on public.notificaciones from anon;
revoke insert, delete on public.notificaciones from authenticated;
revoke truncate, trigger, references on public.notificaciones from authenticated;

grant select, insert, update on public.preferencias_usuario to authenticated;
grant all on public.preferencias_usuario to service_role;
revoke all on public.preferencias_usuario from anon;
revoke delete, truncate, trigger, references on public.preferencias_usuario from authenticated;
