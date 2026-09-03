import { adminClient } from '../_shared/client.ts';
import { corsHeaders, json } from '../_shared/cors.ts';

/**
 * Conferencia automatica pos-sorteio (secao 23).
 *
 * Sequencia:
 *   1. recebe o resultado da fonte configurada e registra a origem;
 *   2. compara todos os bilhetes do sorteio (compare_all_tickets);
 *   3. abre um processo de resgate por bilhete premiado, em estado "detectado";
 *   4. notifica o cliente.
 *
 * O que esta funcao NAO faz, por decisao explicita:
 *   - nao marca premio como definitivo sem resultado oficial;
 *   - nao dispara nenhum pagamento;
 *   - nao fecha processo de resgate automaticamente.
 */
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });

  const secret = req.headers.get('x-sync-secret');
  if (!secret || secret !== Deno.env.get('SYNC_SECRET')) {
    return json({ error: 'unauthorized' }, 401, origin);
  }

  let body: { draw_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, origin);
  }
  if (!body.draw_id) return json({ error: 'draw_id_required' }, 400, origin);

  const admin = adminClient();

  const { data: result } = await admin
    .from('draw_results')
    .select('id, is_official, source')
    .eq('draw_id', body.draw_id)
    .maybeSingle();

  if (!result) return json({ error: 'result_not_available' }, 404, origin);

  // A conferencia roda mesmo com resultado preliminar (para avisar cedo), mas
  // o proprio banco mantem prize_confirmed = false ate a validacao oficial.
  const { data: comparison, error } = await admin.rpc('compare_all_tickets', {
    p_draw_id: body.draw_id,
  });
  if (error) return json({ error: 'comparison_failed', detail: error.message }, 500, origin);

  // Notifica os premiados. Texto deliberadamente cauteloso enquanto o
  // resultado nao e oficial.
  const { data: winners } = await admin
    .from('tickets')
    .select('id, user_id, order_id')
    .eq('draw_id', body.draw_id)
    .eq('won', true);

  for (const ticket of winners ?? []) {
    await admin.from('notifications').insert({
      user_id: ticket.user_id,
      event_key: 'ticket_won',
      title: result.is_official
        ? 'Seu bilhete foi premiado'
        : 'Possível premiação no seu bilhete',
      body: result.is_official
        ? 'A conferência identificou premiação. Veja os detalhes e o processo de recebimento.'
        : 'A conferência preliminar indicou acerto. O prêmio só é confirmado após a validação do resultado oficial.',
      priority: 'high',
      action_url: `/meus-jogos/premio/${ticket.id}`,
    });
  }

  await admin.rpc('write_audit_log', {
    p_action: 'draw.compare_tickets',
    p_entity: 'draws',
    p_entity_id: body.draw_id,
    p_new: { ...comparison, source: result.source, is_official: result.is_official },
    p_severity: 'warning',
  });

  return json(comparison, 200, origin);
});
