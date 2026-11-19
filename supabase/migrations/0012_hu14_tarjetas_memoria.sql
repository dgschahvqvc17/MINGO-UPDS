-- ============================================================================
-- MINGO - HU14: crear tarjetas de memoria para estudiar
-- ============================================================================
-- Contenido:
--   1. Tablas conjuntos_tarjetas y tarjetas.
--   2. Indices y restricciones.
--   3. RLS: cada usuario solo accede a sus conjuntos y tarjetas.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar mas de una vez sin duplicar objetos.
--
-- Requisito: 0001 (perfiles), backend/sql/materias.sql, 0004 (documentos) y
-- 0007 (consumo_ia) ya ejecutadas.
-- ============================================================================

-- 1. Conjuntos de tarjetas ----------------------------------------------------

create table if not exists public.conjuntos_tarjetas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  materia_id uuid not null references public.materias (id) on delete cascade,
  documento_id uuid references public.documentos (id) on delete set null,
  titulo varchar(200) not null,
  cantidad_tarjetas integer not null,
  modelo varchar(100) not null,
  tokens_entrada integer not null default 0,
  tokens_salida integer not null default 0,
  fecha_creacion timestamptz not null default now()
);

alter table public.conjuntos_tarjetas drop constraint if exists conjuntos_tarjetas_titulo_check;
alter table public.conjuntos_tarjetas
  add constraint conjuntos_tarjetas_titulo_check
  check (length(btrim(titulo)) > 0);

alter table public.conjuntos_tarjetas drop constraint if exists conjuntos_tarjetas_cantidad_check;
alter table public.conjuntos_tarjetas
  add constraint conjuntos_tarjetas_cantidad_check
  check (cantidad_tarjetas between 5 and 30);

alter table public.conjuntos_tarjetas drop constraint if exists conjuntos_tarjetas_tokens_check;
alter table public.conjuntos_tarjetas
  add constraint conjuntos_tarjetas_tokens_check
  check (tokens_entrada >= 0 and tokens_salida >= 0);

-- 2. Tarjetas ----------------------------------------------------------------

create table if not exists public.tarjetas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  conjunto_id uuid not null
    references public.conjuntos_tarjetas (id) on delete cascade,
  orden integer not null,
  frente text not null,
  reverso text not null,
  estado varchar(20) not null default 'sin_revisar',
  fecha_actualizacion timestamptz not null default now()
);

alter table public.tarjetas drop constraint if exists tarjetas_orden_check;
alter table public.tarjetas
  add constraint tarjetas_orden_check
  check (orden > 0);

alter table public.tarjetas drop constraint if exists tarjetas_frente_check;
alter table public.tarjetas
  add constraint tarjetas_frente_check
  check (length(btrim(frente)) between 2 and 1000);

alter table public.tarjetas drop constraint if exists tarjetas_reverso_check;
alter table public.tarjetas
  add constraint tarjetas_reverso_check
  check (length(btrim(reverso)) between 2 and 1200);

alter table public.tarjetas drop constraint if exists tarjetas_estado_check;
alter table public.tarjetas
  add constraint tarjetas_estado_check
  check (estado in ('sin_revisar', 'conocida', 'repaso'));

create unique index if not exists uq_tarjetas_conjunto_orden
  on public.tarjetas (conjunto_id, orden);

create index if not exists idx_conjuntos_tarjetas_usuario_fecha
  on public.conjuntos_tarjetas (usuario_id, fecha_creacion desc);

create index if not exists idx_conjuntos_tarjetas_materia
  on public.conjuntos_tarjetas (materia_id);

create index if not exists idx_conjuntos_tarjetas_documento
  on public.conjuntos_tarjetas (documento_id);

create index if not exists idx_tarjetas_conjunto_orden
  on public.tarjetas (conjunto_id, orden);

create index if not exists idx_tarjetas_usuario_conjunto
  on public.tarjetas (usuario_id, conjunto_id);

create index if not exists idx_tarjetas_conjunto_estado
  on public.tarjetas (conjunto_id, estado);

-- 3. Row Level Security -------------------------------------------------------

alter table public.conjuntos_tarjetas enable row level security;
alter table public.tarjetas enable row level security;

-- conjuntos_tarjetas: propiedad directa.
drop policy if exists conjuntos_tarjetas_select_propios on public.conjuntos_tarjetas;
create policy conjuntos_tarjetas_select_propios
  on public.conjuntos_tarjetas for select to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists conjuntos_tarjetas_insert_propios on public.conjuntos_tarjetas;
create policy conjuntos_tarjetas_insert_propios
  on public.conjuntos_tarjetas for insert to authenticated
  with check (auth.uid() = usuario_id);

drop policy if exists conjuntos_tarjetas_delete_propios on public.conjuntos_tarjetas;
create policy conjuntos_tarjetas_delete_propios
  on public.conjuntos_tarjetas for delete to authenticated
  using (auth.uid() = usuario_id);

-- tarjetas: propiedad directa; ademas el conjunto debe pertenecer al usuario.
drop policy if exists tarjetas_select_propias on public.tarjetas;
create policy tarjetas_select_propias
  on public.tarjetas for select to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists tarjetas_insert_propias on public.tarjetas;
create policy tarjetas_insert_propias
  on public.tarjetas for insert to authenticated
  with check (
    auth.uid() = usuario_id
    and exists (
      select 1 from public.conjuntos_tarjetas c
      where c.id = conjunto_id and c.usuario_id = auth.uid()
    )
  );

drop policy if exists tarjetas_update_propias on public.tarjetas;
create policy tarjetas_update_propias
  on public.tarjetas for update to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

drop policy if exists tarjetas_delete_propias on public.tarjetas;
create policy tarjetas_delete_propias
  on public.tarjetas for delete to authenticated
  using (auth.uid() = usuario_id);

-- 4. Permisos ----------------------------------------------------------------

grant select, insert, delete on public.conjuntos_tarjetas to authenticated;
grant select, insert, update, delete on public.tarjetas to authenticated;

revoke all on public.conjuntos_tarjetas from anon;
revoke all on public.tarjetas from anon;

grant all on public.conjuntos_tarjetas to service_role;
grant all on public.tarjetas to service_role;
