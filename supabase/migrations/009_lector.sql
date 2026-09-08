-- ═══════════════════════════════════════════════════════════════════════════
-- 009_lector.sql — Rol de solo lectura
--
-- 'lector' ve todo lo de su empresa igual que 'usuario' (fincas, animales,
-- conteos, vacunaciones, baños), pero no puede crear, editar ni eliminar
-- nada. Es para quien solo necesita consultar el estado del rodeo sin cargar
-- datos (ej. el dueño del campo, o un veterinario externo).
-- ═══════════════════════════════════════════════════════════════════════════

alter table usuarios drop constraint if exists usuarios_rol_check;
alter table usuarios add constraint usuarios_rol_check
  check (rol in ('super_admin', 'admin', 'usuario', 'lector'));

-- ─────────────────────────────────────────────────────────────
-- Security definer, igual que mi_empresa_id()/es_super_admin(): evita la
-- recursion de politica al consultar `usuarios` desde una politica de
-- `usuarios` (o de cualquier otra tabla).
-- ─────────────────────────────────────────────────────────────
create or replace function public.puede_editar()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select rol <> 'lector' from public.usuarios where id = auth.uid()),
    false
  )
$$;

revoke execute on function public.puede_editar() from public, anon;
grant execute on function public.puede_editar() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- fincas / animales / conteos / vacunaciones / banos: la unica politica
-- "for all" que tenian se separa en lectura (todos los roles de la empresa)
-- y escritura (todos menos 'lector'). El super_admin sigue pasando por
-- encima de todo.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "Acceso por empresa" on fincas;

create policy "Ver por empresa" on fincas for select to authenticated
  using (es_super_admin() or empresa_id = mi_empresa_id());
create policy "Crear por empresa" on fincas for insert to authenticated
  with check (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()));
create policy "Editar por empresa" on fincas for update to authenticated
  using (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()))
  with check (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()));
create policy "Eliminar por empresa" on fincas for delete to authenticated
  using (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()));

drop policy if exists "Acceso por empresa" on animales;

create policy "Ver por empresa" on animales for select to authenticated
  using (es_super_admin() or empresa_id = mi_empresa_id());
create policy "Crear por empresa" on animales for insert to authenticated
  with check (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()));
create policy "Editar por empresa" on animales for update to authenticated
  using (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()))
  with check (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()));
create policy "Eliminar por empresa" on animales for delete to authenticated
  using (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()));

drop policy if exists "Acceso por empresa" on conteos;

create policy "Ver por empresa" on conteos for select to authenticated
  using (es_super_admin() or empresa_id = mi_empresa_id());
create policy "Crear por empresa" on conteos for insert to authenticated
  with check (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()));
create policy "Editar por empresa" on conteos for update to authenticated
  using (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()))
  with check (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()));
create policy "Eliminar por empresa" on conteos for delete to authenticated
  using (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()));

drop policy if exists "Acceso por empresa" on vacunaciones;

create policy "Ver por empresa" on vacunaciones for select to authenticated
  using (es_super_admin() or empresa_id = mi_empresa_id());
create policy "Crear por empresa" on vacunaciones for insert to authenticated
  with check (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()));
create policy "Editar por empresa" on vacunaciones for update to authenticated
  using (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()))
  with check (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()));
create policy "Eliminar por empresa" on vacunaciones for delete to authenticated
  using (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()));

drop policy if exists "Acceso por empresa" on banos;

create policy "Ver por empresa" on banos for select to authenticated
  using (es_super_admin() or empresa_id = mi_empresa_id());
create policy "Crear por empresa" on banos for insert to authenticated
  with check (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()));
create policy "Editar por empresa" on banos for update to authenticated
  using (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()))
  with check (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()));
create policy "Eliminar por empresa" on banos for delete to authenticated
  using (es_super_admin() or (empresa_id = mi_empresa_id() and puede_editar()));
