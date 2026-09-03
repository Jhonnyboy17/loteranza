-- ===========================================================================
-- Jackpot USA  |  03 - Pedidos, pagamentos, bilhetes, cofre e premios
-- ===========================================================================

-- --------------------------------------------------------------------------
-- orders: o cliente sempre enxerga produto e taxa separados.
-- --------------------------------------------------------------------------
create table if not exists public.orders (
  id                    uuid primary key default gen_random_uuid(),
  order_number          text not null unique,
  user_id               uuid not null references public.profiles(id) on delete restrict,
  status                public.order_status not null default 'pending_payment',

  currency              text not null default 'USD',
  official_ticket_cost  numeric(14,2) not null default 0,
  service_fee           numeric(14,2) not null default 0,
  tax                   numeric(14,2) not null default 0,
  total                 numeric(14,2) not null default 0,

  -- Cambio congelado no checkout
  display_currency      text not null default 'BRL',
  exchange_rate         numeric(16,6),
  exchange_rate_id      uuid references public.exchange_rates(id),
  exchange_rate_at      timestamptz,
  total_display         numeric(16,2),

  game_id               uuid references public.lottery_games(id),
  draw_id               uuid references public.draws(id),
  draws_count           int not null default 1,
  subscription_id       uuid,

  compliance_status     public.compliance_status not null default 'NOT_EVALUATED',
  compliance_evaluated_at timestamptz,
  jurisdiction_id       uuid references public.jurisdiction_rules(id),
  geolocation_event_id  uuid references public.geolocation_events(id),

  is_demo               boolean not null default true,
  demo_notice           text default 'Pedido demonstrativo. Nenhuma compra real foi realizada.',

  purchase_deadline     timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  paid_at               timestamptz,
  cancelled_at          timestamptz,
  cancellation_reason   text,

  constraint orders_amounts_ck check (
    official_ticket_cost >= 0 and service_fee >= 0 and tax >= 0 and total >= 0
  )
);
comment on column public.orders.is_demo is
  'Pedidos criados com TRANSACTIONS_ENABLED=false sao sempre demo. Dados '
  'demonstrativos nunca se misturam com producao.';
create index if not exists orders_user_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_draw_idx on public.orders(draw_id);
create index if not exists orders_queue_idx
  on public.orders(purchase_deadline) where status = 'awaiting_purchase';

alter table public.compliance_checks
  drop constraint if exists compliance_checks_order_fk;
alter table public.compliance_checks
  add constraint compliance_checks_order_fk
  foreign key (order_id) references public.orders(id) on delete cascade;

-- --------------------------------------------------------------------------
-- order_lines: os numeros exatos escolhidos pelo cliente.
-- --------------------------------------------------------------------------
create table if not exists public.order_lines (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders(id) on delete cascade,
  game_id          uuid not null references public.lottery_games(id),
  line_index       int not null,
  numbers          smallint[] not null,
  special_numbers  smallint[] not null default '{}',
  is_quick_pick    boolean not null default false,
  options          jsonb not null default '{}'::jsonb,   -- { multiplier: true }
  quantity         int not null default 1,
  unit_official_price numeric(14,2) not null default 0,
  unit_service_fee    numeric(14,2) not null default 0,
  line_total       numeric(14,2) not null default 0,
  created_at       timestamptz not null default now(),
  unique (order_id, line_index),
  constraint order_lines_quantity_ck check (quantity > 0),
  constraint order_lines_numbers_ck check (array_length(numbers, 1) > 0)
);
comment on table public.order_lines is
  'Registro exato e imutavel dos numeros pedidos. E a fonte de verdade da '
  'conferencia dupla contra o bilhete adquirido.';
create index if not exists order_lines_order_idx on public.order_lines(order_id, line_index);

-- --------------------------------------------------------------------------
-- payments: nunca armazenar PAN completo. Somente referencias do provedor.
-- --------------------------------------------------------------------------
create table if not exists public.payment_providers (
  id                    uuid primary key default gen_random_uuid(),
  provider_key          text not null unique,
  display_name          text not null,
  method                text not null,               -- card | ach | pix | bank_transfer
  is_enabled            boolean not null default false,
  allowed_jurisdictions text[] not null default '{}',
  min_amount            numeric(14,2),
  max_amount            numeric(14,2),
  currency              text not null default 'USD',
  config                jsonb not null default '{}'::jsonb,   -- sem segredos
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
comment on table public.payment_providers is
  'Camada de abstracao de pagamento. A natureza da operacao deve ser sempre '
  'declarada ao provedor: nao ha campo de descricao alternativa aqui.';

create table if not exists public.payments (
  id                      uuid primary key default gen_random_uuid(),
  order_id                uuid not null references public.orders(id) on delete cascade,
  user_id                 uuid not null references public.profiles(id) on delete restrict,
  provider                text not null,
  provider_transaction_id text,
  method                  text,
  currency                text not null default 'USD',
  amount                  numeric(14,2) not null,
  status                  public.payment_status not null default 'initiated',
  failure_code            text,
  failure_message         text,
  card_brand              text,
  card_last4              text,                       -- somente 4 ultimos digitos
  refund_status           public.refund_status not null default 'none',
  refunded_amount         numeric(14,2) not null default 0,
  merchant_descriptor     text,                       -- descritor real na fatura
  is_demo                 boolean not null default true,
  metadata                jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  confirmed_at            timestamptz,
  constraint payments_amount_ck check (amount >= 0),
  constraint payments_last4_ck check (card_last4 is null or card_last4 ~ '^[0-9]{4}$')
);
create index if not exists payments_order_idx on public.payments(order_id);
create index if not exists payments_user_idx on public.payments(user_id, created_at desc);

-- --------------------------------------------------------------------------
-- tickets: bilhete oficial adquirido por um operador autorizado.
-- --------------------------------------------------------------------------
create table if not exists public.tickets (
  id                  uuid primary key default gen_random_uuid(),
  ticket_ref          text not null unique,          -- id interno exibido ao cliente
  order_id            uuid not null references public.orders(id) on delete restrict,
  order_line_id       uuid references public.order_lines(id) on delete set null,
  user_id             uuid not null references public.profiles(id) on delete restrict,
  game_id             uuid not null references public.lottery_games(id),
  draw_id             uuid not null references public.draws(id),
  status              public.ticket_status not null default 'pending_purchase',

  numbers             smallint[] not null,
  special_numbers     smallint[] not null default '{}',
  options             jsonb not null default '{}'::jsonb,

  -- Dados sensiveis: serial/barcode so quando juridicamente permitido guardar.
  serial_hash         text,
  barcode_hash        text,
  retailer_name       text,
  purchase_location   text,
  purchased_at        timestamptz,
  purchased_by        uuid references public.profiles(id),

  verified_by         uuid references public.profiles(id),
  verified_at         timestamptz,
  discrepancy_notes   text,

  -- Conferencia automatica pos-sorteio
  checked_at          timestamptz,
  won                 boolean,
  matched_main        smallint,
  matched_special     smallint,
  prize_tier_id       uuid references public.prize_tiers(id),
  estimated_prize     numeric(16,2),
  prize_confirmed     boolean not null default false,
  result_source       text,

  is_demo             boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on column public.tickets.serial_hash is
  'Hash, nunca o serial em claro. Dados que permitiriam resgate por terceiros '
  'jamais sao expostos na interface do cliente.';
create index if not exists tickets_user_idx on public.tickets(user_id, created_at desc);
create index if not exists tickets_order_idx on public.tickets(order_id);
create index if not exists tickets_draw_idx on public.tickets(draw_id) where status in ('verified','purchased','uploaded');
create index if not exists tickets_winner_idx on public.tickets(won) where won is true;

create table if not exists public.ticket_images (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.tickets(id) on delete cascade,
  kind          text not null default 'front',       -- front | back | scan
  storage_path  text not null,                        -- bucket privado + signed URL
  redacted      boolean not null default true,        -- serial ocultado na copia do cliente
  width         int,
  height        int,
  checksum      text,
  uploaded_by   uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);
comment on table public.ticket_images is
  'Imagens ficam em bucket privado. O cliente acessa por signed URL de curta '
  'duracao; a copia exibida tem area de serial/barcode ocultada.';
create index if not exists ticket_images_ticket_idx on public.ticket_images(ticket_id);

-- --------------------------------------------------------------------------
-- Ticket Vault: guarda fisica + cadeia de custodia
-- --------------------------------------------------------------------------
create table if not exists public.ticket_vault (
  id             uuid primary key default gen_random_uuid(),
  ticket_id      uuid not null unique references public.tickets(id) on delete cascade,
  vault_location text not null,
  box            text,
  slot           text,
  stored_at      timestamptz,
  stored_by      uuid references public.profiles(id),
  checked_at     timestamptz,
  checked_by     uuid references public.profiles(id),
  retrieved_at   timestamptz,
  retrieved_by   uuid references public.profiles(id),
  current_state  text not null default 'pending',     -- pending | stored | checked | retrieved
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.ticket_vault_events (
  id            uuid primary key default gen_random_uuid(),
  vault_id      uuid not null references public.ticket_vault(id) on delete cascade,
  ticket_id     uuid not null references public.tickets(id) on delete cascade,
  event         text not null,                        -- stored | checked | moved | retrieved
  from_location text,
  to_location   text,
  actor_id      uuid references public.profiles(id),
  witness_id    uuid references public.profiles(id),
  notes         text,
  created_at    timestamptz not null default now()
);
comment on table public.ticket_vault_events is
  'Cadeia de custodia. Append-only: toda movimentacao do bilhete fisico '
  'gera um evento e um registro em audit_logs.';
create index if not exists vault_events_ticket_idx on public.ticket_vault_events(ticket_id, created_at desc);

-- --------------------------------------------------------------------------
-- prize_claims
-- --------------------------------------------------------------------------
create table if not exists public.prize_claims (
  id                  uuid primary key default gen_random_uuid(),
  claim_ref           text not null unique,
  ticket_id           uuid not null references public.tickets(id) on delete restrict,
  order_id            uuid not null references public.orders(id) on delete restrict,
  user_id             uuid not null references public.profiles(id) on delete restrict,
  status              public.prize_claim_status not null default 'detected',
  gross_amount        numeric(16,2),
  withholding_amount  numeric(16,2),
  service_deduction   numeric(16,2),
  net_amount          numeric(16,2),
  currency            text not null default 'USD',
  requires_in_person  boolean not null default false,
  requires_documents  boolean not null default true,
  documents_note      text,
  official_claim_ref  text,
  assigned_to         uuid references public.profiles(id),
  requires_dual_approval boolean not null default true,
  approved_by         uuid references public.profiles(id),
  approved_at         timestamptz,
  second_approver_id  uuid references public.profiles(id),
  second_approved_at  timestamptz,
  notes               text,
  is_demo             boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
comment on table public.prize_claims is
  'Fluxo de resgate. Premios relevantes exigem dupla aprovacao e nunca sao '
  'pagos automaticamente.';
create index if not exists prize_claims_user_idx on public.prize_claims(user_id, created_at desc);
create index if not exists prize_claims_status_idx on public.prize_claims(status);

create table if not exists public.prize_claim_events (
  id          uuid primary key default gen_random_uuid(),
  claim_id    uuid not null references public.prize_claims(id) on delete cascade,
  status      public.prize_claim_status not null,
  note        text,
  actor_id    uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists prize_claim_events_claim_idx on public.prize_claim_events(claim_id, created_at);

-- --------------------------------------------------------------------------
-- subscriptions (multiplos sorteios recorrentes)
-- --------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  game_id          uuid not null references public.lottery_games(id),
  status           public.subscription_status not null default 'pending_activation',
  lines            jsonb not null default '[]'::jsonb,   -- combinacoes fixas
  draws_per_cycle  int not null default 1,
  remaining_draws  int,
  next_draw_id     uuid references public.draws(id),
  paused_at        timestamptz,
  cancelled_at     timestamptz,
  jurisdiction_id  uuid references public.jurisdiction_rules(id),
  is_demo          boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions(user_id, status);

alter table public.orders
  drop constraint if exists orders_subscription_fk;
alter table public.orders
  add constraint orders_subscription_fk
  foreign key (subscription_id) references public.subscriptions(id) on delete set null;

-- --------------------------------------------------------------------------
-- favorites: combinacoes salvas pelo usuario
-- --------------------------------------------------------------------------
create table if not exists public.favorites (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  game_id         uuid not null references public.lottery_games(id) on delete cascade,
  label           text not null,
  numbers         smallint[] not null,
  special_numbers smallint[] not null default '{}',
  times_played    int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists favorites_user_idx on public.favorites(user_id, created_at desc);

-- --------------------------------------------------------------------------
-- jackpot_alerts
-- --------------------------------------------------------------------------
create table if not exists public.jackpot_alerts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  game_id        uuid not null references public.lottery_games(id) on delete cascade,
  minimum_amount numeric(16,2) not null,
  currency       text not null default 'USD',
  active         boolean not null default true,
  last_notified_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, game_id, minimum_amount)
);
