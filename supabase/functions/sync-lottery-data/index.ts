import { adminClient } from '../_shared/client.ts';
import { corsHeaders, json } from '../_shared/cors.ts';

/**
 * Sincronizacao de jackpots e calendario a partir da fonte de dados.
 *
 * Ponto importante: o navegador NUNCA fala com a fonte. Esta funcao roda no
 * servidor (agendada), o que evita scraping fragil no frontend e mantem a
 * chave da API fora do cliente.
 *
 * Enquanto LOTTERY_DATA_PROVIDER for "demo", a funcao apenas regenera o
 * calendario e nao inventa jackpot: um valor ausente permanece ausente.
 * Jackpot falso e proibido por decisao de projeto.
 */
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });

  // Protegida por segredo compartilhado: chamada por agendador, nao por usuario.
  const secret = req.headers.get('x-sync-secret');
  if (!secret || secret !== Deno.env.get('SYNC_SECRET')) {
    return json({ error: 'unauthorized' }, 401, origin);
  }

  const admin = adminClient();
  const provider = Deno.env.get('LOTTERY_DATA_PROVIDER') ?? 'demo';

  const { data: games } = await admin
    .from('lottery_games').select('id, game_key, status').eq('status', 'active');

  const summary: Record<string, unknown>[] = [];

  for (const game of games ?? []) {
    // Sempre mantem o calendario em dia a partir da configuracao do jogo.
    const { data: created } = await admin.rpc('generate_upcoming_draws', {
      p_game_id: game.id,
      p_count: 8,
    });

    let jackpot: number | null = null;
    if (provider !== 'demo') {
      // TODO(integração): consultar a fonte licenciada e preencher `jackpot`.
      // Enquanto não houver integração, NÃO escrevemos valor algum — melhor
      // exibir "valor não informado" do que um número inventado.
      jackpot = null;
    }

    if (jackpot !== null) {
      await admin
        .from('lottery_games')
        .update({ current_jackpot: jackpot, jackpot_updated_at: new Date().toISOString() })
        .eq('id', game.id);
    }

    summary.push({ game: game.game_key, draws_created: created, jackpot_updated: jackpot !== null });
  }

  await admin.rpc('write_audit_log', {
    p_action: 'data.sync',
    p_entity: 'lottery_games',
    p_new: { provider, summary },
    p_severity: 'info',
  });

  return json({ provider, summary }, 200, origin);
});
