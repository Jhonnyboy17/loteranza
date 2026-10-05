import { adminClient } from '../_shared/client.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { isDemoOnly, lotteryProviders } from '../_shared/providers/index.ts';
import { requireSyncSecret } from '../_shared/syncAuth.ts';
import { SyncRun } from '../_shared/syncRun.ts';

/**
 * Calendario de sorteios e valores de jackpot.
 *
 * O navegador NUNCA fala com a fonte: isso evita scraping fragil no cliente e
 * mantem a chave da API fora do bundle.
 *
 * O calendario e regenerado sempre, porque sai da configuracao do proprio
 * jogo (dias e horario em lottery_games) e nao depende de fonte externa. Ja o
 * jackpot so e escrito quando a fonte devolve um numero: valor ausente
 * permanece ausente, e `jackpot_updated_at` nao e tocado. Isso importa porque
 * a interface usa esse carimbo para decidir se ainda pode apresentar o valor
 * como atual — carimbar sem ter dado novo faria a tela mentir que o valor foi
 * confirmado agora, que e o pior resultado possivel desta rotina.
 */
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });

  const auth = requireSyncSecret(req, origin);
  if (!auth.ok) return auth.response;

  const admin = adminClient();
  let providers;
  try {
    providers = lotteryProviders();
  } catch (error) {
    const run = await SyncRun.start(admin, 'jackpots', 'invalid');
    await run.finish(error);
    return json({ error: 'provider_misconfigured', detail: String(error) }, 500, origin);
  }

  const run = await SyncRun.start(admin, 'jackpots', providers.map((p) => p.name).join(','));

  try {
    const { data: games } = await admin
      .from('lottery_games').select('id, game_key').eq('status', 'active');
    const list = games ?? [];
    const summary: Record<string, unknown>[] = [];

    // 1) Calendario: nao depende de fonte externa.
    for (const game of list) {
      const { data: created } = await admin.rpc('generate_upcoming_draws', {
        p_game_id: game.id, p_count: 8,
      });
      summary.push({ game: game.game_key, draws_created: created ?? 0 });
    }

    // 2) Jackpots: so com fonte real.
    if (isDemoOnly(providers)) {
      run.note('jackpots', 'nenhuma fonte real configurada (LOTTERY_DATA_PROVIDERS)');
      run.success(list.length);
      await run.finish();
      return json({ calendar: summary, jackpots: 'skipped_demo_provider' }, 200, origin);
    }

    // A primeira fonte da lista e a de referencia para valor anunciado. Nao ha
    // conciliacao aqui, ao contrario do resultado: jackpot e estimativa que a
    // propria loteria revisa, entao divergir entre fontes e normal e nao
    // indica erro.
    const [primary] = providers;
    const snapshots = await primary.fetchJackpots(list.map((g) => g.game_key));

    for (const snap of snapshots) {
      const game = list.find((g) => g.game_key === snap.gameKey);
      if (!game) continue;
      if (snap.jackpot === null) { run.failure(); continue; }

      const { error } = await admin.from('lottery_games').update({
        current_jackpot: snap.jackpot,
        current_jackpot_cash: snap.cashValue,
        jackpot_updated_at: new Date().toISOString(),
      }).eq('id', game.id);

      if (error) { run.failure(); continue; }
      run.success();
      summary.push({ game: snap.gameKey, jackpot: snap.jackpot });
    }

    run.note('summary', summary);
    await run.finish();
    return json({ provider: primary.name, summary }, 200, origin);
  } catch (error) {
    await run.finish(error);
    return json({ error: 'sync_failed', detail: String(error) }, 500, origin);
  }
});
