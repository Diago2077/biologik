-- ═══════════════════════════════════════════════════════════════════════════
-- 005_super_admin.sql — Alta del super administrador
--
-- Este archivo se corre UNA sola vez, y DESPUES de haber creado el usuario a
-- mano en el dashboard de Supabase:
--
--   Authentication → Users → Add user → Create new user
--   (marcar "Auto Confirm User", si no, no va a poder entrar)
--
-- Cambiar el email de abajo por el que se uso ahi.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.usuarios (id, empresa_id, nombre, email, rol)
select u.id, null, 'Diago', u.email, 'super_admin'
from auth.users u
where u.email = 'diagorr@gmail.com'
on conflict (id) do update
  set rol = 'super_admin',
      empresa_id = null;

-- Verificacion: tiene que devolver exactamente una fila con rol = super_admin
select id, email, rol, empresa_id from public.usuarios where rol = 'super_admin';
