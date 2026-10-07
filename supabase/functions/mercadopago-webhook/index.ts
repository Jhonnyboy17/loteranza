import { adminClient } from '../_shared/client.ts';
import { json, preflight } from '../_shared/cors.ts';
import { mapStatus, readPayment, verifySignature } from '../_shared/mercadopago.ts';

/**
 * Notificacoes do Mercado Pago.
 *
 * TRES REGRAS QUE NAO MUDAM
 *
 *   1. Assinatura primeiro. Sem x-signature valido a notificacao e registrada
 *      como recusada e nao move nada. Este endereco e publico: qualquer um
 *      pode chamar, e sem a conferencia qualquer um marcaria pedido como pago.
 *
 *   2. O corpo nao decide nada. Ele diz apenas QUAL pagamento mudou; o estado
 *      vem da releitura na API do provedor, autenticada com o nosso token.
 *      Confiar no corpo e aceitar que quem forjar a notificacao escolha o
 *      status.
 *
 *   3. Idempotencia no banco. O Mercado Pago reenvia a mesma notificacao por
 *      desenho, entao a unicidade de (provider, external_id) em
 *      payment_webhook_events e o que torna o reenvio inofensivo.
 *
 * Responde 200 mesmo em recusa: o provedor reenfileira o que nao for 2xx, e
 * reenviar uma notificacao invalida nao melhora nada. O que importa fica
 * registrado na tabela, legivel pelo painel.
 */
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);

  const admin = adminClient();
  const rawBody = await req.text();

  let payload: { id?: unknown; type?: string; action?: string; data?: { id?: unknown } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ received: true, handled: false, reason: 'corpo nao e JSON' }, 200, origin);
  }

  const dataId = payload.data?.id != null ? String(payload.data.id) : null;
  const topic = payload.type ?? payload.action ?? null;
  // Id do evento para idempotencia. O provedor manda `id` no envelope; quando
  // falta, o par (data.id + acao) ainda identifica a notificacao.
  const eventId = payload.id != null ? String(payload.id) : `${dataId}:${topic}`;

  const signatureOk = await verifySignature(
    req.headers.get('x-signature'),
    req.headers.get('x-request-id'),
    dataId,
  );

  // Registra ANTES de processar. Notificacao recusada tambem fica guardada:
  // e justamente ela que revela tentativa de forja.
  const { error: insertError } = await admin.from('payment_webhook_events').insert({
    provider: 'mercadopago',
    external_id: eventId,
    topic,
    signature_ok: signatureOk,
    payload,
  });

  // Violacao de unicidade = reenvio. Nada a fazer, e esse e o ponto.
  if (insertError) {
    if (insertError.code === '23505') {
      return json({ received: true, handled: false, reason: 'ja processada' }, 200, origin);
    }
    return json({ received: true, handled: false, reason: insertError.message }, 200, origin);
  }

  if (!signatureOk) {
    return json({ received: true, handled: false, reason: 'assinatura invalida' }, 200, origin);
  }

  // So notificacao de pagamento interessa; merchant_order e as demais sao
  // registradas e ignoradas.
  if (topic && !String(topic).startsWith('payment')) {
    await finish(admin, eventId, null, 'topico ignorado');
    return json({ received: true, handled: false, reason: 'topico ignorado' }, 200, origin);
  }

  if (!dataId) {
    await finish(admin, eventId, null, 'notificacao sem data.id');
    return json({ received: true, handled: false }, 200, origin);
  }

  try {
    const remote = await readPayment(dataId);

    // external_reference carrega o id da NOSSA tentativa. Sem ele nao ha o que
    // conciliar, e adivinhar pelo valor seria perigoso.
    if (!remote.externalReference) {
      await finish(admin, eventId, null, 'pagamento sem external_reference');
      return json({ received: true, handled: false }, 200, origin);
    }

    const { data: settled, error: settleError } = await admin.rpc('settle_payment', {
      p_payment_id: remote.externalReference,
      p_provider_txn: remote.id,
      p_status: mapStatus(remote.status),
      p_detail: {
        mp_status: remote.status,
        status_detail: remote.statusDetail,
        amount: remote.amount,
      },
    });

    if (settleError) {
      await finish(admin, eventId, remote.externalReference, settleError.message);
      return json({ received: true, handled: false, reason: settleError.message }, 200, origin);
    }

    await finish(admin, eventId, remote.externalReference, null);
    return json({ received: true, handled: true, result: settled }, 200, origin);
  } catch (error) {
    await finish(admin, eventId, null, String(error).slice(0, 500));
    return json({ received: true, handled: false, reason: String(error).slice(0, 300) }, 200, origin);
  }
});

async function finish(
  admin: ReturnType<typeof adminClient>,
  eventId: string,
  paymentId: string | null,
  errorMessage: string | null,
): Promise<void> {
  await admin.from('payment_webhook_events').update({
    processed_at: new Date().toISOString(),
    payment_id: paymentId,
    error_message: errorMessage,
  }).eq('provider', 'mercadopago').eq('external_id', eventId);
}
