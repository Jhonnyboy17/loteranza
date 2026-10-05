-- ---------------------------------------------------------------------------
-- Trava de sanidade nas leituras de fonte externa.
--
-- POR QUE NO BANCO, E NAO NO PROVEDOR
--   `draw_result_observations` nao tinha nenhuma restricao sobre os numeros:
--   uma fonte podia gravar sete dezenas, uma dezena 99 num jogo que vai ate
--   69, ou a mesma dezena repetida. A conciliacao entao promoveria isso a
--   resultado oficial se duas fontes errassem igual — e duas fontes que leem
--   a mesma pagina erram igual com facilidade.
--
--   Validar dentro de cada provedor seria repetir a regra em todo arquivo
--   novo e depender de quem escreve o proximo lembrar. A regra ja existe uma
--   vez so, em lottery_games; aqui ela e aplicada. Provedor que enviar lixo
--   recebe erro na cara, a execucao marca failure, e o painel mostra.
--
-- O QUE NAO E VALIDADO
--   Repeticao entre numeros especiais: existe jogo onde a mesma dezena pode
--   sair em pools diferentes. Com um unico especial a questao nem aparece.
-- ---------------------------------------------------------------------------
create or replace function public.validate_draw_observation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  g        public.lottery_games;
  v_main   int := coalesce(array_length(new.main_numbers, 1), 0);
  v_extra  int := coalesce(array_length(new.special_numbers, 1), 0);
  v_unicos int;
begin
  select lg.* into g
  from public.draws d
  join public.lottery_games lg on lg.id = d.game_id
  where d.id = new.draw_id;

  if not found then
    raise exception 'Observacao para sorteio inexistente: %', new.draw_id;
  end if;

  if v_main <> g.main_numbers_count then
    raise exception
      'Fonte "%" enviou % dezena(s) principal(is) em %; o jogo exige %',
      new.source, v_main, g.game_key, g.main_numbers_count;
  end if;

  if v_extra <> g.special_numbers_count then
    raise exception
      'Fonte "%" enviou % numero(s) especial(is) em %; o jogo exige %',
      new.source, v_extra, g.game_key, g.special_numbers_count;
  end if;

  if exists (select 1 from unnest(new.main_numbers) n
             where n < g.main_number_min or n > g.main_number_max) then
    raise exception
      'Fonte "%" enviou dezena fora da faixa em % (permitido % a %): %',
      new.source, g.game_key, g.main_number_min, g.main_number_max,
      new.main_numbers;
  end if;

  if exists (select 1 from unnest(new.special_numbers) n
             where n < g.special_number_min or n > g.special_number_max) then
    raise exception
      'Fonte "%" enviou especial fora da faixa em % (permitido % a %): %',
      new.source, g.game_key, g.special_number_min, g.special_number_max,
      new.special_numbers;
  end if;

  select count(distinct n) into v_unicos from unnest(new.main_numbers) n;
  if v_unicos <> v_main then
    raise exception
      'Fonte "%" repetiu dezena principal em %: %',
      new.source, g.game_key, new.main_numbers;
  end if;

  return new;
end;
$$;

create or replace trigger draw_observations_validate
  before insert or update on public.draw_result_observations
  for each row execute function public.validate_draw_observation();

revoke execute on function public.validate_draw_observation()
  from public, anon, authenticated;
