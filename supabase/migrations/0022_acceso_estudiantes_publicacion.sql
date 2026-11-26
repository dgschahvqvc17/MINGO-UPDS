-- MINGO - Migración 0022: acceso real del estudiante a lo publicado
--
-- Objetivo:
--   1. Permitir que un estudiante con inscripción activa lea las preguntas y
--      opciones de un cuestionario publicado por el docente de su materia.
--   2. Permitir que el estudiante cree su intento de ese cuestionario.
--   3. Permitir que vea los eventos del calendario de sus materias.
--   4. Incluir esos eventos en la función de actividades próximas.
--
-- La definición del cuestionario sigue siendo única y compartida; la
-- separación por estudiante vive en `intentos_cuestionario` y sus respuestas.
-- No copia filas, no borra datos y no modifica calificaciones existentes.

-- 1. Función de acceso a la definición publicada ------------------------------

create or replace function public.usuario_puede_resolver_cuestionario(p_cuestionario_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1
    from public.cuestionarios c
    where c.id = p_cuestionario_id
      and c.publicado
      and public.usuario_estudiante_activo_en_materia(c.materia_id)
  );
end;
$$;

revoke all on function public.usuario_puede_resolver_cuestionario(uuid) from public, anon;
grant execute on function public.usuario_puede_resolver_cuestionario(uuid) to authenticated;

-- 2. Preguntas y opciones legibles por el destinatario de la publicación ------

drop policy if exists preguntas_select_propias on public.preguntas;
drop policy if exists preguntas_select_accesibles on public.preguntas;
create policy preguntas_select_accesibles
  on public.preguntas for select to authenticated
  using (
    exists (
      select 1
      from public.cuestionarios c
      where c.id = cuestionario_id
        and (
          c.usuario_id = auth.uid()
          or public.usuario_puede_resolver_cuestionario(c.id)
        )
    )
  );

drop policy if exists opciones_select_propias on public.opciones_pregunta;
drop policy if exists opciones_select_accesibles on public.opciones_pregunta;
create policy opciones_select_accesibles
  on public.opciones_pregunta for select to authenticated
  using (
    exists (
      select 1
      from public.preguntas p
      join public.cuestionarios c on c.id = p.cuestionario_id
      where p.id = pregunta_id
        and (
          c.usuario_id = auth.uid()
          or public.usuario_puede_resolver_cuestionario(c.id)
        )
    )
  );

-- 3. Intentos: el dueño previsualiza y el estudiante inscrito responde --------

drop policy if exists intentos_insert_propios on public.intentos_cuestionario;
drop policy if exists intentos_insert_accesibles on public.intentos_cuestionario;
create policy intentos_insert_accesibles
  on public.intentos_cuestionario for insert to authenticated
  with check (
    auth.uid() = usuario_id
    and (
      exists (
        select 1
        from public.cuestionarios c
        where c.id = cuestionario_id
          and c.usuario_id = auth.uid()
      )
      or public.usuario_puede_resolver_cuestionario(cuestionario_id)
    )
  );

-- Defensa en profundidad: el servicio ya devuelve 409, pero la base de datos
-- tambien debe impedir un segundo intento si alguien llama a PostgREST directo.
-- El docente dueno sí puede crear intentos de prueba.
create or replace function public.validar_intento_unico_estudiante()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_docente_id uuid;
begin
  select c.usuario_id into v_docente_id
  from public.cuestionarios c
  where c.id = new.cuestionario_id;

  if v_docente_id is distinct from new.usuario_id
    and exists (
      select 1
      from public.intentos_cuestionario i
      where i.usuario_id = new.usuario_id
        and i.cuestionario_id = new.cuestionario_id
    )
  then
    raise exception 'Ya iniciaste este cuestionario. Solo se permite un intento.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validar_intento_unico_estudiante() from public, anon;

drop trigger if exists trigger_validar_intento_unico_estudiante
  on public.intentos_cuestionario;
create trigger trigger_validar_intento_unico_estudiante
  before insert on public.intentos_cuestionario
  for each row execute function public.validar_intento_unico_estudiante();

-- 4. Eventos visibles para estudiantes inscritos en la materia ----------------

drop policy if exists eventos_calendario_select_propias on public.eventos_calendario;
drop policy if exists eventos_calendario_select_accesibles on public.eventos_calendario;
create policy eventos_calendario_select_accesibles
  on public.eventos_calendario for select to authenticated
  using (
    auth.uid() = usuario_id
    or (
      materia_id is not null
      and public.usuario_estudiante_activo_en_materia(materia_id)
    )
  );

-- 5. Actividades próximas: incluir eventos de materias con inscripción activa -

create or replace function public.obtener_eventos_proximos(
  p_usuario_id uuid,
  p_dias integer default 7,
  p_limite integer default 10
)
returns table (
  id uuid,
  titulo varchar,
  descripcion text,
  tipo_evento varchar,
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  recordatorio integer,
  materia_id uuid,
  materia_nombre varchar,
  materia_codigo varchar,
  materia_color varchar
)
language sql
stable
set search_path = public
as $$
  select
    e.id,
    e.titulo,
    e.descripcion,
    e.tipo_evento,
    e.fecha_inicio,
    e.fecha_fin,
    e.recordatorio,
    e.materia_id,
    m.nombre as materia_nombre,
    m.codigo as materia_codigo,
    m.color as materia_color
  from public.eventos_calendario e
  left join public.materias m on m.id = e.materia_id
  where (
      e.usuario_id = p_usuario_id
      or public.usuario_estudiante_activo_en_materia(e.materia_id)
    )
    -- Evita que un usuario consulte los próximos de otra persona pasando su ID.
    and (auth.uid() = p_usuario_id or auth.role() = 'service_role')
    and e.fecha_inicio >= now()
    and e.fecha_inicio <= now() + make_interval(days => p_dias)
  order by e.fecha_inicio asc
  limit p_limite;
$$;

revoke all on function public.obtener_eventos_proximos(uuid, integer, integer) from public;
grant execute on function public.obtener_eventos_proximos(uuid, integer, integer)
  to authenticated, service_role;
