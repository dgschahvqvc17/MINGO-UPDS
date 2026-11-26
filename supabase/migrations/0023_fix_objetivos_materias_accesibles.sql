-- MINGO - Migración 0023: objetivos sobre materias accesibles
--
-- Motivo:
--   La política de inserción de `objetivos_estudio` creada en 0015 exige que
--   la materia pertenezca al usuario (`m.usuario_id = auth.uid()`). Desde 0018
--   un estudiante también puede ver materias compartidas por inscripción
--   activa o por docencia, y el frontend le permite seleccionarlas al crear un
--   objetivo. La política RLS rechazaba esa inserción con 42501.
--
-- Solución:
--   Reutilizar `public.usuario_puede_ver_materia(uuid)` (SECURITY DEFINER,
--   creada en 0019) para que las políticas de INSERT y UPDATE acepten cualquier
--   materia que el usuario pueda ver, no solo las que posee.
--
-- Impacto:
--   Solo cambian dos políticas RLS. No elimina datos, no crea recursos AWS y
--   no modifica roles ni privilegios. Es idempotente.
--
-- Requisito: 0015, 0018 y 0019 ya ejecutadas.

drop policy if exists objetivos_insert_propios on public.objetivos_estudio;
create policy objetivos_insert_propios
  on public.objetivos_estudio for insert to authenticated
  with check (
    auth.uid() = usuario_id
    and (
      materia_id is null
      or public.usuario_puede_ver_materia(materia_id)
    )
  );

drop policy if exists objetivos_update_propios on public.objetivos_estudio;
create policy objetivos_update_propios
  on public.objetivos_estudio for update to authenticated
  using (auth.uid() = usuario_id)
  with check (
    auth.uid() = usuario_id
    and (
      materia_id is null
      or public.usuario_puede_ver_materia(materia_id)
    )
  );

revoke all on function public.usuario_puede_ver_materia(uuid) from public, anon;
grant execute on function public.usuario_puede_ver_materia(uuid) to authenticated;
