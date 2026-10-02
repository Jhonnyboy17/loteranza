-- ===========================================================================
-- Jackpot USA  |  SEED DEMONSTRATIVO
-- ---------------------------------------------------------------------------
-- ATENCAO
--  * Tudo aqui nasce com is_demo = true e nao deve ser aplicado em producao.
--  * Nenhuma jurisdicao e habilitada: transactions_enabled = false em todas.
--  * Valores de premiacao, odds e jackpots sao DEMONSTRATIVOS. Antes de
--    qualquer operacao real eles devem ser substituidos pelos dados do
--    provedor oficial/licenciado atraves do Data Provider Layer.
--  * Nao ha ganhadores ficticios, depoimentos ficticios nem licencas
--    ficticias neste arquivo. Por decisao de projeto, nunca havera.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- Configuracao global. O kill switch nasce desligado.
-- --------------------------------------------------------------------------
insert into public.system_settings (key, value, description, is_public) values
  ('transactions_enabled', 'false'::jsonb,
   'Kill switch global. Mesmo com true, a jurisdicao precisa estar habilitada e o Compliance Engine precisa aprovar.', true),
  ('demo_mode', 'true'::jsonb,
   'Quando true, a interface deixa explicito que os dados sao demonstrativos.', true),
  ('sanctions_provider_enabled', 'false'::jsonb,
   'Habilitar somente apos contratar provedor de triagem de sancoes.', false),
  ('kyc_provider', '"none"'::jsonb, 'Provedor de KYC configurado.', false),
  ('lottery_data_provider', '"demo"'::jsonb,
   'Fonte de jackpots e resultados. Trocar por provedor licenciado antes de operar.', true),
  ('fx_provider', '"demo"'::jsonb, 'Fonte da cotacao USD/BRL.', true),
  ('fx_spread_percent', '0'::jsonb, 'Spread aplicado sobre a cotacao de referencia.', true),
  ('rg.increase_cooldown_hours', '24'::jsonb,
   'Periodo de espera para aumento de limites de jogo responsavel.', true),
  ('prize.manual_review_threshold', '600'::jsonb,
   'Premios acima deste valor (USD) exigem revisao humana e dupla aprovacao.', false),
  ('support_email', '"suporte@exemplo.com"'::jsonb, 'E-mail de contato exibido no site.', true),
  ('brand_name', '"Jackpot USA"'::jsonb, 'Nome da marca. Alteravel sem deploy.', true)
on conflict (key) do nothing;

-- --------------------------------------------------------------------------
-- Jurisdicoes. TODAS desabilitadas: este e o estado correto ate existir
-- parecer juridico e licenciamento para cada uma.
-- --------------------------------------------------------------------------
insert into public.jurisdiction_rules
  (country, state, transactions_enabled, payment_enabled, subscriptions_enabled,
   minimum_age, kyc_required, allowed_games, max_transaction, currency,
   legal_notice, requires_manual_review)
values
  ('BR', null, false, false, false, 18, true, '{}', null, 'BRL',
   'Atualmente nao podemos aceitar compras a partir da sua localizacao. Voce continua podendo consultar jackpots, ver resultados e conferir numeros.', true),
  ('US', null, false, false, false, 18, true, '{}', null, 'USD',
   'Compras ainda nao habilitadas. A liberacao depende de analise por estado.', true),
  ('US', 'IL', false, false, false, 18, true, '{}', 5000.00, 'USD',
   'Jurisdicao mapeada, porem ainda nao habilitada para transacoes.', true),
  ('US', 'NY', false, false, false, 18, true, '{}', 5000.00, 'USD',
   'Jurisdicao mapeada, porem ainda nao habilitada para transacoes.', true),
  ('PT', null, false, false, false, 18, true, '{}', null, 'EUR',
   'Atualmente nao podemos aceitar compras a partir da sua localizacao.', true)
on conflict do nothing;

-- --------------------------------------------------------------------------
-- Provedores de pagamento: cadastrados, todos desabilitados.
-- O descritor de fatura descreve a operacao de forma transparente.
-- --------------------------------------------------------------------------
insert into public.payment_providers
  (provider_key, display_name, method, is_enabled, allowed_jurisdictions, currency, notes)
values
  ('card_generic',  'Cartao de credito', 'card',          false, '{}', 'USD',
   'Requer provedor que aceite explicitamente intermediacao de loteria na jurisdicao.'),
  ('ach_generic',   'Debito em conta (ACH)', 'ach',       false, '{}', 'USD',
   'Somente para contas norte-americanas.'),
  ('pix_generic',   'PIX',              'pix',            false, '{}', 'BRL',
   'Depende de habilitacao juridica no Brasil.'),
  ('bank_transfer', 'Transferencia bancaria', 'bank_transfer', false, '{}', 'USD', null)
on conflict (provider_key) do nothing;

-- --------------------------------------------------------------------------
-- Modalidades. Toda regra de jogo do frontend sai daqui.
-- --------------------------------------------------------------------------
insert into public.lottery_games (
  game_key, name, short_name, status, operator_name, description, how_to_play,
  logo_url, brand_color, sort_order, official_price, service_fee, currency,
  main_numbers_count, main_number_min, main_number_max,
  special_numbers_count, special_number_min, special_number_max, special_number_label,
  multiplier_enabled, multiplier_label, multiplier_price,
  draw_days, draw_time_local, sales_cutoff_minutes, timezone,
  current_jackpot, current_jackpot_cash, jackpot_updated_at,
  sales_enabled, allowed_jurisdictions, max_lines_per_order, max_draws_ahead, is_demo
) values
(
  'powerball', 'Powerball', 'PB', 'active', 'Multi-State Lottery Association',
  'Modalidade multiestadual dos Estados Unidos com sorteios tres vezes por semana e jackpot acumulativo.',
  'Escolha 5 numeros de 1 a 69 e 1 numero Powerball de 1 a 26. O jackpot sai com os 5 numeros mais o Powerball.',
  'logos/powerball.svg', '#E4434B', 10, 2.00, 1.50, 'USD',
  5, 1, 69, 1, 1, 26, 'Powerball',
  true, 'Power Play', 1.00,
  '{1,3,6}', '22:59', 60, 'America/New_York',
  150000000, 71300000, now(),
  false, '{}', 20, 10, true
),
(
  'mega-millions', 'Mega Millions', 'MM', 'active', 'Mega Millions Consortium',
  'Modalidade multiestadual com sorteios as tercas e sextas-feiras e multiplicador ja incluso na aposta.',
  'Escolha 5 numeros de 1 a 70 e 1 Mega Ball de 1 a 24. O jackpot sai com os 5 numeros mais a Mega Ball.',
  'logos/mega-millions.svg', '#3B82F6', 20, 5.00, 1.50, 'USD',
  5, 1, 70, 1, 1, 24, 'Mega Ball',
  false, null, 0,
  '{2,5}', '23:00', 60, 'America/New_York',
  486000000, 231700000, now(),
  false, '{}', 20, 10, true
),
(
  'lotto', 'Lotto', null, 'coming_soon', null,
  'Modalidade estadual. Estrutura preparada, ativacao depende de configuracao no painel.',
  null, 'logos/lotto.svg', '#22B07D', 30, 1.00, 1.00, 'USD',
  6, 1, 52, 0, 1, 0, null,
  false, null, 0, '{1,4,6}', '21:22', 45, 'America/Chicago',
  null, null, null, false, '{}', 20, 10, true
),
(
  'lucky-day-lotto', 'Lucky Day Lotto', null, 'coming_soon', null,
  'Modalidade estadual com dois sorteios diarios. Estrutura preparada.',
  null, 'logos/lucky-day-lotto.svg', '#A855F7', 40, 1.00, 0.75, 'USD',
  5, 1, 45, 0, 1, 0, null,
  false, null, 0, '{0,1,2,3,4,5,6}', '21:22', 30, 'America/Chicago',
  null, null, null, false, '{}', 20, 10, true
),
(
  'pick-3', 'Pick 3', null, 'coming_soon', null,
  'Modalidade de tres digitos. Estrutura preparada.',
  null, 'logos/pick-3.svg', '#EC4899', 50, 0.50, 0.50, 'USD',
  3, 0, 9, 0, 1, 0, null,
  false, null, 0, '{0,1,2,3,4,5,6}', '12:40', 20, 'America/Chicago',
  null, null, null, false, '{}', 20, 10, true
),
(
  'pick-4', 'Pick 4', null, 'coming_soon', null,
  'Modalidade de quatro digitos. Estrutura preparada.',
  null, 'logos/pick-4.svg', '#06B6D4', 60, 0.50, 0.50, 'USD',
  4, 0, 9, 0, 1, 0, null,
  false, null, 0, '{0,1,2,3,4,5,6}', '12:40', 20, 'America/Chicago',
  null, null, null, false, '{}', 20, 10, true
)
on conflict (game_key) do nothing;

-- --------------------------------------------------------------------------
-- Faixas de premiacao (DEMONSTRATIVAS - validar com a fonte oficial).
-- --------------------------------------------------------------------------
insert into public.prize_tiers
  (game_id, tier_key, label, main_matches, special_matches, is_jackpot, fixed_prize, odds_denominator, sort_order, prize_note)
select g.id, v.tier_key, v.label, v.mm, v.sm, v.jack, v.prize, v.odds, v.ord,
       'Valor demonstrativo. Confirmar com a fonte oficial antes de operar.'
from public.lottery_games g
join (values
  ('5+1', '5 numeros + Powerball', 5, 1, true,  null::numeric, 292201338::bigint, 10),
  ('5+0', '5 numeros',             5, 0, false, 1000000,       11688054,          20),
  ('4+1', '4 numeros + Powerball', 4, 1, false, 50000,         913129,            30),
  ('4+0', '4 numeros',             4, 0, false, 100,           36525,             40),
  ('3+1', '3 numeros + Powerball', 3, 1, false, 100,           14494,             50),
  ('3+0', '3 numeros',             3, 0, false, 7,             580,               60),
  ('2+1', '2 numeros + Powerball', 2, 1, false, 7,             701,               70),
  ('1+1', '1 numero + Powerball',  1, 1, false, 4,             92,                80),
  ('0+1', 'Somente o Powerball',   0, 1, false, 4,             38,                90)
) as v(tier_key, label, mm, sm, jack, prize, odds, ord) on true
where g.game_key = 'powerball'
on conflict (game_id, tier_key) do nothing;

insert into public.prize_tiers
  (game_id, tier_key, label, main_matches, special_matches, is_jackpot, fixed_prize, odds_denominator, sort_order, prize_note)
select g.id, v.tier_key, v.label, v.mm, v.sm, v.jack, v.prize, v.odds, v.ord,
       'Valor demonstrativo. Confirmar com a fonte oficial antes de operar.'
from public.lottery_games g
join (values
  ('5+1', '5 numeros + Mega Ball', 5, 1, true,  null::numeric, 290472336::bigint, 10),
  ('5+0', '5 numeros',             5, 0, false, 1000000,       12607306,          20),
  ('4+1', '4 numeros + Mega Ball', 4, 1, false, 10000,         931001,            30),
  ('4+0', '4 numeros',             4, 0, false, 500,           38792,             40),
  ('3+1', '3 numeros + Mega Ball', 3, 1, false, 200,           14547,             50),
  ('3+0', '3 numeros',             3, 0, false, 10,            606,               60),
  ('2+1', '2 numeros + Mega Ball', 2, 1, false, 10,            693,               70),
  ('1+1', '1 numero + Mega Ball',  1, 1, false, 4,             89,                80),
  ('0+1', 'Somente a Mega Ball',   0, 1, false, 2,             37,                90)
) as v(tier_key, label, mm, sm, jack, prize, odds, ord) on true
where g.game_key = 'mega-millions'
on conflict (game_id, tier_key) do nothing;

-- --------------------------------------------------------------------------
-- Sorteios futuros, gerados a partir do calendario de cada jogo.
-- --------------------------------------------------------------------------
select public.generate_upcoming_draws(id, 8)
from public.lottery_games where status = 'active';

-- --------------------------------------------------------------------------
-- Historico demonstrativo: 6 sorteios passados por jogo, com resultado.
-- Marcados is_demo = true e is_official = false (nunca apresentar como
-- resultado oficial).
-- --------------------------------------------------------------------------
do $$
declare
  g          public.lottery_games;
  v_day      date;
  v_draw_id  uuid;
  v_draw_at  timestamptz;
  v_count    int;
  v_main     smallint[];
  v_special  smallint[];
  v_jackpot  numeric;
begin
  for g in select * from public.lottery_games where status = 'active' loop
    v_day := (now() at time zone 'UTC')::date - 1;
    v_count := 0;

    while v_count < 6 loop
      if extract(dow from v_day)::smallint = any(g.draw_days) then
        v_draw_at := (v_day + g.draw_time_local) at time zone g.timezone;
        v_jackpot := g.current_jackpot * (0.55 + 0.06 * v_count);

        insert into public.draws
          (game_id, draw_date, draw_at, sales_close_at, status, advertised_jackpot, is_demo)
        values
          (g.id, v_day, v_draw_at,
           v_draw_at - make_interval(mins => g.sales_cutoff_minutes),
           'drawn', round(v_jackpot, 2), true)
        on conflict (game_id, draw_date) do nothing
        returning id into v_draw_id;

        if v_draw_id is not null then
          -- Sorteio pseudoaleatorio apenas para popular a interface de demo.
          select array_agg(n order by n)::smallint[] into v_main
          from (
            select n from generate_series(g.main_number_min::int, g.main_number_max::int) n
            order by md5(n::text || v_draw_id::text)
            limit g.main_numbers_count
          ) s;

          if g.special_numbers_count > 0 then
            select array_agg(n)::smallint[] into v_special
            from (
              select n from generate_series(g.special_number_min::int, g.special_number_max::int) n
              order by md5(n::text || v_draw_id::text || 'sp')
              limit g.special_numbers_count
            ) s;
          else
            v_special := '{}';
          end if;

          insert into public.draw_results
            (draw_id, game_id, main_numbers, special_numbers, jackpot_amount,
             jackpot_won, winners_count, source, is_official, is_demo, published_at)
          values
            (v_draw_id, g.id, v_main, v_special, round(v_jackpot, 2),
             false, 0, 'demo-seed', false, true, v_draw_at + interval '30 minutes');

          v_count := v_count + 1;
          v_draw_id := null;
        end if;
      end if;
      v_day := v_day - 1;
    end loop;
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- Cotacao demonstrativa
-- --------------------------------------------------------------------------
insert into public.exchange_rates
  (base_currency, quote_currency, rate, spread_percent, effective_rate, source, is_demo)
values ('USD', 'BRL', 5.4000, 0, 5.4000, 'demo-seed', true);

-- --------------------------------------------------------------------------
-- FAQ inicial
-- --------------------------------------------------------------------------
insert into public.faqs (category, question, answer, sort_order) values
('geral', 'Como funciona?',
 'Voce escolhe a loteria e monta seus jogos. Onde a operacao for legalmente permitida, o pedido segue para pagamento e um operador autorizado adquire o bilhete oficial, digitaliza e associa a sua conta. Onde nao for permitida, voce continua podendo consultar jackpots, resultados e usar o simulador.', 10),
('bilhete', 'O bilhete e oficial?',
 'O modelo previsto e de aquisicao de bilhete oficial por operador autorizado, com digitalizacao e guarda. A operacao so e habilitada em jurisdicoes expressamente liberadas no painel administrativo. [CONTEUDO A SER VALIDADO POR ADVOGADO]', 20),
('bilhete', 'Onde meu bilhete fica armazenado?',
 'Em cofre fisico controlado, com registro de cadeia de custodia: quem guardou, onde, quando e quem conferiu. Toda movimentacao gera log de auditoria.', 30),
('bilhete', 'Quando recebo a imagem do bilhete?',
 'Assim que o operador conclui a compra e faz o upload, a copia digital aparece na sua conta. A imagem exibida oculta areas sensiveis, como serial e codigo de barras.', 40),
('premios', 'O que acontece se eu ganhar?',
 'O sistema compara automaticamente os numeros quando o resultado e recebido e avisa voce. O premio so e tratado como definitivo apos validacao do resultado oficial. O resgate segue as regras do orgao oficial e da jurisdicao, podendo exigir documentos, retencao de impostos e, em alguns casos, presenca fisica.', 50),
('pagamento', 'Existe taxa de servico?',
 'Sim. A taxa da plataforma e sempre exibida separada do preco oficial da aposta, antes de qualquer confirmacao. Nao ha cobranca embutida.', 60),
('pagamento', 'Quais impostos existem?',
 'Premios podem sofrer retencao na fonte pelo orgao oficial e tributacao no seu pais de residencia. Os valores aplicaveis sao informados quando conhecidos. [CONTEUDO A SER VALIDADO POR ADVOGADO]', 70),
('pagamento', 'Como funciona o cambio?',
 'Precos oficiais sao em dolar. A conversao para real e uma estimativa calculada com a cotacao vigente, exibida junto com o horario de captura. A taxa usada no checkout fica registrada no pedido e nunca e alterada depois.', 80),
('conta', 'Posso cancelar um pedido?',
 'O cancelamento e possivel enquanto o bilhete ainda nao tiver sido adquirido e dentro do prazo do sorteio. Depois da compra do bilhete fisico o cancelamento nao e possivel. [CONTEUDO A SER VALIDADO POR ADVOGADO]', 90),
('conta', 'Quem pode participar?',
 'Apenas pessoas que atendam a idade minima da jurisdicao e estejam em local onde a operacao seja permitida. A verificacao e feita antes de qualquer transacao.', 100),
('verificacao', 'Por que minha localizacao e verificada?',
 'Porque a permissao para intermediar a compra depende do lugar de onde a solicitacao parte. A verificacao usa GPS do navegador e o pais do IP; divergencias sao registradas. Nao ha como informar a localizacao manualmente.', 110)
on conflict do nothing;

-- --------------------------------------------------------------------------
-- Conteudo institucional e legal. Textos juridicos entram como PLACEHOLDER.
-- --------------------------------------------------------------------------
insert into public.cms_content (content_key, kind, title, body, is_published, requires_legal_review, data) values
('home.hero', 'json', 'Os maiores jackpots dos Estados Unidos em um so lugar', null, true, false,
 jsonb_build_object(
   'subtitle', 'Acompanhe jackpots e resultados oficiais, monte seus jogos e, onde a operacao for legalmente permitida, acompanhe cada etapa ate o bilhete digitalizado na sua conta.',
   'primary_cta', 'Escolher meus numeros',
   'secondary_cta', 'Como funciona')),
('legal.terms', 'markdown', 'Termos de Uso',
 E'# Termos de Uso\n\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n\nEste documento e um esqueleto estrutural. Nenhuma clausula abaixo foi redigida ou revisada por profissional habilitado e nao deve ser publicada sem revisao.\n\n## 1. Objeto\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n\n## 2. Natureza do servico\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n\n## 3. Elegibilidade e jurisdicao\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n\n## 4. Propriedade do bilhete\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n\n## 5. Taxas e pagamentos\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n\n## 6. Premios e resgate\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n\n## 7. Limitacao de responsabilidade\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n',
 false, true, '{}'),
('legal.privacy', 'markdown', 'Politica de Privacidade',
 E'# Politica de Privacidade\n\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n\n## Dados tratados\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n\n## Base legal (LGPD / GDPR)\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n\n## Direitos do titular\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n\n## Retencao e exclusao\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n',
 false, true, '{}'),
('legal.cookies', 'markdown', 'Politica de Cookies',
 E'# Politica de Cookies\n\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n', false, true, '{}'),
('legal.aml-kyc', 'markdown', 'Politica AML / KYC',
 E'# Politica AML / KYC\n\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n\n## Verificacao de identidade\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n\n## Monitoramento de transacoes\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n\n## Triagem de sancoes\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n', false, true, '{}'),
('legal.responsible-gaming', 'markdown', 'Jogo Responsavel',
 E'# Jogo Responsavel\n\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n\nFerramentas disponiveis na sua conta: limites de gasto diario, semanal e mensal, pausa temporaria e autoexclusao.\n\nTodas as combinacoes validas possuem a mesma probabilidade de serem sorteadas. Nenhuma estrategia altera essa probabilidade.\n', false, true, '{}'),
('legal.prize-claim', 'markdown', 'Politica de Resgate de Premios',
 E'# Politica de Resgate de Premios\n\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n\nPrazos, documentos exigidos, retencoes e eventual necessidade de comparecimento dependem do orgao oficial da loteria e da jurisdicao.\n', false, true, '{}'),
('legal.refund', 'markdown', 'Politica de Reembolso',
 E'# Politica de Reembolso\n\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n', false, true, '{}'),
('legal.jurisdictions', 'markdown', 'Restricoes por Jurisdicao',
 E'# Restricoes por Jurisdicao\n\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n\nA lista de jurisdicoes habilitadas e mantida no painel administrativo e refletida automaticamente nesta pagina.\n', false, true, '{}'),
('page.ticket-security', 'markdown', 'Seguranca dos Bilhetes',
 E'# Seguranca dos Bilhetes\n\n## Como sao adquiridos\nUm operador autorizado recebe o pedido com os numeros exatos escolhidos por voce e realiza a compra no ponto oficial.\n\n## Como sao digitalizados\nFrente e, quando aplicavel, verso sao fotografados e anexados ao pedido. A copia exibida a voce oculta serial e codigo de barras.\n\n## Como sao armazenados\nO bilhete fisico fica em cofre controlado. Cada movimentacao registra responsavel, data e local, formando uma cadeia de custodia auditavel.\n\n## Como funciona a conferencia\nQuando o resultado e recebido, o sistema compara automaticamente os numeros de cada bilhete. Nenhum premio e tratado como definitivo antes da validacao do resultado oficial.\n\n## Como funciona o resgate\nO fluxo depende do valor e das regras do orgao oficial. Premios relevantes passam por revisao humana e dupla aprovacao.\n\n## Propriedade do bilhete\n[CONTEUDO A SER VALIDADO POR ADVOGADO]\n',
 true, true, '{}')
on conflict (content_key, locale, version) do nothing;
