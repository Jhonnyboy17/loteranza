-- ---------------------------------------------------------------------------
-- Cambio: margem de divergencia entre fontes.
--
-- O QUE ESTAVA ERRADO
--   Nenhuma fonte real de cambio estava registrada no codigo: `FX_PROVIDERS`
--   tinha so o provedor `demo`, e `fxProvider()` caia nele por padrao. A
--   rotina `sync-exchange-rate` rodava, respondia `skipped: demo_provider_only`
--   e nunca gravava nada. A unica linha de `exchange_rates` era a semente de
--   demonstracao: USD/BRL = 5,40, spread 0, `is_demo = true`.
--
--   Isso nao ficou parado na vitrine. `create-order` grava
--   `orders.total_display = total * effective_rate`, e `begin_payment` cobra
--   exatamente esse campo. O dolar de referencia no dia desta migration era
--   4,97 — ou seja, a semente de demonstracao cobrava cerca de 8,7% a mais que
--   o cambio do dia, em pedido real, em cobranca real.
--
--   A trava de validade do frontend nao pegava o caso: `rateUsable` dispensa a
--   checagem de idade quando `rate.isDemo`, pela mesma razao que o jackpot
--   demonstrativo era dispensado — a premissa era que dado demonstrativo so
--   aparece em tela demonstrativa. Com a venda aberta, a premissa caiu.
--
-- O QUE MUDA AQUI
--   Duas fontes publicas sem chave passam a ser o padrao (frankfurter e
--   er-api), e a rotina so grava quando elas concordam dentro da margem
--   definida nesta configuracao. Divergencia acima dela NAO grava: a cotacao
--   antiga vence, a interface para de converter e o operador ve o problema no
--   diario de execucao. Preferivel a cobrar por uma taxa que ninguem conferiu.
--
--   2% e folgado para ruido entre uma referencia do BCE (diaria) e uma de
--   mercado (intradiaria), e apertado o suficiente para barrar erro de
--   publicacao, que costuma ser de ordem de grandeza.
--
-- O QUE ESTA MIGRATION NAO FAZ, DE PROPOSITO
--   Nao desliga `demo_mode`, nao mexe em `is_demo` e nao define spread. Essas
--   sao decisoes do operador para ESTA instalacao, nao padrao do projeto: uma
--   instalacao nova tem de nascer em demonstracao, como o briefing exige. O
--   estado atual desta instalacao esta em docs/PROXIMOS-PASSOS.md.
-- ---------------------------------------------------------------------------

insert into public.system_settings (key, value, description, is_public)
values (
  'fx_max_divergence_percent',
  '2'::jsonb,
  'Divergencia maxima tolerada entre as fontes de cambio, em %. Acima disso a '
  'rotina nao grava cotacao nenhuma: cotacao entra congelada no pedido e vira '
  'cobranca, entao numero nao conferido e pior que cotacao vencida.',
  false
)
on conflict (key) do update
  set description = excluded.description;
