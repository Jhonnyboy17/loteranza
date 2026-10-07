import { adminClient } from '../_shared/client.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { fxProviders } from '../_shared/providers/index.ts';
import { requireSyncSecret } from '../_shared/syncAuth.ts';
import { SyncRun } from '../_shared/syncRun.ts';

/**
 * Captura da cotacao USD/BRL.
 *
 * Nao e cosmetico: o checkout CONGELA a taxa no pedido e nunca a reescreve
 * depois, e `begin_payment` cobra `orders.total_display`, que sai dessa taxa.
 * Uma cotacao parada ha dias significa vender com cambio de outro dia, e o
 * prejuizo (ou o ganho indevido) fica registrado no pedido. Por isso a
 * interface tambem para de converter quando a captura vence — a trava de
 * validade no frontend e a contrapartida desta rotina.
 *
 * O spread sai de system_settings e e aplicado AQUI, no servidor: `rate` e a
 * referencia crua da fonte e `effective_rate` e o que o cliente paga. Guardar
 * as duas separadas e o que permite auditar a margem depois.
 *
 * DUAS FONTES, E RECUSA QUANDO DIVERGEM
 *   Com uma fonte so nao existe como conferir nada: se ela publicar um numero
 *   errado, o erro entra no pedido congelado e ninguem percebe. Com duas, a
 *   divergencia acima de `fx_max_divergence_percent` faz a rotina NAO gravar e
 *   registrar o desacordo. A cotacao antiga vence sozinha, a interface para de
 *   converter e o operador ve o problema — tudo preferivel a cobrar por uma
 *   taxa que ninguem conferiu.
 *
 *   Quando as fontes concordam, grava-se a taxa da PRIMEIRA configurada, e as
 *   demais ficam em `source_reference` como corroboracao. Media silenciosa
 *   entre numeros discordantes seria inventar um terceiro valor.
 */
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });

  const auth = requireSyncSecret(req, origin);
  if (!auth.ok) return auth.response;

  const admin = adminClient();
  let providers;
  try {
    providers = fxProviders();
  } catch (error) {
    const run = await SyncRun.start(admin, 'exchange_rate', 'invalid');
    await run.finish(error);
    return json({ error: 'provider_misconfigured', detail: String(error) }, 500, origin);
  }

  const reais = providers.filter((p) => p.name !== 'demo');
  const run = await SyncRun.start(
    admin,
    'exchange_rate',
    reais.map((p) => p.name).join('+') || 'demo',
  );

  if (reais.length === 0) {
    run.note('skipped', 'nenhuma fonte de cambio configurada (FX_PROVIDER)');
    await run.finish();
    return json({ skipped: true, reason: 'demo_provider_only' }, 200, origin);
  }

  try {
    // Uma fonte fora do ar nao derruba a rotina: cada leitura e registrada com
    // o seu resultado, inclusive a falha, e a decisao vem depois.
    const leituras = await Promise.all(reais.map(async (p) => {
      try {
        return { fonte: p.name, taxa: await p.fetchRate('USD', 'BRL'), erro: null as string | null };
      } catch (error) {
        return { fonte: p.name, taxa: null, erro: String(error).slice(0, 300) };
      }
    }));

    for (const l of leituras) {
      run.note(`fonte_${l.fonte}`, l.erro ?? l.taxa);
    }

    const validas = leituras.filter((l): l is { fonte: string; taxa: number; erro: null } =>
      typeof l.taxa === 'number' && l.taxa > 0
    );

    if (validas.length === 0) {
      // Fonte sem resposta nao vira linha nova: melhor a cotacao vencer e a
      // interface omitir a conversao do que gravar um numero duvidoso que o
      // checkout vai congelar num pedido.
      run.failure();
      run.note('reason', 'nenhuma fonte devolveu taxa utilizavel');
      await run.finish();
      return json({ skipped: true, reason: 'no_rate', leituras }, 200, origin);
    }

    const { data: margemRow } = await admin
      .from('system_settings').select('value').eq('key', 'fx_max_divergence_percent').maybeSingle();
    const margem = Number(margemRow?.value ?? 2) || 2;

    // Divergencia medida entre o menor e o maior, sobre o menor: e a leitura
    // pessimista, que e a correta quando o numero vai virar cobranca.
    const menor = Math.min(...validas.map((l) => l.taxa));
    const maior = Math.max(...validas.map((l) => l.taxa));
    const divergencia = menor > 0 ? ((maior - menor) / menor) * 100 : 0;

    if (validas.length > 1 && divergencia > margem) {
      run.failure();
      run.note('reason', 'fontes de cambio divergem acima da margem');
      run.note('divergencia_percent', Number(divergencia.toFixed(4)));
      run.note('margem_percent', margem);
      await run.finish();
      return json({
        skipped: true,
        reason: 'fx_divergence',
        divergencia_percent: Number(divergencia.toFixed(4)),
        margem_percent: margem,
        leituras,
      }, 200, origin);
    }

    // A primeira fonte CONFIGURADA que respondeu — nao a primeira que chegou.
    const escolhida = reais
      .map((p) => validas.find((l) => l.fonte === p.name))
      .find((l) => l !== undefined)!;

    const { data: spreadRow } = await admin
      .from('system_settings').select('value').eq('key', 'fx_spread_percent').maybeSingle();
    const spread = Number(spreadRow?.value ?? 0) || 0;
    const effective = Number((escolhida.taxa * (1 + spread / 100)).toFixed(6));

    const { error } = await admin.from('exchange_rates').insert({
      base_currency: 'USD',
      quote_currency: 'BRL',
      rate: escolhida.taxa,
      spread_percent: spread,
      effective_rate: effective,
      source: escolhida.fonte,
      // Guarda as leituras de todas as fontes, inclusive as que falharam. E
      // isso que permite, meses depois, explicar por que o pedido daquele dia
      // foi cobrado naquela taxa.
      source_reference: JSON.stringify({
        leituras,
        divergencia_percent: Number(divergencia.toFixed(4)),
        margem_percent: margem,
      }),
      is_demo: false,
    });
    if (error) throw error;

    run.success();
    run.note('rate', escolhida.taxa);
    run.note('effective_rate', effective);
    run.note('divergencia_percent', Number(divergencia.toFixed(4)));
    await run.finish();
    return json({
      rate: escolhida.taxa,
      source: escolhida.fonte,
      spread_percent: spread,
      effective_rate: effective,
      divergencia_percent: Number(divergencia.toFixed(4)),
      leituras,
    }, 200, origin);
  } catch (error) {
    await run.finish(error);
    return json({ error: 'sync_failed', detail: String(error) }, 500, origin);
  }
});
