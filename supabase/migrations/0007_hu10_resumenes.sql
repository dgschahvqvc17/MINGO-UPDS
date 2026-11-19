-- ============================================================================
-- MINGO - HU10: generar resumenes inteligentes
-- ============================================================================
-- Contenido:
--   1. Tabla resumenes con cache por documento + hash + profundidad.
--   2. Tabla consumo_ia para cuotas y registro de tokens.
--   3. Indices y restricciones.
--   4. RLS: cada usuario solo accede a sus propios resumenes y consumos.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar mas de una vez sin duplicar objetos.
--
-- Requisito: supabase/migrations/0004_hu07_documentos.sql y
-- 0005_hu09_fragmentos.sql ya ejecutadas.
-- ============================================================================

-- 1. Resumenes ---------------------------------------------------------------

create table if not exists public.resumenes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  documento_id uuid not null references public.documentos (id) on delete cascade,
  profundidad varchar(10) not null,
  hash_contenido varchar(64) not null,
  resumen_general text not null,
  temas_principales jsonb not null default '[]'::jsonb,
  conceptos_importantes jsonb not null default '[]'::jsonb,
  modelo varchar(100) not null,
  tokens_entrada integer not null default 0,
  tokens_salida integer not null default 0,
  contenido_truncado boolean not null default false,
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz
);

alter table public.resumenes drop constraint if exists resumenes_profundidad_check;
alter table public.resumenes
  add constraint resumenes_profundidad_check
  check (profundidad in ('breve', 'media', 'detallada'));

alter table public.resumenes drop constraint if exists resumenes_hash_check;
alter table public.resumenes
  add constraint resumenes_hash_check
  check (hash_contenido ~ '^[0-9a-f]{64}$');

alter table public.resumenes drop constraint if exists resumenes_contenido_check;
alter table public.resumenes
  add constraint resumenes_contenido_check
  check (length(btrim(resumen_general)) > 0);

alter table public.resumenes drop constraint if exists resumenes_temas_check;
alter table public.resumenes
  add constraint resumenes_temas_check
  check (jsonb_typeof(temas_principales) = 'array');

alter table public.resumenes drop constraint if exists resumenes_conceptos_check;
alter table public.resumenes
  add constraint resumenes_conceptos_check
  check (jsonb_typeof(conceptos_importantes) = 'array');

alter table public.resumenes drop constraint if exists resumenes_tokens_check;
alter table public.resumenes
  add constraint resumenes_tokens_check
  check (tokens_entrada >= 0 and tokens_salida >= 0);

-- Cache: un mismo documento y version de contenido solo tiene un resumen
-- guardado por nivel de profundidad.
create unique index if not exists uq_resumenes_cache
  on public.resumenes (documento_id, hash_contenido, profundidad);
create index if not exists idx_resumenes_usuario_documento
  on public.resumenes (usuario_id, documento_id, fecha_creacion desc);

comment on table public.resumenes is 'Resumenes IA generados a partir de documentos procesados';
comment on column public.resumenes.hash_contenido is
  'SHA-256 de los hashes de los fragmentos; cambia si el documento se reprocesa';
comment on column public.resumenes.contenido_truncado is
  'Indica que el documento supero el limite de tokens y se resumio parcialmente';

-- 2. Consumo de IA -----------------------------------------------------------

create table if not exists public.consumo_ia (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  operacion varchar(30) not null,
  modelo varchar(100) not null,
  tokens_entrada integer not null default 0,
  tokens_salida integer not null default 0,
  costo_estimado numeric(12, 6) not null default 0,
  fecha timestamptz not null default now()
);

alter table public.consumo_ia drop constraint if exists consumo_ia_tokens_check;
alter table public.consumo_ia
  add constraint consumo_ia_tokens_check
  check (tokens_entrada >= 0 and tokens_salida >= 0);

create index if not exists idx_consumo_ia_usuario_operacion_fecha
  on public.consumo_ia (usuario_id, operacion, fecha desc);

comment on table public.consumo_ia is 'Registro de consumo por operacion de IA para cuotas y control de costos';
comment on column public.consumo_ia.costo_estimado is
  'Costo estimado en USD; se completa cuando se conozca el precio del proveedor';

-- 3. RLS ---------------------------------------------------------------------

alter table public.resumenes enable row level security;
alter table public.consumo_ia enable row level security;

drop policy if exists resumenes_select_propios on public.resumenes;
create policy resumenes_select_propios
  on public.resumenes
  for select
  to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists resumenes_insert_propios on public.resumenes;
create policy resumenes_insert_propios
  on public.resumenes
  for insert
  to authenticated
  with check (auth.uid() = usuario_id);

drop policy if exists resumenes_update_propios on public.resumenes;
create policy resumenes_update_propios
  on public.resumenes
  for update
  to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

drop policy if exists resumenes_delete_propios on public.resumenes;
create policy resumenes_delete_propios
  on public.resumenes
  for delete
  to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists consumo_ia_select_propios on public.consumo_ia;
create policy consumo_ia_select_propios
  on public.consumo_ia
  for select
  to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists consumo_ia_insert_propios on public.consumo_ia;
create policy consumo_ia_insert_propios
  on public.consumo_ia
  for insert
  to authenticated
  with check (auth.uid() = usuario_id);

grant select, insert, update, delete on public.resumenes to authenticated;
grant select, insert on public.consumo_ia to authenticated;
revoke all on public.resumenes from anon;
revoke all on public.consumo_ia from anon;
grant all on public.resumenes to service_role;
grant all on public.consumo_ia to service_role;
