-- ============================================================================
-- MINGO - HU09: reemplazo atomico de fragmentos de un documento
-- ============================================================================
-- Contenido:
--   1. Funcion public.confirmar_reemplazo_fragmentos(documento, desplazamiento).
--
-- Uso:
--   Supabase Dashboard > SQL Editor > pegar este archivo > Run.
--   Es idempotente: `create or replace` permite ejecutarla varias veces.
--
-- Requisito: supabase/migrations/0005_hu09_fragmentos.sql ya ejecutada.
--
-- Por que existe:
--   El worker no puede borrar los fragmentos anteriores antes de insertar los
--   nuevos (un fallo a mitad dejaria el documento sin contenido) ni puede
--   insertar encima del numero de fragmento anterior (choca con la restriccion
--   unique (documento_id, numero_fragmento)). La solucion es insertar los
--   nuevos con un desplazamiento grande, borrar los viejos y restar el
--   desplazamiento, todo dentro de una transaccion.
--
-- Seguridad:
--   security definer con search_path fijo y EXECUTE solo para service_role.
--   Las escrituras de fragmentos las hace unicamente el worker.
-- ============================================================================

create or replace function public.confirmar_reemplazo_fragmentos(
  p_documento_id uuid,
  p_desplazamiento integer
)
returns integer
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_importados integer;
begin
  if p_documento_id is null then
    raise exception 'El documento es obligatorio.'
      using errcode = '22023';
  end if;

  if p_desplazamiento is null or p_desplazamiento < 1 then
    raise exception 'El desplazamiento debe ser un entero positivo.'
      using errcode = '22023';
  end if;

  -- Cuantos fragmentos nuevos hay; el numero original queda por debajo del
  -- desplazamiento, asi que `> desplazamiento` identifica solo a los nuevos.
  select count(*)
    into v_importados
    from public.fragmentos_documento
   where documento_id = p_documento_id
     and numero_fragmento > p_desplazamiento;

  if v_importados = 0 then
    -- Se lanza para que la transaccion revierta. Si no hay fragmentos nuevos,
    -- confirmar el reemplazo dejaria el documento sin contenido.
    raise exception 'No hay fragmentos nuevos que confirmar para el documento %.',
      p_documento_id
      using errcode = 'P0001';
  end if;

  -- Borra los fragmentos del procesamiento anterior.
  delete from public.fragmentos_documento
   where documento_id = p_documento_id
     and numero_fragmento <= p_desplazamiento;

  -- Devuelve la numeracion original (1..n) a los fragmentos nuevos.
  update public.fragmentos_documento
     set numero_fragmento = numero_fragmento - p_desplazamiento
   where documento_id = p_documento_id
     and numero_fragmento > p_desplazamiento;

  return v_importados;
end;
$$;

comment on function public.confirmar_reemplazo_fragmentos(uuid, integer) is
  'Reemplaza los fragmentos de un documento en una transaccion: borra los viejos y resta el desplazamiento a los nuevos (HU09)';

-- La funcion nace con EXECUTE para PUBLIC; se cierra y se deja solo al worker.
revoke all on function public.confirmar_reemplazo_fragmentos(uuid, integer) from public;
revoke all on function public.confirmar_reemplazo_fragmentos(uuid, integer) from anon;
revoke all on function public.confirmar_reemplazo_fragmentos(uuid, integer) from authenticated;
grant execute on function public.confirmar_reemplazo_fragmentos(uuid, integer) to service_role;
