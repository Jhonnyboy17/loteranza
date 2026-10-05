import { adminClient } from '../_shared/client.ts';
import { corsHeaders, json } from '../_shared/cors.ts';
import { type GameSpec, isDemoOnly, lotteryProviders } from '../_shared/providers/index.ts';
import { requireSyncSecret } from '../_shared/syncAuth.ts';
import { SyncRun } from '../_shared/syncRun.ts';

/**
 * Ingestao de resultados, em DOIS estagios.
 *
 *   ?stage=numbers    numeros sorteados, logo apos o sorteio
 *   ?stage=breakdown  quantos ganharam cada faixa, horas depois
 *
 * Sao separados porque as duas coisas nao sao publicadas juntas: os numeros
 * saem minutos depois do sorteio, enquanto a quebra depende de fechar a
 * apuracao das vendas (o premio e pari-mutuel). Uma chamada so gravaria a
 * quebra como nula e nunca voltaria nela.
 *
 * O que esta funcao NAO faz, por decisao:
 *   - nao decide se um resultado e oficial. Ela registra o que CADA fonte
 *     disse em draw_result_observations e chama reconcile_draw_result(), que
 *     promove a oficial apenas quando duas fontes concordam;
 *   - nao sobrescreve a leitura de uma fonte com a de outra — a divergencia e
 *     justamente o que precisa sobreviver para aparecer no painel;
 *   - nao confirma premio nem dispara pagamento.
 */
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });

  const auth = requireSyncSecret(req, origin);
  if (!auth.ok) return auth.response;

  const stage = new URL(req.url).searchParams.get('stage') ?? 'numbers';
  if (stage !== 'numbers' && stage !== 'breakdown') {
    return json({ error: 'invalid_stage', allowed: ['numbers', 'breakdown'] }, 400, origin);
  }

  const admin = adminClient();
  let providers;
  try {
    providers = lotteryProviders();
  } catch (error) {
    // Nome de provedor errado nos secrets: falha ruidosa e registrada, em vez
    // de cair em demo e parar de atualizar sem ninguem perceber.
    const run = await SyncRun.start(admin, `results.${stage}`, 'invalid');
    await run.finish(error);
    return json({ error: 'provider_misconfigured', detail: String(error) }, 500, origin);
  }

  const run = await SyncRun.start(admin, `results.${stage}`, providers.map((p) => p.name).join(','));

  if (isDemoOnly(providers)) {
    run.note('skipped', 'nenhuma fonte real configurada (LOTTERY_DATA_PROVIDERS)');
    await run.finish();
    return json({ skipped: true, reason: 'demo_provider_only' }, 200, origin);
  }

  try {
    const result = stage === 'numbers'
      ? await ingestNumbers(admin, providers, run)
      : await ingestBreakdown(admin, providers, run);
    await run.finish();
    return json(result, 200, origin);
  } catch (error) {
    await run.finish(error);
    return json({ error: 'ingest_failed', detail: String(error) }, 500, origin);
  }
});

/** As contagens vem do banco, nunca do codigo: e o que permite um provedor
 *  interpretar formatos diferentes sem fixar as regras de cada jogo. */
function gameSpec(joined: unknown): GameSpec {
  const g = joined as { game_key: string; main_numbers_count: number; special_numbers_count: number };
  return {
    gameKey: g.game_key,
    mainCount: g.main_numbers_count,
    specialCount: g.special_numbers_count,
  };
}

/**
 * Sorteios ja realizados, nos ultimos dias, ainda sem resultado oficial.
 *
 * O `!draws_game_id_fkey` nao e enfeite: existem DOIS caminhos entre draws e
 * lottery_games (draws.game_id aponta para o jogo, e lottery_games.next_draw_id
 * aponta de volta para o sorteio). Sem dizer qual usar, o PostgREST recusa a
 * consulta com PGRST201 em vez de escolher um.
 *
 * E o erro PRECISA ser conferido: com `data ?? []` a recusa virava lista
 * vazia, a rotina respondia "0 sorteios examinados" e marcava sucesso. Ficou
 * invisivel enquanto so havia provedor demo, porque a funcao saia antes de
 * chegar aqui; apareceu no minuto em que uma fonte real foi ligada.
 */
async function pendingDraws(admin: ReturnType<typeof adminClient>, days: number) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await admin
    .from('draws')
    .select('id, draw_date, draw_at, game_id, lottery_games!draws_game_id_fkey!inner(game_key, main_numbers_count, special_numbers_count)')
    .lt('draw_at', new Date().toISOString())
    .gte('draw_at', since)
    .order('draw_at', { ascending: false });
  if (error) throw new Error(`listar sorteios pendentes: ${error.message}`);
  return data ?? [];
}

async function ingestNumbers(
  admin: ReturnType<typeof adminClient>,
  providers: ReturnType<typeof lotteryProviders>,
  run: SyncRun,
) {
  const draws = await pendingDraws(admin, 7);
  const outcome: Record<string, unknown>[] = [];

  for (const draw of draws) {
    const game = gameSpec(draw.lottery_games);

    for (const provider of providers) {
      try {
        const reading = await provider.fetchDrawNumbers(game, draw.draw_date);
        // null nao e erro: significa que a fonte ainda nao publicou.
        if (!reading) continue;

        // O erro PRECISA ser conferido: o banco valida a leitura contra as
        // regras do jogo (validate_draw_observation) e recusa numero fora da
        // faixa, dezena repetida ou quantidade errada. Ignorar o retorno
        // transformaria essa recusa em "sucesso" no diario de execucao, que e
        // pior do que nao ter a trava.
        const { error: obsError } = await admin.from('draw_result_observations').upsert({
          draw_id: draw.id,
          source: provider.name,
          main_numbers: reading.mainNumbers,
          special_numbers: reading.specialNumbers,
          multiplier: reading.multiplier ?? null,
          jackpot_amount: reading.jackpotAmount ?? null,
          jackpot_won: reading.jackpotWon ?? null,
          winners_count: reading.winnersCount ?? null,
          source_reference: reading.sourceReference ?? null,
          raw_payload: reading.raw ?? null,
          observed_at: new Date().toISOString(),
        }, { onConflict: 'draw_id,source' });

        if (obsError) {
          throw new Error(`leitura recusada pelo banco: ${obsError.message}`);
        }

        run.success();
      } catch (error) {
        // Falha de uma fonte num sorteio nao derruba o lote: as demais
        // leituras ainda valem, e e delas que sai a concordancia.
        run.failure();
        outcome.push({ draw: draw.draw_date, game: game.gameKey, provider: provider.name, error: String(error) });
      }
    }

    const { data: verdict, error: verdictError } = await admin
      .rpc('reconcile_draw_result', { p_draw_id: draw.id });
    if (verdictError) {
      // Conciliacao que falha em silencio deixaria leituras gravadas sem
      // nunca virarem resultado, e o painel diria que tudo correu bem.
      run.failure();
      outcome.push({ draw: draw.draw_date, game: game.gameKey, error: `conciliacao: ${verdictError.message}` });
    } else if (verdict && (verdict as { status?: string }).status !== 'NO_OBSERVATIONS') {
      outcome.push({ draw: draw.draw_date, game: game.gameKey, ...(verdict as object) });
    }
  }

  run.note('draws', outcome);
  return { stage: 'numbers', draws_examined: draws.length, outcome };
}

async function ingestBreakdown(
  admin: ReturnType<typeof adminClient>,
  providers: ReturnType<typeof lotteryProviders>,
  run: SyncRun,
) {
  // So faz sentido buscar a quebra de sorteio que ja tem resultado conhecido.
  // O embed aninhado de lottery_games precisa da mesma desambiguacao de FK que
  // pendingDraws, pelo mesmo motivo.
  const { data: results, error: resultsError } = await admin
    .from('draw_results')
    .select('draw_id, draws!inner(draw_date, draw_at, lottery_games!draws_game_id_fkey!inner(game_key, main_numbers_count, special_numbers_count))')
    .gte('draws.draw_at', new Date(Date.now() - 14 * 86_400_000).toISOString());
  if (resultsError) throw new Error(`listar resultados sem quebra: ${resultsError.message}`);

  const outcome: Record<string, unknown>[] = [];

  for (const row of results ?? []) {
    const draw = row.draws as unknown as { draw_date: string; lottery_games: unknown };
    const game = gameSpec(draw.lottery_games);

    const { count, error: countError } = await admin
      .from('draw_prize_breakdown')
      .select('id', { count: 'exact', head: true })
      .eq('draw_id', row.draw_id);
    // Contagem que falha em silencio viraria 0, e a rotina buscaria de novo
    // uma quebra que ja esta gravada.
    if (countError) throw new Error(`contar quebra existente: ${countError.message}`);
    if ((count ?? 0) > 0) continue; // ja temos a quebra deste sorteio

    for (const provider of providers) {
      try {
        const tiers = await provider.fetchPrizeBreakdown(game, draw.draw_date);
        // null aqui costuma ser "ainda nao publicada", nao erro: a rotina
        // volta no proximo agendamento.
        if (!tiers || tiers.length === 0) continue;

        const { data: applied, error: applyError } = await admin.rpc('upsert_prize_breakdown', {
          p_draw_id: row.draw_id,
          p_rows: tiers.map((t) => ({ tier_key: t.tierKey, winners: t.winners, amount: t.amount })),
        });
        if (applyError) {
          throw new Error(`gravar quebra por faixa: ${applyError.message}`);
        }

        run.success();
        outcome.push({ draw: draw.draw_date, game: game.gameKey, provider: provider.name, ...(applied as object) });
        break; // a quebra de uma fonte basta; nao ha o que conciliar aqui
      } catch (error) {
        run.failure();
        outcome.push({ draw: draw.draw_date, game: game.gameKey, provider: provider.name, error: String(error) });
      }
    }
  }

  run.note('breakdowns', outcome);
  return { stage: 'breakdown', results_examined: results?.length ?? 0, outcome };
}
