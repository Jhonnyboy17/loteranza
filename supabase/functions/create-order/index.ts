import { adminClient, requireUser, userClient } from '../_shared/client.ts';
import { corsHeaders, json } from '../_shared/cors.ts';

/**
 * Criacao de pedido — precificacao e elegibilidade decididas no servidor.
 *
 * Pontos deliberados:
 *  - O preco NUNCA vem do cliente. Ele e recalculado a partir de lottery_games.
 *  - Os limites de cada jogo (quantidade de numeros, faixa, maximo de linhas)
 *    sao validados aqui; o navegador pode ser contornado, esta funcao nao.
 *  - A cotacao usada e capturada e gravada no pedido; nao muda depois.
 *  - Sem APPROVED do Compliance Engine, o pedido nasce como demo e nao segue
 *    para pagamento.
 */

interface LineInput {
  numbers: number[];
  special_numbers: number[];
  is_quick_pick?: boolean;
  options?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);

  const user = await requireUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401, origin);

  let body: {
    game_key?: string;
    draw_id?: string;
    draws_count?: number;
    lines?: LineInput[];
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, origin);
  }

  const admin = adminClient();

  const { data: game } = await admin
    .from('lottery_games').select('*').eq('game_key', body.game_key ?? '').maybeSingle();
  if (!game) return json({ error: 'game_not_found' }, 404, origin);
  if (game.status !== 'active') return json({ error: 'game_not_active' }, 409, origin);

  const lines = body.lines ?? [];
  const drawsCount = Math.max(1, Math.min(body.draws_count ?? 1, game.max_draws_ahead));

  if (lines.length === 0) return json({ error: 'no_lines' }, 400, origin);
  if (lines.length > game.max_lines_per_order) {
    return json({ error: 'too_many_lines', max: game.max_lines_per_order }, 400, origin);
  }

  // Validacao de cada linha contra a configuracao da modalidade.
  for (const [index, line] of lines.entries()) {
    const invalid = validateLine(line, game);
    if (invalid) return json({ error: 'invalid_line', line: index, reason: invalid }, 400, origin);
  }

  // Prazo do sorteio: pedido nao entra depois do encerramento das vendas.
  const { data: draw } = await admin
    .from('draws').select('*').eq('id', body.draw_id ?? '').maybeSingle();
  if (!draw) return json({ error: 'draw_not_found' }, 404, origin);
  if (new Date(draw.sales_close_at).getTime() <= Date.now()) {
    return json({ error: 'sales_closed' }, 409, origin);
  }

  // Cotacao vigente, congelada no pedido.
  const { data: rate } = await admin
    .from('exchange_rates')
    .select('*')
    .eq('base_currency', game.currency)
    .eq('quote_currency', 'BRL')
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Preco calculado aqui, a partir do banco.
  let official = 0;
  let fee = 0;
  for (const line of lines) {
    const multiplier = line.options?.multiplier === true ? Number(game.multiplier_price) : 0;
    official += (Number(game.official_price) + multiplier) * drawsCount;
    fee += (Number(game.service_fee) +
      Number(game.official_price) * Number(game.service_fee_percent)) * drawsCount;
  }
  official = round2(official);
  fee = round2(fee);
  const total = round2(official + fee);

  // Compliance ANTES de criar qualquer coisa cobravel.
  const { data: verdict } = await admin.rpc('evaluate_compliance', {
    p_user_id: user.id,
    p_order_id: null,
    p_country: req.headers.get('cf-ipcountry') ?? req.headers.get('x-vercel-ip-country'),
    p_state: req.headers.get('x-vercel-ip-country-region'),
    p_amount: total,
    p_game_key: game.game_key,
  });

  const approved = verdict?.status === 'APPROVED';

  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      user_id: user.id,
      status: approved ? 'pending_payment' : 'compliance_review',
      currency: game.currency,
      official_ticket_cost: official,
      service_fee: fee,
      tax: 0,
      total,
      display_currency: 'BRL',
      exchange_rate: rate?.effective_rate ?? null,
      exchange_rate_id: rate?.id ?? null,
      exchange_rate_at: rate?.captured_at ?? null,
      total_display: rate ? round2(total * Number(rate.effective_rate)) : null,
      game_id: game.id,
      draw_id: draw.id,
      draws_count: drawsCount,
      compliance_status: verdict?.status ?? 'NOT_EVALUATED',
      compliance_evaluated_at: new Date().toISOString(),
      // Sem aprovacao, o pedido e explicitamente demonstrativo.
      is_demo: !approved,
      purchase_deadline: draw.sales_close_at,
    })
    .select()
    .single();

  if (orderError) return json({ error: 'order_failed', detail: orderError.message }, 500, origin);

  const { error: linesError } = await admin.from('order_lines').insert(
    lines.map((line, index) => ({
      order_id: order.id,
      game_id: game.id,
      line_index: index,
      numbers: line.numbers,
      special_numbers: line.special_numbers,
      is_quick_pick: line.is_quick_pick ?? false,
      options: line.options ?? {},
      quantity: 1,
      unit_official_price:
        (Number(game.official_price) +
          (line.options?.multiplier === true ? Number(game.multiplier_price) : 0)) * drawsCount,
      unit_service_fee:
        (Number(game.service_fee) +
          Number(game.official_price) * Number(game.service_fee_percent)) * drawsCount,
      line_total: 0,
    })),
  );
  if (linesError) {
    await admin.from('orders').delete().eq('id', order.id);
    return json({ error: 'lines_failed', detail: linesError.message }, 500, origin);
  }

  // Recalculo final no banco — fonte de verdade do total.
  await admin.rpc('calculate_order_totals', { p_order_id: order.id });

  // p_actor explicito: esta chamada usa a service role, onde auth.uid() e nulo.
  await admin.rpc('write_audit_log', {
    p_actor: user.id,
    p_action: 'order.create',
    p_entity: 'orders',
    p_entity_id: order.id,
    p_new: { total, approved, lines: lines.length },
    p_severity: 'info',
  });

  const { data: finalOrder } = await userClient(req)
    .from('orders').select('*').eq('id', order.id).single();

  return json({ order: finalOrder, compliance: verdict }, 201, origin);
});

/** Valida uma linha contra a configuracao da modalidade. */
function validateLine(line: LineInput, game: Record<string, number | string>): string | null {
  const mainCount = Number(game.main_numbers_count);
  const mainMin = Number(game.main_number_min);
  const mainMax = Number(game.main_number_max);
  const specialCount = Number(game.special_numbers_count);
  const specialMin = Number(game.special_number_min);
  const specialMax = Number(game.special_number_max);

  if (!Array.isArray(line.numbers) || line.numbers.length !== mainCount) {
    return `esperado ${mainCount} numeros principais`;
  }
  if (line.numbers.some((n) => !Number.isInteger(n) || n < mainMin || n > mainMax)) {
    return `numeros principais fora da faixa ${mainMin}-${mainMax}`;
  }
  // Modalidades de digitos (faixa iniciando em 0) admitem repeticao.
  if (mainMin > 0 && new Set(line.numbers).size !== line.numbers.length) {
    return 'numeros principais repetidos';
  }

  const special = line.special_numbers ?? [];
  if (special.length !== specialCount) {
    return `esperado ${specialCount} numero(s) especial(is)`;
  }
  if (special.some((n) => !Number.isInteger(n) || n < specialMin || n > specialMax)) {
    return `numero especial fora da faixa ${specialMin}-${specialMax}`;
  }
  return null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
