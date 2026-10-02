-- ===========================================================================
-- Jackpot USA  |  01 - Identidade, jurisdicoes, compliance, KYC, privacidade
-- ===========================================================================

-- --------------------------------------------------------------------------
-- profiles: espelho aplicacional de auth.users.
-- Dados sensiveis de documento NAO ficam aqui (ver kyc_checks / provider).
-- --------------------------------------------------------------------------
create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  full_name            text,
  display_name         text,
  email                extensions.citext,
  phone                text,
  phone_verified_at    timestamptz,
  date_of_birth        date,
  residence_country    text,                       -- ISO 3166-1 alpha-2
  preferred_locale     text not null default 'pt-BR',
  preferred_currency   text not null default 'BRL',
  marketing_opt_in     boolean not null default false,
  kyc_status           public.kyc_status not null default 'not_started',
  self_excluded_until  timestamptz,
  account_paused_until timestamptz,
  terms_accepted_at    timestamptz,
  privacy_accepted_at  timestamptz,
  age_confirmed_at     timestamptz,
  is_demo              boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table public.profiles is
  'Perfil do usuario. Documento/selfie ficam no provedor de KYC, nao aqui.';

create index if not exists profiles_kyc_status_idx on public.profiles(kyc_status);
create index if not exists profiles_residence_country_idx on public.profiles(residence_country);

-- --------------------------------------------------------------------------
-- addresses
-- --------------------------------------------------------------------------
create table if not exists public.addresses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  label         text,
  line1         text not null,
  line2         text,
  city          text not null,
  state         text,
  postal_code   text,
  country       text not null,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses(user_id);

-- --------------------------------------------------------------------------
-- operators: quem e staff e com qual papel (RBAC).
-- A ausencia de linha = cliente comum.
-- --------------------------------------------------------------------------
create table if not exists public.operators (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         public.app_role not null,
  is_active    boolean not null default true,
  display_name text,
  notes        text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, role)
);
comment on table public.operators is
  'Staff e papeis. PURCHASER ve apenas o necessario para adquirir bilhetes; '
  'FINANCE nao acessa documentos de KYC.';
create index if not exists operators_user_idx on public.operators(user_id) where is_active;

-- --------------------------------------------------------------------------
-- Helpers de RBAC. SECURITY DEFINER para serem chamados dentro de policies
-- sem provocar recursao de RLS sobre a propria tabela operators.
-- --------------------------------------------------------------------------
create or replace function public.has_role(required public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1
    from public.operators o
    where o.user_id = auth.uid()
      and o.is_active
      and o.role = any(required)
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select exists (
    select 1 from public.operators o
    where o.user_id = auth.uid() and o.is_active
  );
$$;


-- --------------------------------------------------------------------------
-- jurisdiction_rules: coracao regulatorio. Sem linha habilitada aqui,
-- nenhuma transacao acontece, em nenhum lugar do sistema.
-- --------------------------------------------------------------------------
create table if not exists public.jurisdiction_rules (
  id                    uuid primary key default gen_random_uuid(),
  country               text not null,               -- ISO alpha-2
  state                 text,                        -- NULL = regra do pais inteiro
  transactions_enabled  boolean not null default false,
  payment_enabled       boolean not null default false,
  subscriptions_enabled boolean not null default false,
  minimum_age           smallint not null default 18,
  kyc_required          boolean not null default true,
  allowed_games         text[] not null default '{}',    -- vazio = nenhum jogo liberado
  max_transaction       numeric(14,2),
  max_daily_amount      numeric(14,2),
  currency              text not null default 'USD',
  legal_notice          text,
  legal_basis_reference text,
  requires_manual_review boolean not null default true,
  enabled_by            uuid references public.profiles(id),
  enabled_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
comment on table public.jurisdiction_rules is
  'Regras por pais/estado. Default e negar: transactions_enabled=false. '
  'Habilitar exige decisao administrativa registrada (enabled_by/enabled_at).';
create unique index if not exists jurisdiction_rules_scope_uidx
  on public.jurisdiction_rules (country, coalesce(state, ''));

-- --------------------------------------------------------------------------
-- geolocation_events: evidencia de onde o usuario estava. Somente escrita
-- pelo servidor. Nunca editavel pelo usuario (por isso nao ha policy de
-- update/delete para o dono).
-- --------------------------------------------------------------------------
create table if not exists public.geolocation_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles(id) on delete set null,
  session_ref    text,
  context        text not null default 'browse',   -- browse | checkout | payment
  country        text,
  state          text,
  city           text,
  latitude       numeric(9,6),
  longitude      numeric(9,6),
  accuracy_m     numeric(10,2),
  ip_country     text,
  ip_state       text,
  ip_hash        text,                              -- hash, nunca o IP cru
  source         text not null default 'browser',   -- browser | ip | provider
  mismatch_flag  boolean not null default false,    -- divergencia GPS x IP
  raw_provider   jsonb,
  created_at     timestamptz not null default now()
);
comment on table public.geolocation_events is
  'Trilha de geolocalizacao para auditoria. Registro imutavel e sempre '
  'gravado no servidor; divergencias sao sinalizadas, nunca corrigidas '
  'manualmente pelo usuario.';
create index if not exists geolocation_events_user_idx on public.geolocation_events(user_id, created_at desc);

-- --------------------------------------------------------------------------
-- compliance_checks: resultado de cada verificacao individual.
-- --------------------------------------------------------------------------
create table if not exists public.compliance_checks (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references public.profiles(id) on delete set null,
  order_id       uuid,                              -- FK adicionada apos orders
  kind           public.compliance_check_kind not null,
  status         public.compliance_status not null default 'NOT_EVALUATED',
  passed         boolean not null default false,
  reason_code    text,
  reason_message text,
  evidence       jsonb not null default '{}'::jsonb,
  jurisdiction_id uuid references public.jurisdiction_rules(id),
  evaluated_by   text not null default 'engine',    -- engine | operator:<uuid>
  engine_version text,
  created_at     timestamptz not null default now()
);
create index if not exists compliance_checks_user_idx on public.compliance_checks(user_id, created_at desc);
create index if not exists compliance_checks_order_idx on public.compliance_checks(order_id);

-- --------------------------------------------------------------------------
-- kyc_checks: referencia ao provedor externo. Nunca guardamos o documento.
-- --------------------------------------------------------------------------
create table if not exists public.kyc_checks (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles(id) on delete cascade,
  status               public.kyc_status not null default 'not_started',
  provider             text,                        -- ex.: provedor licenciado
  provider_reference   text,                        -- id da verificacao no provedor
  document_type        text,                        -- 'passport' | 'cpf' | ...
  document_last4       text,                        -- somente ultimos digitos
  has_document_image   boolean not null default false,
  has_selfie           boolean not null default false,
  has_proof_of_address boolean not null default false,
  rejection_reason     text,
  reviewed_by          uuid references public.profiles(id),
  submitted_at         timestamptz,
  resolved_at          timestamptz,
  expires_at           timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
comment on table public.kyc_checks is
  'Ponteiro para verificacao no provedor de KYC. Imagens de documento e '
  'selfie ficam no provedor; aqui guardamos apenas referencia e status.';
create index if not exists kyc_checks_user_idx on public.kyc_checks(user_id, created_at desc);

-- --------------------------------------------------------------------------
-- responsible_gaming_limits: limites definidos pelo proprio usuario.
-- Aumento de limite pode exigir periodo de espera (effective_at no futuro).
-- --------------------------------------------------------------------------
create table if not exists public.responsible_gaming_limits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  kind           public.rg_limit_kind not null,
  amount         numeric(14,2),
  currency       text not null default 'USD',
  active         boolean not null default true,
  requested_at   timestamptz not null default now(),
  effective_at   timestamptz not null default now(),
  is_increase    boolean not null default false,
  previous_amount numeric(14,2),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
comment on column public.responsible_gaming_limits.effective_at is
  'Reducoes valem imediatamente. Aumentos podem exigir periodo de espera '
  'definido em system_settings (rg.increase_cooldown_hours).';
create index if not exists rg_limits_user_idx on public.responsible_gaming_limits(user_id, kind) where active;

create table if not exists public.self_exclusions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  kind          text not null default 'self_exclusion',   -- pause | self_exclusion
  starts_at     timestamptz not null default now(),
  ends_at       timestamptz,                               -- NULL = permanente
  reason        text,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists self_exclusions_user_idx on public.self_exclusions(user_id, starts_at desc);

-- --------------------------------------------------------------------------
-- Privacidade: LGPD / GDPR / leis estaduais dos EUA.
-- --------------------------------------------------------------------------
create table if not exists public.consent_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete set null,
  consent_key   text not null,          -- terms | privacy | marketing | cookies_analytics
  granted       boolean not null,
  version       text,                   -- versao do documento aceito
  locale        text,
  ip_hash       text,
  user_agent    text,
  created_at    timestamptz not null default now()
);
create index if not exists consent_logs_user_idx on public.consent_logs(user_id, created_at desc);

create table if not exists public.data_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  kind          public.data_request_kind not null,
  status        public.data_request_status not null default 'received',
  notes         text,
  handled_by    uuid references public.profiles(id),
  export_url    text,
  requested_at  timestamptz not null default now(),
  resolved_at   timestamptz
);
create index if not exists data_requests_user_idx on public.data_requests(user_id, requested_at desc);
