-- =============================================================================
-- MINGO - Migración 0021: visibilidad de tareas y ventana de cuestionarios
-- =============================================================================
-- Contenido:
--   1. Columnas `fecha_inicio` y `fecha_limite` en `cuestionarios`, con
--      backfill de los cuestionarios ya publicados y restricción de ventana.
--   2. Corrección de la política RLS de `tareas`: un estudiante inscrito ve las
--      tareas académicas de la materia, aunque `tareas.docente_id` esté vacío o
--      la tarea la haya creado un administrador.
--   3. Permisos de columna para actualizar la ventana de publicación.
--
-- Contrato:
--   - No elimina ni renombra datos.
--   - Los cuestionarios publicados existentes reciben una ventana de 7 días
--     desde su `fecha_publicacion` para no dejarlos inaccesibles.
--   - Las tareas personales siguen siendo visibles solo para su propietario:
--     la política exige inscripción activa y una materia con docente responsable.
--   - No crea recursos AWS y no cambia el costo esperado ($0 USD/mes).
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar más de una vez sin duplicar objetos.
--
-- Requisito: migraciones 0002, 0003, 0018 y 0020 ya ejecutadas.
-- =============================================================================

-- 1. Ventana de publicación de cuestionarios ---------------------------------

alter table public.cuestionarios
  add column if not exists fecha_inicio timestamptz;

alter table public.cuestionarios
  add column if not exists fecha_limite timestamptz;

-- Los cuestionarios ya publicados no tenían ventana. Se les asigna una semana
-- desde su publicación para conservar el comportamiento anterior sin dejar
-- filas publicadas sin fechas.
update public.cuestionarios
set
  fecha_inicio = coalesce(fecha_publicacion, fecha_creacion),
  fecha_limite = coalesce(fecha_publicacion, fecha_creacion) + interval '7 days'
where publicado
  and (fecha_inicio is null or fecha_limite is null);

alter table public.cuestionarios drop constraint if exists cuestionarios_ventana_check;
alter table public.cuestionarios
  add constraint cuestionarios_ventana_check
  check (
    case
      when publicado then
        fecha_inicio is not null
        and fecha_limite is not null
        and fecha_limite >= fecha_inicio
      else
        fecha_inicio is null and fecha_limite is null
    end
  );

create index if not exists idx_cuestionarios_ventana
  on public.cuestionarios (publicado, fecha_inicio, fecha_limite)
  where publicado;

comment on column public.cuestionarios.fecha_inicio is
  'Inicio de la ventana en la que el estudiante puede resolver el cuestionario';
comment on column public.cuestionarios.fecha_limite is
  'Fecha límite para resolver el cuestionario; el backend bloquea los intentos fuera de la ventana';

-- La política de actualización de 0020 solo permitía dos columnas. Se amplía
-- para que el docente responsable pueda programar la ventana de publicación.
revoke update on public.cuestionarios from public, anon;
grant update (publicado, fecha_publicacion, fecha_inicio, fecha_limite)
  on public.cuestionarios to authenticated;

-- 2. Visibilidad real de tareas para estudiantes -----------------------------

-- La migración 0018 condicionaba la visibilidad a `tareas.docente_id is not
-- null`. Las tareas heredadas y las creadas por administración quedaban ocultas
-- para estudiantes inscritos. Esta función centraliza la regla sin recursion
-- RLS entre `tareas`, `materias` e `inscripciones`.
create or replace function public.usuario_puede_ver_tarea(p_tarea_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tareas t
    join public.materias m on m.id = t.materia_id
    join public.inscripciones i on i.materia_id = m.id
    where t.id = p_tarea_id
      and i.estudiante_id = auth.uid()
      and i.estado = 'activa'
      and m.docente_id is not null
      and (
        coalesce(t.docente_id, m.docente_id) = m.docente_id
        or exists (
          select 1
          from public.usuario_roles ur
          join public.roles r on r.id = ur.rol_id
          where ur.usuario_id = t.usuario_id
            and r.nombre = 'administrador'
        )
      )
  );
$$;

revoke all on function public.usuario_puede_ver_tarea(uuid) from public, anon;
grant execute on function public.usuario_puede_ver_tarea(uuid) to authenticated;

drop policy if exists tareas_select_accesibles on public.tareas;
create policy tareas_select_accesibles
  on public.tareas
  for select
  to authenticated
  using (
    auth.uid() = usuario_id
    or auth.uid() = docente_id
    or public.usuario_puede_ver_tarea(id)
  );

comment on function public.usuario_puede_ver_tarea(uuid) is
  'True cuando el usuario tiene inscripción activa en la materia académica de la tarea';
