-- =============================================================================
-- MINGO - Migración 0020: publicación de cuestionarios
-- =============================================================================
-- Contenido:
--   1. Columnas `publicado` y `fecha_publicacion` en `cuestionarios`.
--   2. Índice parcial para listar solo cuestionarios publicados por materia.
--   3. Funciones SECURITY DEFINER para comprobar docencia y matrícula activa.
--   4. Políticas RLS: el docente responsable publica y ve calificaciones; el
--      estudiante con inscripción activa solo ve cuestionarios publicados.
--
-- Contrato de autorización:
--   - Solo el dueño del cuestionario que además es `materias.docente_id` puede
--     publicar o despublicar. Un administrador o un docente ajeno NO puede
--     hacerlo, aunque tenga otros permisos.
--   - `preguntas` y `opciones_pregunta` NO se abren por RLS: contienen la
--     respuesta correcta. El backend las lee con service_role de forma acotada
--     y sanitiza la salida antes de responder.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar más de una vez sin duplicar objetos.
--
-- Requisito: migraciones 0010, 0014, 0018 y 0019 ya ejecutadas.
-- No elimina datos: los cuestionarios existentes quedan sin publicar.
-- No crea recursos AWS y no cambia el costo esperado ($0 USD/mes).
-- =============================================================================

-- 1. Columnas de publicación --------------------------------------------------

alter table public.cuestionarios
  add column if not exists publicado boolean not null default false;

alter table public.cuestionarios
  add column if not exists fecha_publicacion timestamptz;

alter table public.cuestionarios drop constraint if exists cuestionarios_publicacion_check;
alter table public.cuestionarios
  add constraint cuestionarios_publicacion_check
  check (
    (publicado and fecha_publicacion is not null)
    or (not publicado and fecha_publicacion is null)
  );

create index if not exists idx_cuestionarios_publicados_materia
  on public.cuestionarios (publicado, materia_id)
  where publicado;

comment on column public.cuestionarios.publicado is
  'Indica si el cuestionario está disponible para los estudiantes inscritos';
comment on column public.cuestionarios.fecha_publicacion is
  'Fecha de la última publicación; null cuando el cuestionario está sin publicar';

-- 2. Funciones de apoyo para RLS ---------------------------------------------

-- Se usan como SECURITY DEFINER para evitar recursión entre las políticas de
-- `cuestionarios`, `materias` e `inscripciones` (mismo patrón que la 0019).
create or replace function public.usuario_es_docente_de_materia(p_materia_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.materias m
    where m.id = p_materia_id
      and m.docente_id = auth.uid()
      and exists (
        select 1
        from public.usuario_roles ur
        join public.roles r on r.id = ur.rol_id
        where ur.usuario_id = auth.uid()
          and r.nombre = 'docente'
      )
  );
end;
$$;

create or replace function public.usuario_estudiante_activo_en_materia(p_materia_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.inscripciones i
    where i.materia_id = p_materia_id
      and i.estudiante_id = auth.uid()
      and i.estado = 'activa'
  );
end;
$$;

revoke all on function public.usuario_es_docente_de_materia(uuid) from public, anon;
grant execute on function public.usuario_es_docente_de_materia(uuid) to authenticated;

revoke all on function public.usuario_estudiante_activo_en_materia(uuid) from public, anon;
grant execute on function public.usuario_estudiante_activo_en_materia(uuid) to authenticated;

-- 3. Políticas RLS de cuestionarios ------------------------------------------

alter table public.cuestionarios enable row level security;

-- El dueño conserva el acceso histórico. El estudiante solo ve los publicados
-- de materias en las que tiene inscripción activa. Un docente no obtiene acceso
-- a cuestionarios privados generados por otras personas: sus propias
-- calificaciones se consultan con el repositorio acotado del backend.
drop policy if exists cuestionarios_select_propios on public.cuestionarios;
drop policy if exists cuestionarios_select_accesibles on public.cuestionarios;
create policy cuestionarios_select_accesibles
  on public.cuestionarios
  for select
  to authenticated
  using (
    auth.uid() = usuario_id
    or (
      publicado
      and public.usuario_estudiante_activo_en_materia(materia_id)
    )
  );

-- Solo el propietario que además es docente responsable de la materia puede
-- cambiar el estado de publicación. El permiso a nivel de columna impide que
-- modifique título, preguntas o notas.
drop policy if exists cuestionarios_update_publicacion on public.cuestionarios;
create policy cuestionarios_update_publicacion
  on public.cuestionarios
  for update
  to authenticated
  using (
    auth.uid() = usuario_id
    and public.usuario_es_docente_de_materia(materia_id)
  )
  with check (
    auth.uid() = usuario_id
    and public.usuario_es_docente_de_materia(materia_id)
  );

revoke update on public.cuestionarios from public, anon;
grant update (publicado, fecha_publicacion) on public.cuestionarios to authenticated;

-- 4. Preguntas y calificaciones ----------------------------------------------

-- `preguntas` y `opciones_pregunta` siguen siendo privadas: RLS solo permite al
-- dueño del cuestionario. El backend usa un repositorio de lectura con
-- service_role, siempre detrás de una comprobación de acceso en el servicio, y
-- elimina `respuesta_correcta`, `explicacion` y `es_correcta` de la respuesta.
-- Tampoco se abre RLS de `intentos_cuestionario` ni de `respuestas_usuario`:
-- el panel del docente usa el mismo repositorio acotado y solo devuelve nota.
comment on table public.preguntas is
  'Preguntas de un cuestionario (HU13). RLS restringido al dueño; el backend sanitiza el contenido';
