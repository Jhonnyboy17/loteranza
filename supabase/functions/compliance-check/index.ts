import { adminClient, requireUser, userClient } from '../_shared/client.ts';
import { json, preflight } from '../_shared/cors.ts';

/**
 * COMPLIANCE ENGINE — avaliacao autoritativa.
 *
 * O veredito que vale e este. A versao que roda no navegador serve apenas para
 * explicar ao usuario o que falta; ela nao pode liberar nada.
 *
 * O país/estado usados na decisao vem do SERVIDOR:
 *   - país do IP da requisicao (cabecalho da borda), e
 *   - coordenadas capturadas pelo dispositivo, quando houver.
 * O corpo da requisicao NAO pode escolher a jurisdicao. Um país enviado pelo
 * cliente e ignorado — e essa e a razao de a funcao existir.
 */
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);

  const user = await requireUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401, origin);

  let body: { order_id?: string; amount?: number; game_key?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, origin);
  }

  // País resolvido pela borda. Nunca aceito do corpo da requisicao.
  const ipCountry =
    req.headers.get('cf-ipcountry') ??
    req.headers.get('x-vercel-ip-country') ??
    null;
  const ipState = req.headers.get('x-vercel-ip-country-region') ?? null;

  const admin = adminClient();

  // Último sinal de geolocalizacao gravado pelo servidor para este usuario.
  const { data: geo } = await admin
    .from('geolocation_events')
    .select('country, state, mismatch_flag, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Divergencia entre GPS e IP nao e resolvida escolhendo a opcao conveniente:
  // ela bloqueia e vai para revisao.
  const geoIsFresh =
    geo?.created_at != null &&
    Date.now() - new Date(geo.created_at).getTime() < 30 * 60_000;

  if (geo?.mismatch_flag && geoIsFresh) {
    return json(
      {
        status: 'PENDING_REVIEW',
        checks: [
          {
            kind: 'jurisdiction_check',
            passed: false,
            reason_code: 'GEO_IP_MISMATCH',
            reason_message:
              'A localização do dispositivo e a do endereço de rede divergem. O pedido foi enviado para revisão.',
          },
        ],
      },
      200,
      origin,
    );
  }

  const country = (geoIsFresh ? geo?.country : null) ?? ipCountry;
  const state = (geoIsFresh ? geo?.state : null) ?? ipState;

  // Se o pedido foi informado, ele precisa pertencer ao usuario autenticado.
  if (body.order_id) {
    const { data: order } = await userClient(req)
      .from('orders').select('id, user_id, total').eq('id', body.order_id).maybeSingle();
    if (!order || order.user_id !== user.id) {
      return json({ error: 'order_not_found' }, 404, origin);
    }
  }

  const { data, error } = await admin.rpc('evaluate_compliance', {
    p_user_id: user.id,
    p_order_id: body.order_id ?? null,
    p_country: country,
    p_state: state,
    p_amount: body.amount ?? 0,
    p_game_key: body.game_key ?? null,
  });

  if (error) return json({ error: 'evaluation_failed', detail: error.message }, 500, origin);

  // p_actor explicito: esta chamada usa a service role, onde auth.uid() e nulo.
  // Sem ele a trilha de auditoria registraria a avaliacao sem autor.
  await admin.rpc('write_audit_log', {
    p_actor: user.id,
    p_action: 'compliance.evaluate',
    p_entity: 'compliance_checks',
    p_entity_id: body.order_id ?? user.id,
    p_new: data,
    p_severity: 'info',
  });

  return json(data, 200, origin);
});
