import { adminClient } from '../_shared/client.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { fxProvider } from '../_shared/providers/index.ts';
import { SyncRun } from '../_shared/syncRun.ts';

/**
 * Captura da cotacao USD/BRL.
 *
 * Nao e cosmetico: o checkout CONGELA a taxa no pedido e nunca a reescreve
 * depois. Uma cotacao parada ha dias significa vender com cambio de outro
 * dia, e o prejuizo (ou o ganho indevido) fica registrado no pedido. Por isso
 * a interface tambem para de converter quando a captura vence — a trava de
 * validade no frontend e a contrapartida desta rotina.
 *
 * O spread sai de system_settings e e aplicado AQUI, no servidor: `rate` e a
 * referencia crua da fonte e `effective_rate` e o que o cliente paga. Guardar
 * as duas separadas e o que permite auditar a margem depois.
 */
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });

  const secret = req.headers.get('x-sync-secret');
  if (!secret || secret !== Deno.env.get('SYNC_SECRET')) {
    return json({ error: 'unauthorized' }, 401, origin);
  }

  const admin = adminClient();
  let provider;
  try {
    provider = fxProvider();
  } catch (error) {
    const run = await SyncRun.start(admin, 'exchange_rate', 'invalid');
    await run.finish(error);
    return json({ error: 'provider_misconfigured', detail: String(error) }, 500, origin);
  }

  const run = await SyncRun.start(admin, 'exchange_rate', provider.name);

  if (provider.name === 'demo') {
    run.note('skipped', 'nenhuma fonte de cambio configurada (FX_PROVIDER)');
    await run.finish();
    return json({ skipped: true, reason: 'demo_provider_only' }, 200, origin);
  }

  try {
    const rate = await provider.fetchRate('USD', 'BRL');
    if (rate === null || !(rate > 0)) {
      // Fonte sem resposta nao vira linha nova: melhor a cotacao vencer e a
      // interface omitir a conversao do que gravar um numero duvidoso que o
      // checkout vai congelar num pedido.
      run.failure();
      run.note('reason', 'fonte nao devolveu taxa utilizavel');
      await run.finish();
      return json({ skipped: true, reason: 'no_rate' }, 200, origin);
    }

    const { data: spreadRow } = await admin
      .from('system_settings').select('value').eq('key', 'fx_spread_percent').maybeSingle();
    const spread = Number(spreadRow?.value ?? 0) || 0;
    const effective = Number((rate * (1 + spread / 100)).toFixed(6));

    const { error } = await admin.from('exchange_rates').insert({
      base_currency: 'USD',
      quote_currency: 'BRL',
      rate,
      spread_percent: spread,
      effective_rate: effective,
      source: provider.name,
      is_demo: false,
    });
    if (error) throw error;

    run.success();
    run.note('rate', rate);
    run.note('effective_rate', effective);
    await run.finish();
    return json({ rate, spread_percent: spread, effective_rate: effective }, 200, origin);
  } catch (error) {
    await run.finish(error);
    return json({ error: 'sync_failed', detail: String(error) }, 500, origin);
  }
});
