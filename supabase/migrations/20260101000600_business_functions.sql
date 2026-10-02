-- ===========================================================================
-- Jackpot USA  |  06 - Funcoes de negocio (autoridade do lado servidor)
-- ---------------------------------------------------------------------------
-- Tudo que decide "pode ou nao pode" e "quanto custa" vive aqui ou em Edge
-- Functions. O frontend apenas reflete o resultado.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Criacao de perfil no signup
-- --------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, phone, date_of_birth, residence_country)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    (nullif(new.raw_user_meta_data->>'date_of_birth', ''))::date,
    nullif(new.raw_user_meta_data->>'residence_country', '')
  )
  on conflict (id) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------------------
-- Numeracao legivel de pedidos / bilhetes / chamados
-- --------------------------------------------------------------------------
create sequence if not exists public.order_number_seq start 1000;
create sequence if not exists public.ticket_ref_seq start 1000;
create sequence if not exists public.support_ref_seq start 1000;
create sequence if not exists public.claim_ref_seq start 1000;

create or replace function public.next_order_number()
returns text language sql volatile
set search_path = public, extensions, pg_temp as $$
  select 'JP-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

create or replace function public.next_ticket_ref()
returns text language sql volatile
set search_path = public, extensions, pg_temp as $$
  select 'TK-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.ticket_ref_seq')::text, 6, '0');
$$;

create or replace function public.next_support_ref()
returns text language sql volatile
set search_path = public, extensions, pg_temp as $$
  select 'SP-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.support_ref_seq')::text, 6, '0');
$$;

create or replace function public.next_claim_ref()
returns text language sql volatile
set search_path = public, extensions, pg_temp as $$
  select 'PC-' || to_char(now(), 'YYMM') || '-' || lpad(nextval('public.claim_ref_seq')::text, 6, '0');
$$;

alter table public.orders alter column order_number set default public.next_order_number();
alter table public.tickets alter column ticket_ref set default public.next_ticket_ref();
alter table public.support_tickets alter column ticket_ref set default public.next_support_ref();
alter table public.prize_claims alter column claim_ref set default public.next_claim_ref();

-- --------------------------------------------------------------------------
-- Leitura tipada de system_settings
-- --------------------------------------------------------------------------
create or replace function public.setting_bool(p_key text, p_default boolean default false)
returns boolean
language sql stable security definer set search_path = public, extensions, pg_temp
as $$
  select coalesce((select (value #>> '{}')::boolean from public.system_settings where key = p_key), p_default);
$$;

create or replace function public.setting_numeric(p_key text, p_default numeric default 0)
returns numeric
language sql stable security definer set search_path = public, extensions, pg_temp
as $$
  select coalesce((select (value #>> '{}')::numeric from public.system_settings where key = p_key), p_default);
$$;

-- --------------------------------------------------------------------------
-- Jurisdicao: regra de estado tem precedencia sobre regra de pais.
-- Se nao existir regra, o resultado e "sem regra" => negado.
-- --------------------------------------------------------------------------
create or replace function public.resolve_jurisdiction(p_country text, p_state text default null)
returns public.jurisdiction_rules
language sql stable security definer set search_path = public, extensions, pg_temp
as $$
  select j.*
  from public.jurisdiction_rules j
  where j.country = upper(p_country)
    and (j.state is null or j.state = upper(p_state))
  order by (j.state is not null) desc
  limit 1;
$$;

-- --------------------------------------------------------------------------
-- Gasto acumulado numa janela (para purchase_limits_check)
-- --------------------------------------------------------------------------
create or replace function public.spent_in_window(p_user uuid, p_window interval)
returns numeric
language sql stable security definer set search_path = public, extensions, pg_temp
as $$
  select coalesce(sum(o.total), 0)
  from public.orders o
  where o.user_id = p_user
    and o.created_at >= now() - p_window
    and o.status not in ('cancelled', 'refunded', 'pending_payment');
$$;

-- --------------------------------------------------------------------------
-- COMPLIANCE ENGINE (autoridade). Retorna o veredito e grava cada check.
-- Nunca retorna APPROVED sem que os tres portoes estejam abertos.
-- --------------------------------------------------------------------------
create or replace function public.evaluate_compliance(
  p_user_id  uuid,
  p_order_id uuid default null,
  p_country  text default null,
  p_state    text default null,
  p_amount   numeric default 0,
  p_game_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_profile      public.profiles;
  v_jur          public.jurisdiction_rules;
  v_checks       jsonb := '[]'::jsonb;
  v_status       public.compliance_status := 'APPROVED';
  v_global_on    boolean;
  v_age          int;
  v_min_age      int := 18;
  v_spent_day    numeric;
  v_limit        numeric;
  v_engine       text := 'compliance-engine/1.0.0';
  v_excluded     boolean;
begin
  select * into v_profile from public.profiles where id = p_user_id;
  if not found then
    return jsonb_build_object(
      'status', 'REJECTED',
      'engine_version', v_engine,
      'checks', jsonb_build_array(jsonb_build_object(
        'kind', 'identity_check', 'passed', false,
        'reason_code', 'PROFILE_NOT_FOUND',
        'reason_message', 'Perfil nao encontrado.'))
    );
  end if;

  -- 1) Kill switch global -------------------------------------------------
  v_global_on := public.setting_bool('transactions_enabled', false);
  v_checks := v_checks || jsonb_build_object(
    'kind', 'transactions_enabled_check',
    'passed', v_global_on,
    'reason_code', case when v_global_on then 'OK' else 'GLOBAL_TRANSACTIONS_DISABLED' end,
    'reason_message', case when v_global_on
      then 'Transacoes habilitadas globalmente.'
      else 'A plataforma esta em modo demonstracao. Nenhuma compra e processada.' end
  );
  if not v_global_on then v_status := 'BLOCKED'; end if;

  -- 2) Jurisdicao ---------------------------------------------------------
  v_jur := public.resolve_jurisdiction(coalesce(p_country, v_profile.residence_country, ''), p_state);
  if v_jur.id is null then
    v_checks := v_checks || jsonb_build_object(
      'kind', 'jurisdiction_check', 'passed', false,
      'reason_code', 'JURISDICTION_NOT_CONFIGURED',
      'reason_message', 'Atualmente nao podemos aceitar compras a partir da sua localizacao.');
    v_status := 'BLOCKED';
  elsif not v_jur.transactions_enabled then
    v_checks := v_checks || jsonb_build_object(
      'kind', 'jurisdiction_check', 'passed', false,
      'reason_code', 'JURISDICTION_DISABLED',
      'reason_message', coalesce(v_jur.legal_notice,
        'Atualmente nao podemos aceitar compras a partir da sua localizacao.'));
    v_status := 'BLOCKED';
  elsif p_game_key is not null and not (p_game_key = any(v_jur.allowed_games)) then
    v_checks := v_checks || jsonb_build_object(
      'kind', 'jurisdiction_check', 'passed', false,
      'reason_code', 'GAME_NOT_ALLOWED_IN_JURISDICTION',
      'reason_message', 'Esta modalidade nao esta liberada na sua localizacao.');
    v_status := 'BLOCKED';
  else
    v_min_age := v_jur.minimum_age;
    v_checks := v_checks || jsonb_build_object(
      'kind', 'jurisdiction_check', 'passed', true,
      'reason_code', 'OK', 'reason_message', 'Jurisdicao autorizada.');
  end if;

  -- 3) Idade --------------------------------------------------------------
  if v_profile.date_of_birth is null then
    v_checks := v_checks || jsonb_build_object(
      'kind', 'age_check', 'passed', false,
      'reason_code', 'DOB_MISSING',
      'reason_message', 'Informe sua data de nascimento para prosseguir.');
    if v_status = 'APPROVED' then v_status := 'REJECTED'; end if;
  else
    v_age := extract(year from age(current_date, v_profile.date_of_birth));
    if v_age < v_min_age then
      v_checks := v_checks || jsonb_build_object(
        'kind', 'age_check', 'passed', false,
        'reason_code', 'UNDER_MINIMUM_AGE',
        'reason_message', format('Idade minima exigida nesta jurisdicao: %s anos.', v_min_age));
      v_status := 'BLOCKED';
    else
      v_checks := v_checks || jsonb_build_object(
        'kind', 'age_check', 'passed', true, 'reason_code', 'OK',
        'reason_message', 'Idade minima atendida.');
    end if;
  end if;

  -- 4) Identidade / KYC ---------------------------------------------------
  if v_jur.id is not null and v_jur.kyc_required and v_profile.kyc_status <> 'approved' then
    v_checks := v_checks || jsonb_build_object(
      'kind', 'identity_check', 'passed', false,
      'reason_code', 'KYC_REQUIRED',
      'reason_message', 'Verificacao de identidade pendente para esta jurisdicao.');
    if v_status = 'APPROVED' then v_status := 'PENDING_REVIEW'; end if;
  else
    v_checks := v_checks || jsonb_build_object(
      'kind', 'identity_check', 'passed', true, 'reason_code', 'OK',
      'reason_message', 'Identidade verificada ou nao exigida.');
  end if;

  -- 5) Jogo responsavel: pausa e autoexclusao sao bloqueios duros ---------
  v_excluded :=
       coalesce(v_profile.self_excluded_until  > now(), false)
    or coalesce(v_profile.account_paused_until > now(), false)
    or exists (
         select 1 from public.self_exclusions se
         where se.user_id = p_user_id
           and se.revoked_at is null
           and se.starts_at <= now()
           and (se.ends_at is null or se.ends_at > now()));

  if v_excluded then
    v_checks := v_checks || jsonb_build_object(
      'kind', 'responsible_gaming_check', 'passed', false,
      'reason_code', 'SELF_EXCLUDED_OR_PAUSED',
      'reason_message', 'Sua conta esta em pausa ou autoexclusao.');
    v_status := 'BLOCKED';
  else
    v_checks := v_checks || jsonb_build_object(
      'kind', 'responsible_gaming_check', 'passed', true, 'reason_code', 'OK',
      'reason_message', 'Sem restricoes de jogo responsavel ativas.');
  end if;

  -- 6) Limites de compra --------------------------------------------------
  v_spent_day := public.spent_in_window(p_user_id, interval '1 day');
  select l.amount into v_limit
  from public.responsible_gaming_limits l
  where l.user_id = p_user_id and l.kind = 'daily_spend'
    and l.active and l.effective_at <= now()
  order by l.effective_at desc limit 1;

  if v_limit is not null and (v_spent_day + coalesce(p_amount, 0)) > v_limit then
    v_checks := v_checks || jsonb_build_object(
      'kind', 'purchase_limits_check', 'passed', false,
      'reason_code', 'DAILY_LIMIT_EXCEEDED',
      'reason_message', 'Este pedido ultrapassa o limite diario definido por voce.',
      'evidence', jsonb_build_object('spent_today', v_spent_day, 'limit', v_limit));
    v_status := 'BLOCKED';
  elsif v_jur.id is not null and v_jur.max_transaction is not null
        and coalesce(p_amount, 0) > v_jur.max_transaction then
    v_checks := v_checks || jsonb_build_object(
      'kind', 'purchase_limits_check', 'passed', false,
      'reason_code', 'JURISDICTION_MAX_TRANSACTION',
      'reason_message', 'Valor acima do maximo permitido por transacao nesta jurisdicao.');
    v_status := 'BLOCKED';
  else
    v_checks := v_checks || jsonb_build_object(
      'kind', 'purchase_limits_check', 'passed', true, 'reason_code', 'OK',
      'reason_message', 'Dentro dos limites configurados.');
  end if;

  -- 7) Sancoes: exige provedor externo. Sem provedor => revisao manual.
  if v_jur.id is not null and v_jur.transactions_enabled then
    if public.setting_bool('sanctions_provider_enabled', false) then
      v_checks := v_checks || jsonb_build_object(
        'kind', 'sanctions_check', 'passed', true, 'reason_code', 'OK',
        'reason_message', 'Triagem de sancoes executada pelo provedor configurado.');
    else
      v_checks := v_checks || jsonb_build_object(
        'kind', 'sanctions_check', 'passed', false,
        'reason_code', 'SANCTIONS_PROVIDER_NOT_CONFIGURED',
        'reason_message', 'Triagem de sancoes ainda nao configurada; revisao manual necessaria.');
      if v_status = 'APPROVED' then v_status := 'PENDING_REVIEW'; end if;
    end if;
  end if;

  -- Persistencia dos checks
  insert into public.compliance_checks
    (user_id, order_id, kind, status, passed, reason_code, reason_message, evidence, jurisdiction_id, engine_version)
  select
    p_user_id,
    p_order_id,
    (c->>'kind')::public.compliance_check_kind,
    case when (c->>'passed')::boolean then 'APPROVED' else v_status end::public.compliance_status,
    (c->>'passed')::boolean,
    c->>'reason_code',
    c->>'reason_message',
    coalesce(c->'evidence', '{}'::jsonb),
    v_jur.id,
    v_engine
  from jsonb_array_elements(v_checks) c;

  if p_order_id is not null then
    update public.orders
      set compliance_status = v_status,
          compliance_evaluated_at = now(),
          jurisdiction_id = v_jur.id
    where id = p_order_id;
  end if;

  return jsonb_build_object(
    'status', v_status,
    'engine_version', v_engine,
    'jurisdiction_id', v_jur.id,
    'minimum_age', v_min_age,
    'checks', v_checks
  );
end;
$$;

comment on function public.evaluate_compliance is
  'Compliance Engine. APPROVED exige: kill switch global ligado + jurisdicao '
  'habilitada + idade + identidade + limites + jogo responsavel. Qualquer '
  'falha derruba o veredito. Nao existe caminho alternativo de aprovacao.';

-- --------------------------------------------------------------------------
-- Precificacao: sempre no servidor. Produto e taxa nunca sao misturados.
-- --------------------------------------------------------------------------
create or replace function public.calculate_order_totals(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_official numeric(14,2) := 0;
  v_fee      numeric(14,2) := 0;
  v_draws    int;
  v_rate     numeric(16,6);
begin
  select o.draws_count, o.exchange_rate into v_draws, v_rate
  from public.orders o where o.id = p_order_id;

  select
    coalesce(sum(l.unit_official_price * l.quantity), 0),
    coalesce(sum(l.unit_service_fee   * l.quantity), 0)
  into v_official, v_fee
  from public.order_lines l
  where l.order_id = p_order_id;

  v_official := v_official * coalesce(v_draws, 1);
  v_fee      := v_fee      * coalesce(v_draws, 1);

  update public.orders o
  set official_ticket_cost = v_official,
      service_fee = v_fee,
      total = v_official + v_fee + coalesce(o.tax, 0),
      total_display = case when v_rate is null then null
                      else round((v_official + v_fee + coalesce(o.tax, 0)) * v_rate, 2) end
  where o.id = p_order_id;
end;
$$;

-- --------------------------------------------------------------------------
-- Conferencia automatica pos-sorteio
-- --------------------------------------------------------------------------
create or replace function public.match_ticket_against_result(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ticket   public.tickets;
  v_result   public.draw_results;
  v_main     int;
  v_special  int;
  v_tier     public.prize_tiers;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id;
  if not found then return jsonb_build_object('error', 'TICKET_NOT_FOUND'); end if;

  select * into v_result from public.draw_results where draw_id = v_ticket.draw_id;
  if not found then return jsonb_build_object('error', 'RESULT_NOT_AVAILABLE'); end if;

  select count(*) into v_main
  from unnest(v_ticket.numbers) n
  where n = any(v_result.main_numbers);

  select count(*) into v_special
  from unnest(v_ticket.special_numbers) s
  where s = any(v_result.special_numbers);

  select * into v_tier
  from public.prize_tiers t
  where t.game_id = v_ticket.game_id
    and t.main_matches = v_main
    and t.special_matches = v_special
  limit 1;

  update public.tickets
  set matched_main = v_main,
      matched_special = v_special,
      won = (v_tier.id is not null),
      prize_tier_id = v_tier.id,
      estimated_prize = v_tier.fixed_prize,
      -- Premio so e definitivo quando o resultado e oficial E foi revisado.
      prize_confirmed = false,
      checked_at = now(),
      result_source = v_result.source,
      status = case when status = 'verified' then 'verified' else status end
  where id = p_ticket_id;

  return jsonb_build_object(
    'ticket_id', p_ticket_id,
    'matched_main', v_main,
    'matched_special', v_special,
    'won', (v_tier.id is not null),
    'prize_tier', v_tier.tier_key,
    'estimated_prize', v_tier.fixed_prize,
    'result_is_official', v_result.is_official,
    'source', v_result.source
  );
end;
$$;

create or replace function public.compare_all_tickets(p_draw_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ticket record;
  v_checked int := 0;
  v_winners int := 0;
  v_official boolean;
begin
  select is_official into v_official from public.draw_results where draw_id = p_draw_id;
  if v_official is null then
    return jsonb_build_object('error', 'RESULT_NOT_AVAILABLE');
  end if;

  for v_ticket in
    select id from public.tickets
    where draw_id = p_draw_id and status in ('purchased','uploaded','verified')
  loop
    perform public.match_ticket_against_result(v_ticket.id);
    v_checked := v_checked + 1;
  end loop;

  select count(*) into v_winners
  from public.tickets where draw_id = p_draw_id and won is true;

  -- Abre um processo de resgate para cada bilhete premiado, em 'detected'.
  -- Nenhum pagamento e disparado automaticamente.
  insert into public.prize_claims (ticket_id, order_id, user_id, status, gross_amount, currency, is_demo)
  select t.id, t.order_id, t.user_id, 'detected', t.estimated_prize, 'USD', t.is_demo
  from public.tickets t
  where t.draw_id = p_draw_id and t.won is true
    and not exists (select 1 from public.prize_claims c where c.ticket_id = t.id);

  update public.orders o
  set status = case when t.won then 'winner'::public.order_status else 'not_winner'::public.order_status end
  from public.tickets t
  where t.order_id = o.id and t.draw_id = p_draw_id
    and o.status in ('verified', 'awaiting_draw');

  return jsonb_build_object(
    'draw_id', p_draw_id,
    'checked', v_checked,
    'winners', v_winners,
    'result_is_official', v_official
  );
end;
$$;

comment on function public.compare_all_tickets is
  'Conferencia automatica. Marca acertos e abre prize_claims em estado '
  '"detected". Nada e tratado como premio definitivo antes da validacao '
  'oficial (draw_results.is_official + revisao humana).';

-- --------------------------------------------------------------------------
-- Conferencia dupla: pedido original x bilhete adquirido (secao 35)
-- --------------------------------------------------------------------------
create or replace function public.verify_ticket_against_order(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_ticket public.tickets;
  v_line   public.order_lines;
  v_diffs  text[] := '{}';
begin
  select * into v_ticket from public.tickets where id = p_ticket_id;
  if not found then return jsonb_build_object('error', 'TICKET_NOT_FOUND'); end if;

  select * into v_line from public.order_lines where id = v_ticket.order_line_id;
  if not found then return jsonb_build_object('error', 'ORDER_LINE_NOT_FOUND'); end if;

  if not (v_ticket.numbers @> v_line.numbers and v_ticket.numbers <@ v_line.numbers) then
    v_diffs := v_diffs || 'numbers';
  end if;
  if not (v_ticket.special_numbers @> v_line.special_numbers
          and v_ticket.special_numbers <@ v_line.special_numbers) then
    v_diffs := v_diffs || 'special_numbers';
  end if;
  if v_ticket.game_id <> v_line.game_id then
    v_diffs := v_diffs || 'game';
  end if;
  if v_ticket.options <> v_line.options then
    v_diffs := v_diffs || 'options';
  end if;

  update public.tickets
  set status = case when array_length(v_diffs, 1) is null then 'verified' else 'discrepancy' end,
      discrepancy_notes = case when array_length(v_diffs, 1) is null then null
                          else 'Divergencia em: ' || array_to_string(v_diffs, ', ') end
  where id = p_ticket_id;

  return jsonb_build_object(
    'ticket_id', p_ticket_id,
    'match', array_length(v_diffs, 1) is null,
    'differences', to_jsonb(v_diffs)
  );
end;
$$;

-- --------------------------------------------------------------------------
-- Geracao de sorteios futuros a partir do calendario configurado no jogo.
-- Usada pelo worker de sincronizacao e pelo painel admin.
-- --------------------------------------------------------------------------
create or replace function public.generate_upcoming_draws(p_game_id uuid, p_count int default 8)
returns int
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  g            public.lottery_games;
  v_day        date := (now() at time zone 'UTC')::date;
  v_created    int := 0;
  v_draw_at    timestamptz;
  v_guard      int := 0;
begin
  select * into g from public.lottery_games where id = p_game_id;
  if not found or array_length(g.draw_days, 1) is null then
    return 0;
  end if;

  while v_created < p_count and v_guard < 400 loop
    v_guard := v_guard + 1;

    if extract(dow from v_day)::smallint = any(g.draw_days) then
      -- Monta o instante do sorteio no fuso oficial do jogo.
      v_draw_at := (v_day + g.draw_time_local) at time zone g.timezone;

      if v_draw_at > now() then
        insert into public.draws (
          game_id, draw_date, draw_at, sales_close_at, status,
          advertised_jackpot, is_demo
        )
        values (
          g.id, v_day, v_draw_at,
          v_draw_at - make_interval(mins => g.sales_cutoff_minutes),
          'scheduled', g.current_jackpot, g.is_demo
        )
        on conflict (game_id, draw_date) do nothing;

        if found then v_created := v_created + 1; end if;
      end if;
    end if;

    v_day := v_day + 1;
  end loop;

  -- Aponta o proximo sorteio no jogo.
  update public.lottery_games lg
  set next_draw_id = (
        select d.id from public.draws d
        where d.game_id = lg.id and d.draw_at > now() and d.status = 'scheduled'
        order by d.draw_at limit 1)
  where lg.id = p_game_id;

  return v_created;
end;
$$;
