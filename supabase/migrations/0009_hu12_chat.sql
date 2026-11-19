-- ============================================================================
-- MINGO - HU12: consultar al asistente academico mediante chat
-- ============================================================================
-- Contenido:
--   1. Tablas conversaciones, mensajes y referencias_respuesta.
--   2. Indices y restricciones.
--   3. Trigger de actualizacion de la conversacion al llegar un mensaje.
--   4. RLS: cada usuario solo accede a sus conversaciones, mensajes y citas.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar mas de una vez sin duplicar objetos.
--
-- Requisito: 0001, 0004, 0005, 0007 y 0008 ya ejecutadas.
--
-- Nota: documentos.id y fragmentos_documento.id son UUID (0004 y 0005). El
-- DDL historico de base-datos.md usaba integer para esas claves foraneas; esta
-- migracion usa el tipo real para que las citas apunten a fragmentos existentes.
-- ============================================================================

-- 1. Tablas ------------------------------------------------------------------

create table if not exists public.conversaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  titulo varchar(120) not null default 'Nueva conversación',
  tipo_conversacion varchar(30) not null default 'academica',
  fecha_creacion timestamptz not null default now(),
  fecha_actualizacion timestamptz not null default now()
);

alter table public.conversaciones drop constraint if exists conversaciones_titulo_check;
alter table public.conversaciones
  add constraint conversaciones_titulo_check
  check (length(btrim(titulo)) > 0);

alter table public.conversaciones drop constraint if exists conversaciones_tipo_check;
alter table public.conversaciones
  add constraint conversaciones_tipo_check
  check (tipo_conversacion in ('academica', 'general'));

create table if not exists public.mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null
    references public.conversaciones (id) on delete cascade,
  rol_mensaje varchar(20) not null
    check (rol_mensaje in ('usuario', 'asistente', 'sistema')),
  contenido text not null,
  modelo_utilizado varchar(100),
  intencion varchar(30) not null default 'general',
  fecha_creacion timestamptz not null default now()
);

alter table public.mensajes drop constraint if exists mensajes_contenido_check;
alter table public.mensajes
  add constraint mensajes_contenido_check
  check (length(btrim(contenido)) > 0);

alter table public.mensajes drop constraint if exists mensajes_intencion_check;
alter table public.mensajes
  add constraint mensajes_intencion_check
  check (intencion in ('documental', 'general', 'sin_informacion'));

create table if not exists public.referencias_respuesta (
  id uuid primary key default gen_random_uuid(),
  mensaje_id uuid not null references public.mensajes (id) on delete cascade,
  fragmento_id uuid not null
    references public.fragmentos_documento (id) on delete cascade,
  documento_id uuid not null references public.documentos (id) on delete cascade,
  documento_nombre varchar(255) not null,
  numero_pagina integer,
  extracto text not null,
  fecha_creacion timestamptz not null default now()
);

alter table public.referencias_respuesta drop constraint if exists referencias_pagina_check;
alter table public.referencias_respuesta
  add constraint referencias_pagina_check
  check (numero_pagina is null or numero_pagina > 0);

alter table public.referencias_respuesta drop constraint if exists referencias_extracto_check;
alter table public.referencias_respuesta
  add constraint referencias_extracto_check
  check (length(btrim(extracto)) > 0);

alter table public.referencias_respuesta drop constraint if exists referencias_nombre_check;
alter table public.referencias_respuesta
  add constraint referencias_nombre_check
  check (length(btrim(documento_nombre)) > 0);

-- 2. Indices -----------------------------------------------------------------

create index if not exists idx_conversaciones_usuario_actualizacion
  on public.conversaciones (usuario_id, fecha_actualizacion desc);
create index if not exists idx_mensajes_conversacion_fecha
  on public.mensajes (conversacion_id, fecha_creacion);
create index if not exists idx_referencias_mensaje
  on public.referencias_respuesta (mensaje_id);
create index if not exists idx_referencias_fragmento
  on public.referencias_respuesta (fragmento_id);
create index if not exists idx_referencias_documento
  on public.referencias_respuesta (documento_id);

comment on table public.conversaciones is 'Conversaciones del chat academico con MINGO (HU12)';
comment on table public.mensajes is 'Mensajes usuario/asistente de cada conversacion (HU12)';
comment on table public.referencias_respuesta is 'Fuentes documentales citadas por una respuesta del asistente (HU12)';
comment on column public.mensajes.intencion is
  'Clasificacion determinista del turno: documental, general o sin_informacion';

-- 3. Actualizacion de la conversacion ----------------------------------------

create or replace function public.actualizar_fecha_conversacion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversaciones
     set fecha_actualizacion = now()
   where id = new.conversacion_id;
  return new;
end;
$$;

drop trigger if exists on_mensaje_creado on public.mensajes;
create trigger on_mensaje_creado
  after insert on public.mensajes
  for each row execute function public.actualizar_fecha_conversacion();

-- 4. RLS ---------------------------------------------------------------------

alter table public.conversaciones enable row level security;
alter table public.mensajes enable row level security;
alter table public.referencias_respuesta enable row level security;

-- conversaciones: propiedad directa.
drop policy if exists conversaciones_select_propias on public.conversaciones;
create policy conversaciones_select_propias
  on public.conversaciones for select to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists conversaciones_insert_propias on public.conversaciones;
create policy conversaciones_insert_propias
  on public.conversaciones for insert to authenticated
  with check (auth.uid() = usuario_id);

drop policy if exists conversaciones_update_propias on public.conversaciones;
create policy conversaciones_update_propias
  on public.conversaciones for update to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

drop policy if exists conversaciones_delete_propias on public.conversaciones;
create policy conversaciones_delete_propias
  on public.conversaciones for delete to authenticated
  using (auth.uid() = usuario_id);

-- mensajes: propiedad indirecta a traves de la conversacion.
drop policy if exists mensajes_select_propios on public.mensajes;
create policy mensajes_select_propios
  on public.mensajes for select to authenticated
  using (
    exists (
      select 1 from public.conversaciones c
      where c.id = conversacion_id and c.usuario_id = auth.uid()
    )
  );

drop policy if exists mensajes_insert_propios on public.mensajes;
create policy mensajes_insert_propios
  on public.mensajes for insert to authenticated
  with check (
    exists (
      select 1 from public.conversaciones c
      where c.id = conversacion_id and c.usuario_id = auth.uid()
    )
  );

drop policy if exists mensajes_delete_propios on public.mensajes;
create policy mensajes_delete_propios
  on public.mensajes for delete to authenticated
  using (
    exists (
      select 1 from public.conversaciones c
      where c.id = conversacion_id and c.usuario_id = auth.uid()
    )
  );

-- referencias: propiedad indirecta mensaje -> conversacion.
drop policy if exists referencias_select_propias on public.referencias_respuesta;
create policy referencias_select_propias
  on public.referencias_respuesta for select to authenticated
  using (
    exists (
      select 1
      from public.mensajes m
      join public.conversaciones c on c.id = m.conversacion_id
      where m.id = mensaje_id and c.usuario_id = auth.uid()
    )
  );

drop policy if exists referencias_insert_propias on public.referencias_respuesta;
create policy referencias_insert_propias
  on public.referencias_respuesta for insert to authenticated
  with check (
    exists (
      select 1
      from public.mensajes m
      join public.conversaciones c on c.id = m.conversacion_id
      where m.id = mensaje_id and c.usuario_id = auth.uid()
    )
  );

drop policy if exists referencias_delete_propias on public.referencias_respuesta;
create policy referencias_delete_propias
  on public.referencias_respuesta for delete to authenticated
  using (
    exists (
      select 1
      from public.mensajes m
      join public.conversaciones c on c.id = m.conversacion_id
      where m.id = mensaje_id and c.usuario_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.conversaciones to authenticated;
grant select, insert, delete on public.mensajes to authenticated;
grant select, insert, delete on public.referencias_respuesta to authenticated;

revoke all on public.conversaciones from anon;
revoke all on public.mensajes from anon;
revoke all on public.referencias_respuesta from anon;

grant all on public.conversaciones to service_role;
grant all on public.mensajes to service_role;
grant all on public.referencias_respuesta to service_role;
