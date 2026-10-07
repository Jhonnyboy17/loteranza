/**
 * Cliente do Mercado Pago.
 *
 * Tudo aqui roda no servidor. O access token nunca sai desta camada, e o
 * navegador nunca fala com o provedor: ele chama a nossa funcao, que chama o
 * Mercado Pago. Isso vale inclusive para o PIX, cujo QR e publico — a razao
 * nao e o sigilo do QR, e que o valor a cobrar precisa vir do banco.
 *
 * SOBRE O DESCRITOR
 *   `statement_descriptor` e sempre preenchido com a natureza real da
 *   operacao. Nao existe caminho neste arquivo para descrever a cobranca de
 *   outra forma, e isso e deliberado: disfarcar a operacao para o processador
 *   e uma das coisas que este projeto nao faz.
 */

const API = 'https://api.mercadopago.com';

export interface MpPayer {
  email?: string;
  firstName?: string;
  lastName?: string;
  /** Somente digitos. Nunca persistido do nosso lado. */
  cpf?: string;
}

export interface PixResult {
  providerPaymentId: string;
  status: string;
  statusDetail: string | null;
  qrCode: string | null;
  qrCodeBase64: string | null;
  ticketUrl: string | null;
  expiresAt: string | null;
}

export interface PreferenceResult {
  preferenceId: string;
  /** Endereco para onde o cliente e enviado. Em teste, o do sandbox. */
  checkoutUrl: string;
}

function token(): string {
  const value = (Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') ?? '').trim();
  if (value === '') {
    throw new Error(
      'MERCADOPAGO_ACCESS_TOKEN nao esta definido nos secrets desta Edge Function.',
    );
  }
  return value;
}

/** Credencial de teste comeca com TEST-; serve para o painel dizer o modo. */
export function isSandbox(): boolean {
  return token().startsWith('TEST-');
}

/**
 * Recusa do provedor, com o corpo cru preservado.
 *
 * `message` e uma frase para a tela; `raw` e o JSON inteiro, que vai para
 * `payments.failure_message` e serve para depurar meses depois. Sao coisas
 * diferentes e por isso ficam em campos diferentes: despejar o JSON na tela
 * do cliente nao ajuda ninguem a resolver nada.
 */
export class MercadoPagoError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly providerError: string | null,
    readonly raw: string,
  ) {
    super(message);
    this.name = 'MercadoPagoError';
  }
}

/**
 * Recusas conhecidas, traduzidas com o conserto junto.
 *
 * Sem isso o operador recebe "unauthorized" e precisa procurar na internet o
 * que o provedor quis dizer — foi exatamente o que aconteceu aqui.
 *
 * O PROVEDOR USA DOIS LUGARES PARA DIZER O QUE DEU ERRADO
 *   Em algumas recusas o codigo util esta em `error`
 *   ("invalid_back_urls"). Em outras `error` vem generico e o codigo util
 *   esta em `cause[0].code` — foi o caso do 401 de credenciais, que chegou
 *   como `{"error":"unauthorized", cause:[{"code":7, ...}]}`. Procurar so em
 *   `error` deixaria justamente esse de fora, entao os dois sao consultados.
 */
const POR_ERROR: Record<string, string> = {
  invalid_back_urls:
    'As URLs de retorno estao em formato invalido. Normalmente isso significa '
    + 'que o secret PUBLIC_SITE_URL nao esta definido nesta Edge Function.',
  invalid_users:
    'O pagador e o recebedor sao a mesma conta do Mercado Pago. Use outro '
    + 'e-mail de pagador, ou um usuario de teste.',
};

const POR_CAUSA: Record<string, string> = {
  // "Unauthorized use of live credentials"
  '7':
    'A chamada foi autenticada com credenciais de PRODUCAO que nao estao '
    + 'ativadas nesta conta do Mercado Pago. Dois caminhos: trocar o secret '
    + 'MERCADOPAGO_ACCESS_TOKEN pelo token de TESTE (comeca com TEST-) para '
    + 'seguir testando, ou concluir a ativacao das credenciais de producao no '
    + 'painel do Mercado Pago. Veja metadata.sandbox no registro do pagamento '
    + 'para confirmar qual credencial foi usada.',
};

async function call<T>(
  path: string,
  body: unknown,
  idempotencyKey: string,
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token()}`,
      'Content-Type': 'application/json',
      // Protege contra cobranca dupla quando a rede falha depois do provedor
      // ja ter criado o pagamento.
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });

  const text = await res.text();
  if (!res.ok) {
    let corpo: {
      message?: string;
      error?: string;
      cause?: Array<{ code?: unknown; description?: string }>;
    } | null = null;
    try {
      corpo = JSON.parse(text);
    } catch {
      corpo = null;
    }

    const codigo = typeof corpo?.error === 'string' ? corpo.error : null;
    const causa = corpo?.cause?.[0]?.code;
    const causaCodigo = causa === undefined || causa === null ? null : String(causa);
    const frase = corpo?.message
      ?? corpo?.cause?.[0]?.description
      ?? `HTTP ${res.status}`;
    const explicacao = (codigo ? POR_ERROR[codigo] : undefined)
      ?? (causaCodigo ? POR_CAUSA[causaCodigo] : undefined);

    throw new MercadoPagoError(
      explicacao ? `${frase}. ${explicacao}` : `Mercado Pago recusou: ${frase}`,
      res.status,
      // Prefere a causa especifica ao codigo generico: "7" distingue, e
      // "unauthorized" nao.
      causaCodigo !== null && POR_CAUSA[causaCodigo] ? `cause_${causaCodigo}` : codigo,
      text.slice(0, 1000),
    );
  }
  return JSON.parse(text) as T;
}

/** Cobranca PIX. Devolve o QR e o codigo copia-e-cola. */
export async function createPixPayment(input: {
  amount: number;
  description: string;
  descriptor: string;
  externalReference: string;
  notificationUrl: string;
  payer: MpPayer;
  expiresInMinutes: number;
}): Promise<PixResult> {
  const expiration = new Date(Date.now() + input.expiresInMinutes * 60_000);

  const payload: Record<string, unknown> = {
    transaction_amount: input.amount,
    description: input.description,
    statement_descriptor: input.descriptor,
    payment_method_id: 'pix',
    external_reference: input.externalReference,
    notification_url: input.notificationUrl,
    date_of_expiration: expiration.toISOString(),
    payer: {
      email: input.payer.email,
      first_name: input.payer.firstName,
      last_name: input.payer.lastName,
      ...(input.payer.cpf
        ? { identification: { type: 'CPF', number: input.payer.cpf } }
        : {}),
    },
  };

  const data = await call<{
    id: number | string;
    status: string;
    status_detail?: string;
    date_of_expiration?: string;
    point_of_interaction?: {
      transaction_data?: {
        qr_code?: string;
        qr_code_base64?: string;
        ticket_url?: string;
      };
    };
  }>('/v1/payments', payload, input.externalReference);

  const tx = data.point_of_interaction?.transaction_data;
  return {
    providerPaymentId: String(data.id),
    status: data.status,
    statusDetail: data.status_detail ?? null,
    qrCode: tx?.qr_code ?? null,
    qrCodeBase64: tx?.qr_code_base64 ?? null,
    ticketUrl: tx?.ticket_url ?? null,
    expiresAt: data.date_of_expiration ?? expiration.toISOString(),
  };
}

/** Checkout Pro: o cliente conclui o cartao no ambiente do Mercado Pago. */
export async function createCardPreference(input: {
  amount: number;
  title: string;
  descriptor: string;
  externalReference: string;
  notificationUrl: string;
  backUrls: { success: string; failure: string; pending: string };
  payerEmail?: string;
}): Promise<PreferenceResult> {
  const data = await call<{
    id: string;
    init_point?: string;
    sandbox_init_point?: string;
  }>('/checkout/preferences', {
    items: [{
      title: input.title,
      quantity: 1,
      unit_price: input.amount,
      currency_id: 'BRL',
    }],
    statement_descriptor: input.descriptor,
    external_reference: input.externalReference,
    notification_url: input.notificationUrl,
    back_urls: input.backUrls,
    auto_return: 'approved',
    // PIX tem fluxo proprio nesta plataforma, com QR na propria tela. Deixar
    // os dois caminhos levaria o cliente a uma segunda tela de PIX, diferente
    // da nossa, sem a confirmacao automatica.
    payment_methods: {
      excluded_payment_types: [{ id: 'ticket' }, { id: 'bank_transfer' }],
    },
    ...(input.payerEmail ? { payer: { email: input.payerEmail } } : {}),
  }, input.externalReference);

  const url = isSandbox()
    ? (data.sandbox_init_point ?? data.init_point)
    : data.init_point;

  if (!url) {
    throw new Error('Mercado Pago nao devolveu endereco de checkout.');
  }
  return { preferenceId: data.id, checkoutUrl: url };
}

/**
 * Releitura do pagamento no provedor.
 *
 * O webhook NUNCA confia no corpo da notificacao para decidir estado: a
 * notificacao diz apenas qual pagamento mudou. Quem tem autoridade sobre o
 * status e esta consulta, autenticada com o nosso token.
 */
export async function readPayment(providerPaymentId: string): Promise<{
  id: string;
  status: string;
  statusDetail: string | null;
  externalReference: string | null;
  amount: number | null;
  raw: unknown;
}> {
  const res = await fetch(`${API}/v1/payments/${providerPaymentId}`, {
    headers: { 'Authorization': `Bearer ${token()}` },
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Mercado Pago respondeu HTTP ${res.status} ao reler pagamento: ${text.slice(0, 300)}`);
  }
  const data = JSON.parse(text) as {
    id: number | string;
    status: string;
    status_detail?: string;
    external_reference?: string;
    transaction_amount?: number;
  };
  return {
    id: String(data.id),
    status: data.status,
    statusDetail: data.status_detail ?? null,
    externalReference: data.external_reference ?? null,
    amount: data.transaction_amount ?? null,
    raw: data,
  };
}

/** Estados do provedor traduzidos para o nosso enum payment_status. */
export function mapStatus(mpStatus: string): string {
  switch (mpStatus) {
    case 'approved':    return 'captured';
    case 'authorized':  return 'authorized';
    case 'in_process':
    case 'in_mediation':
    case 'pending':     return 'pending';
    case 'rejected':    return 'failed';
    case 'cancelled':   return 'cancelled';
    case 'refunded':    return 'refunded';
    case 'charged_back': return 'chargeback';
    // Status desconhecido vira pendente, nunca capturado: na duvida o pedido
    // NAO avanca. Inventar captura libera bilhete sem dinheiro ter entrado.
    default:            return 'pending';
  }
}

/**
 * Confere a assinatura da notificacao.
 *
 * Formato: x-signature: ts=<timestamp>,v1=<hmac hex>
 * Manifesto: id:<data.id minusculo>;request-id:<x-request-id>;ts:<ts>;
 */
export async function verifySignature(
  signatureHeader: string | null,
  requestId: string | null,
  dataId: string | null,
): Promise<boolean> {
  const secret = (Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET') ?? '').trim();
  if (secret === '' || !signatureHeader || !dataId) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((piece) => {
      const [key, ...rest] = piece.split('=');
      return [key.trim(), rest.join('=').trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  // O id chega as vezes em maiusculas; a validacao do provedor usa minusculo.
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId ?? ''};ts:${ts};`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(manifest));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Comparacao de tempo constante, como no segredo das rotinas de sync.
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  }
  return diff === 0;
}
