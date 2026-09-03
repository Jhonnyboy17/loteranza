-- ===========================================================================
-- Jackpot USA  |  05 - Row Level Security
-- ---------------------------------------------------------------------------
-- Regra geral: RLS ligada em TODAS as tabelas e o default e negar.
-- O cliente le apenas os proprios dados. Staff le conforme o papel.
-- Escrita em tabelas financeiras/regulatorias e feita por Edge Functions com
-- service role, nunca diretamente pelo browser.
-- ===========================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','addresses','operators','jurisdiction_rules','geolocation_events',
    'compliance_checks','kyc_checks','responsible_gaming_limits','self_exclusions',
    'consent_logs','data_requests','lottery_games','prize_tiers','draws',
    'draw_results','draw_prize_breakdown','exchange_rates','orders','order_lines',
    'payment_providers','payments','tickets','ticket_images','ticket_vault',
    'ticket_vault_events','prize_claims','prize_claim_events','subscriptions',
    'favorites','jackpot_alerts','notifications','notification_preferences',
    'support_tickets','support_messages','cms_content','faqs','system_settings',
    'audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- Catalogo publico: qualquer visitante pode consultar jogos e resultados.
-- Isso e proposital: consultar jackpot/resultado nao e transacao.
-- --------------------------------------------------------------------------
drop policy if exists lottery_games_read on public.lottery_games;
create policy lottery_games_read on public.lottery_games
  for select using (status <> 'retired');

drop policy if exists lottery_games_write on public.lottery_games;
create policy lottery_games_write on public.lottery_games
  for all using (public.has_role(array['SUPER_ADMIN','ADMIN']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','ADMIN']::public.app_role[]));

drop policy if exists prize_tiers_read on public.prize_tiers;
create policy prize_tiers_read on public.prize_tiers for select using (true);
drop policy if exists prize_tiers_write on public.prize_tiers;
create policy prize_tiers_write on public.prize_tiers
  for all using (public.has_role(array['SUPER_ADMIN','ADMIN']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','ADMIN']::public.app_role[]));

drop policy if exists draws_read on public.draws;
create policy draws_read on public.draws for select using (true);
drop policy if exists draws_write on public.draws;
create policy draws_write on public.draws
  for all using (public.has_role(array['SUPER_ADMIN','ADMIN']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','ADMIN']::public.app_role[]));

drop policy if exists draw_results_read on public.draw_results;
create policy draw_results_read on public.draw_results for select using (true);
drop policy if exists draw_results_write on public.draw_results;
create policy draw_results_write on public.draw_results
  for all using (public.has_role(array['SUPER_ADMIN','ADMIN']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','ADMIN']::public.app_role[]));

drop policy if exists draw_breakdown_read on public.draw_prize_breakdown;
create policy draw_breakdown_read on public.draw_prize_breakdown for select using (true);
drop policy if exists draw_breakdown_write on public.draw_prize_breakdown;
create policy draw_breakdown_write on public.draw_prize_breakdown
  for all using (public.has_role(array['SUPER_ADMIN','ADMIN']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','ADMIN']::public.app_role[]));

drop policy if exists exchange_rates_read on public.exchange_rates;
create policy exchange_rates_read on public.exchange_rates for select using (true);
drop policy if exists exchange_rates_write on public.exchange_rates;
create policy exchange_rates_write on public.exchange_rates
  for all using (public.has_role(array['SUPER_ADMIN','ADMIN','FINANCE']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','ADMIN','FINANCE']::public.app_role[]));

drop policy if exists faqs_read on public.faqs;
create policy faqs_read on public.faqs for select using (is_published or public.is_staff());
drop policy if exists faqs_write on public.faqs;
create policy faqs_write on public.faqs
  for all using (public.has_role(array['SUPER_ADMIN','ADMIN','SUPPORT']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','ADMIN','SUPPORT']::public.app_role[]));

drop policy if exists cms_read on public.cms_content;
create policy cms_read on public.cms_content
  for select using (is_published or public.is_staff());
drop policy if exists cms_write on public.cms_content;
create policy cms_write on public.cms_content
  for all using (public.has_role(array['SUPER_ADMIN','ADMIN','COMPLIANCE','SUPPORT']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','ADMIN','COMPLIANCE','SUPPORT']::public.app_role[]));

-- jurisdiction_rules: leitura publica (o usuario precisa saber se pode ou nao
-- comprar). Escrita apenas por COMPLIANCE/ADMIN.
drop policy if exists jurisdiction_read on public.jurisdiction_rules;
create policy jurisdiction_read on public.jurisdiction_rules for select using (true);
drop policy if exists jurisdiction_write on public.jurisdiction_rules;
create policy jurisdiction_write on public.jurisdiction_rules
  for all using (public.has_role(array['SUPER_ADMIN','COMPLIANCE']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','COMPLIANCE']::public.app_role[]));

drop policy if exists settings_read on public.system_settings;
create policy settings_read on public.system_settings
  for select using (is_public or public.is_staff());
drop policy if exists settings_write on public.system_settings;
create policy settings_write on public.system_settings
  for all using (public.has_role(array['SUPER_ADMIN','ADMIN']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','ADMIN']::public.app_role[]));

drop policy if exists payment_providers_read on public.payment_providers;
create policy payment_providers_read on public.payment_providers
  for select using (is_enabled or public.is_staff());
drop policy if exists payment_providers_write on public.payment_providers;
create policy payment_providers_write on public.payment_providers
  for all using (public.has_role(array['SUPER_ADMIN','FINANCE']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','FINANCE']::public.app_role[]));

-- --------------------------------------------------------------------------
-- Dados do proprio usuario
-- --------------------------------------------------------------------------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (
    id = auth.uid()
    or public.has_role(array['SUPER_ADMIN','ADMIN','COMPLIANCE','SUPPORT']::public.app_role[])
  );

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_staff_update on public.profiles;
create policy profiles_staff_update on public.profiles
  for update using (public.has_role(array['SUPER_ADMIN','COMPLIANCE']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','COMPLIANCE']::public.app_role[]));

drop policy if exists addresses_owner on public.addresses;
create policy addresses_owner on public.addresses
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists addresses_staff_read on public.addresses;
create policy addresses_staff_read on public.addresses
  for select using (public.has_role(array['SUPER_ADMIN','COMPLIANCE','SUPPORT']::public.app_role[]));

-- operators: cada um enxerga o proprio papel; gestao so por SUPER_ADMIN.
drop policy if exists operators_self_read on public.operators;
create policy operators_self_read on public.operators
  for select using (user_id = auth.uid() or public.has_role(array['SUPER_ADMIN','ADMIN']::public.app_role[]));
drop policy if exists operators_admin_write on public.operators;
create policy operators_admin_write on public.operators
  for all using (public.has_role(array['SUPER_ADMIN']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN']::public.app_role[]));

-- Geolocalizacao: o usuario le o proprio historico mas NAO pode inserir,
-- alterar ou apagar. Gravacao e exclusiva do servidor (service role).
drop policy if exists geo_self_read on public.geolocation_events;
create policy geo_self_read on public.geolocation_events
  for select using (
    user_id = auth.uid()
    or public.has_role(array['SUPER_ADMIN','COMPLIANCE']::public.app_role[])
  );

-- Compliance: o usuario ve o resultado das proprias verificacoes (para
-- entender por que foi bloqueado), mas nunca escreve.
drop policy if exists compliance_self_read on public.compliance_checks;
create policy compliance_self_read on public.compliance_checks
  for select using (
    user_id = auth.uid()
    or public.has_role(array['SUPER_ADMIN','COMPLIANCE','ADMIN']::public.app_role[])
  );

-- KYC: FINANCE deliberadamente fora. Apenas COMPLIANCE e SUPER_ADMIN.
drop policy if exists kyc_self_read on public.kyc_checks;
create policy kyc_self_read on public.kyc_checks
  for select using (
    user_id = auth.uid()
    or public.has_role(array['SUPER_ADMIN','COMPLIANCE']::public.app_role[])
  );
drop policy if exists kyc_self_insert on public.kyc_checks;
create policy kyc_self_insert on public.kyc_checks
  for insert with check (user_id = auth.uid());
drop policy if exists kyc_staff_update on public.kyc_checks;
create policy kyc_staff_update on public.kyc_checks
  for update using (public.has_role(array['SUPER_ADMIN','COMPLIANCE']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','COMPLIANCE']::public.app_role[]));

drop policy if exists rg_limits_owner on public.responsible_gaming_limits;
create policy rg_limits_owner on public.responsible_gaming_limits
  for select using (
    user_id = auth.uid()
    or public.has_role(array['SUPER_ADMIN','COMPLIANCE','SUPPORT']::public.app_role[])
  );
drop policy if exists rg_limits_insert on public.responsible_gaming_limits;
create policy rg_limits_insert on public.responsible_gaming_limits
  for insert with check (user_id = auth.uid());

drop policy if exists self_exclusions_owner on public.self_exclusions;
create policy self_exclusions_owner on public.self_exclusions
  for select using (
    user_id = auth.uid()
    or public.has_role(array['SUPER_ADMIN','COMPLIANCE','SUPPORT']::public.app_role[])
  );
drop policy if exists self_exclusions_insert on public.self_exclusions;
create policy self_exclusions_insert on public.self_exclusions
  for insert with check (user_id = auth.uid());

drop policy if exists consent_owner_read on public.consent_logs;
create policy consent_owner_read on public.consent_logs
  for select using (
    user_id = auth.uid()
    or public.has_role(array['SUPER_ADMIN','COMPLIANCE']::public.app_role[])
  );
drop policy if exists consent_owner_insert on public.consent_logs;
create policy consent_owner_insert on public.consent_logs
  for insert with check (user_id = auth.uid());

drop policy if exists data_requests_owner on public.data_requests;
create policy data_requests_owner on public.data_requests
  for select using (
    user_id = auth.uid()
    or public.has_role(array['SUPER_ADMIN','COMPLIANCE']::public.app_role[])
  );
drop policy if exists data_requests_insert on public.data_requests;
create policy data_requests_insert on public.data_requests
  for insert with check (user_id = auth.uid());

-- --------------------------------------------------------------------------
-- Pedidos e pagamentos
-- --------------------------------------------------------------------------
drop policy if exists orders_owner_read on public.orders;
create policy orders_owner_read on public.orders
  for select using (
    user_id = auth.uid()
    or public.has_role(array['SUPER_ADMIN','ADMIN','COMPLIANCE','FINANCE','PURCHASER','TICKET_VERIFIER','SUPPORT']::public.app_role[])
  );
-- O cliente pode criar/editar apenas rascunhos aguardando pagamento.
-- Precificacao e compliance sao recalculados no servidor.
drop policy if exists orders_owner_insert on public.orders;
create policy orders_owner_insert on public.orders
  for insert with check (user_id = auth.uid() and status = 'pending_payment');
drop policy if exists orders_owner_update on public.orders;
create policy orders_owner_update on public.orders
  for update using (user_id = auth.uid() and status = 'pending_payment')
  with check (user_id = auth.uid() and status in ('pending_payment','cancelled'));
drop policy if exists orders_staff_update on public.orders;
create policy orders_staff_update on public.orders
  for update using (public.has_role(array['SUPER_ADMIN','ADMIN','COMPLIANCE','FINANCE','PURCHASER','TICKET_VERIFIER']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','ADMIN','COMPLIANCE','FINANCE','PURCHASER','TICKET_VERIFIER']::public.app_role[]));

drop policy if exists order_lines_read on public.order_lines;
create policy order_lines_read on public.order_lines
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
    or public.has_role(array['SUPER_ADMIN','ADMIN','COMPLIANCE','PURCHASER','TICKET_VERIFIER','SUPPORT']::public.app_role[])
  );
drop policy if exists order_lines_owner_write on public.order_lines;
create policy order_lines_owner_write on public.order_lines
  for all using (
    exists (select 1 from public.orders o
            where o.id = order_id and o.user_id = auth.uid() and o.status = 'pending_payment')
  )
  with check (
    exists (select 1 from public.orders o
            where o.id = order_id and o.user_id = auth.uid() and o.status = 'pending_payment')
  );

-- Pagamentos: somente leitura para o cliente. Escrita exclusiva do servidor.
drop policy if exists payments_read on public.payments;
create policy payments_read on public.payments
  for select using (
    user_id = auth.uid()
    or public.has_role(array['SUPER_ADMIN','ADMIN','FINANCE','COMPLIANCE']::public.app_role[])
  );

-- --------------------------------------------------------------------------
-- Bilhetes
-- --------------------------------------------------------------------------
drop policy if exists tickets_read on public.tickets;
create policy tickets_read on public.tickets
  for select using (
    user_id = auth.uid()
    or public.has_role(array['SUPER_ADMIN','ADMIN','COMPLIANCE','PURCHASER','TICKET_VERIFIER','SUPPORT','FINANCE']::public.app_role[])
  );
drop policy if exists tickets_staff_write on public.tickets;
create policy tickets_staff_write on public.tickets
  for all using (public.has_role(array['SUPER_ADMIN','ADMIN','PURCHASER','TICKET_VERIFIER']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','ADMIN','PURCHASER','TICKET_VERIFIER']::public.app_role[]));

drop policy if exists ticket_images_read on public.ticket_images;
create policy ticket_images_read on public.ticket_images
  for select using (
    exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid())
    or public.has_role(array['SUPER_ADMIN','ADMIN','PURCHASER','TICKET_VERIFIER','SUPPORT']::public.app_role[])
  );
drop policy if exists ticket_images_staff_write on public.ticket_images;
create policy ticket_images_staff_write on public.ticket_images
  for all using (public.has_role(array['SUPER_ADMIN','ADMIN','PURCHASER','TICKET_VERIFIER']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','ADMIN','PURCHASER','TICKET_VERIFIER']::public.app_role[]));

-- Cofre: o cliente NAO ve localizacao fisica do bilhete.
drop policy if exists vault_staff_only on public.ticket_vault;
create policy vault_staff_only on public.ticket_vault
  for all using (public.has_role(array['SUPER_ADMIN','ADMIN','TICKET_VERIFIER','COMPLIANCE']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','ADMIN','TICKET_VERIFIER']::public.app_role[]));

drop policy if exists vault_events_read on public.ticket_vault_events;
create policy vault_events_read on public.ticket_vault_events
  for select using (public.has_role(array['SUPER_ADMIN','ADMIN','TICKET_VERIFIER','COMPLIANCE']::public.app_role[]));
drop policy if exists vault_events_insert on public.ticket_vault_events;
create policy vault_events_insert on public.ticket_vault_events
  for insert with check (public.has_role(array['SUPER_ADMIN','ADMIN','TICKET_VERIFIER']::public.app_role[]));

-- --------------------------------------------------------------------------
-- Premios
-- --------------------------------------------------------------------------
drop policy if exists prize_claims_read on public.prize_claims;
create policy prize_claims_read on public.prize_claims
  for select using (
    user_id = auth.uid()
    or public.has_role(array['SUPER_ADMIN','ADMIN','FINANCE','COMPLIANCE','SUPPORT']::public.app_role[])
  );
drop policy if exists prize_claims_staff_write on public.prize_claims;
create policy prize_claims_staff_write on public.prize_claims
  for all using (public.has_role(array['SUPER_ADMIN','FINANCE','COMPLIANCE']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','FINANCE','COMPLIANCE']::public.app_role[]));

drop policy if exists prize_events_read on public.prize_claim_events;
create policy prize_events_read on public.prize_claim_events
  for select using (
    exists (select 1 from public.prize_claims c where c.id = claim_id and c.user_id = auth.uid())
    or public.has_role(array['SUPER_ADMIN','ADMIN','FINANCE','COMPLIANCE','SUPPORT']::public.app_role[])
  );
drop policy if exists prize_events_write on public.prize_claim_events;
create policy prize_events_write on public.prize_claim_events
  for insert with check (public.has_role(array['SUPER_ADMIN','FINANCE','COMPLIANCE']::public.app_role[]));

-- --------------------------------------------------------------------------
-- Recursos do cliente
-- --------------------------------------------------------------------------
drop policy if exists subscriptions_owner on public.subscriptions;
create policy subscriptions_owner on public.subscriptions
  for select using (
    user_id = auth.uid()
    or public.has_role(array['SUPER_ADMIN','ADMIN','FINANCE','SUPPORT']::public.app_role[])
  );
drop policy if exists subscriptions_owner_update on public.subscriptions;
create policy subscriptions_owner_update on public.subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists favorites_owner on public.favorites;
create policy favorites_owner on public.favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists jackpot_alerts_owner on public.jackpot_alerts;
create policy jackpot_alerts_owner on public.jackpot_alerts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_owner_read on public.notifications;
create policy notifications_owner_read on public.notifications
  for select using (
    user_id = auth.uid()
    or public.has_role(array['SUPER_ADMIN','ADMIN','SUPPORT']::public.app_role[])
  );
drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notif_prefs_owner on public.notification_preferences;
create policy notif_prefs_owner on public.notification_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists support_tickets_owner on public.support_tickets;
create policy support_tickets_owner on public.support_tickets
  for select using (
    user_id = auth.uid()
    or public.has_role(array['SUPER_ADMIN','ADMIN','SUPPORT','COMPLIANCE']::public.app_role[])
  );
drop policy if exists support_tickets_insert on public.support_tickets;
create policy support_tickets_insert on public.support_tickets
  for insert with check (user_id = auth.uid());
drop policy if exists support_tickets_staff_update on public.support_tickets;
create policy support_tickets_staff_update on public.support_tickets
  for update using (public.has_role(array['SUPER_ADMIN','ADMIN','SUPPORT']::public.app_role[]))
  with check (public.has_role(array['SUPER_ADMIN','ADMIN','SUPPORT']::public.app_role[]));

-- Notas internas nao vazam para o cliente.
drop policy if exists support_messages_read on public.support_messages;
create policy support_messages_read on public.support_messages
  for select using (
    (not is_internal and exists (
      select 1 from public.support_tickets s where s.id = ticket_id and s.user_id = auth.uid()))
    or public.has_role(array['SUPER_ADMIN','ADMIN','SUPPORT','COMPLIANCE']::public.app_role[])
  );
drop policy if exists support_messages_insert on public.support_messages;
create policy support_messages_insert on public.support_messages
  for insert with check (
    (author_id = auth.uid() and not is_internal and exists (
      select 1 from public.support_tickets s where s.id = ticket_id and s.user_id = auth.uid()))
    or public.has_role(array['SUPER_ADMIN','ADMIN','SUPPORT']::public.app_role[])
  );

-- --------------------------------------------------------------------------
-- Auditoria: leitura restrita, escrita apenas via write_audit_log(),
-- remocao impossivel (trigger + ausencia de policy).
-- --------------------------------------------------------------------------
drop policy if exists audit_logs_read on public.audit_logs;
create policy audit_logs_read on public.audit_logs
  for select using (public.has_role(array['SUPER_ADMIN','COMPLIANCE']::public.app_role[]));

revoke update, delete on public.audit_logs from authenticated, anon;
