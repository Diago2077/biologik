-- ═══════════════════════════════════════════════════════════════════════════
-- 004_uso_ia.sql — Consumo de IA y configuracion del modelo
--
-- Cada llamada a api/contar.ts que efectivamente le pega a OpenAI deja un
-- registro con los tokens que devolvio la respuesta y un costo estimado en
-- USD. El super_admin puede asignarle a cada empresa un limite mensual de
-- tokens (empresas.limite_tokens_mensual) y un tope por usuario y hora,
-- para que una sola persona cargando cientos de fotos no deje sin cupo al
-- resto.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists uso_ia (
  id uuid default gen_random_uuid() primary key,
  empresa_id uuid not null references empresas (id) on delete cascade,
  animal_id uuid references animales (id) on delete set null,
  usuario_id uuid references usuarios (id) on delete set null,
  modelo text,
  tokens_prompt integer not null default 0,
  tokens_completion integer not null default 0,
  tokens_total integer not null default 0,
  tokens_cache integer not null default 0,
  costo_usd numeric(10, 4) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists uso_ia_empresa_fecha_idx on uso_ia (empresa_id, created_at desc);
create index if not exists uso_ia_usuario_fecha_idx on uso_ia (usuario_id, created_at desc);

-- Solo lo inserta el servidor con la service_role key (bypassea la RLS); del
-- lado del cliente es de solo lectura, y solo para el super_admin.
alter table uso_ia enable row level security;

drop policy if exists "Super admin ve el consumo" on uso_ia;
create policy "Super admin ve el consumo" on uso_ia for select to authenticated
  using (es_super_admin());

revoke all on table uso_ia from anon;
grant select on table uso_ia to authenticated;

-- ─────────────────────────────────────────────────────────────
-- configuracion_ia — tabla singleton (un solo registro posible, via el
-- truco de PK boolean forzada a true). Modelo, precios por millon de tokens
-- y parametros de la llamada, editables por el super_admin en vez de
-- constantes fijas en el codigo.
--
-- La calibracion (slope/intercept) corrige el sesgo sistematico del modelo:
-- en fotos con muchas garrapatas juntas tiende a quedarse corto, asi que el
-- numero crudo se ajusta con una recta calculada sobre conteos reales.
-- ─────────────────────────────────────────────────────────────
create table if not exists configuracion_ia (
  id boolean primary key default true,
  modelo text not null,
  precio_input_por_1m numeric(10, 4) not null,
  precio_output_por_1m numeric(10, 4) not null,
  precio_cache_por_1m numeric(10, 4) not null default 0,
  -- Solo aplica a modelos gpt-5.x; se ignora para gpt-4o y similares.
  reasoning_effort text check (reasoning_effort in ('none', 'low', 'medium', 'high', 'xhigh', 'max')),
  max_tokens integer not null default 2500,
  -- Tokens que un mismo usuario puede consumir por hora. null = sin tope.
  limite_tokens_usuario_hora integer default 500000,
  calibracion_slope numeric(6, 3) not null default 1.35,
  calibracion_intercept numeric(6, 3) not null default -2.5,
  updated_at timestamptz not null default now(),
  constraint configuracion_ia_singleton check (id)
);

insert into configuracion_ia (
  id, modelo, precio_input_por_1m, precio_output_por_1m, precio_cache_por_1m,
  reasoning_effort, max_tokens
)
values (true, 'gpt-5.6-luna', 1, 6, 0.5, 'low', 2500)
on conflict (id) do nothing;

alter table configuracion_ia enable row level security;

drop policy if exists "Super admin ve la configuracion de IA" on configuracion_ia;
create policy "Super admin ve la configuracion de IA" on configuracion_ia for select to authenticated
  using (es_super_admin());

drop policy if exists "Super admin edita la configuracion de IA" on configuracion_ia;
create policy "Super admin edita la configuracion de IA" on configuracion_ia for update to authenticated
  using (es_super_admin()) with check (es_super_admin());

revoke all on table configuracion_ia from anon;
grant select, update on table configuracion_ia to authenticated;
