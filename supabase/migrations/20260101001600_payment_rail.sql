-- ---------------------------------------------------------------------------
-- Trilho de pagamento: Mercado Pago (PIX e cartao via Checkout Pro).
--
-- QUEM E DONO DO QUE
--   O banco e dono do dinheiro; a Edge Function so conversa HTTP com o
--   Mercado Pago. Por isso o valor a cobrar NUNCA e parametro: `begin_payment`
--   le `orders.total_display` da propria linha do pedido. Cliente adulterado,
--   Edge Function com bug de arredondamento ou chamada repetida nao conseguem
--   mudar quanto se cobra.
--
--   `settle_payment` e o unico caminho para marcar pedido como pago, e exige
--   o id da transacao no provedor. Nao ha atalho que mude `orders.status`
--   para 'paid' sem um pagamento capturado por tras.
--
-- OS PORTOES CONTINUAM VALENDO
--   `begin_payment` chama `evaluate_compliance()` e aborta em qualquer
--   veredito diferente de APPROVED. Como o kill switch global esta desligado
--   e nenhuma jurisdicao esta habilitada, hoje a funcao recusa toda tentativa
--   — que e o comportamento correto enquanto o enquadramento do processador e
--   a revisao juridica nao sairem. O trilho fica pronto, nao aberto.
-- ---------------------------------------------------------------------------

-- --------------------------------------------------------------------------
-- Notificacoes recebidas do provedor.
--
-- Guardar a notificacao crua resolve tres coisas de uma vez: idempotencia (o
-- Mercado Pago reenvia a mesma notificacao varias vezes por desenho),
-- auditoria de divergencia, e material para depurar sem precisar reproduzir.
-- --------------------------------------------------------------------------
create table if not exists public.payment_webhook_events (
  id             bigserial primary key,
  provider       text not null,
  -- Id do evento no provedor. Unico por provedor: e isso que torna o
  -- reprocessamento inofensivo.
  external_id    text not null,
  topic          text,
  signature_ok   boolean not null,
  payload        jsonb,
  payment_id     uuid references public.payments(id) on delete set null,
  processed_at   timestamptz,
  error_message  text,
  received_at    timestamptz not null default now(),
  unique (provider, external_id)
);

comment on table public.payment_webhook_events is
  'Notificacoes cruas do provedor de pagamento. A unicidade (provider, '
  'external_id) e o que torna o reenvio idempotente.';

create index if not exists payment_webhook_events_pending_idx
  on public.payment_webhook_events(received_at desc)
  where processed_at is null;

alter table public.payment_webhook_events enable row level security;
alter table public.payment_webhook_events force row level security;

-- Nenhuma policy de leitura para cliente: notificacao de pagamento contem
-- dado do provedor e nao tem por que chegar ao navegador. Staff le pelo
-- painel, que roda com papel.
create policy payment_webhook_events_staff_read
  on public.payment_webhook_events for select
  using (public.has_role(array['SUPER_ADMIN','FINANCE','COMPLIANCE']::public.app_role[]));

-- --------------------------------------------------------------------------
-- Abre uma tentativa de pagamento.
-- --------------------------------------------------------------------------
create or replace function public.begin_payment(
  p_order_id     uuid,
  p_provider_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order    public.orders;
  v_provider public.payment_providers;
  v_verdict  jsonb;
  v_payment  uuid;
  v_amount   numeric;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Pedido % nao encontrado', p_order_id;
  end if;

  -- O dono do pedido e quem paga. Operador nao paga por cliente.
  if v_order.user_id is distinct from auth.uid() then
    raise exception 'Pedido nao pertence ao usuario autenticado';
  end if;

  if v_order.status <> 'pending_payment' then
    raise exception 'Pedido % nao esta aguardando pagamento (status %)',
      v_order.order_number, v_order.status;
  end if;

  select * into v_provider
  from public.payment_providers where provider_key = p_provider_key;
  if not found then
    raise exception 'Meio de pagamento % nao existe', p_provider_key;
  end if;
  if not v_provider.is_enabled then
    raise exception 'Meio de pagamento % esta desabilitado', p_provider_key;
  end if;

  -- Portao de compliance. Nao existe caminho alternativo.
  v_verdict := public.evaluate_compliance(
    v_order.user_id, v_order.id, null, null, v_order.total, null);
  if (v_verdict ->> 'status') <> 'APPROVED' then
    raise exception 'Compliance recusou: %', coalesce(v_verdict ->> 'status', 'sem veredito');
  end if;

  -- O valor vem do pedido, nunca de parametro. O pedido ja congelou a taxa de
  -- cambio, entao total_display e o que o cliente viu e e o que ele paga.
  v_amount := v_order.total_display;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Pedido % sem valor em %', v_order.order_number, v_order.display_currency;
  end if;
  if v_provider.currency is distinct from v_order.display_currency then
    raise exception 'Meio de pagamento cobra em %, pedido esta em %',
      v_provider.currency, v_order.display_currency;
  end if;
  if v_provider.min_amount is not null and v_amount < v_provider.min_amount then
    raise exception 'Valor abaixo do minimo do meio de pagamento';
  end if;
  if v_provider.max_amount is not null and v_amount > v_provider.max_amount then
    raise exception 'Valor acima do maximo do meio de pagamento';
  end if;

  -- Tentativa anterior ainda aberta e reaproveitada: o cliente que recarrega a
  -- tela de PIX nao deve gerar cobranca nova.
  select id into v_payment
  from public.payments
  where order_id = p_order_id
    and provider = p_provider_key
    and status in ('initiated','pending')
  order by created_at desc
  limit 1;

  if v_payment is null then
    insert into public.payments (
      order_id, user_id, provider, method, currency, amount, status, is_demo
    ) values (
      p_order_id, v_order.user_id, p_provider_key, v_provider.method,
      v_provider.currency, v_amount, 'initiated', v_order.is_demo
    ) returning id into v_payment;
  end if;

  return jsonb_build_object(
    'payment_id',   v_payment,
    'order_number', v_order.order_number,
    'amount',       v_amount,
    'currency',     v_provider.currency,
    'method',       v_provider.method,
    'is_demo',      v_order.is_demo
  );
end;
$$;

comment on function public.begin_payment is
  'Abre tentativa de pagamento. O valor sai de orders.total_display, nunca de '
  'parametro, e o Compliance Engine precisa aprovar antes.';

-- --------------------------------------------------------------------------
-- Conclui (ou falha) uma tentativa de pagamento.
--
-- Chamada somente pelo webhook, com service role. O status vem da releitura
-- do pagamento na API do provedor, nunca do corpo da notificacao.
-- --------------------------------------------------------------------------
create or replace function public.settle_payment(
  p_payment_id   uuid,
  p_provider_txn text,
  p_status       public.payment_status,
  p_detail       jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_payment public.payments;
  v_order   public.orders;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Pagamento % nao encontrado', p_payment_id;
  end if;

  -- Estado terminal nao volta atras por reenvio de notificacao.
  if v_payment.status in ('captured','refunded','chargeback') then
    return jsonb_build_object('payment_id', p_payment_id,
                              'status', v_payment.status, 'changed', false);
  end if;

  update public.payments
  set status                 = p_status,
      provider_transaction_id = coalesce(p_provider_txn, provider_transaction_id),
      metadata               = coalesce(p_detail, metadata),
      confirmed_at           = case when p_status = 'captured' then now() else confirmed_at end,
      failure_code           = case when p_status = 'failed'
                                    then coalesce(p_detail ->> 'status_detail', failure_code) end,
      updated_at             = now()
  where id = p_payment_id;

  select * into v_order from public.orders where id = v_payment.order_id for update;

  -- Pedido so avanca com pagamento capturado. Pagamento pendente mantem o
  -- pedido aguardando: PIX leva minutos e o cliente nao pode ver "pago" antes.
  if p_status = 'captured' and v_order.status = 'pending_payment' then
    update public.orders
    set status = 'paid', paid_at = now(), updated_at = now()
    where id = v_order.id;
  end if;

  perform public.write_audit_log(
    'payment.settled', 'payments', p_payment_id::text,
    jsonb_build_object('status', v_payment.status),
    jsonb_build_object('status', p_status, 'provider_txn', p_provider_txn),
    case when p_status in ('failed','chargeback') then 'warning' else 'info' end
  );

  return jsonb_build_object('payment_id', p_payment_id, 'status', p_status, 'changed', true);
end;
$$;

comment on function public.settle_payment is
  'Conclui tentativa de pagamento e, so com captura, move o pedido para paid. '
  'Estado terminal nao regride por reenvio de notificacao.';

-- --------------------------------------------------------------------------
-- Provedores. Nascem DESLIGADOS, e e intencional: ligar depende do
-- enquadramento comercial do Mercado Pago sair por escrito e da revisao
-- juridica das jurisdicoes.
-- --------------------------------------------------------------------------
insert into public.payment_providers
  (provider_key, display_name, method, is_enabled, currency, allowed_jurisdictions, notes)
values
  ('mercadopago_pix', 'PIX', 'pix', false, 'BRL', array[]::text[],
   'Mercado Pago, API de pagamentos. QR e codigo copia-e-cola na propria tela. '
   'Exige CPF do pagador, coletado no checkout e nao armazenado. Ligar apenas '
   'apos enquadramento de MCC confirmado por escrito pelo Mercado Pago.'),
  ('mercadopago_card', 'Cartao de credito', 'card', false, 'BRL', array[]::text[],
   'Mercado Pago, Checkout Pro. O cliente conclui no ambiente do Mercado Pago, '
   'entao nenhum dado de cartao passa por esta plataforma. Ligar apenas apos '
   'enquadramento de MCC confirmado por escrito.')
on conflict (provider_key) do nothing;

revoke execute on function public.settle_payment(uuid, text, public.payment_status, jsonb)
  from public, anon, authenticated;
revoke execute on function public.begin_payment(uuid, text) from public, anon;
grant  execute on function public.begin_payment(uuid, text) to authenticated;
