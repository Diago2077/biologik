-- ═══════════════════════════════════════════════════════════════════════════
-- 006_vacunaciones.sql — Registro de vacunacion y su cronograma
--
-- Una fila por animal y por dosis. Se guarda por animal (y no por finca)
-- aunque en la practica se vacune un lote entero de una vez: es la unica
-- forma de detectar al animal que se salteo una dosis, y de que un animal
-- que entra al rodeo mas tarde tenga su propio calendario.
--
-- El cronograma NO se guarda: se calcula a partir de las dosis aplicadas
-- (ver src/lib/vacunacion.ts). Guardar fechas previstas obligaria a
-- recalcular filas cada vez que se aplica una dosis fuera de termino, y
-- cualquier fila que quedara sin actualizar mostraria una fecha mentirosa.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists vacunaciones (
  id uuid default gen_random_uuid() primary key,
  -- Denormalizado a proposito, igual que en animales/conteos: deja la
  -- politica RLS en una sola comparacion.
  empresa_id uuid not null references empresas (id) on delete cascade,
  animal_id uuid not null references animales (id) on delete cascade,

  -- 1 = primera dosis, 2 = refuerzo a los 30 dias, 3 = a los 180 de la
  -- primera, y de ahi en mas cada 180.
  numero_dosis integer not null check (numero_dosis >= 1),
  fecha_aplicada date not null,

  producto text,
  lote text,
  observaciones text,

  created_by uuid references usuarios (id) on delete set null,
  created_at timestamptz not null default now(),

  -- Un animal no puede tener dos veces la misma dosis
  unique (animal_id, numero_dosis)
);

create index if not exists vacunaciones_animal_idx on vacunaciones (animal_id, numero_dosis);
create index if not exists vacunaciones_empresa_fecha_idx on vacunaciones (empresa_id, fecha_aplicada desc);

alter table vacunaciones enable row level security;

drop policy if exists "Acceso por empresa" on vacunaciones;
create policy "Acceso por empresa" on vacunaciones for all to authenticated
  using (es_super_admin() or empresa_id = mi_empresa_id())
  with check (es_super_admin() or empresa_id = mi_empresa_id());

revoke all on table vacunaciones from anon;
grant select, insert, update, delete on table vacunaciones to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Como se corre el cronograma cuando una dosis se aplica tarde.
--
--   'reajustar' : la proxima se cuenta desde la fecha REAL de la anterior,
--                 asi el intervalo entre dosis siempre se respeta.
--   'anclar'    : las fechas se calculan siempre desde la primera dosis,
--                 el calendario original no se mueve aunque haya atrasos.
--
-- Es una decision sanitaria, no tecnica, por eso la elige cada empresa.
-- ─────────────────────────────────────────────────────────────
alter table empresas
  add column if not exists modo_cronograma_vacunacion text
    not null default 'reajustar'
    check (modo_cronograma_vacunacion in ('reajustar', 'anclar'));

comment on column empresas.modo_cronograma_vacunacion is
  'Que hacer con las dosis siguientes cuando una se aplica fuera de termino.';
