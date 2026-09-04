-- ═══════════════════════════════════════════════════════════════════════════
-- 002_rls.sql — Aislamiento por empresa
--
-- Regla unica: un usuario solo toca filas cuyo empresa_id coincide con el suyo.
-- El super_admin (empresa_id null) pasa por encima de todo.
--
-- "Inactivo" bloquea de verdad: los helpers miran usuarios.activo y
-- empresas.activo, asi que una sesion todavia valida de un usuario
-- desactivado no puede leer nada por la API aunque la app se lo permitiera.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- Helpers en security definer: leen `usuarios` SALTEANDO la RLS.
-- Sin esto, cualquier politica sobre `usuarios` que a su vez consulte
-- `usuarios` dispara "infinite recursion detected in policy".
-- ─────────────────────────────────────────────────────────────
create or replace function public.mi_empresa_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select u.empresa_id
  from usuarios u
  join empresas e on e.id = u.empresa_id
  where u.id = auth.uid() and u.activo = true and e.activo = true
$$;

create or replace function public.es_super_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select rol = 'super_admin' and activo from public.usuarios where id = auth.uid()),
    false
  )
$$;

revoke execute on function public.mi_empresa_id() from public, anon;
revoke execute on function public.es_super_admin() from public, anon;
grant execute on function public.mi_empresa_id() to authenticated;
grant execute on function public.es_super_admin() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- empresas — se ve la propia; crearlas y editarlas es del super_admin
-- ─────────────────────────────────────────────────────────────
alter table empresas enable row level security;

drop policy if exists "Ver mi empresa" on empresas;
create policy "Ver mi empresa" on empresas for select to authenticated
  using (es_super_admin() or id = mi_empresa_id());

drop policy if exists "Super admin gestiona empresas" on empresas;
create policy "Super admin gestiona empresas" on empresas for all to authenticated
  using (es_super_admin()) with check (es_super_admin());

-- ─────────────────────────────────────────────────────────────
-- usuarios — se ven los de la propia empresa, pero NADIE se edita a si mismo.
-- Si un usuario pudiera hacer update sobre su fila, se pondria
-- rol = 'super_admin' y se quedaria con el sistema entero.
--
-- La excepcion del select sobre la fila propia es para que la app pueda
-- explicar por que esta bloqueando a alguien cuya empresa quedo inactiva.
-- ─────────────────────────────────────────────────────────────
alter table usuarios enable row level security;

drop policy if exists "Ver usuarios de mi empresa" on usuarios;
create policy "Ver usuarios de mi empresa" on usuarios for select to authenticated
  using (
    es_super_admin()
    or id = auth.uid()
    or (empresa_id is not null and empresa_id = mi_empresa_id())
  );

drop policy if exists "Super admin gestiona usuarios" on usuarios;
create policy "Super admin gestiona usuarios" on usuarios for all to authenticated
  using (es_super_admin()) with check (es_super_admin());

-- ─────────────────────────────────────────────────────────────
-- fincas / animales / conteos — CRUD completo dentro de la empresa
-- ─────────────────────────────────────────────────────────────
alter table fincas enable row level security;

drop policy if exists "Acceso por empresa" on fincas;
create policy "Acceso por empresa" on fincas for all to authenticated
  using (es_super_admin() or empresa_id = mi_empresa_id())
  with check (es_super_admin() or empresa_id = mi_empresa_id());

alter table animales enable row level security;

drop policy if exists "Acceso por empresa" on animales;
create policy "Acceso por empresa" on animales for all to authenticated
  using (es_super_admin() or empresa_id = mi_empresa_id())
  with check (es_super_admin() or empresa_id = mi_empresa_id());

alter table conteos enable row level security;

drop policy if exists "Acceso por empresa" on conteos;
create policy "Acceso por empresa" on conteos for all to authenticated
  using (es_super_admin() or empresa_id = mi_empresa_id())
  with check (es_super_admin() or empresa_id = mi_empresa_id());

-- ─────────────────────────────────────────────────────────────
-- Permisos de tabla.
-- Supabase concede por defecto a `anon` sobre las tablas nuevas de public;
-- aca no hay nada publico, asi que se revoca de forma explicita.
-- ─────────────────────────────────────────────────────────────
revoke all on table empresas, usuarios, fincas, animales, conteos from anon;

grant select on table empresas, usuarios to authenticated;
grant insert, update, delete on table empresas, usuarios to authenticated;
grant select, insert, update, delete on table fincas, animales, conteos to authenticated;
