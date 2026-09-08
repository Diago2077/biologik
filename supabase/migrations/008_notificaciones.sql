-- ═══════════════════════════════════════════════════════════════════════════
-- 008_notificaciones.sql — Suscripciones a notificaciones push
--
-- Guarda el endpoint que el navegador de CADA DISPOSITIVO entrega al
-- suscribirse via PushManager. Un mismo usuario puede tener varias filas
-- (celular + PC), por eso la clave no es el usuario sino el endpoint.
--
-- El envio real (con la clave privada VAPID) lo hace api/cron/vacunaciones.ts
-- con la service_role, que no pasa por RLS. Las policies de aca son solo
-- para que cada usuario pueda activar/desactivar SUS PROPIAS notificaciones
-- directo desde el cliente, sin necesitar una funcion serverless para eso.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists push_subscripciones (
  id uuid default gen_random_uuid() primary key,
  usuario_id uuid not null references usuarios (id) on delete cascade,
  -- Denormalizado a proposito, igual que en el resto del esquema: el cron
  -- filtra suscripciones por empresa sin tener que pasar por usuarios.
  empresa_id uuid not null references empresas (id) on delete cascade,

  endpoint text not null unique,
  p256dh text not null,
  auth text not null,

  created_at timestamptz not null default now()
);

create index if not exists push_subscripciones_empresa_idx on push_subscripciones (empresa_id);

alter table push_subscripciones enable row level security;

drop policy if exists "Cada usuario administra las suyas" on push_subscripciones;
create policy "Cada usuario administra las suyas" on push_subscripciones for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

revoke all on table push_subscripciones from anon;
grant select, insert, update, delete on table push_subscripciones to authenticated;
