-- ============================================================================
-- MINGO - HU07: cargar documentos academicos
-- ============================================================================
-- Contenido:
--   1. Tabla documentos con sus restricciones.
--   2. Indices para listados y filtros.
--   3. Trigger de fecha de actualizacion.
--   4. RLS: cada usuario solo accede a sus propios documentos.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar mas de una vez sin duplicar objetos.
--
-- Requisito: las tablas public.perfiles y public.materias deben existir.
-- ============================================================================

-- 1. Tabla -------------------------------------------------------------------

create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  materia_id uuid not null references public.materias (id) on delete cascade,
  -- Sin FK todavia: la tabla public.unidades llega con HU03. Cuando exista,
  -- se agrega la referencia y esta columna pasa a ser la organizacion real.
  unidad_id uuid,
  nombre varchar(255) not null,
  nombre_archivo varchar(255) not null,
  ruta_almacenamiento text not null,
  tipo_archivo varchar(120) not null,
  tamano bigint not null,
  estado_procesamiento varchar(20) not null default 'pendiente',
  motivo_error text,
  numero_paginas integer,
  fecha_carga timestamptz not null default now(),
  fecha_actualizacion timestamptz
);

alter table public.documentos drop constraint if exists documentos_estado_check;
alter table public.documentos
  add constraint documentos_estado_check
  check (estado_procesamiento in ('pendiente', 'en_cola', 'procesando', 'procesado', 'error'));

-- El limite es el mismo que valida la aplicacion: 20 MB.
alter table public.documentos drop constraint if exists documentos_tamano_check;
alter table public.documentos
  add constraint documentos_tamano_check
  check (tamano > 0 and tamano <= 20971520);

-- Todo objeto debe vivir bajo la carpeta del usuario dueno.
alter table public.documentos drop constraint if exists documentos_ruta_check;
alter table public.documentos
  add constraint documentos_ruta_check
  check (ruta_almacenamiento like 'usuarios/%');

-- 2. Indices -----------------------------------------------------------------

create unique index if not exists uq_documentos_ruta_almacenamiento
  on public.documentos (ruta_almacenamiento);
create index if not exists idx_documentos_usuario_id on public.documentos (usuario_id);
create index if not exists idx_documentos_materia_id on public.documentos (materia_id);
create index if not exists idx_documentos_unidad_id on public.documentos (unidad_id);
create index if not exists idx_documentos_estado on public.documentos (estado_procesamiento);
create index if not exists idx_documentos_usuario_fecha
  on public.documentos (usuario_id, fecha_carga desc);

comment on table public.documentos is 'Metadatos de los documentos academicos; el archivo vive en S3';
comment on column public.documentos.usuario_id is 'Usuario dueno del documento';
comment on column public.documentos.materia_id is 'Materia a la que pertenece el documento';
comment on column public.documentos.unidad_id is 'Unidad academica; nula hasta que exista HU03';
comment on column public.documentos.ruta_almacenamiento is 'Clave del objeto en S3: usuarios/<usuario_id>/documentos/...';
comment on column public.documentos.tamano is 'Tamano real del objeto en bytes, leido desde S3';
comment on column public.documentos.estado_procesamiento is 'pendiente, en_cola, procesando, procesado o error';

-- 3. Trigger de fecha de actualizacion ---------------------------------------

create or replace function public.actualizar_fecha_actualizacion_documentos()
returns trigger
language plpgsql
as $$
begin
  new.fecha_actualizacion = now();
  return new;
end;
$$;

drop trigger if exists trigger_actualizar_fecha_documentos on public.documentos;

create trigger trigger_actualizar_fecha_documentos
  before update on public.documentos
  for each row execute function public.actualizar_fecha_actualizacion_documentos();

-- 4. RLS ---------------------------------------------------------------------

alter table public.documentos enable row level security;

drop policy if exists documentos_select_propios on public.documentos;
create policy documentos_select_propios
  on public.documentos
  for select
  to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists documentos_insert_propios on public.documentos;
create policy documentos_insert_propios
  on public.documentos
  for insert
  to authenticated
  with check (auth.uid() = usuario_id);

drop policy if exists documentos_update_propios on public.documentos;
create policy documentos_update_propios
  on public.documentos
  for update
  to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

drop policy if exists documentos_delete_propios on public.documentos;
create policy documentos_delete_propios
  on public.documentos
  for delete
  to authenticated
  using (auth.uid() = usuario_id);

grant select, insert, update, delete on public.documentos to authenticated;
revoke all on public.documentos from anon;
