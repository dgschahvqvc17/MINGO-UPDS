-- ============================================================================
-- MINGO - HU01: inicio de sesion y control de acceso
-- ============================================================================
-- Contenido:
--   1. Tablas de identidad: perfiles, roles y usuario_roles.
--   2. Trigger que crea el perfil y asigna el rol "estudiante" al registrarse.
--   3. Relleno de perfiles para usuarios de Auth creados antes de esta migracion.
--   4. RLS de solo lectura para el usuario autenticado.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar mas de una vez sin duplicar datos.
--
-- Nota: la escritura de perfiles y roles se hace desde el backend con la
-- service role key. El cliente autenticado solo puede leer sus propios datos.
-- ============================================================================

-- 1. Tablas ------------------------------------------------------------------

create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  nombre varchar(100) not null default '',
  apellido varchar(100) not null default '',
  correo varchar(255) not null unique,
  carrera varchar(120),
  estado varchar(20) not null default 'activo',
  fecha_creacion timestamptz not null default now(),
  constraint perfiles_auth_user_id_coincide check (auth_user_id = id)
);

-- Compatibilidad con un esquema previo que no tuviera "estado".
alter table public.perfiles
  add column if not exists estado varchar(20) not null default 'activo';

alter table public.perfiles
  drop constraint if exists perfiles_estado_check;

alter table public.perfiles
  add constraint perfiles_estado_check check (estado in ('activo', 'inactivo'));

create table if not exists public.roles (
  id serial primary key,
  nombre varchar(50) not null unique,
  descripcion text
);

create table if not exists public.usuario_roles (
  id serial primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  rol_id integer not null references public.roles (id) on delete restrict,
  unique (usuario_id, rol_id)
);

-- 2. Catalogo de roles -------------------------------------------------------

insert into public.roles (nombre, descripcion)
values
  ('estudiante', 'Acceso a su espacio academico personal.'),
  ('administrador', 'Acceso al panel administrativo y a la gestion de usuarios.')
on conflict (nombre) do nothing;

-- 3. Trigger de registro -----------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rol_estudiante_id integer;
begin
  insert into public.perfiles (id, auth_user_id, nombre, apellido, correo)
  values (
    new.id,
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_user_meta_data ->> 'apellido', ''),
    coalesce(new.email, new.id::text || '@sin-correo.mingo')
  )
  on conflict (id) do nothing;

  select id into rol_estudiante_id
  from public.roles
  where nombre = 'estudiante';

  if rol_estudiante_id is not null then
    insert into public.usuario_roles (usuario_id, rol_id)
    values (new.id, rol_estudiante_id)
    on conflict (usuario_id, rol_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Relleno de usuarios existentes -----------------------------------------

insert into public.perfiles (id, auth_user_id, nombre, apellido, correo)
select
  u.id,
  u.id,
  coalesce(u.raw_user_meta_data ->> 'nombre', ''),
  coalesce(u.raw_user_meta_data ->> 'apellido', ''),
  coalesce(u.email, u.id::text || '@sin-correo.mingo')
from auth.users u
where not exists (
  select 1 from public.perfiles p where p.id = u.id
)
on conflict (id) do nothing;

insert into public.usuario_roles (usuario_id, rol_id)
select u.id, r.id
from auth.users u
cross join public.roles r
where r.nombre = 'estudiante'
  and not exists (
    select 1 from public.usuario_roles ur where ur.usuario_id = u.id
  )
on conflict (usuario_id, rol_id) do nothing;

-- 5. RLS ---------------------------------------------------------------------

alter table public.perfiles enable row level security;
alter table public.roles enable row level security;
alter table public.usuario_roles enable row level security;

drop policy if exists perfiles_select_propio on public.perfiles;
create policy perfiles_select_propio
  on public.perfiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists roles_select_autenticados on public.roles;
create policy roles_select_autenticados
  on public.roles
  for select
  to authenticated
  using (true);

drop policy if exists usuario_roles_select_propio on public.usuario_roles;
create policy usuario_roles_select_propio
  on public.usuario_roles
  for select
  to authenticated
  using (auth.uid() = usuario_id);

-- Lectura para el usuario autenticado; la escritura queda en el backend.
grant select on public.perfiles, public.roles, public.usuario_roles to authenticated;
revoke insert, update, delete
  on public.perfiles, public.roles, public.usuario_roles
  from anon, authenticated;

-- ============================================================================
-- Asignar el rol de administrador a un usuario concreto (HU02 lo automatiza):
--
--   insert into public.usuario_roles (usuario_id, rol_id)
--   select u.id, r.id
--   from auth.users u
--   cross join public.roles r
--   where u.email = 'admin@mingo.test' and r.nombre = 'administrador'
--   on conflict (usuario_id, rol_id) do nothing;
-- ============================================================================
