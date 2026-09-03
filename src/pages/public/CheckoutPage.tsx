import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Lock, MapPin, ShieldCheck } from 'lucide-react';
import type { ComplianceVerdict } from '@/types/domain';
import { env } from '@/config/env';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { usePlatform } from '@/contexts/PlatformContext';
import { useToast } from '@/components/ui/toast';
import { evaluateCompliance, resolveJurisdiction } from '@/services/compliance/engine';
import { describeGeoSignal } from '@/services/compliance/geolocation';
import { availableMethods } from '@/services/payments';
import { demoStore, buildDemoOrder } from '@/services/platform/demoStore';
import { formatUSD } from '@/lib/format';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/misc';
import { CartSummary } from '@/components/cart/CartSummary';
import {
  ComplianceChecklist, JurisdictionNotice, TransactionsDisabledNotice,
} from '@/components/compliance/notices';
import { cn } from '@/lib/utils';

const STEPS = [
  { key: 'conta', label: 'Conta' },
  { key: 'identificacao', label: 'Identificação' },
  { key: 'elegibilidade', label: 'Elegibilidade' },
  { key: 'pagamento', label: 'Pagamento' },
  { key: 'confirmacao', label: 'Confirmação' },
] as const;

type StepKey = (typeof STEPS)[number]['key'];

/**
 * Checkout em 5 etapas.
 *
 * A etapa 4 (pagamento) so fica acessivel quando o Compliance Engine devolve
 * APPROVED. Enquanto isso nao acontece — e no estado atual do projeto nunca
 * acontece, porque nenhuma jurisdicao esta habilitada — o usuario ve exatamente
 * o que falta e o pedido pode ser salvo como demonstracao.
 */
export function CheckoutPage() {
  const navigate = useNavigate();
  const { isAuthenticated, profile } = useAuth();
  const { items, totals, clear } = useCart();
  const {
    settings, jurisdictions, jurisdiction, geo, assumedCountry,
    requestPreciseLocation, globalTransactionsEnabled,
  } = usePlatform();
  const { toast } = useToast();

  const [step, setStep] = React.useState<StepKey>('conta');
  const [locating, setLocating] = React.useState(false);
  const [verdict, setVerdict] = React.useState<ComplianceVerdict | null>(null);
  const [placing, setPlacing] = React.useState(false);

  // Jurisdição efetiva: quando há sinal do dispositivo, ele tem precedência
  // sobre a dica local do navegador.
  const effectiveJurisdiction = React.useMemo(() => {
    if (geo?.country) return resolveJurisdiction(jurisdictions, geo.country, geo.state);
    return jurisdiction;
  }, [geo, jurisdictions, jurisdiction]);

  const runComplianceCheck = React.useCallback(() => {
    const result = evaluateCompliance({
      profile,
      jurisdiction: effectiveJurisdiction,
      settings,
      geo,
      amount: totals.total,
      gameKey: items[0]?.gameKey ?? null,
    });
    setVerdict(result);
    return result;
  }, [profile, effectiveJurisdiction, settings, geo, totals.total, items]);

  const approved = verdict?.status === 'APPROVED';
  const paymentMethods = availableMethods(effectiveJurisdiction);

  const handleLocate = async () => {
    setLocating(true);
    try {
      const signal = await requestPreciseLocation();
      if (signal.source === 'unavailable') {
        toast({
          title: 'Localização não disponível',
          description:
            'Não conseguimos ler a localização do dispositivo. Você continua podendo navegar e consultar resultados.',
          variant: 'warning',
        });
      }
    } finally {
      setLocating(false);
    }
  };

  const placeDemoOrder = () => {
    if (!profile) return;
    setPlacing(true);
    try {
      const order = buildDemoOrder({
        userId: profile.id,
        items,
        drawsCount: items[0]?.drawsCount ?? 1,
        exchangeRate: totals.exchangeRate,
        exchangeRateAt: totals.exchangeRateAt,
        purchaseDeadline: null,
      });
      order.complianceStatus = verdict?.status ?? 'NOT_EVALUATED';

      demoStore.update((draft) => { draft.orders.unshift(order); });
      demoStore.audit({
        userId: profile.id, role: 'CUSTOMER', action: 'order.create_demo',
        entity: 'orders', entityId: order.id,
        oldValue: null, newValue: { total: order.total, isDemo: true }, severity: 'info',
      });
      demoStore.notify({
        userId: profile.id, eventKey: 'order_created',
        title: 'Pedido demonstrativo registrado',
        body: `Pedido ${order.orderNumber} salvo em modo demonstração. Nenhuma cobrança foi feita.`,
        priority: 'normal', actionUrl: `/meus-jogos/${order.id}`,
      });

      clear();
      toast({
        title: 'Pedido demonstrativo criado',
        description: 'Nenhuma cobrança foi realizada e nenhum bilhete foi adquirido.',
        variant: 'success',
      });
      navigate(`/meus-jogos/${order.id}`);
    } finally {
      setPlacing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="container py-16 text-center">
        <Seo title="Checkout" description="Finalize seu pedido." noIndex />
        <h1 className="text-display-lg font-bold">Não há nada para finalizar</h1>
        <p className="mt-2 text-muted-foreground">Seu carrinho está vazio.</p>
        <Button asChild className="mt-6"><Link to="/loterias">Ver loterias</Link></Button>
      </div>
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="container py-10">
      <Seo title="Checkout" description="Finalize seu pedido." canonicalPath="/checkout" noIndex />

      <h1 className="mb-6 text-display-xl font-extrabold">Checkout</h1>

      {/* Trilha de etapas */}
      <ol className="mb-8 flex flex-wrap gap-2" aria-label="Etapas do checkout">
        {STEPS.map((item, index) => {
          const state = index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'todo';
          return (
            <li key={item.key} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-xs font-bold',
                  state === 'done' && 'bg-success text-success-foreground',
                  state === 'current' && 'bg-primary text-primary-foreground',
                  state === 'todo' && 'bg-muted text-muted-foreground',
                )}
                aria-current={state === 'current' ? 'step' : undefined}
              >
                {state === 'done' ? <Check className="size-4" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  'text-sm',
                  state === 'current' ? 'font-semibold' : 'text-muted-foreground',
                )}
              >
                {item.label}
              </span>
              {index < STEPS.length - 1 && (
                <span className="mx-1 hidden h-px w-6 bg-border sm:block" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {/* ---------------------------------------------------- ETAPA 1 CONTA */}
          {step === 'conta' && (
            <StepCard title="Etapa 1 · Sua conta">
              {isAuthenticated ? (
                <>
                  <p className="text-sm">
                    Você está em{' '}
                    <strong>{profile?.email ?? profile?.fullName ?? 'sua conta'}</strong>.
                  </p>
                  <Button onClick={() => setStep('identificacao')} size="lg">Continuar</Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    É necessário estar em uma conta para prosseguir. Seus jogos ficam salvos no
                    carrinho.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="lg"><Link to="/entrar">Entrar</Link></Button>
                    <Button asChild size="lg" variant="outline">
                      <Link to="/criar-conta">Criar conta</Link>
                    </Button>
                  </div>
                </>
              )}
            </StepCard>
          )}

          {/* ------------------------------------------- ETAPA 2 IDENTIFICAÇÃO */}
          {step === 'identificacao' && (
            <StepCard title="Etapa 2 · Identificação">
              <dl className="space-y-2 text-sm">
                <Row label="Nome" value={profile?.fullName ?? '—'} />
                <Row label="E-mail" value={profile?.email ?? '—'} />
                <Row
                  label="Data de nascimento"
                  value={profile?.dateOfBirth ?? 'Não informada'}
                />
                <Row label="País de residência" value={profile?.residenceCountry ?? '—'} />
                <Row
                  label="Verificação de identidade (KYC)"
                  value={
                    profile?.kycStatus === 'approved'
                      ? 'Aprovada'
                      : profile?.kycStatus === 'not_started'
                        ? 'Não iniciada'
                        : (profile?.kycStatus ?? '—')
                  }
                />
              </dl>

              {profile?.kycStatus !== 'approved' && (
                <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
                  A verificação de identidade é exigida em jurisdições que a requerem. Ela é feita
                  por provedor especializado — documentos não são armazenados nesta plataforma.
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setStep('conta')}>Voltar</Button>
                <Button size="lg" onClick={() => setStep('elegibilidade')}>Continuar</Button>
              </div>
            </StepCard>
          )}

          {/* ------------------------------------------- ETAPA 3 ELEGIBILIDADE */}
          {step === 'elegibilidade' && (
            <StepCard title="Etapa 3 · Elegibilidade e localização">
              <JurisdictionNotice
                jurisdiction={effectiveJurisdiction}
                detectedLabel={
                  geo?.country
                    ? `${geo.country}${geo.state ? `-${geo.state}` : ''}`
                    : assumedCountry
                      ? `${assumedCountry} (estimativa do navegador)`
                      : null
                }
              />

              <div className="rounded-xl border border-border p-4">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Confirmação de localização</p>
                    <p className="text-sm text-muted-foreground">
                      A permissão para intermediar a compra depende do local de onde o pedido
                      parte. Usamos a localização do dispositivo e o país da conexão; a decisão
                      final é feita no servidor e registrada para auditoria.
                    </p>
                    {geo && (
                      <p className="text-sm text-muted-foreground">{describeGeoSignal(geo)}</p>
                    )}
                    <Button variant="outline" onClick={handleLocate} loading={locating}>
                      {geo?.source === 'browser' ? 'Atualizar localização' : 'Confirmar localização'}
                    </Button>
                  </div>
                </div>
              </div>

              {verdict && <ComplianceChecklist verdict={verdict} />}

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setStep('identificacao')}>Voltar</Button>
                <Button
                  size="lg"
                  onClick={() => {
                    const result = runComplianceCheck();
                    if (result.status === 'APPROVED') setStep('pagamento');
                  }}
                >
                  <ShieldCheck aria-hidden /> Verificar elegibilidade
                </Button>
              </div>

              {verdict && verdict.status !== 'APPROVED' && (
                <>
                  <Separator />
                  <TransactionsDisabledNotice message={verdict.summary} />
                  <p className="text-sm text-muted-foreground">
                    Você pode salvar este pedido como demonstração para ver como o acompanhamento
                    funciona, sem qualquer cobrança.
                  </p>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={placeDemoOrder}
                    loading={placing}
                    disabled={!isAuthenticated}
                  >
                    Salvar pedido demonstrativo
                  </Button>
                  {!isAuthenticated && (
                    <p className="text-xs text-muted-foreground">
                      Entre na sua conta para salvar o pedido demonstrativo.
                    </p>
                  )}
                </>
              )}
            </StepCard>
          )}

          {/* ----------------------------------------------- ETAPA 4 PAGAMENTO */}
          {step === 'pagamento' && (
            <StepCard title="Etapa 4 · Pagamento">
              {!approved ? (
                <TransactionsDisabledNotice
                  message="A verificação de elegibilidade precisa ser aprovada antes do pagamento."
                />
              ) : paymentMethods.length === 0 ? (
                <TransactionsDisabledNotice
                  message="Nenhum meio de pagamento habilitado para a sua jurisdição."
                />
              ) : (
                <>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Lock className="size-4" aria-hidden />
                    Os dados do meio de pagamento são processados pelo provedor. Esta plataforma
                    não recebe nem armazena o número completo do cartão.
                  </p>
                  <ul className="space-y-2">
                    {paymentMethods.map((method) => (
                      <li key={method} className="rounded-lg border border-border p-4 text-sm">
                        {method}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <Button variant="outline" onClick={() => setStep('elegibilidade')}>Voltar</Button>
            </StepCard>
          )}

          {step === 'confirmacao' && (
            <StepCard title="Etapa 5 · Confirmação">
              <p className="text-sm text-muted-foreground">
                Esta etapa é preenchida após a confirmação do pagamento pelo provedor.
              </p>
            </StepCard>
          )}

          {/* Estado global sempre visível */}
          {!globalTransactionsEnabled && (
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-sm font-medium">Estado atual do sistema</p>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Badge variant={env.transactionsEnabled ? 'success' : 'neutral'}>
                    {env.transactionsEnabled ? 'ligado' : 'desligado'}
                  </Badge>
                  Portão 1 — variável de ambiente TRANSACTIONS_ENABLED
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant={settings.transactionsEnabled ? 'success' : 'neutral'}>
                    {settings.transactionsEnabled ? 'ligado' : 'desligado'}
                  </Badge>
                  Portão 2 — configuração do sistema
                </li>
                <li className="flex items-center gap-2">
                  <Badge variant={effectiveJurisdiction?.transactionsEnabled ? 'success' : 'neutral'}>
                    {effectiveJurisdiction?.transactionsEnabled ? 'liberada' : 'não liberada'}
                  </Badge>
                  Portão 3 — jurisdição da sua localização
                </li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                A compra só é processada com os três portões abertos e o Compliance Engine
                aprovando no servidor.
              </p>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <CartSummary
            totals={totals}
            actionLabel={approved ? 'Ir para o pagamento' : 'Compra ainda não disponível'}
            actionDisabled={!approved}
            onAction={() => setStep('pagamento')}
            footer={
              <p className="text-xs text-muted-foreground">
                Total recalculado no servidor no momento do pagamento. A cotação registrada no
                pedido não é alterada depois.
              </p>
            }
          />
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {formatUSD(totals.total)} · {totals.betCount}{' '}
            {totals.betCount === 1 ? 'aposta' : 'apostas'}
          </p>
        </aside>
      </div>
    </div>
  );
}

function StepCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface space-y-4 p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-4 border-b border-border pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
