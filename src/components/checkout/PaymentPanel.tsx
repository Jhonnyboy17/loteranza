import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, CreditCard, ExternalLink, QrCode, RefreshCw } from 'lucide-react';
import { requireSupabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { TransactionsDisabledNotice } from '@/components/compliance/notices';
import { isValidCpf, maskCpf, normalizeCpf } from '@/lib/cpf';
import {
  PaymentError, readPaymentStatus, startPayment, type PaymentStart,
} from '@/services/payments/mercadopago';
import { cn } from '@/lib/utils';

/**
 * Etapa de pagamento.
 *
 * Os meios vem de `payment_providers` no banco, nunca de uma lista no codigo:
 * a RLS da tabela so expoe os habilitados, entao o que o navegador consegue
 * ver ja e o que o administrador liberou. Com a tabela toda desabilitada —
 * estado atual — a tela diz isso em vez de oferecer um botao que nao funciona.
 *
 * PIX e cartao seguem caminhos deliberadamente diferentes:
 *  - PIX resolve na propria tela, porque o codigo copia-e-cola e o QR sao
 *    publicos por natureza: quem os tem so consegue pagar, nunca receber;
 *  - cartao sai para o Checkout Pro do Mercado Pago, porque assim nenhum dado
 *    de cartao toca esta plataforma — nem em memoria.
 */

interface EnabledProvider {
  provider_key: string;
  display_name: string;
  method: string;
  currency: string;
}

function useEnabledProviders() {
  return useQuery({
    queryKey: ['payment-providers'],
    queryFn: async (): Promise<EnabledProvider[]> => {
      const { data, error } = await requireSupabase()
        .from('payment_providers')
        .select('provider_key, display_name, method, currency')
        .eq('is_enabled', true)
        .order('method');
      if (error) throw error;
      return (data ?? []) as EnabledProvider[];
    },
    staleTime: 60_000,
  });
}

export function PaymentPanel({
  orderId, payerName, payerEmail, onPaid,
}: {
  orderId: string;
  payerName?: string | null;
  payerEmail?: string | null;
  onPaid: () => void;
}) {
  const providersQuery = useEnabledProviders();
  const [charge, setCharge] = React.useState<PaymentStart | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const providers = providersQuery.data ?? [];
  const pix = providers.find((p) => p.method === 'pix');
  const card = providers.find((p) => p.method === 'card');

  if (providersQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando meios de pagamento…</p>;
  }

  if (providers.length === 0) {
    return (
      <TransactionsDisabledNotice
        message={
          'Nenhum meio de pagamento habilitado. Os provedores só são ligados após a '
          + 'confirmação de enquadramento junto ao processador e a liberação da jurisdição.'
        }
      />
    );
  }

  if (charge?.method === 'pix') {
    return (
      <PixCharge
        charge={charge}
        onPaid={onPaid}
        onRestart={() => { setCharge(null); setError(null); }}
      />
    );
  }

  return (
    <div className="space-y-space-md">
      {error && (
        <p role="alert" className="text-sm font-medium text-destructive">{error}</p>
      )}

      {pix && (
        <PixForm
          orderId={orderId}
          provider={pix}
          payerName={payerName}
          payerEmail={payerEmail}
          onStarted={setCharge}
          onError={setError}
        />
      )}

      {card && (
        <CardRedirect
          orderId={orderId}
          provider={card}
          onError={setError}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function PixForm({
  orderId, provider, payerName, payerEmail, onStarted, onError,
}: {
  orderId: string;
  provider: EnabledProvider;
  payerName?: string | null;
  payerEmail?: string | null;
  onStarted: (charge: PaymentStart) => void;
  onError: (message: string | null) => void;
}) {
  const [cpf, setCpf] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [touched, setTouched] = React.useState(false);

  const cpfOk = isValidCpf(cpf);
  const showCpfError = touched && cpf.length > 0 && !cpfOk;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!cpfOk) return;

    setBusy(true);
    onError(null);
    try {
      const charge = await startPayment({
        orderId,
        providerKey: provider.provider_key,
        payerCpf: normalizeCpf(cpf),
        payerName: payerName ?? undefined,
        payerEmail: payerEmail ?? undefined,
      });
      onStarted(charge);
    } catch (err) {
      onError(err instanceof PaymentError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border p-space-md">
      <div className="flex items-center gap-space-sm">
        <span className="flex size-9 items-center justify-center rounded-lg bg-surface-container-high text-tertiary">
          <QrCode className="size-5" aria-hidden />
        </span>
        <div>
          <p className="font-semibold text-on-surface">{provider.display_name}</p>
          <p className="text-xs text-muted-foreground">
            O código aparece aqui mesmo. Você não sai do site.
          </p>
        </div>
      </div>

      <div className="mt-space-md">
        <Field
          label="CPF do pagador"
          htmlFor="pix-cpf"
          required
          hint="Exigido pelo arranjo do PIX. Não é guardado: segue para o provedor e acaba ali."
          error={showCpfError ? 'CPF inválido. Confira os dígitos.' : null}
        >
          <Input
            id="pix-cpf"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            value={maskCpf(cpf)}
            onChange={(e) => setCpf(normalizeCpf(e.target.value))}
            onBlur={() => setTouched(true)}
            aria-invalid={showCpfError}
          />
        </Field>
      </div>

      <Button type="submit" className="mt-space-md" disabled={busy || !cpfOk} block>
        {busy ? 'Gerando código…' : 'Gerar código PIX'}
      </Button>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

function CardRedirect({
  orderId, provider, onError,
}: {
  orderId: string;
  provider: EnabledProvider;
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = React.useState(false);

  async function go() {
    setBusy(true);
    onError(null);
    try {
      const charge = await startPayment({ orderId, providerKey: provider.provider_key });
      if (charge.method !== 'card') {
        throw new PaymentError('O provedor não devolveu um endereço de pagamento.');
      }
      // Navegacao normal, nao window.open: popup e bloqueado com frequencia e
      // o cliente fica achando que o botao nao funcionou.
      window.location.assign(charge.redirectUrl);
    } catch (err) {
      onError(err instanceof PaymentError ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border p-space-md">
      <div className="flex items-center gap-space-sm">
        <span className="flex size-9 items-center justify-center rounded-lg bg-surface-container-high text-tertiary">
          <CreditCard className="size-5" aria-hidden />
        </span>
        <div>
          <p className="font-semibold text-on-surface">{provider.display_name}</p>
          <p className="text-xs text-muted-foreground">
            Você conclui no ambiente do Mercado Pago. Nenhum dado do cartão passa por este site.
          </p>
        </div>
      </div>

      <Button variant="outline" className="mt-space-md" onClick={go} disabled={busy} block>
        {busy ? 'Abrindo…' : 'Pagar com cartão'}
        <ExternalLink className="ml-2 size-4" aria-hidden />
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const TERMINAL_FAILURE = ['failed', 'cancelled', 'chargeback'] as const;

function PixCharge({
  charge, onPaid, onRestart,
}: {
  charge: Extract<PaymentStart, { method: 'pix' }>;
  onPaid: () => void;
  onRestart: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const [status, setStatus] = React.useState<string>('pending');

  // Observa a propria cobranca ate confirmar. Quem muda o estado e o webhook;
  // esta consulta so le. Para de insistir em estado terminal para nao ficar
  // batendo no banco a cada 4 segundos para sempre.
  React.useEffect(() => {
    if (status === 'captured' || TERMINAL_FAILURE.includes(status as never)) return undefined;

    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const next = await readPaymentStatus(charge.paymentId);
        if (!active || !next) return;
        setStatus(next);
        if (next === 'captured') onPaid();
      } catch {
        // Falha de leitura nao derruba a tela: o QR continua valido e a
        // proxima tentativa acontece em 4 segundos.
      }
    }, 4000);

    return () => { active = false; window.clearInterval(timer); };
  }, [charge.paymentId, status, onPaid]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(charge.pix.qrCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Sem permissao de area de transferencia o usuario ainda consegue
      // selecionar o texto, que fica visivel logo abaixo.
    }
  }

  const failed = TERMINAL_FAILURE.includes(status as never);

  return (
    <div className="space-y-space-md rounded-xl border border-border p-space-md">
      <div className="flex items-center justify-between gap-space-sm">
        <p className="font-semibold text-on-surface">Pague com PIX</p>
        <Badge variant={status === 'captured' ? 'success' : failed ? 'danger' : 'warning'}>
          {status === 'captured' ? 'pagamento confirmado'
            : failed ? 'não concluído'
            : 'aguardando pagamento'}
        </Badge>
      </div>

      {status === 'captured' ? (
        <p className="text-sm text-on-surface">
          Pagamento confirmado. O pedido entrou na fila de compra do bilhete.
        </p>
      ) : failed ? (
        <div className="space-y-space-sm">
          <p className="text-sm text-on-surface">
            Este código não foi concluído. Você pode gerar um novo.
          </p>
          <Button variant="outline" onClick={onRestart}>
            <RefreshCw className="mr-2 size-4" aria-hidden />
            Gerar outro código
          </Button>
        </div>
      ) : (
        <>
          {charge.pix.qrCodeBase64 && (
            <img
              src={`data:image/png;base64,${charge.pix.qrCodeBase64}`}
              alt="QR Code do PIX para pagamento"
              className="mx-auto size-56 rounded-lg bg-white p-2"
              width={224}
              height={224}
            />
          )}

          <div>
            <p className="text-xs font-medium text-muted-foreground">Código copia e cola</p>
            <p className="mt-1 break-all rounded-lg bg-surface-container-high p-space-sm font-mono text-xs text-on-surface">
              {charge.pix.qrCode}
            </p>
          </div>

          <Button onClick={copy} block>
            {copied
              ? <><Check className="mr-2 size-4" aria-hidden /> Código copiado</>
              : <><Copy className="mr-2 size-4" aria-hidden /> Copiar código</>}
          </Button>

          <p className={cn('text-xs text-muted-foreground')}>
            Assim que o banco confirmar, esta tela muda sozinha. Não é preciso recarregar.
          </p>

          {charge.pix.ticketUrl && (
            <a
              href={charge.pix.ticketUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center text-xs font-medium text-primary underline"
            >
              Abrir comprovante no provedor
              <ExternalLink className="ml-1 size-3" aria-hidden />
            </a>
          )}
        </>
      )}
    </div>
  );
}
