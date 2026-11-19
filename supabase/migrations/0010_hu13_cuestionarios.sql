-- ============================================================================
-- MINGO - HU13: generar cuestionarios y evaluaciones
-- ============================================================================
-- Contenido:
--   1. Tablas cuestionarios, preguntas y opciones_pregunta.
--   2. Tablas intentos_cuestionario y respuestas_usuario.
--   3. Indices y restricciones.
--   4. RLS: cada usuario solo accede a sus cuestionarios, intentos y respuestas.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar mas de una vez sin duplicar objetos.
--
-- Requisito: 0001, 0003, 0004 y 0005 ya ejecutadas.
--
-- Nota: el DDL historico de base-datos.md usaba SERIAL para cuestionarios,
-- preguntas y opciones. Esta migracion usa UUID para alinearse con el resto
-- del dominio y con los modelos del frontend.
-- ============================================================================

-- 1. Cuestionarios -----------------------------------------------------------

create table if not exists public.cuestionarios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  materia_id uuid not null references public.materias (id) on delete cascade,
  documento_id uuid references public.documentos (id) on delete set null,
  titulo varchar(200) not null,
  dificultad varchar(20) not null default 'intermedia',
  cantidad_preguntas integer not null,
  tipos jsonb not null default '[]'::jsonb,
  modelo varchar(100) not null,
  tokens_entrada integer not null default 0,
  tokens_salida integer not null default 0,
  fecha_creacion timestamptz not null default now()
);

alter table public.cuestionarios drop constraint if exists cuestionarios_titulo_check;
alter table public.cuestionarios
  add constraint cuestionarios_titulo_check
  check (length(btrim(titulo)) > 0);

alter table public.cuestionarios drop constraint if exists cuestionarios_dificultad_check;
alter table public.cuestionarios
  add constraint cuestionarios_dificultad_check
  check (dificultad in ('basica', 'intermedia', 'avanzada'));

alter table public.cuestionarios drop constraint if exists cuestionarios_cantidad_check;
alter table public.cuestionarios
  add constraint cuestionarios_cantidad_check
  check (cantidad_preguntas between 5 and 20);

alter table public.cuestionarios drop constraint if exists cuestionarios_tipos_check;
alter table public.cuestionarios
  add constraint cuestionarios_tipos_check
  check (
    jsonb_typeof(tipos) = 'array'
    and jsonb_array_length(tipos) between 1 and 3
  );

alter table public.cuestionarios drop constraint if exists cuestionarios_tokens_check;
alter table public.cuestionarios
  add constraint cuestionarios_tokens_check
  check (tokens_entrada >= 0 and tokens_salida >= 0);

-- 2. Preguntas y opciones ----------------------------------------------------

create table if not exists public.preguntas (
  id uuid primary key default gen_random_uuid(),
  cuestionario_id uuid not null
    references public.cuestionarios (id) on delete cascade,
  orden integer not null,
  enunciado text not null,
  tipo_pregunta varchar(30) not null,
  respuesta_correcta text not null,
  explicacion text not null,
  fecha_creacion timestamptz not null default now()
);

alter table public.preguntas drop constraint if exists preguntas_orden_check;
alter table public.preguntas
  add constraint preguntas_orden_check
  check (orden > 0);

alter table public.preguntas drop constraint if exists preguntas_enunciado_check;
alter table public.preguntas
  add constraint preguntas_enunciado_check
  check (length(btrim(enunciado)) > 0);

alter table public.preguntas drop constraint if exists preguntas_tipo_check;
alter table public.preguntas
  add constraint preguntas_tipo_check
  check (tipo_pregunta in ('opcion_multiple', 'verdadero_falso', 'abierta'));

alter table public.preguntas drop constraint if exists preguntas_respuesta_check;
alter table public.preguntas
  add constraint preguntas_respuesta_check
  check (length(btrim(respuesta_correcta)) > 0);

alter table public.preguntas drop constraint if exists preguntas_explicacion_check;
alter table public.preguntas
  add constraint preguntas_explicacion_check
  check (length(btrim(explicacion)) > 0);

create unique index if not exists uq_preguntas_cuestionario_orden
  on public.preguntas (cuestionario_id, orden);

create table if not exists public.opciones_pregunta (
  id uuid primary key default gen_random_uuid(),
  pregunta_id uuid not null
    references public.preguntas (id) on delete cascade,
  orden integer not null,
  contenido text not null,
  es_correcta boolean not null default false,
  fecha_creacion timestamptz not null default now()
);

alter table public.opciones_pregunta drop constraint if exists opciones_orden_check;
alter table public.opciones_pregunta
  add constraint opciones_orden_check
  check (orden > 0);

alter table public.opciones_pregunta drop constraint if exists opciones_contenido_check;
alter table public.opciones_pregunta
  add constraint opciones_contenido_check
  check (length(btrim(contenido)) > 0);

create unique index if not exists uq_opciones_pregunta_orden
  on public.opciones_pregunta (pregunta_id, orden);

-- 3. Intentos y respuestas ---------------------------------------------------

create table if not exists public.intentos_cuestionario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  cuestionario_id uuid not null
    references public.cuestionarios (id) on delete cascade,
  estado varchar(20) not null default 'en_progreso',
  total_preguntas integer not null,
  preguntas_objetivas integer not null default 0,
  respuestas_correctas integer not null default 0,
  puntuacion numeric(5, 2),
  fecha_inicio timestamptz not null default now(),
  fecha_finalizacion timestamptz
);

alter table public.intentos_cuestionario drop constraint if exists intentos_estado_check;
alter table public.intentos_cuestionario
  add constraint intentos_estado_check
  check (estado in ('en_progreso', 'finalizado'));

alter table public.intentos_cuestionario drop constraint if exists intentos_totales_check;
alter table public.intentos_cuestionario
  add constraint intentos_totales_check
  check (
    total_preguntas between 1 and 20
    and preguntas_objetivas between 0 and total_preguntas
    and respuestas_correctas between 0 and preguntas_objetivas
  );

alter table public.intentos_cuestionario drop constraint if exists intentos_puntuacion_check;
alter table public.intentos_cuestionario
  add constraint intentos_puntuacion_check
  check (puntuacion is null or (puntuacion >= 0 and puntuacion <= 100));

create table if not exists public.respuestas_usuario (
  id uuid primary key default gen_random_uuid(),
  intento_id uuid not null
    references public.intentos_cuestionario (id) on delete cascade,
  pregunta_id uuid not null
    references public.preguntas (id) on delete cascade,
  respuesta text not null,
  es_correcta boolean,
  fecha_creacion timestamptz not null default now()
);

alter table public.respuestas_usuario drop constraint if exists respuestas_texto_check;
alter table public.respuestas_usuario
  add constraint respuestas_texto_check
  check (length(btrim(respuesta)) > 0);

create unique index if not exists uq_respuestas_intento_pregunta
  on public.respuestas_usuario (intento_id, pregunta_id);

-- 4. Indices -----------------------------------------------------------------

create index if not exists idx_cuestionarios_usuario_fecha
  on public.cuestionarios (usuario_id, fecha_creacion desc);
create index if not exists idx_cuestionarios_materia
  on public.cuestionarios (materia_id, fecha_creacion desc);
create index if not exists idx_cuestionarios_documento
  on public.cuestionarios (documento_id);
create index if not exists idx_preguntas_cuestionario
  on public.preguntas (cuestionario_id, orden);
create index if not exists idx_opciones_pregunta
  on public.opciones_pregunta (pregunta_id, orden);
create index if not exists idx_intentos_usuario_fecha
  on public.intentos_cuestionario (usuario_id, fecha_inicio desc);
create index if not exists idx_intentos_cuestionario
  on public.intentos_cuestionario (cuestionario_id, fecha_inicio desc);
create index if not exists idx_respuestas_intento
  on public.respuestas_usuario (intento_id);

comment on table public.cuestionarios is 'Cuestionarios generados con IA (HU13)';
comment on table public.preguntas is 'Preguntas de un cuestionario (HU13)';
comment on table public.opciones_pregunta is 'Alternativas de las preguntas de seleccion (HU13)';
comment on table public.intentos_cuestionario is 'Intentos de resolucion de un cuestionario (HU13/HU16)';
comment on table public.respuestas_usuario is 'Respuestas del estudiante y resultado por pregunta (HU13/HU16)';
comment on column public.intentos_cuestionario.puntuacion is
  'Porcentaje sobre preguntas objetivas; null mientras el intento esta en progreso o si solo hay preguntas abiertas';
comment on column public.respuestas_usuario.es_correcta is
  'true/false en preguntas objetivas; null en abiertas hasta la evaluacion de HU16';

-- 5. RLS ---------------------------------------------------------------------

alter table public.cuestionarios enable row level security;
alter table public.preguntas enable row level security;
alter table public.opciones_pregunta enable row level security;
alter table public.intentos_cuestionario enable row level security;
alter table public.respuestas_usuario enable row level security;

-- cuestionarios: propiedad directa.
drop policy if exists cuestionarios_select_propios on public.cuestionarios;
create policy cuestionarios_select_propios
  on public.cuestionarios for select to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists cuestionarios_insert_propios on public.cuestionarios;
create policy cuestionarios_insert_propios
  on public.cuestionarios for insert to authenticated
  with check (auth.uid() = usuario_id);

drop policy if exists cuestionarios_delete_propios on public.cuestionarios;
create policy cuestionarios_delete_propios
  on public.cuestionarios for delete to authenticated
  using (auth.uid() = usuario_id);

-- preguntas: propiedad indirecta a traves del cuestionario.
drop policy if exists preguntas_select_propias on public.preguntas;
create policy preguntas_select_propias
  on public.preguntas for select to authenticated
  using (
    exists (
      select 1 from public.cuestionarios c
      where c.id = cuestionario_id and c.usuario_id = auth.uid()
    )
  );

drop policy if exists preguntas_insert_propias on public.preguntas;
create policy preguntas_insert_propias
  on public.preguntas for insert to authenticated
  with check (
    exists (
      select 1 from public.cuestionarios c
      where c.id = cuestionario_id and c.usuario_id = auth.uid()
    )
  );

drop policy if exists preguntas_delete_propias on public.preguntas;
create policy preguntas_delete_propias
  on public.preguntas for delete to authenticated
  using (
    exists (
      select 1 from public.cuestionarios c
      where c.id = cuestionario_id and c.usuario_id = auth.uid()
    )
  );

-- opciones: propiedad indirecta pregunta -> cuestionario.
drop policy if exists opciones_select_propias on public.opciones_pregunta;
create policy opciones_select_propias
  on public.opciones_pregunta for select to authenticated
  using (
    exists (
      select 1
      from public.preguntas p
      join public.cuestionarios c on c.id = p.cuestionario_id
      where p.id = pregunta_id and c.usuario_id = auth.uid()
    )
  );

drop policy if exists opciones_insert_propias on public.opciones_pregunta;
create policy opciones_insert_propias
  on public.opciones_pregunta for insert to authenticated
  with check (
    exists (
      select 1
      from public.preguntas p
      join public.cuestionarios c on c.id = p.cuestionario_id
      where p.id = pregunta_id and c.usuario_id = auth.uid()
    )
  );

drop policy if exists opciones_delete_propias on public.opciones_pregunta;
create policy opciones_delete_propias
  on public.opciones_pregunta for delete to authenticated
  using (
    exists (
      select 1
      from public.preguntas p
      join public.cuestionarios c on c.id = p.cuestionario_id
      where p.id = pregunta_id and c.usuario_id = auth.uid()
    )
  );

-- intentos: propiedad directa; el cuestionario tambien debe ser propio.
drop policy if exists intentos_select_propios on public.intentos_cuestionario;
create policy intentos_select_propios
  on public.intentos_cuestionario for select to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists intentos_insert_propios on public.intentos_cuestionario;
create policy intentos_insert_propios
  on public.intentos_cuestionario for insert to authenticated
  with check (
    auth.uid() = usuario_id
    and exists (
      select 1 from public.cuestionarios c
      where c.id = cuestionario_id and c.usuario_id = auth.uid()
    )
  );

drop policy if exists intentos_update_propios on public.intentos_cuestionario;
create policy intentos_update_propios
  on public.intentos_cuestionario for update to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

drop policy if exists intentos_delete_propios on public.intentos_cuestionario;
create policy intentos_delete_propios
  on public.intentos_cuestionario for delete to authenticated
  using (auth.uid() = usuario_id);

-- respuestas: propiedad indirecta intento -> usuario.
drop policy if exists respuestas_select_propias on public.respuestas_usuario;
create policy respuestas_select_propias
  on public.respuestas_usuario for select to authenticated
  using (
    exists (
      select 1 from public.intentos_cuestionario i
      where i.id = intento_id and i.usuario_id = auth.uid()
    )
  );

drop policy if exists respuestas_insert_propias on public.respuestas_usuario;
create policy respuestas_insert_propias
  on public.respuestas_usuario for insert to authenticated
  with check (
    exists (
      select 1 from public.intentos_cuestionario i
      where i.id = intento_id and i.usuario_id = auth.uid()
    )
  );

drop policy if exists respuestas_update_propias on public.respuestas_usuario;
create policy respuestas_update_propias
  on public.respuestas_usuario for update to authenticated
  using (
    exists (
      select 1 from public.intentos_cuestionario i
      where i.id = intento_id and i.usuario_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.intentos_cuestionario i
      where i.id = intento_id and i.usuario_id = auth.uid()
    )
  );

drop policy if exists respuestas_delete_propias on public.respuestas_usuario;
create policy respuestas_delete_propias
  on public.respuestas_usuario for delete to authenticated
  using (
    exists (
      select 1 from public.intentos_cuestionario i
      where i.id = intento_id and i.usuario_id = auth.uid()
    )
  );

-- 6. Permisos ----------------------------------------------------------------

grant select, insert, delete on public.cuestionarios to authenticated;
grant select, insert, delete on public.preguntas to authenticated;
grant select, insert, delete on public.opciones_pregunta to authenticated;
grant select, insert, update, delete on public.intentos_cuestionario to authenticated;
grant select, insert, update, delete on public.respuestas_usuario to authenticated;

revoke all on public.cuestionarios from anon;
revoke all on public.preguntas from anon;
revoke all on public.opciones_pregunta from anon;
revoke all on public.intentos_cuestionario from anon;
revoke all on public.respuestas_usuario from anon;

grant all on public.cuestionarios to service_role;
grant all on public.preguntas to service_role;
grant all on public.opciones_pregunta to service_role;
grant all on public.intentos_cuestionario to service_role;
grant all on public.respuestas_usuario to service_role;
