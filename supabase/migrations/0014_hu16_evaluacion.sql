-- ============================================================================
-- MINGO - HU16: evaluacion de respuestas y retroalimentacion
-- ============================================================================
-- Contenido:
--   1. Tema por pregunta para medir dominio por tema.
--   2. Resultado agregado de la evaluacion en intentos_cuestionario.
--   3. Tabla evaluaciones_respuesta con el detalle de cada respuesta abierta.
--   4. Indices, restricciones, RLS y permisos.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar mas de una vez sin duplicar objetos.
--
-- Requisito: 0010 ya ejecutada.
-- ============================================================================

-- 1. Tema de las preguntas ---------------------------------------------------

alter table public.preguntas add column if not exists tema varchar(120);

alter table public.preguntas drop constraint if exists preguntas_tema_check;
alter table public.preguntas
  add constraint preguntas_tema_check
  check (tema is null or length(btrim(tema)) > 0);

comment on column public.preguntas.tema is
  'Tema breve que la IA asigna a la pregunta al generar el cuestionario (HU16)';

-- 2. Resultado agregado del intento -----------------------------------------

alter table public.intentos_cuestionario add column if not exists retroalimentacion_general text;
alter table public.intentos_cuestionario add column if not exists temas_reforzar jsonb not null default '[]'::jsonb;
alter table public.intentos_cuestionario add column if not exists recomendaciones jsonb not null default '[]'::jsonb;
alter table public.intentos_cuestionario add column if not exists modelo_evaluacion varchar(100);
alter table public.intentos_cuestionario add column if not exists tokens_entrada_evaluacion integer not null default 0;
alter table public.intentos_cuestionario add column if not exists tokens_salida_evaluacion integer not null default 0;

-- Ahora las abiertas evaluadas tambien cuentan como aciertos.
alter table public.intentos_cuestionario drop constraint if exists intentos_totales_check;
alter table public.intentos_cuestionario
  add constraint intentos_totales_check
  check (
    total_preguntas between 1 and 20
    and preguntas_objetivas between 0 and total_preguntas
    and respuestas_correctas between 0 and total_preguntas
  );

alter table public.intentos_cuestionario drop constraint if exists intentos_temas_reforzar_check;
alter table public.intentos_cuestionario
  add constraint intentos_temas_reforzar_check
  check (jsonb_typeof(temas_reforzar) = 'array');

alter table public.intentos_cuestionario drop constraint if exists intentos_recomendaciones_check;
alter table public.intentos_cuestionario
  add constraint intentos_recomendaciones_check
  check (jsonb_typeof(recomendaciones) = 'array');

alter table public.intentos_cuestionario drop constraint if exists intentos_tokens_evaluacion_check;
alter table public.intentos_cuestionario
  add constraint intentos_tokens_evaluacion_check
  check (tokens_entrada_evaluacion >= 0 and tokens_salida_evaluacion >= 0);

comment on column public.intentos_cuestionario.puntuacion is
  'Porcentaje final del intento: objetivas exactas y abiertas evaluadas (HU16); null mientras esta en progreso';
comment on column public.intentos_cuestionario.temas_reforzar is
  'Temas con menor dominio calculados al finalizar el intento (HU16)';
comment on column public.intentos_cuestionario.recomendaciones is
  'Recomendaciones de repaso calculadas al finalizar el intento (HU16)';

-- 3. Detalle de la evaluacion de respuestas abiertas ------------------------

create table if not exists public.evaluaciones_respuesta (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  intento_id uuid not null
    references public.intentos_cuestionario (id) on delete cascade,
  pregunta_id uuid not null
    references public.preguntas (id) on delete cascade,
  es_correcta boolean not null,
  puntaje numeric(5, 2) not null,
  retroalimentacion text not null,
  temas_reforzar jsonb not null default '[]'::jsonb,
  criterios jsonb not null default '[]'::jsonb,
  modelo varchar(100),
  tokens_entrada integer not null default 0,
  tokens_salida integer not null default 0,
  fecha_creacion timestamptz not null default now(),
  constraint uq_evaluaciones_intento_pregunta unique (intento_id, pregunta_id)
);

alter table public.evaluaciones_respuesta drop constraint if exists evaluaciones_puntaje_check;
alter table public.evaluaciones_respuesta
  add constraint evaluaciones_puntaje_check
  check (puntaje >= 0 and puntaje <= 10);

alter table public.evaluaciones_respuesta drop constraint if exists evaluaciones_retroalimentacion_check;
alter table public.evaluaciones_respuesta
  add constraint evaluaciones_retroalimentacion_check
  check (length(btrim(retroalimentacion)) > 0);

alter table public.evaluaciones_respuesta drop constraint if exists evaluaciones_temas_check;
alter table public.evaluaciones_respuesta
  add constraint evaluaciones_temas_check
  check (jsonb_typeof(temas_reforzar) = 'array');

alter table public.evaluaciones_respuesta drop constraint if exists evaluaciones_criterios_check;
alter table public.evaluaciones_respuesta
  add constraint evaluaciones_criterios_check
  check (jsonb_typeof(criterios) = 'array');

alter table public.evaluaciones_respuesta drop constraint if exists evaluaciones_tokens_check;
alter table public.evaluaciones_respuesta
  add constraint evaluaciones_tokens_check
  check (tokens_entrada >= 0 and tokens_salida >= 0);

create index if not exists idx_evaluaciones_usuario_fecha
  on public.evaluaciones_respuesta (usuario_id, fecha_creacion desc);
create index if not exists idx_evaluaciones_intento
  on public.evaluaciones_respuesta (intento_id);
create index if not exists idx_preguntas_tema
  on public.preguntas (tema);

comment on table public.evaluaciones_respuesta is
  'Evaluacion con IA de respuestas abiertas y retroalimentacion (HU16)';

-- 4. RLS ---------------------------------------------------------------------

alter table public.evaluaciones_respuesta enable row level security;

drop policy if exists evaluaciones_select_propias on public.evaluaciones_respuesta;
create policy evaluaciones_select_propias
  on public.evaluaciones_respuesta for select to authenticated
  using (auth.uid() = usuario_id);

drop policy if exists evaluaciones_insert_propias on public.evaluaciones_respuesta;
create policy evaluaciones_insert_propias
  on public.evaluaciones_respuesta for insert to authenticated
  with check (
    auth.uid() = usuario_id
    and exists (
      select 1 from public.intentos_cuestionario i
      where i.id = intento_id and i.usuario_id = auth.uid()
    )
  );

drop policy if exists evaluaciones_update_propias on public.evaluaciones_respuesta;
create policy evaluaciones_update_propias
  on public.evaluaciones_respuesta for update to authenticated
  using (auth.uid() = usuario_id)
  with check (auth.uid() = usuario_id);

drop policy if exists evaluaciones_delete_propias on public.evaluaciones_respuesta;
create policy evaluaciones_delete_propias
  on public.evaluaciones_respuesta for delete to authenticated
  using (auth.uid() = usuario_id);

-- 5. Permisos ----------------------------------------------------------------

grant select, insert, update, delete on public.evaluaciones_respuesta to authenticated;
grant all on public.evaluaciones_respuesta to service_role;
revoke all on public.evaluaciones_respuesta from anon;
