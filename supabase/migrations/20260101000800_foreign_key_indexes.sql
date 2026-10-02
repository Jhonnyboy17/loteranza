-- ===========================================================================
-- Jackpot USA  |  INDICES DE CHAVE ESTRANGEIRA
-- ---------------------------------------------------------------------------
-- O linter do Supabase aponta 44 chaves estrangeiras sem indice. Indexar
-- todas custa escrita em toda insercao sem retorno de leitura, portanto aqui
-- entram apenas as que servem a um caminho real de consulta da aplicacao, de
-- uma rotina do servidor ou de um ON DELETE CASCADE.
--
-- Ficam deliberadamente de fora as colunas de autoria e custodia
-- (verified_by, purchased_by, reviewed_by, approved_by, second_approver_id,
-- assigned_to, stored_by, checked_by, retrieved_by, uploaded_by, created_by,
-- updated_by, handled_by, enabled_by, actor_id, witness_id). Sao escritas uma
-- vez e nunca usadas como filtro; o unico custo de nao indexa-las e uma
-- varredura durante a exclusao de um perfil, operacao administrativa rara.
-- Pelo desenho da trilha de auditoria essas referencias sao NO ACTION de
-- proposito: nao se apaga quem conferiu um bilhete.
-- ===========================================================================

-- Catalogo e sorteios ------------------------------------------------------
create index if not exists draw_results_game_idx
  on public.draw_results(game_id);
create index if not exists draw_prize_breakdown_tier_idx
  on public.draw_prize_breakdown(tier_id);
create index if not exists faqs_game_idx
  on public.faqs(game_id);

-- Pedidos ------------------------------------------------------------------
create index if not exists orders_game_idx
  on public.orders(game_id);
create index if not exists orders_jurisdiction_idx
  on public.orders(jurisdiction_id);
create index if not exists orders_subscription_idx
  on public.orders(subscription_id);
create index if not exists order_lines_game_idx
  on public.order_lines(game_id);

-- Bilhetes e custodia ------------------------------------------------------
create index if not exists tickets_game_idx
  on public.tickets(game_id);
create index if not exists tickets_order_line_idx
  on public.tickets(order_line_id);
create index if not exists ticket_vault_events_vault_idx
  on public.ticket_vault_events(vault_id);

-- Premios ------------------------------------------------------------------
-- compare_all_tickets() consulta prize_claims por ticket_id uma vez para cada
-- bilhete premiado do sorteio; sem este indice a conferencia degrada com o
-- volume de resgates ja abertos.
create index if not exists prize_claims_ticket_idx
  on public.prize_claims(ticket_id);
create index if not exists prize_claims_order_idx
  on public.prize_claims(order_id);

-- Recorrencia e preferencias ----------------------------------------------
create index if not exists subscriptions_game_idx
  on public.subscriptions(game_id);
create index if not exists subscriptions_next_draw_idx
  on public.subscriptions(next_draw_id);
create index if not exists favorites_game_idx
  on public.favorites(game_id);
create index if not exists jackpot_alerts_game_idx
  on public.jackpot_alerts(game_id);

-- Compliance e suporte -----------------------------------------------------
create index if not exists compliance_checks_jurisdiction_idx
  on public.compliance_checks(jurisdiction_id);
create index if not exists support_tickets_order_idx
  on public.support_tickets(order_id);
