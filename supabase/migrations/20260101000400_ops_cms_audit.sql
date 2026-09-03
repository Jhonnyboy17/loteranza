-- ===========================================================================
-- Jackpot USA  |  04 - Notificacoes, suporte, CMS, configuracoes, auditoria
-- ===========================================================================

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  event_key    text not null,          -- payment_approved | ticket_purchased | ...
  title        text not null,
  body         text,
  channel      public.notification_channel not null default 'in_app',
  priority     text not null default 'normal',   -- normal | high | critical
  action_url   text,
  payload      jsonb not null default '{}'::jsonb,
  read_at      timestamptz,
  sent_at      timestamptz,
  delivery_status text not null default 'queued',
  created_at   timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id) where read_at is null;

create table if not exists public.notification_preferences (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  email_enabled      boolean not null default true,
  push_enabled       boolean not null default false,
  sms_enabled        boolean not null default false,
  whatsapp_enabled   boolean not null default false,
  muted_events       text[] not null default '{}',
  updated_at         timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- Suporte
-- --------------------------------------------------------------------------
create table if not exists public.support_tickets (
  id            uuid primary key default gen_random_uuid(),
  ticket_ref    text not null unique,
  user_id       uuid references public.profiles(id) on delete set null,
  category      text not null,         -- account | payment | ticket | results | prizes | verification | security
  subject       text not null,
  status        public.support_ticket_status not null default 'open',
  priority      text not null default 'normal',
  order_id      uuid references public.orders(id) on delete set null,
  assigned_to   uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  resolved_at   timestamptz
);
create index if not exists support_tickets_user_idx on public.support_tickets(user_id, created_at desc);
create index if not exists support_tickets_status_idx on public.support_tickets(status);

create table if not exists public.support_messages (
  id            uuid primary key default gen_random_uuid(),
  ticket_id     uuid not null references public.support_tickets(id) on delete cascade,
  author_id     uuid references public.profiles(id) on delete set null,
  is_internal   boolean not null default false,
  body          text not null,
  attachments   jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists support_messages_ticket_idx on public.support_messages(ticket_id, created_at);

-- --------------------------------------------------------------------------
-- CMS: todo texto institucional e legal e editavel sem deploy.
-- --------------------------------------------------------------------------
create table if not exists public.cms_content (
  id             uuid primary key default gen_random_uuid(),
  content_key    text not null,           -- 'legal.terms', 'home.hero', ...
  locale         text not null default 'pt-BR',
  kind           text not null default 'rich_text',  -- rich_text | markdown | json | banner
  title          text,
  body           text,
  data           jsonb not null default '{}'::jsonb,
  version        int not null default 1,
  is_published   boolean not null default false,
  requires_legal_review boolean not null default false,
  legal_reviewed_by text,
  legal_reviewed_at timestamptz,
  updated_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (content_key, locale, version)
);
comment on column public.cms_content.requires_legal_review is
  'Textos juridicos entram com placeholder e so podem ser publicados apos '
  'revisao registrada. Nao ha texto juridico definitivo gerado pelo sistema.';

create table if not exists public.faqs (
  id           uuid primary key default gen_random_uuid(),
  locale       text not null default 'pt-BR',
  category     text not null default 'geral',
  question     text not null,
  answer       text not null,
  game_id      uuid references public.lottery_games(id) on delete cascade,
  sort_order   int not null default 100,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- --------------------------------------------------------------------------
-- system_settings: kill switches e parametros operacionais.
-- --------------------------------------------------------------------------
create table if not exists public.system_settings (
  key          text primary key,
  value        jsonb not null,
  description  text,
  is_public    boolean not null default false,   -- true = pode ser lido sem login
  updated_by   uuid references public.profiles(id),
  updated_at   timestamptz not null default now()
);
comment on table public.system_settings is
  'Configuracao operacional editavel pelo admin. transactions_enabled aqui e '
  'apenas UM dos tres portoes: env + jurisdicao + compliance.';

-- --------------------------------------------------------------------------
-- audit_logs: append-only. Nao ha caminho de UPDATE/DELETE pelo painel.
-- --------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          bigserial primary key,
  user_id     uuid references public.profiles(id) on delete set null,
  role        public.app_role,
  action      text not null,
  entity      text not null,
  entity_id   text,
  old_value   jsonb,
  new_value   jsonb,
  ip_hash     text,
  user_agent  text,
  severity    text not null default 'info',
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_entity_idx on public.audit_logs(entity, entity_id, created_at desc);
create index if not exists audit_logs_user_idx on public.audit_logs(user_id, created_at desc);

-- Bloqueio fisico de alteracao/remocao de log, independente de RLS.
create or replace function public.audit_logs_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs e append-only: % nao e permitido', tg_op;
end;
$$;

drop trigger if exists audit_logs_no_update on public.audit_logs;
create trigger audit_logs_no_update
  before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

-- Escrita de log a partir de qualquer contexto autenticado.
create or replace function public.write_audit_log(
  p_action    text,
  p_entity    text,
  p_entity_id text default null,
  p_old       jsonb default null,
  p_new       jsonb default null,
  p_severity  text default 'info'
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.app_role;
begin
  select o.role into v_role
  from public.operators o
  where o.user_id = auth.uid() and o.is_active
  order by o.created_at
  limit 1;

  insert into public.audit_logs(user_id, role, action, entity, entity_id, old_value, new_value, severity)
  values (auth.uid(), coalesce(v_role, 'CUSTOMER'), p_action, p_entity, p_entity_id, p_old, p_new, p_severity);
end;
$$;

-- --------------------------------------------------------------------------
-- Gatilhos de updated_at
-- --------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','addresses','operators','jurisdiction_rules','kyc_checks',
    'responsible_gaming_limits','lottery_games','draws','orders',
    'payment_providers','payments','tickets','ticket_vault','prize_claims',
    'subscriptions','favorites','jackpot_alerts','support_tickets',
    'cms_content','faqs','notification_preferences'
  ] loop
    execute format('drop trigger if exists touch_%1$s on public.%1$I', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$I '
      'for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;
