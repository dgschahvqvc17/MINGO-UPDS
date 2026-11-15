-- ============================================================================
-- MINGO - HU09: procesar documentos academicos
-- ============================================================================
-- Contenido:
--   1. Extension pgvector.
--   2. Tabla fragmentos_documento con texto y embeddings.
--   3. Indices, incluido HNSW para busqueda semantica.
--   4. RLS: el usuario solo lee fragmentos de sus propios documentos.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: se puede ejecutar mas de una vez sin duplicar objetos.
--
-- Requisito: supabase/migrations/0004_hu07_documentos.sql ya ejecutada.
--
-- Nota: la dimension 1536 debe coincidir con AI_EMBEDDING_DIMENSIONS y con el
-- modelo de embeddings configurado. Cambiarla exige migracion y reprocesar.
-- ============================================================================

-- 1. Extension ---------------------------------------------------------------

create extension if not exists vector;

-- 2. Tabla -------------------------------------------------------------------

create table if not exists public.fragmentos_documento (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos (id) on delete cascade,
  numero_fragmento integer not null,
  numero_pagina integer,
  contenido text not null,
  hash_contenido varchar(64) not null,
  embedding vector(1536),
  modelo_embedding varchar(100),
  fecha_creacion timestamptz not null default now()
);

alter table public.fragmentos_documento
  drop constraint if exists fragmentos_documento_numero_check;
alter table public.fragmentos_documento
  add constraint fragmentos_documento_numero_check
  check (numero_fragmento > 0);

alter table public.fragmentos_documento
  drop constraint if exists fragmentos_documento_pagina_check;
alter table public.fragmentos_documento
  add constraint fragmentos_documento_pagina_check
  check (numero_pagina is null or numero_pagina > 0);

alter table public.fragmentos_documento
  drop constraint if exists fragmentos_documento_contenido_check;
alter table public.fragmentos_documento
  add constraint fragmentos_documento_contenido_check
  check (length(btrim(contenido)) > 0);

alter table public.fragmentos_documento
  drop constraint if exists fragmentos_documento_hash_check;
alter table public.fragmentos_documento
  add constraint fragmentos_documento_hash_check
  check (hash_contenido ~ '^[0-9a-f]{64}$');

alter table public.fragmentos_documento
  drop constraint if exists fragmentos_documento_unico;
alter table public.fragmentos_documento
  add constraint fragmentos_documento_unico
  unique (documento_id, numero_fragmento);

-- 3. Indices -----------------------------------------------------------------

create index if not exists idx_fragmentos_documento_documento
  on public.fragmentos_documento (documento_id);
create index if not exists idx_fragmentos_documento_hash
  on public.fragmentos_documento (documento_id, hash_contenido);
create index if not exists idx_fragmentos_documento_embedding_hnsw
  on public.fragmentos_documento
  using hnsw (embedding vector_cosine_ops);

comment on table public.fragmentos_documento is
  'Fragmentos de texto y embeddings de cada documento para RAG';
comment on column public.fragmentos_documento.documento_id is
  'Documento de origen; al eliminarlo se eliminan sus fragmentos';
comment on column public.fragmentos_documento.numero_fragmento is
  'Orden del fragmento dentro del documento, desde 1';
comment on column public.fragmentos_documento.numero_pagina is
  'Pagina o diapositiva de origen; nula cuando el formato no la expone';
comment on column public.fragmentos_documento.hash_contenido is
  'SHA-256 del contenido para evitar regenerar embeddings sin cambios';
comment on column public.fragmentos_documento.embedding is
  'Vector de 1536 dimensiones; debe coincidir con AI_EMBEDDING_DIMENSIONS';
comment on column public.fragmentos_documento.modelo_embedding is
  'Modelo que genero el vector, para trazabilidad';

-- 4. RLS ---------------------------------------------------------------------

alter table public.fragmentos_documento enable row level security;

-- Las escrituras las hace el worker con service_role; el usuario solo lee.
drop policy if exists fragmentos_select_propios on public.fragmentos_documento;
create policy fragmentos_select_propios
  on public.fragmentos_documento
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.documentos d
      where d.id = fragmentos_documento.documento_id
        and d.usuario_id = auth.uid()
    )
  );

grant select on public.fragmentos_documento to authenticated;
revoke all on public.fragmentos_documento from anon;
grant all on public.fragmentos_documento to service_role;
