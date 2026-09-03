-- ===========================================================================
-- Jackpot USA  |  02 - Dominio de loteria: jogos, sorteios, resultados, cambio
-- ---------------------------------------------------------------------------
-- NENHUMA regra de jogo pode ser escrita no frontend. Quantidade de numeros,
-- faixas, precos, horarios e jurisdicoes vem sempre de lottery_games.
-- ===========================================================================

create table if not exists public.lottery_games (
  id                      uuid primary key default gen_random_uuid(),
  game_key                text not null unique,           -- 'powerball', 'mega-millions'
  name                    text not null,
  short_name              text,
  status                  public.game_status not null default 'coming_soon',
  operator_name           text,                            -- orgao oficial que opera
  description             text,
  how_to_play             text,
  logo_url                text,
  brand_color             text,                            -- cor do card no catalogo
  sort_order              int not null default 100,

  -- Precificacao (sempre separada: produto x taxa de servico)
  official_price          numeric(14,2) not null,          -- preco oficial por aposta
  service_fee             numeric(14,2) not null default 0,-- taxa da plataforma por aposta
  service_fee_percent     numeric(6,4) not null default 0, -- taxa percentual adicional
  currency                text not null default 'USD',

  -- Estrutura de numeros (dirige integralmente o number picker)
  main_numbers_count      smallint not null,
  main_number_min         smallint not null default 1,
  main_number_max         smallint not null,
  special_numbers_count   smallint not null default 0,
  special_number_min      smallint not null default 1,
  special_number_max      smallint not null default 0,
  special_number_label    text,                            -- 'Powerball', 'Mega Ball'
  allow_duplicate_special boolean not null default true,

  -- Multiplicadores opcionais (Power Play / Megaplier)
  multiplier_enabled      boolean not null default false,
  multiplier_label        text,
  multiplier_price        numeric(14,2) not null default 0,

  -- Calendario
  draw_days               smallint[] not null default '{}',-- 0=domingo .. 6=sabado
  draw_time_local         time not null,
  sales_cutoff_minutes    int not null default 60,         -- minutos antes do sorteio
  timezone                text not null default 'America/New_York',

  -- Estado corrente (atualizado pelo Data Provider, nunca hardcoded)
  current_jackpot         numeric(16,2),
  current_jackpot_cash    numeric(16,2),
  next_draw_id            uuid,
  jackpot_updated_at      timestamptz,

  -- Comercializacao
  sales_enabled           boolean not null default false,
  allowed_jurisdictions   text[] not null default '{}',    -- 'US-IL', 'BR' ...
  max_lines_per_order     int not null default 20,
  max_draws_ahead         int not null default 10,
  is_demo                 boolean not null default false,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint lottery_games_main_range_ck check (main_number_max > main_number_min),
  constraint lottery_games_main_count_ck check (main_numbers_count between 1 and 20),
  constraint lottery_games_main_feasible_ck
    check (main_numbers_count <= (main_number_max - main_number_min + 1)),
  constraint lottery_games_special_ck
    check (special_numbers_count = 0 or special_number_max > special_number_min),
  constraint lottery_games_price_ck check (official_price >= 0 and service_fee >= 0)
);
comment on table public.lottery_games is
  'Configuracao completa de cada modalidade. O frontend le daqui; nao ha '
  'regra de jogo duplicada em codigo.';

-- --------------------------------------------------------------------------
-- Faixas de premiacao (tabela de premios por acertos)
-- --------------------------------------------------------------------------
create table if not exists public.prize_tiers (
  id                 uuid primary key default gen_random_uuid(),
  game_id            uuid not null references public.lottery_games(id) on delete cascade,
  tier_key           text not null,                 -- '5+1', '5+0', ...
  label              text not null,                 -- '5 numeros + Powerball'
  main_matches       smallint not null,
  special_matches    smallint not null default 0,
  is_jackpot         boolean not null default false,
  fixed_prize        numeric(16,2),                 -- NULL quando pari-mutuel/jackpot
  prize_note         text,
  odds_denominator   bigint,                        -- 1 em N
  sort_order         int not null default 100,
  created_at         timestamptz not null default now(),
  unique (game_id, tier_key)
);

-- --------------------------------------------------------------------------
-- draws: cada sorteio agendado
-- --------------------------------------------------------------------------
create table if not exists public.draws (
  id                   uuid primary key default gen_random_uuid(),
  game_id              uuid not null references public.lottery_games(id) on delete cascade,
  draw_number          text,                          -- identificador oficial
  draw_date            date not null,
  draw_at              timestamptz not null,
  sales_close_at       timestamptz not null,
  status               public.draw_status not null default 'scheduled',
  advertised_jackpot   numeric(16,2),
  cash_value           numeric(16,2),
  is_demo              boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (game_id, draw_date)
);
create index if not exists draws_game_time_idx on public.draws(game_id, draw_at);
create index if not exists draws_upcoming_idx on public.draws(draw_at) where status = 'scheduled';

alter table public.lottery_games
  drop constraint if exists lottery_games_next_draw_fk;
alter table public.lottery_games
  add constraint lottery_games_next_draw_fk
  foreign key (next_draw_id) references public.draws(id) on delete set null;

-- --------------------------------------------------------------------------
-- draw_results: numeros oficiais. Sempre com rastreio da fonte.
-- --------------------------------------------------------------------------
create table if not exists public.draw_results (
  id                 uuid primary key default gen_random_uuid(),
  draw_id            uuid not null references public.draws(id) on delete cascade,
  game_id            uuid not null references public.lottery_games(id) on delete cascade,
  main_numbers       smallint[] not null,
  special_numbers    smallint[] not null default '{}',
  multiplier         smallint,
  jackpot_amount     numeric(16,2),
  jackpot_won        boolean,
  winners_count      int,
  source             text not null,                   -- provedor que forneceu
  source_reference   text,
  is_official        boolean not null default false,  -- so true apos validacao
  verified_by        uuid references public.profiles(id),
  verified_at        timestamptz,
  published_at       timestamptz not null default now(),
  is_demo            boolean not null default false,
  raw_payload        jsonb,
  created_at         timestamptz not null default now(),
  unique (draw_id)
);
comment on column public.draw_results.is_official is
  'Enquanto false, o resultado e preliminar. Nenhum premio pode ser tratado '
  'como definitivo com is_official = false.';

-- Distribuicao de premios por faixa em um sorteio (valores pari-mutuel).
create table if not exists public.draw_prize_breakdown (
  id             uuid primary key default gen_random_uuid(),
  draw_id        uuid not null references public.draws(id) on delete cascade,
  tier_id        uuid not null references public.prize_tiers(id) on delete cascade,
  winners_count  int,
  prize_amount   numeric(16,2),
  created_at     timestamptz not null default now(),
  unique (draw_id, tier_id)
);

-- --------------------------------------------------------------------------
-- exchange_rates: cotacao registrada e imutavel por pedido.
-- --------------------------------------------------------------------------
create table if not exists public.exchange_rates (
  id             uuid primary key default gen_random_uuid(),
  base_currency  text not null default 'USD',
  quote_currency text not null default 'BRL',
  rate           numeric(16,6) not null,
  spread_percent numeric(6,4) not null default 0,
  effective_rate numeric(16,6) not null,       -- rate ajustada pelo spread
  source         text not null,
  source_reference text,
  captured_at    timestamptz not null default now(),
  is_demo        boolean not null default false,
  constraint exchange_rates_rate_ck check (rate > 0 and effective_rate > 0)
);
create index if not exists exchange_rates_pair_idx
  on public.exchange_rates(base_currency, quote_currency, captured_at desc);
comment on table public.exchange_rates is
  'Historico de cotacoes. O pedido guarda a taxa usada no checkout e ela '
  'nunca e reescrita retroativamente.';
