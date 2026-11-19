-- ============================================================================
-- MINGO - HU11: busqueda semantica de documentos
-- ============================================================================
-- Contenido:
--   1. RPC public.match_fragmentos: similitud coseno con pgvector, filtrada
--      por propietario, materia y documento opcionales.
--   2. Permisos: solo authenticated puede ejecutarlo; anon no.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar mas de una vez sin duplicar objetos.
--
-- Requisito: supabase/migrations/0005_hu09_fragmentos.sql y
-- 0007_hu10_resumenes.sql ya ejecutadas.
--
-- Nota: la firma que aparece en docs/base-datos.md usaba `int` para los IDs,
-- pero documentos y fragmentos son UUID. Se elimina esa variante, si alguien
-- la creo manualmente, para poder crear la firma correcta.
-- ============================================================================

drop function if exists public.match_fragmentos(vector(1536), double precision, integer, integer);

create or replace function public.match_fragmentos(
  query_embedding vector(1536),
  match_threshold double precision default 0.70,
  match_count integer default 8,
  p_documento_id uuid default null,
  p_materia_id uuid default null
)
returns table (
  id uuid,
  documento_id uuid,
  documento_nombre text,
  numero_fragmento integer,
  numero_pagina integer,
  contenido text,
  similitud double precision,
  modelo_embedding varchar(100)
)
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select
    f.id,
    f.documento_id,
    d.nombre as documento_nombre,
    f.numero_fragmento,
    f.numero_pagina,
    f.contenido,
    1 - (f.embedding <=> query_embedding) as similitud,
    f.modelo_embedding
  from public.fragmentos_documento f
  join public.documentos d on d.id = f.documento_id
  where d.usuario_id = auth.uid()
    and f.embedding is not null
    and (p_documento_id is null or f.documento_id = p_documento_id)
    and (p_materia_id is null or d.materia_id = p_materia_id)
    and 1 - (f.embedding <=> query_embedding) >= match_threshold
  order by f.embedding <=> query_embedding
  limit least(match_count, 20);
$$;

comment on function public.match_fragmentos(vector(1536), double precision, integer, uuid, uuid) is
  'Devuelve hasta 20 fragmentos propios ordenados por similitud coseno (HU11)';

-- Postgres otorga EXECUTE a PUBLIC por defecto; se retira para que ningun
-- anonimo pueda consultar similitudes aunque conozca un vector.
revoke all on function public.match_fragmentos(vector(1536), double precision, integer, uuid, uuid)
  from public, anon;
grant execute on function public.match_fragmentos(vector(1536), double precision, integer, uuid, uuid)
  to authenticated;
