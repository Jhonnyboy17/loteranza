import { requireSupabase } from '@/lib/supabase';

/**
 * Cliente da Edge Function de pagamento.
 *
 * O navegador NUNCA fala com o Mercado Pago. Ele chama a nossa funcao, que
 * guarda o access token como secret e conversa com o provedor pelo servidor.
 * Isso vale para os dois meios:
 *
 *  - PIX: a funcao devolve o QR e o codigo copia-e-cola, que sao publicos por
 *    natureza (qualquer um que os tenha so consegue PAGAR, nunca receber);
 *  - cartao: a funcao devolve a URL do Checkout Pro e o cliente conclui no
 *    ambiente do Mercado Pago. Nenhum dado de cartao passa por aqui.
 *
 * O valor nao viaja daqui. Quem decide quanto cobrar e `begin_payment()` no
 * banco, lendo a propria linha do pedido.
 */

export interface PixCharge {
  /** Codigo copia-e-cola (payload EMV do PIX). */
  qrCode: string;
  /** Imagem do QR em base64, sem o prefixo data:. */
  qrCodeBase64: string | null;
  /** Pagina do comprovante no provedor, quando houver. */
  ticketUrl: string | null;
  expiresAt: string | null;
}

export type PaymentStart =
  | { method: 'pix'; paymentId: string; amount: number; currency: string; pix: PixCharge }
  | { method: 'card'; paymentId: string; amount: number; currency: string; redirectUrl: string };

export interface StartPaymentInput {
  orderId: string;
  providerKey: string;
  /** Somente para PIX. Nao e persistido: segue para o provedor e acaba ali. */
  payerCpf?: string;
  payerName?: string;
  payerEmail?: string;
}

/** Erro com a mensagem do servidor preservada, para a tela poder explicar. */
export class PaymentError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

export async function startPayment(input: StartPaymentInput): Promise<PaymentStart> {
  const { data, error } = await requireSupabase().functions.invoke('create-payment', {
    body: {
      order_id: input.orderId,
      provider_key: input.providerKey,
      payer: input.payerCpf
        ? { cpf: input.payerCpf, name: input.payerName, email: input.payerEmail }
        : undefined,
    },
  });

  if (error) {
    // A funcao devolve o motivo no corpo mesmo em erro; preferimos ele a
    // "Edge Function returned a non-2xx status code", que nao ajuda ninguem.
    const detail = (error as { context?: { body?: unknown } }).context?.body;
    const parsed = typeof detail === 'string' ? safeParse(detail) : detail;
    const reason = (parsed as { reason?: string; error?: string } | null)?.reason
      ?? (parsed as { error?: string } | null)?.error;
    throw new PaymentError(reason ?? error.message);
  }

  const payload = data as Record<string, unknown>;
  if (payload.method === 'pix') {
    const pix = (payload.pix ?? {}) as Record<string, unknown>;
    return {
      method: 'pix',
      paymentId: String(payload.payment_id),
      amount: Number(payload.amount),
      currency: String(payload.currency),
      pix: {
        qrCode: String(pix.qr_code ?? ''),
        qrCodeBase64: (pix.qr_code_base64 as string) ?? null,
        ticketUrl: (pix.ticket_url as string) ?? null,
        expiresAt: (pix.expires_at as string) ?? null,
      },
    };
  }

  return {
    method: 'card',
    paymentId: String(payload.payment_id),
    amount: Number(payload.amount),
    currency: String(payload.currency),
    redirectUrl: String(payload.redirect_url),
  };
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export type PaymentWatchStatus =
  | 'initiated' | 'pending' | 'authorized' | 'captured'
  | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded' | 'chargeback' | 'demo';

/**
 * Le o estado da propria cobranca.
 *
 * A RLS de `payments` ja limita ao dono, entao a consulta e direta e nao
 * precisa de funcao. Quem decide o estado e o webhook, nunca esta leitura:
 * aqui so observamos.
 */
export async function readPaymentStatus(paymentId: string): Promise<PaymentWatchStatus | null> {
  const { data, error } = await requireSupabase()
    .from('payments')
    .select('status')
    .eq('id', paymentId)
    .maybeSingle();

  if (error) throw new PaymentError(error.message);
  return (data?.status as PaymentWatchStatus) ?? null;
}
