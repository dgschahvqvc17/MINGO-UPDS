-- ============================================================================
-- MINGO - HU12: idempotencia de POST /asistente/chat
-- ============================================================================
-- Contenido:
--   1. Tabla solicitudes_idempotentes.
--   2. Indices y restricciones.
--   3. RLS: cada usuario solo ve y administra sus propias claves.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar mas de una vez sin duplicar objetos.
--
-- Requisito: 0001 ya ejecutada.
--
-- Nota: la tabla guarda la huella de la solicitud y la respuesta ya emitida
-- para que un reintento con la misma cabecera Idempotency-Key devuelva el mismo
-- resultado sin crear turnos duplicados. Las filas se purgan de forma
-- oportunista tras 24 horas (ver docs/api.md, seccion 17).
-- ============================================================================

-- 1. Tabla -------------------------------------------------------------------

create table if not exists public.solicitudes_idempotentes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  endpoint varchar(120) not null,
  clave varchar(100) not null,
  huella varchar(64) not null,
  estado varchar(20) not null default 'en_proceso',
  respuesta jsonb,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

alter table public.solicitudes_idempotentes
  drop constraint if exists solicitudes_idempotentes_estado_check;
alter table public.solicitudes_idempotentes
  add constraint solicitudes_idempotentes_estado_check
  check (estado in ('en_proceso', 'completado'));

alter table public.solicitudes_idempotentes
  drop constraint if exists solicitudes_idempotentes_respuesta_check;
alter table public.solicitudes_idempotentes
  add constraint solicitudes_idempotentes_respuesta_check
  check (estado = 'en_proceso' or respuesta is not null);

alter table public.solicitudes_idempotentes
  drop constraint if exists solicitudes_idempotentes_unica;
alter table public.solicitudes_idempotentes
  add constraint solicitudes_idempotentes_unica
  unique (usuario_id, endpoint, clave);

-- 2. Indices -----------------------------------------------------------------

create index if not exists idx_solicitudes_idempotentes_fecha
  on public.solicitudes_idempotentes (fecha_creacion);

comment on table public.solicitudes_idempotentes is
  'Claves Idempotency-Key de endpoints de IA con su respuesta original (HU12)';
comment on column public.solicitudes_idempotentes.huella is
  'SHA-256 del cuerpo normalizado; detecta reutilizacion de la clave con otra solicitud';
comment on column public.solicitudes_idempotentes.respuesta is
  'Respuesta 200 original devuelta al cliente; se replica en reintentos';

-- 3. RLS ---------------------------------------------------------------------

alter table public.solicitudes_idempotentes enable row level security;

drop policy if exists solicitudes_idempotentes_select_propias
  on public.solicitudes_idempotentes;
create policy solicitudes_idempotentes_select_propias
  on public.solicitudes_idempotentes for select to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists solicitudes_idempotentes_insert_propias
  on public.solicitudes_idempotentes;
create policy solicitudes_idempotentes_insert_propias
  on public.solicitudes_idempotentes for insert to authenticated
  with check (auth.uid() = usuario_id);

drop policy if exists solicitudes_idempotentes_update_propias
  on public.solicitudes_idempotentes;
create policy solicitudes_idempotentes_update_propias
  on public.solicitudes_idempotentes for update to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

drop policy if exists solicitudes_idempotentes_delete_propias
  on public.solicitudes_idempotentes;
create policy solicitudes_idempotentes_delete_propias
  on public.solicitudes_idempotentes for delete to authenticated
  using (auth.uid() = usuario_id);

-- 4. Permisos ----------------------------------------------------------------

grant select, insert, update, delete on public.solicitudes_idempotentes to authenticated;

revoke all on public.solicitudes_idempotentes from anon;

grant all on public.solicitudes_idempotentes to service_role;
