-- ═══════════════════════════════════════════════════════════════════════════
-- 001_schema.sql — Esquema base de Biologik S.A.
--
--   empresas (la empresa ganadera)
--     ├── usuarios
--     └── fincas
--           └── animales
--                 └── conteos          ← foto + conteo de garrapatas por IA
--
-- La empresa es el limite de aislamiento: un usuario nunca ve datos de otra.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- empresas — la empresa cliente del sistema
-- ─────────────────────────────────────────────────────────────
create table if not exists empresas (
  id uuid default gen_random_uuid() primary key,
  nombre text not null,
  ruc text,
  email text,
  telefono text,
  direccion text,
  logo_url text,
  activo boolean not null default true,
  -- Tope mensual de tokens de IA. null = sin tope.
  limite_tokens_mensual integer,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────
-- usuarios — perfil colgado de auth.users (comparten el id)
-- ─────────────────────────────────────────────────────────────
create table if not exists usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  empresa_id uuid references empresas (id) on delete cascade,
  nombre text not null,
  email text not null,
  rol text not null default 'usuario' check (rol in ('super_admin', 'admin', 'usuario')),
  activo boolean not null default true,
  created_at timestamptz default now(),
  -- El super_admin es el unico que vive fuera de una empresa
  constraint usuarios_empresa_requerida check (rol = 'super_admin' or empresa_id is not null)
);

create index if not exists usuarios_empresa_idx on usuarios (empresa_id);

-- ─────────────────────────────────────────────────────────────
-- fincas — los establecimientos de la empresa
-- ─────────────────────────────────────────────────────────────
create table if not exists fincas (
  id uuid default gen_random_uuid() primary key,
  empresa_id uuid not null references empresas (id) on delete cascade,
  nombre text not null,
  propietario text,
  ubicacion text,
  ciudad text,
  telefono text,
  email text,
  activo boolean not null default true,
  created_at timestamptz default now(),
  unique (empresa_id, nombre)
);

create index if not exists fincas_empresa_idx on fincas (empresa_id);

-- ─────────────────────────────────────────────────────────────
-- animales — identificados por el numero de caravana dentro de la finca
-- ─────────────────────────────────────────────────────────────
create table if not exists animales (
  id uuid default gen_random_uuid() primary key,
  -- Denormalizado a proposito: deja la politica RLS en una sola condicion
  empresa_id uuid not null references empresas (id) on delete cascade,
  finca_id uuid not null references fincas (id) on delete cascade,
  caravana text not null,
  raza text,
  categoria text,
  observaciones text,
  activo boolean not null default true,
  created_at timestamptz default now(),
  unique (finca_id, caravana)
);

create index if not exists animales_finca_idx on animales (finca_id);
create index if not exists animales_empresa_idx on animales (empresa_id);

-- ─────────────────────────────────────────────────────────────
-- conteos — una foto de una parte del cuerpo del animal, ya contada
--
-- El count_total es el numero que queda registrado: sale de la IA pero el
-- usuario puede corregirlo en la pantalla de revision antes de guardar.
-- ─────────────────────────────────────────────────────────────
create table if not exists conteos (
  id uuid default gen_random_uuid() primary key,
  empresa_id uuid not null references empresas (id) on delete cascade,
  animal_id uuid not null references animales (id) on delete cascade,

  lado_cuerpo text not null check (lado_cuerpo in (
    'lado_izquierdo', 'lado_derecho', 'paleta', 'cuello', 'axila', 'entrepierna', 'cola'
  )),
  count_total integer not null default 0 check (count_total >= 0),
  fecha_conteo date not null default current_date,

  -- Posiciones relativas devueltas por la IA, para dibujar las marcas encima
  -- de la foto: [{ x, y, tamano_mm_estimado }]
  detecciones jsonb not null default '[]'::jsonb,
  observaciones text,

  -- Ruta dentro del bucket 'fotos' de Storage
  archivo_path text,
  archivo_nombre text,
  archivo_mime text,

  -- Respuesta cruda de la IA, para poder auditar que conto mal
  extraccion_raw jsonb,

  created_by uuid references usuarios (id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists conteos_animal_fecha_idx on conteos (animal_id, fecha_conteo desc);
create index if not exists conteos_empresa_idx on conteos (empresa_id);

-- ─────────────────────────────────────────────────────────────
-- updated_at automatico en conteos
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists conteos_updated_at on conteos;
create trigger conteos_updated_at
  before update on conteos
  for each row execute function public.set_updated_at();
