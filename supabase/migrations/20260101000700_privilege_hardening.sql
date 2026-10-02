-- ===========================================================================
-- Jackpot USA  |  ENDURECIMENTO DE PRIVILEGIOS
-- ---------------------------------------------------------------------------
-- O Supabase concede, por padrao, todos os privilegios de tabela e EXECUTE em
-- todas as funcoes do schema public aos papeis anon e authenticated. Para esta
-- plataforma isso e largo demais: duas brechas concretas surgem dai.
--
--  1) TRUNCATE nao passa por RLS. Com o privilegio padrao, qualquer sessao
--     autenticada poderia esvaziar audit_logs, jurisdiction_rules ou
--     system_settings. O gatilho audit_logs_immutable so cobre UPDATE/DELETE,
--     portanto a trilha de auditoria so e de fato imutavel depois deste
--     REVOKE.
--
--  2) Funcoes SECURITY DEFINER rodam como o owner e ignoram RLS. Expostas em
--     /rest/v1/rpc/<nome>, davam ao cliente caminhos que o produto nao
--     preve: evaluate_compliance aceita p_user_id, p_country e p_state como
--     parametros, de modo que um cliente poderia declarar a propria
--     jurisdicao e escrever o veredito em um pedido qualquer; spent_in_window
--     devolveria o gasto de outro usuario; setting_bool leria configuracoes
--     marcadas como nao publicas; write_audit_log permitiria poluir a
--     trilha de auditoria.
--
-- Todas essas funcoes sao chamadas unicamente pelas Edge Functions com a
-- chave service_role. Nenhum caminho do frontend as invoca.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- 1) Privilegios de tabela que RLS nao filtra.
-- --------------------------------------------------------------------------
revoke truncate, references, trigger on all tables in schema public
  from anon, authenticated;

-- Tabelas criadas por migracoes futuras nascem sem esses privilegios.
alter default privileges in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;

-- --------------------------------------------------------------------------
-- 2) EXECUTE nas funcoes privilegiadas.
--    O REVOKE de PUBLIC e obrigatorio: o Postgres concede EXECUTE ao
--    pseudo-papel PUBLIC em toda funcao nova, e isso cobre anon e
--    authenticated mesmo depois de revogar os dois nominalmente.
-- --------------------------------------------------------------------------
revoke execute on function public.evaluate_compliance(uuid, uuid, text, text, numeric, text)
  from public, anon, authenticated;
revoke execute on function public.calculate_order_totals(uuid)
  from public, anon, authenticated;
revoke execute on function public.compare_all_tickets(uuid)
  from public, anon, authenticated;
revoke execute on function public.match_ticket_against_result(uuid)
  from public, anon, authenticated;
revoke execute on function public.verify_ticket_against_order(uuid)
  from public, anon, authenticated;
revoke execute on function public.generate_upcoming_draws(uuid, int)
  from public, anon, authenticated;
revoke execute on function public.write_audit_log(text, text, text, jsonb, jsonb, text)
  from public, anon, authenticated;
revoke execute on function public.spent_in_window(uuid, interval)
  from public, anon, authenticated;
revoke execute on function public.setting_bool(text, boolean)
  from public, anon, authenticated;
revoke execute on function public.setting_numeric(text, numeric)
  from public, anon, authenticated;
revoke execute on function public.resolve_jurisdiction(text, text)
  from public, anon, authenticated;
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

-- has_role() e is_staff() permanecem executaveis por anon e authenticated de
-- proposito: as 73 policies de RLS as chamam, e expressoes de policy sao
-- avaliadas com os privilegios de quem consulta. As duas sao fixadas em
-- auth.uid() internamente, nao aceitam identidade vinda do chamador e
-- devolvem apenas um booleano sobre o proprio solicitante.
