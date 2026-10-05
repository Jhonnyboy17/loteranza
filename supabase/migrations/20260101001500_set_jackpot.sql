-- ---------------------------------------------------------------------------
-- Atualizacao manual do jackpot anunciado.
--
-- POR QUE EXISTE
--   Jackpot nao e dado aberto em lugar nenhum: resultado de sorteio e fato e
--   vira dado publico, mas jackpot e estimativa de marketing que a loteria
--   revisa conforme as vendas entram. Sondado: o catalogo Socrata (NY, TX, OR,
--   MD) nao tem nenhum dataset de jackpot, megamillions.com responde 403 de
--   Cloudflare e powerball.com nao expoe JSON. Enquanto nao houver fornecedor
--   contratado, o caminho honesto e alguem digitar — e a trava de validade de
--   12h cobrir o esquecimento.
--
-- POR QUE UMA FUNCAO, E NAO UM UPDATE COM RLS
--   `jackpot_updated_at` e o que a interface usa para decidir se ainda pode
--   apresentar o valor como atual. Se o cliente pudesse escrever esse campo,
--   poderia carimbar data futura e desligar a trava — exatamente o jackpot
--   falso que o briefing proibe. Aqui o carimbo e sempre now(), definido pelo
--   servidor, e nao ha parametro para ele.
--
--   A funcao tambem garante o registro em audit_logs. Numero exibido em
--   destaque na home precisa ter dono: quem mudou, quando, de quanto para
--   quanto.
-- ---------------------------------------------------------------------------
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
  v_old public.lottery_games;
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

  perform public.write_audit_log(
    'game.jackpot_set', 'lottery_games', p_game_id::text,
    jsonb_build_object('jackpot', v_old.current_jackpot,
                       'cash',    v_old.current_jackpot_cash,
                       'updated_at', v_old.jackpot_updated_at),
    jsonb_build_object('jackpot', p_jackpot, 'cash', p_cash, 'updated_at', now()),
    'warning'
  );

  return jsonb_build_object(
    'game_key',   v_old.game_key,
    'jackpot',    p_jackpot,
    'cash',       p_cash,
    'updated_at', now()
  );
end;
$$;

comment on function public.set_game_jackpot is
  'Grava jackpot anunciado com carimbo de servidor e registro de auditoria. '
  'O carimbo nunca vem do cliente: e ele que a trava de validade usa para '
  'decidir se o valor ainda pode ser exibido como atual.';

-- `authenticated` precisa executar (o painel chama como o operador logado); a
-- autorizacao real e o has_role() la dentro. anon nunca.
revoke execute on function public.set_game_jackpot(uuid, numeric, numeric)
  from public, anon;
grant execute on function public.set_game_jackpot(uuid, numeric, numeric)
  to authenticated;
