-- ---------------------------------------------------------------------------
-- generate_upcoming_draws: p_count passa a ser o ALVO, nao o incremento.
--
-- O BUG
--   O laco contava apenas o que ELA mesma criou (`v_created < p_count`) e
--   ignorava os sorteios futuros que ja existiam. Como o insert tem
--   `on conflict do nothing`, um dia ja ocupado nao incrementava o contador —
--   entao a funcao simplesmente andava para frente no calendario ate conseguir
--   criar 8 dias ineditos. Cada execucao empurrava o horizonte oito sorteios
--   adiante, para sempre.
--
--   Enquanto a rotina era manual isso passou despercebido. Com o agendamento
--   de 4 em 4 horas ligado, viraram 6 execucoes por dia: 96 sorteios novos
--   diarios, e um calendario anunciando sorteios de 2028 que nenhuma loteria
--   publicou ainda. Pior: cada linha carrega `advertised_jackpot` igual ao
--   jackpot de hoje, o que para um sorteio de daqui a um ano e um numero
--   inventado — exatamente o que este projeto nao pode exibir.
--
-- A CORRECAO
--   Contar os futuros ja agendados e criar apenas a diferenca. Com oito ja no
--   lugar, a funcao nao cria nada e devolve 0. Rodar duas vezes seguidas passa
--   a ter o mesmo efeito de rodar uma vez, que e o que o nome da funcao sempre
--   prometeu.
-- ---------------------------------------------------------------------------
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
          'scheduled', g.current_jackpot, g.is_demo
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
