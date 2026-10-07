-- ---------------------------------------------------------------------------
-- Triagem de sancoes: o registro passa a dizer a verdade.
--
-- O flag `sanctions_provider_enabled` tinha um defeito grave. Ligado, ele
-- fazia o sistema gravar em compliance_checks que a triagem foi "executada
-- pelo provedor configurado" — mesmo nao existindo provedor nenhum. Quem
-- precisasse destravar uma venda acabava produzindo evidencia falsa de uma
-- checagem que nunca rodou, e e justamente esse documento que um banco ou um
-- regulador pede para ver.
--
-- Substituido por `sanctions_screening_mode`, com tres valores explicitos:
--
--   provider       a triagem rodou de verdade;
--   risk_accepted  NAO rodou, e o registro diz isso por extenso. A venda
--                  segue por decisao administrativa, e a ausencia da triagem
--                  fica documentada em vez de escondida;
--   qualquer outro nao rodou e o pedido para em revisao manual (o padrao).
--
-- A diferenca entre o estado antigo e o novo nao e se a venda acontece: e se
-- a trilha de auditoria conta o que de fato houve.
-- ---------------------------------------------------------------------------

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
  -- 1.1.0, nao 1.0.0: a regra de sancoes mudou de comportamento nesta
  -- migration, e `engine_version` e carimbado em cada linha de
  -- compliance_checks justamente para dizer QUAL conjunto de regras decidiu.
  -- Manter 1.0.0 faria a trilha de auditoria atribuir vereditos novos ao
  -- ruleset antigo — e e por essa coluna que se reconstroi, depois, por que
  -- um pedido foi aprovado.
  v_engine       text := 'compliance-engine/1.1.0';
  v_excluded     boolean;
  v_sanctions    text;
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

  -- 7) Sancoes.
  --
  -- O flag booleano anterior tinha um defeito grave: ligado, ele fazia o
  -- sistema GRAVAR em compliance_checks que a triagem foi "executada pelo
  -- provedor configurado" mesmo sem provedor nenhum. Operador que precisasse
  -- destravar uma venda acabava registrando evidencia falsa de uma checagem
  -- que nunca rodou — exatamente o documento que um banco ou regulador pede
  -- para ver.
  --
  -- Agora sao tres modos explicitos, e nenhum deles mente:
  --   'provider'      triagem rodou de verdade;
  --   'risk_accepted' NAO rodou, e o registro diz isso com todas as letras,
  --                   junto de quem assumiu o risco. A venda segue, mas a
  --                   trilha de auditoria conta a verdade;
  --   qualquer outro  nao rodou e o pedido para em revisao manual.
  if v_jur.id is not null and v_jur.transactions_enabled then
    select coalesce(value #>> '{}', 'none') into v_sanctions
      from public.system_settings where key = 'sanctions_screening_mode';

    if v_sanctions = 'provider' then
      v_checks := v_checks || jsonb_build_object(
        'kind', 'sanctions_check', 'passed', true, 'reason_code', 'OK',
        'reason_message', 'Triagem de sancoes executada pelo provedor configurado.');
    elsif v_sanctions = 'risk_accepted' then
      v_checks := v_checks || jsonb_build_object(
        'kind', 'sanctions_check', 'passed', true,
        'reason_code', 'SANCTIONS_SCREENING_NOT_CONTRACTED',
        'reason_message',
        'Triagem de sancoes NAO foi executada: nao ha provedor contratado. '
        'A operacao segue por decisao administrativa do operador, que assume '
        'o risco. Este registro existe para que a ausencia da triagem fique '
        'documentada, e nao escondida.');
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

