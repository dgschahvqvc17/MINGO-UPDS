-- ============================================================================
-- MINGO - HU17: gestionar objetivos y progreso academico
-- ============================================================================
-- Contenido:
--   1. Tabla objetivos_estudio con materia opcional, fecha limite y estado.
--   2. Indices, restricciones y trigger de fecha de actualizacion.
--   3. RLS: cada usuario solo accede a sus objetivos.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar mas de una vez sin duplicar objetos.
--
-- Requisito: 0001 (perfiles), materias y 0013 (planes, para la convencion de
-- triggers de fecha_actualizacion) ya ejecutadas.
-- ============================================================================

-- 1. Objetivos de estudio ----------------------------------------------------

create table if not exists public.objetivos_estudio (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  materia_id uuid references public.materias (id) on delete set null,
  titulo varchar(150) not null,
  descripcion text,
  fecha_limite date,
  estado varchar(20) not null default 'pendiente',
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz
);

alter table public.objetivos_estudio drop constraint if exists objetivos_titulo_check;
alter table public.objetivos_estudio
  add constraint objetivos_titulo_check
  check (length(btrim(titulo)) between 5 and 150);

alter table public.objetivos_estudio drop constraint if exists objetivos_descripcion_check;
alter table public.objetivos_estudio
  add constraint objetivos_descripcion_check
  check (descripcion is null or length(btrim(descripcion)) <= 1000);

alter table public.objetivos_estudio drop constraint if exists objetivos_estado_check;
alter table public.objetivos_estudio
  add constraint objetivos_estado_check
  check (estado in ('pendiente', 'en_progreso', 'completada'));

create index if not exists idx_objetivos_usuario_estado
  on public.objetivos_estudio (usuario_id, estado);
create index if not exists idx_objetivos_usuario_fecha_limite
  on public.objetivos_estudio (usuario_id, fecha_limite);
create index if not exists idx_objetivos_materia
  on public.objetivos_estudio (materia_id);

comment on table public.objetivos_estudio is
  'Objetivos academicos del estudiante con materia, fecha limite y estado (HU17)';
comment on column public.objetivos_estudio.estado is
  'pendiente, en_progreso o completada; el progreso agregado se calcula en el backend (HU17)';

-- 2. Trigger de fecha de actualizacion --------------------------------------

create or replace function public.actualizar_fecha_actualizacion_objetivos_estudio()
returns trigger
language plpgsql
as $$
begin
  new.fecha_actualizacion = now();
  return new;
end;
$$;

drop trigger if exists trigger_actualizar_fecha_objetivos_estudio on public.objetivos_estudio;
create trigger trigger_actualizar_fecha_objetivos_estudio
  before update on public.objetivos_estudio
  for each row execute function public.actualizar_fecha_actualizacion_objetivos_estudio();

-- 3. RLS ---------------------------------------------------------------------

alter table public.objetivos_estudio enable row level security;

drop policy if exists objetivos_select_propios on public.objetivos_estudio;
create policy objetivos_select_propios
  on public.objetivos_estudio for select to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists objetivos_insert_propios on public.objetivos_estudio;
create policy objetivos_insert_propios
  on public.objetivos_estudio for insert to authenticated
  with check (
    auth.uid() = usuario_id
    and (
      materia_id is null
      or exists (
        select 1 from public.materias m
        where m.id = materia_id and m.usuario_id = auth.uid()
      )
    )
  );

drop policy if exists objetivos_update_propios on public.objetivos_estudio;
create policy objetivos_update_propios
  on public.objetivos_estudio for update to authenticated
  using (auth.uid() = usuario_id)
  with check (
    auth.uid() = usuario_id
    and (
      materia_id is null
      or exists (
        select 1 from public.materias m
        where m.id = materia_id and m.usuario_id = auth.uid()
      )
    )
  );

drop policy if exists objetivos_delete_propios on public.objetivos_estudio;
create policy objetivos_delete_propios
  on public.objetivos_estudio for delete to authenticated
  using (auth.uid() = usuario_id);

-- 4. Permisos ----------------------------------------------------------------

grant select, insert, update, delete on public.objetivos_estudio to authenticated;
grant all on public.objetivos_estudio to service_role;
revoke all on public.objetivos_estudio from anon;
