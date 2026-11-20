-- ============================================================================
-- MINGO - HU17: minimizar privilegios de objetivos_estudio
-- ============================================================================
-- Motivo: Supabase concede ALL por defecto sobre las tablas nuevas del schema
-- public. La migracion 0015 otorga solo SELECT/INSERT/UPDATE/DELETE a
-- authenticated, pero los GRANT son aditivos: no retiran TRUNCATE, TRIGGER ni
-- REFERENCES. RLS no cubre TRUNCATE, asi que esos tres privilegios se quitan
-- aqui para cumplir con el principio de minimo privilegio.
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: REVOKE y GRANT se pueden repetir sin cambiar el resultado.
--
-- Requisito: 0015_hu17_objetivos_progreso.sql ya ejecutada.
--
-- Permiso final:
--   authenticated: SELECT, INSERT, UPDATE, DELETE
--   service_role:  ALL
--   anon:          ninguno
-- ============================================================================

revoke truncate, trigger, references on public.objetivos_estudio from authenticated;

grant select, insert, update, delete on public.objetivos_estudio to authenticated;
grant all on public.objetivos_estudio to service_role;
revoke all on public.objetivos_estudio from anon;
