-- =============================================================================
-- MINGO - Migración 0019
-- Corrige la recursión infinita entre las políticas RLS de `materias` e
-- `inscripciones` introducida en 0018.
--
-- Contexto: la política de lectura de `materias` consultaba `inscripciones`,
-- cuya política de lectura vuelve a consultar `materias`. PostgreSQL detecta
-- el ciclo y devuelve 42P17 al insertar o listar materias.
--
-- Solución: mover la comprobación a una función SECURITY DEFINER que consulta
-- las tablas sin aplicar las políticas del usuario, manteniendo las mismas
-- reglas de acceso: propiedad, docencia o inscripción activa.
--
-- Impacto: solo cambia la política de SELECT de `materias`. No elimina datos,
-- no crea recursos AWS y no modifica los roles ni sus privilegios.
-- =============================================================================

create or replace function public.usuario_puede_ver_materia(p_materia_id uuid)
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
      and (
        m.usuario_id = auth.uid()
        or m.docente_id = auth.uid()
        or exists (
          select 1
          from public.inscripciones i
          where i.materia_id = m.id
            and i.estudiante_id = auth.uid()
            and i.estado = 'activa'
        )
      )
  );
end;
$$;

revoke all on function public.usuario_puede_ver_materia(uuid) from public, anon;
grant execute on function public.usuario_puede_ver_materia(uuid) to authenticated;

drop policy if exists "Usuarios pueden ver materias accesibles" on public.materias;
create policy "Usuarios pueden ver materias accesibles" on public.materias
  for select
  to authenticated
  using (public.usuario_puede_ver_materia(id));
