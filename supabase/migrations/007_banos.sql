-- ═══════════════════════════════════════════════════════════════════════════
-- 007_banos.sql — Baños acaricidas, umbral de infestacion y plan de dosis
--
-- El Programa de Control Integrado (PCIG) no se mide en garrapatas contadas
-- sino en BAÑOS: cuantos menos baños hacen falta al año, y mas dias pasan
-- entre uno y otro, mejor esta funcionando la vacunacion. Todos los
-- resultados publicados del programa estan expresados asi (Venezuela: -83.7%
-- de baños por animal/año; Colombia: el intervalo paso de 120 a 244 dias).
--
-- Ademas el baño se decide POR NIVEL DE INFESTACION, no por calendario: por
-- eso la empresa configura un umbral de garrapatas a partir del cual el
-- animal se considera que hay que tratarlo.
-- ═══════════════════════════════════════════════════════════════════════════

-- El baño es un evento de finca, no de animal: el rodeo entero pasa por el
-- baño o la manga en la misma jornada. Guardarlo por animal multiplicaria
-- las filas sin agregar informacion, y el intervalo entre baños --que es la
-- metrica-- es de la finca.
create table if not exists banos (
  id uuid default gen_random_uuid() primary key,
  empresa_id uuid not null references empresas (id) on delete cascade,
  finca_id uuid not null references fincas (id) on delete cascade,

  fecha date not null,
  -- Que producto se uso. Importa para la resistencia: el programa recomienda
  -- rotar y no repetir siempre el mismo principio activo.
  producto text,
  observaciones text,

  created_by uuid references usuarios (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists banos_finca_fecha_idx on banos (finca_id, fecha desc);
create index if not exists banos_empresa_fecha_idx on banos (empresa_id, fecha desc);

alter table banos enable row level security;

drop policy if exists "Acceso por empresa" on banos;
create policy "Acceso por empresa" on banos for all to authenticated
  using (es_super_admin() or empresa_id = mi_empresa_id())
  with check (es_super_admin() or empresa_id = mi_empresa_id());

revoke all on table banos from anon;
grant select, insert, update, delete on table banos to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Parametros del programa, por empresa.
--
-- Estaban fijos en el codigo. Se sacan a la base porque son decisiones
-- sanitarias que cambian entre paises y entre productos: el prospecto de
-- Gavac indica la 2da dosis a la semana 4 (28 dias) y refuerzos cada 6
-- meses, pero el veterinario puede trabajar con otros numeros.
-- ─────────────────────────────────────────────────────────────
alter table empresas
  add column if not exists umbral_garrapatas integer not null default 20
    check (umbral_garrapatas > 0),
  add column if not exists dias_segunda_dosis integer not null default 30
    check (dias_segunda_dosis > 0),
  add column if not exists dias_refuerzo integer not null default 180
    check (dias_refuerzo > 0),
  add column if not exists dias_aviso_vacunacion integer not null default 15
    check (dias_aviso_vacunacion >= 0);

comment on column empresas.umbral_garrapatas is
  'Carga a partir de la cual el animal se considera que necesita tratamiento acaricida.';
comment on column empresas.dias_segunda_dosis is
  'Dias entre la 1ra y la 2da dosis.';
comment on column empresas.dias_refuerzo is
  'Dias entre refuerzos. La 3ra dosis cae a esta distancia de la 1ra.';
comment on column empresas.dias_aviso_vacunacion is
  'Con cuantos dias de anticipacion una dosis empieza a avisar.';
