-- ---------------------------------------------------------------------------
-- Jackpot anunciado passa a existir SO no proximo sorteio.
--
-- O QUE ESTAVA ERRADO
--   `generate_upcoming_draws` carimbava `advertised_jackpot = g.current_jackpot`
--   em cada sorteio que criava. Com oito sorteios no horizonte, isso punha o
--   jackpot de hoje em sorteios de tres, quatro semanas adiante. O banco tinha
--   oito linhas da Mega Millions, de 07/10 a 31/10, todas anunciando os mesmos
--   486 milhoes.
--
--   Esse numero nao e estimativa velha: e numero inventado. Jackpot de loteria
--   americana e acumulado — depende de quantos bilhetes forem vendidos e de
--   ninguem acertar antes. Ninguem, nem a propria loteria, sabe hoje o premio
--   do sorteio do fim do mes. Afirmar um valor para aquela data e precisamente
--   o jackpot falso que o briefing proibe, e agravado por estar amarrado a uma
--   data de sorteio especifica, o que o faz parecer anuncio oficial.
--
--   Eu mesmo descrevi esse defeito no comentario da migration do horizonte
--   (20260101001300) e corrigi apenas o crescimento sem fim do calendario. O
--   numero inventado continuou sendo gravado por mais quatro semanas de
--   sorteios. Esta migration fecha essa parte.
--
-- A REGRA AGORA
--   So o PROXIMO sorteio de cada jogo pode carregar `advertised_jackpot`,
--   porque so para ele existe estimativa publicada pela loteria. Nos demais o
--   campo fica nulo, e nulo aqui quer dizer a verdade: ainda nao ha premio
--   anunciado para aquela data.
--
--   A interface nao perde nada com isso. As telas publicas pedem sempre o
--   proximo sorteio (`getUpcomingDraw`), e onde um sorteio distante aparece —
--   a lista do painel — o vazio e a informacao correta. O painel admin, que
--   lista sorteios futuros, passa a mostrar "—" nos distantes em vez de
--   repetir um valor que ninguem apurou.
-- ---------------------------------------------------------------------------

-- 1) A geracao de sorteios para de inventar premio -------------------------
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
  v_existing   int := 0;
  v_draw_at    timestamptz;
  v_guard      int := 0;
begin
  select * into g from public.lottery_games where id = p_game_id;
  if not found or array_length(g.draw_days, 1) is null then
    return 0;
  end if;

  -- Quantos sorteios futuros este jogo ja tem agendados.
  select count(*) into v_existing
  from public.draws
  where game_id = p_game_id and draw_at > now() and status = 'scheduled';

  while (v_existing + v_created) < p_count and v_guard < 400 loop
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
          'scheduled',
          -- NULO, de proposito. O jackpot do proximo sorteio e escrito por
          -- set_game_jackpot(), a partir de uma fonte. Copiar o valor de hoje
          -- para um sorteio de semanas adiante seria afirmar um premio que
          -- ninguem apurou.
          null,
          g.is_demo
        )
        on conflict (game_id, draw_date) do nothing;

        -- `found` e falso quando o dia ja estava ocupado; esse sorteio ja foi
        -- contado em v_existing, entao nao pode contar de novo.
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

revoke execute on function public.generate_upcoming_draws(uuid, int)
  from public, anon, authenticated;

-- 2) set_game_jackpot passa a cuidar tambem do sorteio -----------------------
--
-- Quem digita o jackpot esta informando o premio do PROXIMO sorteio. Antes a
-- funcao escrevia so em `lottery_games`, e o sorteio ficava com o valor que a
-- geracao havia copiado — ou seja, o painel dizia uma coisa e a linha do
-- sorteio outra. Agora o mesmo ato escreve o proximo sorteio e limpa os
-- demais, de modo que nao exista no banco um premio anunciado sem fonte.
create or replace function public.set_game_jackpot(
  p_game_id uuid,
  p_jackpot numeric,
  p_cash    numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_old       public.lottery_games;
  v_next_id   uuid;
  v_limpos    int := 0;
begin
  if not public.has_role(array['SUPER_ADMIN','ADMIN']::public.app_role[]) then
    raise exception 'Apenas ADMIN ou SUPER_ADMIN pode alterar jackpot';
  end if;

  select * into v_old from public.lottery_games where id = p_game_id;
  if not found then
    raise exception 'Modalidade % nao encontrada', p_game_id;
  end if;

  if p_jackpot is null or p_jackpot <= 0 then
    raise exception 'Jackpot precisa ser maior que zero';
  end if;

  -- O valor a vista e sempre menor que o anunciado (o anunciado e a soma das
  -- parcelas da anuidade). Invertido indica troca de campo no formulario.
  if p_cash is not null and p_cash > p_jackpot then
    raise exception
      'Valor a vista (%) nao pode superar o anunciado (%). Os campos parecem trocados.',
      p_cash, p_jackpot;
  end if;

  if p_cash is not null and p_cash <= 0 then
    raise exception 'Valor a vista precisa ser maior que zero, ou vazio';
  end if;

  update public.lottery_games
  set current_jackpot      = p_jackpot,
      current_jackpot_cash = p_cash,
      -- Sempre now(), nunca um parametro: e esse carimbo que a trava de
      -- validade usa.
      jackpot_updated_at   = now()
  where id = p_game_id;

  -- O proximo sorteio recebe o valor informado.
  select d.id into v_next_id
  from public.draws d
  where d.game_id = p_game_id and d.draw_at > now() and d.status = 'scheduled'
  order by d.draw_at
  limit 1;

  if v_next_id is not null then
    update public.draws
    set advertised_jackpot = p_jackpot,
        cash_value         = p_cash,
        updated_at         = now()
    where id = v_next_id;
  end if;

  -- Os seguintes ficam sem premio anunciado. Nao ha estimativa publicada para
  -- eles, e o nulo diz isso.
  with limpos as (
    update public.draws
    set advertised_jackpot = null,
        cash_value         = null,
        updated_at         = now()
    where game_id = p_game_id
      and draw_at > now()
      and status = 'scheduled'
      and (v_next_id is null or id <> v_next_id)
      and (advertised_jackpot is not null or cash_value is not null)
    returning 1
  )
  select count(*) into v_limpos from limpos;

  perform public.write_audit_log(
    'game.jackpot_set', 'lottery_games', p_game_id::text,
    jsonb_build_object('jackpot', v_old.current_jackpot,
                       'cash',    v_old.current_jackpot_cash,
                       'updated_at', v_old.jackpot_updated_at),
    jsonb_build_object('jackpot', p_jackpot, 'cash', p_cash, 'updated_at', now(),
                       'proximo_sorteio', v_next_id,
                       'sorteios_limpos', v_limpos),
    'warning'
  );

  return jsonb_build_object(
    'game_key',        v_old.game_key,
    'jackpot',         p_jackpot,
    'cash',            p_cash,
    'updated_at',      now(),
    'proximo_sorteio', v_next_id,
    'sorteios_limpos', v_limpos
  );
end;
$$;

comment on function public.set_game_jackpot is
  'Grava jackpot anunciado com carimbo de servidor e registro de auditoria. '
  'Escreve o valor no PROXIMO sorteio e apaga o premio anunciado dos sorteios '
  'seguintes, que nao tem estimativa publicada. O carimbo nunca vem do '
  'cliente: e ele que a trava de validade usa para decidir se o valor ainda '
  'pode ser exibido como atual.';

revoke execute on function public.set_game_jackpot(uuid, numeric, numeric)
  from public, anon;
grant execute on function public.set_game_jackpot(uuid, numeric, numeric)
  to authenticated;

-- 3) Limpeza do que ja estava gravado ---------------------------------------
--
-- Apaga o premio anunciado de todo sorteio futuro que nao seja o proximo do
-- seu jogo. O proximo e preservado: o valor dele pode estar velho, e a trava
-- de validade cuida disso mostrando "Premio a confirmar" — bem diferente de
-- um numero afirmado para uma data distante.
with proximos as (
  select distinct on (game_id) id
  from public.draws
  where draw_at > now() and status = 'scheduled'
  order by game_id, draw_at
)
update public.draws d
set advertised_jackpot = null,
    cash_value         = null,
    updated_at         = now()
where d.draw_at > now()
  and d.status = 'scheduled'
  and d.id not in (select id from proximos)
  and (d.advertised_jackpot is not null or d.cash_value is not null);
