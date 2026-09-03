-- ===========================================================================
-- Jackpot USA  |  00 - Extensoes, tipos e helpers base
-- ---------------------------------------------------------------------------
-- Principios adotados em todo o schema:
--   * Nenhuma regra de negocio critica (preco, taxa, elegibilidade) vive no
--     frontend. Tudo aqui ou em Edge Functions.
--   * Valores monetarios usam NUMERIC (decimal exato), nunca float.
--   * Toda tabela recebe RLS. O default e negar.
--   * Transacoes ficam DESABILITADAS ate que um administrador habilite a
--     jurisdicao explicitamente (jurisdiction_rules.transactions_enabled).
-- ===========================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- --------------------------------------------------------------------------
-- Papeis (RBAC). CUSTOMER e o default de qualquer conta criada.
-- --------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum (
    'SUPER_ADMIN',
    'ADMIN',
    'COMPLIANCE',
    'FINANCE',
    'PURCHASER',
    'TICKET_VERIFIER',
    'SUPPORT',
    'CUSTOMER'
  );
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------------------
-- Ciclo de vida do pedido (secao 17 da especificacao).
-- --------------------------------------------------------------------------
do $$ begin
  create type public.order_status as enum (
    'pending_payment',
    'paid',
    'compliance_review',
    'awaiting_purchase',
    'purchased',
    'ticket_uploaded',
    'verified',
    'awaiting_draw',
    'winner',
    'not_winner',
    'claim_processing',
    'paid_out',
    'cancelled',
    'refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum (
    'initiated', 'pending', 'authorized', 'captured', 'failed',
    'cancelled', 'refunded', 'partially_refunded', 'chargeback', 'demo'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.refund_status as enum ('none', 'requested', 'processing', 'completed', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.kyc_status as enum (
    'not_started', 'pending', 'approved', 'rejected', 'manual_review', 'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.compliance_status as enum (
    'APPROVED', 'REJECTED', 'PENDING_REVIEW', 'BLOCKED', 'NOT_EVALUATED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.compliance_check_kind as enum (
    'age_check',
    'identity_check',
    'jurisdiction_check',
    'sanctions_check',
    'purchase_limits_check',
    'responsible_gaming_check',
    'payment_eligibility_check',
    'transactions_enabled_check'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ticket_status as enum (
    'pending_purchase', 'purchased', 'uploaded', 'verified', 'discrepancy',
    'void', 'redeemed', 'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.prize_claim_status as enum (
    'detected', 'verified', 'contacting_customer', 'documents_requested',
    'claim_started', 'claim_completed', 'funds_received', 'customer_paid',
    'rejected', 'expired'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('active', 'paused', 'cancelled', 'pending_activation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.draw_status as enum ('scheduled', 'closed_for_sales', 'drawn', 'official', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.game_status as enum ('active', 'paused', 'coming_soon', 'retired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.support_ticket_status as enum ('open', 'waiting_customer', 'waiting_internal', 'resolved', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_channel as enum ('in_app', 'email', 'push', 'sms', 'whatsapp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.rg_limit_kind as enum ('daily_spend', 'weekly_spend', 'monthly_spend', 'daily_orders', 'session_time');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.data_request_kind as enum ('export', 'deletion', 'rectification');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.data_request_status as enum ('received', 'in_progress', 'completed', 'rejected');
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------------------
-- Helpers sem dependencia de tabela. Os helpers de RBAC (has_role/is_staff)
-- ficam na migration 01, logo apos a criacao de public.operators.
-- --------------------------------------------------------------------------
create or replace function public.current_user_id()
returns uuid
language sql
stable
as $$ select auth.uid() $$;

-- Mantem updated_at coerente sem depender da aplicacao.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
