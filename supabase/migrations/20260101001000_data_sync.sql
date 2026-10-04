-- ===========================================================================
-- Jackpot USA  |  SINCRONIZACAO AUTOMATICA DE DADOS
-- ---------------------------------------------------------------------------
-- Tres problemas distintos, resolvidos aqui:
--
--  1. CONFIANCA. Um resultado vindo de uma fonte so nao pode virar oficial
--     sozinho: um digito errado faz a plataforma dizer a alguem que ganhou,
--     ou que perdeu, errado — e com bilhete fisico no cofre esse e o pior
--     erro possivel. A solucao nao e exigir humano para tudo (ninguem
--     sustenta isso diariamente), e sim registrar CADA leitura de CADA fonte
--     em draw_result_observations e so promover a oficial quando duas fontes
--     independentes concordarem. Divergencia nao escolhe a mais conveniente:
--     segura em preliminar e sinaliza.
--
--  2. CADENCIA. Numero sorteado e quebra por faixa nao saem juntos. Os
--     numeros saem minutos depois do sorteio; a quebra sai horas depois,
--     porque o premio e pari-mutuel e depende de fechar a apuracao das
--     vendas. Por isso sao dois estagios, agendados em horarios diferentes,
--     e nao uma chamada so.
--
--  3. FALHA SILENCIOSA. O modo de falha perigoso nao e o sync quebrar: e ele
--     quebrar sem ninguem notar, com o site anunciando um jackpot velho como
--     se fosse atual. sync_runs registra toda execucao, e as configuracoes de
--     validade abaixo permitem a interface dizer "desatualizado" em vez de
--     mostrar um numero que nao vale mais.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Estados de uma execucao de sincronizacao.
-- 'partial' existe porque o caso comum nao e tudo-ou-nada: a fonte responde
-- para a Powerball e falha para a Mega Millions. Tratar isso como sucesso
-- esconde metade do problema; como falha, esconde a metade que funcionou.
-- --------------------------------------------------------------------------
do $$ begin
  create type public.sync_status as enum ('running', 'success', 'partial', 'failed');
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------------------
-- Leituras brutas, uma por fonte. E o insumo da conciliacao.
-- --------------------------------------------------------------------------
create table if not exists public.draw_result_observations (
  id               uuid primary key default gen_random_uuid(),
  draw_id          uuid not null references public.draws(id) on delete cascade,
  source           text not null,
  main_numbers     smallint[] not null,
  special_numbers  smallint[] not null default '{}',
  multiplier       smallint,
  jackpot_amount   numeric(16,2),
  jackpot_won      boolean,
  winners_count    int,
  source_reference text,
  raw_payload      jsonb,
  observed_at      timestamptz not null default now(),
  unique (draw_id, source)
);

comment on table public.draw_result_observations is
  'Uma linha por fonte por sorteio. Nunca e sobrescrita por outra fonte: e '
  'justamente a divergencia entre elas que precisa ficar visivel.';

create index if not exists draw_observations_draw_idx
  on public.draw_result_observations(draw_id, observed_at desc);

-- --------------------------------------------------------------------------
-- Diario de execucoes. Sem isto, falha de sync e invisivel.
-- --------------------------------------------------------------------------
create table if not exists public.sync_runs (
  id             bigserial primary key,
  job            text not null,
  provider       text not null,
  status         public.sync_status not null default 'running',
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  items_ok       int not null default 0,
  items_failed   int not null default 0,
  error_message  text,
  detail         jsonb not null default '{}'::jsonb
);

comment on table public.sync_runs is
  'Toda execucao de sincronizacao, com sucesso ou nao. A ausencia de linha '
  'recente e tao informativa quanto uma linha com erro: significa que o '
  'agendador parou.';

create index if not exists sync_runs_job_idx on public.sync_runs(job, started_at desc);

-- --------------------------------------------------------------------------
-- Validade dos dados voláteis. Passou do prazo, a interface avisa.
-- --------------------------------------------------------------------------
insert into public.system_settings (key, value, description, is_public) values
  ('jackpot_max_age_hours', '12'::jsonb,
   'Acima disso o valor do premio e exibido como desatualizado, nunca como atual.', true),
  ('fx_max_age_hours', '24'::jsonb,
   'Acima disso a conversao para real e omitida: taxa velha em checkout e prejuizo real.', true),
  ('results_require_two_sources', 'true'::jsonb,
   'Com true, um resultado so vira oficial quando duas fontes independentes concordam.', false)
on conflict (key) do nothing;

-- ===========================================================================
-- CONCILIACAO
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Compara as leituras registradas e decide se o resultado pode ser oficial.
--
-- Regra: duas fontes com os MESMOS numeros principais e especiais promovem o
-- resultado. Fontes que discordam nao produzem resultado oficial em hipotese
-- alguma — o registro fica preliminar e a divergencia aparece no painel.
--
-- Importante: promover a oficial NAO libera pagamento. tickets.prize_confirmed
-- continua false (match_ticket_against_result o mantem assim) e prize_claims
-- segue exigindo dupla aprovacao. Oficial aqui significa "o resultado esta
-- conferido", nao "pode pagar".
-- --------------------------------------------------------------------------
create or replace function public.reconcile_draw_result(p_draw_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_game_id     uuid;
  v_total       int;
  v_agree       int;
  v_winner      public.draw_result_observations;
  v_main        smallint[];
  v_special     smallint[];
  v_require_two boolean;
  v_official    boolean;
  v_sources     text;
begin
  select game_id into v_game_id from public.draws where id = p_draw_id;
  if v_game_id is null then
    return jsonb_build_object('error', 'DRAW_NOT_FOUND');
  end if;

  select count(*) into v_total
  from public.draw_result_observations where draw_id = p_draw_id;

  if v_total = 0 then
    return jsonb_build_object('status', 'NO_OBSERVATIONS');
  end if;

  -- Qual combinacao de numeros reuniu mais fontes.
  select main_numbers, special_numbers, count(*)
    into v_main, v_special, v_agree
  from public.draw_result_observations
  where draw_id = p_draw_id
  group by main_numbers, special_numbers
  order by count(*) desc, min(observed_at)
  limit 1;

  -- A leitura mais antiga dessa combinacao representa as demais: os campos
  -- auxiliares (jackpot, ganhadores) saem dela.
  select * into v_winner
  from public.draw_result_observations
  where draw_id = p_draw_id
    and main_numbers = v_main
    and special_numbers = v_special
  order by observed_at
  limit 1;

  v_require_two := public.setting_bool('results_require_two_sources', true);
  v_official := case when v_require_two then v_agree >= 2 else v_agree >= 1 end;

  select string_agg(distinct source, '+' order by source) into v_sources
  from public.draw_result_observations
  where draw_id = p_draw_id
    and main_numbers = v_main
    and special_numbers = v_special;

  insert into public.draw_results (
    draw_id, game_id, main_numbers, special_numbers, multiplier,
    jackpot_amount, jackpot_won, winners_count, source, source_reference,
    is_official, raw_payload, is_demo
  )
  values (
    p_draw_id, v_game_id, v_winner.main_numbers, v_winner.special_numbers,
    v_winner.multiplier, v_winner.jackpot_amount, v_winner.jackpot_won,
    v_winner.winners_count, v_sources, v_winner.source_reference,
    v_official, v_winner.raw_payload, false
  )
  on conflict (draw_id) do update set
    main_numbers     = excluded.main_numbers,
    special_numbers  = excluded.special_numbers,
    multiplier       = excluded.multiplier,
    jackpot_amount   = coalesce(excluded.jackpot_amount, public.draw_results.jackpot_amount),
    jackpot_won      = coalesce(excluded.jackpot_won, public.draw_results.jackpot_won),
    winners_count    = coalesce(excluded.winners_count, public.draw_results.winners_count),
    source           = excluded.source,
    source_reference = excluded.source_reference,
    -- Nunca REBAIXA um resultado ja conferido por humano: se alguem marcou
    -- oficial e verified_by, uma leitura nova nao desfaz isso.
    is_official      = public.draw_results.is_official or excluded.is_official,
    raw_payload      = excluded.raw_payload;

  update public.draws set status = 'drawn' where id = p_draw_id and status <> 'drawn';

  return jsonb_build_object(
    'draw_id', p_draw_id,
    'observations', v_total,
    'agreeing', v_agree,
    'sources', v_sources,
    'is_official', v_official,
    'status', case
      when v_official then 'OFFICIAL'
      when v_total > 1 then 'SOURCES_DISAGREE'
      else 'AWAITING_SECOND_SOURCE' end
  );
end;
$$;

-- --------------------------------------------------------------------------
-- Grava a quebra por faixa: quantas pessoas ganharam cada premio e quanto.
-- Recebe [{ "tier_key": "5+1", "winners": 0, "amount": null }, ...] e resolve
-- os tier_id pelo jogo do sorteio, para o chamador nao precisar conhecer ids.
-- --------------------------------------------------------------------------
create or replace function public.upsert_prize_breakdown(p_draw_id uuid, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_game_id uuid;
  v_applied int := 0;
  v_unknown text[] := '{}';
  r jsonb;
  v_tier_id uuid;
begin
  select game_id into v_game_id from public.draws where id = p_draw_id;
  if v_game_id is null then
    return jsonb_build_object('error', 'DRAW_NOT_FOUND');
  end if;

  for r in select * from jsonb_array_elements(p_rows) loop
    select id into v_tier_id
    from public.prize_tiers
    where game_id = v_game_id and tier_key = (r->>'tier_key');

    if v_tier_id is null then
      -- Faixa desconhecida nao e silenciada: o catalogo pode estar
      -- desatualizado em relacao a fonte, e isso precisa aparecer.
      v_unknown := v_unknown || (r->>'tier_key');
      continue;
    end if;

    insert into public.draw_prize_breakdown (draw_id, tier_id, winners_count, prize_amount)
    values (
      p_draw_id, v_tier_id,
      nullif(r->>'winners', '')::int,
      nullif(r->>'amount', '')::numeric
    )
    on conflict (draw_id, tier_id) do update set
      winners_count = excluded.winners_count,
      prize_amount  = excluded.prize_amount;

    v_applied := v_applied + 1;
  end loop;

  return jsonb_build_object(
    'draw_id', p_draw_id, 'applied', v_applied, 'unknown_tiers', to_jsonb(v_unknown)
  );
end;
$$;

-- ===========================================================================
-- LEITURAS PARA O PAINEL
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Saude das sincronizacoes. Responde a pergunta que importa — "esta rodando?"
-- — inclusive quando a resposta e "parou de rodar": `minutes_since` cresce
-- sozinho quando nao chega execucao nova, sem depender de ninguem gravar um
-- erro.
-- --------------------------------------------------------------------------
create or replace view public.sync_health
with (security_invoker = true)
as
select
  j.job,
  r.provider,
  r.status,
  r.started_at   as last_run_at,
  r.finished_at,
  r.items_ok,
  r.items_failed,
  r.error_message,
  round(extract(epoch from (now() - r.started_at)) / 60)::int as minutes_since,
  (select count(*) from public.sync_runs f
    where f.job = j.job and f.status = 'failed'
      and f.started_at > now() - interval '24 hours') as failures_24h
from (select distinct job from public.sync_runs) j
left join lateral (
  select * from public.sync_runs s
  where s.job = j.job
  order by s.started_at desc
  limit 1
) r on true;

comment on view public.sync_health is
  'Ultima execucao por job mais a contagem de falhas em 24h. security_invoker: '
  'quem consulta precisa ter direito de ler sync_runs, que e so equipe.';

-- --------------------------------------------------------------------------
-- Fila de conferencia: sorteios com leitura registrada que ainda nao viraram
-- oficiais, com o motivo. E a tela de trabalho do operador.
-- --------------------------------------------------------------------------
create or replace view public.draw_results_pending_review
with (security_invoker = true)
as
select
  d.id                as draw_id,
  g.game_key,
  g.name              as game_name,
  d.draw_date,
  d.draw_at,
  res.main_numbers,
  res.special_numbers,
  res.source,
  res.is_official,
  (select count(*) from public.draw_result_observations o where o.draw_id = d.id) as observations,
  (select count(distinct (o.main_numbers, o.special_numbers))
     from public.draw_result_observations o where o.draw_id = d.id)               as distinct_readings,
  (select count(*) from public.draw_prize_breakdown b where b.draw_id = d.id)     as breakdown_rows,
  case
    when (select count(distinct (o.main_numbers, o.special_numbers))
            from public.draw_result_observations o where o.draw_id = d.id) > 1
      then 'SOURCES_DISAGREE'
    when (select count(*) from public.draw_result_observations o where o.draw_id = d.id) < 2
      then 'AWAITING_SECOND_SOURCE'
    else 'READY'
  end as reason
from public.draws d
join public.lottery_games g on g.id = d.game_id
left join public.draw_results res on res.draw_id = d.id
where d.draw_at < now()
  and coalesce(res.is_official, false) = false
  -- Guarda explicita, e nao redundante: a view e security_invoker, mas se
  -- apoia em draws e draw_results, que sao publicos por politica. Sem esta
  -- linha qualquer visitante lista quais resultados a plataforma ainda nao
  -- conferiu — nao e vazamento de dado, e vazamento de postura operacional.
  and public.is_staff()
order by d.draw_at desc;

comment on view public.draw_results_pending_review is
  'Fila de trabalho da equipe: sorteios ja realizados sem resultado oficial. '
  '`reason` diz o que falta — segunda fonte, ou resolver divergencia. '
  'Restrita a equipe pela chamada a is_staff() no proprio WHERE.';

-- ===========================================================================
-- RLS E PRIVILEGIOS
-- ===========================================================================

alter table public.draw_result_observations enable row level security;
alter table public.draw_result_observations force row level security;
alter table public.sync_runs enable row level security;
alter table public.sync_runs force row level security;

-- Leitura bruta de fonte e diario de execucao sao dados operacionais: nao
-- interessam ao cliente e nao devem vazar a estrutura de fornecedores.
create policy draw_observations_staff_read on public.draw_result_observations
  for select using (public.has_role(array['SUPER_ADMIN','ADMIN','COMPLIANCE']::public.app_role[]));

create policy sync_runs_staff_read on public.sync_runs
  for select using (public.has_role(array['SUPER_ADMIN','ADMIN','COMPLIANCE']::public.app_role[]));

-- Escrita e exclusivamente das Edge Functions, que usam service_role e
-- ignoram RLS. Nenhuma policy de insert/update para cliente, de proposito.

revoke truncate, references, trigger on public.draw_result_observations, public.sync_runs
  from anon, authenticated;

-- Mesma regra da migracao 0700: funcao SECURITY DEFINER nao fica exposta em
-- /rest/v1/rpc. Estas escrevem resultado oficial e premiacao — e o caminho
-- mais curto para forjar um ganhador se ficarem abertas.
revoke execute on function public.reconcile_draw_result(uuid)
  from public, anon, authenticated;
revoke execute on function public.upsert_prize_breakdown(uuid, jsonb)
  from public, anon, authenticated;
