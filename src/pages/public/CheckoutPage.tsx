import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Lock, MapPin, ShieldCheck } from 'lucide-react';
import { Sym, type IconName } from '@/components/ui/icon';
import type { ComplianceVerdict } from '@/types/domain';
import { env } from '@/config/env';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { usePlatform } from '@/contexts/PlatformContext';
import { useToast } from '@/components/ui/toast';
import { evaluateCompliance, resolveJurisdiction } from '@/services/compliance/engine';
import { describeGeoSignal } from '@/services/compliance/geolocation';
import { demoStore, buildDemoOrder } from '@/services/platform/demoStore';
import { requireSupabase } from '@/lib/supabase';
import { descreverErroDeFuncao, type ErroDeFuncao } from '@/lib/edgeError';
import { lotteryData } from '@/services/lottery';
import { PaymentPanel } from '@/components/checkout/PaymentPanel';
import { formatDrawMoment, formatUSD } from '@/lib/format';
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
  const { items, totals, clear, setItemDraw } = useCart();
  const {
    settings, jurisdictions, jurisdiction, geo, assumedCountry,
    requestPreciseLocation, globalTransactionsEnabled,
  } = usePlatform();
  const { toast } = useToast();

  const [step, setStep] = React.useState<StepKey>('conta');
  const [locating, setLocating] = React.useState(false);
  const [verdict, setVerdict] = React.useState<ComplianceVerdict | null>(null);
  const [placing, setPlacing] = React.useState(false);
  // Pedido REAL, criado no servidor. E dele que sai o valor a cobrar: o
  // pagamento nunca e aberto a partir do carrinho, que vive no navegador.
  const [pendingOrderId, setPendingOrderId] = React.useState<string | null>(null);
  const [orderError, setOrderError] = React.useState<ErroDeFuncao | null>(null);

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

  /**
   * Cria o pedido no servidor antes de abrir o pagamento.
   *
   * O carrinho vive no navegador e por isso nao serve de base para cobranca:
   * `create-order` recalcula preco a partir de lottery_games, valida as linhas
   * contra as regras do jogo e congela a cotacao. O id que volta e o unico que
   * o pagamento aceita.
   */
  const ensureOrder = React.useCallback(async (): Promise<string | null> => {
    if (pendingOrderId) return pendingOrderId;
    const item = items[0];
    if (!item) return null;

    setPlacing(true);
    setOrderError(null);
    try {
      const { data, error } = await requireSupabase().functions.invoke('create-order', {
        body: {
          game_key: item.gameKey,
          draw_id: item.drawId,
          draws_count: item.drawsCount,
          lines: item.lines.map((line) => ({
            numbers: line.numbers,
            special_numbers: line.specialNumbers,
            is_quick_pick: line.isQuickPick,
          })),
        },
      });
      if (error) throw error;

      const id = (data as { order?: { id?: string } } | null)?.order?.id ?? null;
      if (!id) throw new Error('O servidor não devolveu o pedido.');
      setPendingOrderId(id);
      return id;
    } catch (err) {
      // O motivo vem no CORPO da resposta, nao na message do erro — ver
      // src/lib/edgeError.ts. Sem esta leitura, "sales_closed" chegava aqui
      // como "Edge Function returned a non-2xx status code".
      setOrderError(await descreverErroDeFuncao(err));
      return null;
    } finally {
      setPlacing(false);
    }
  }, [items, pendingOrderId]);

  /**
   * Caminho de saida do `sales_closed`.
   *
   * Busca o proximo sorteio da modalidade e aponta o item para ele. NAO faz
   * isso sozinho no erro: a pessoa escolheu um sorteio, e trocar a data da
   * aposta em silencio seria decidir no lugar dela. Aqui ela ve qual fechou,
   * ve qual e o proximo, e confirma.
   */
  const trocarParaProximoSorteio = React.useCallback(async () => {
    const item = items[0];
    if (!item) return;

    setPlacing(true);
    try {
      const proximo = await lotteryData.getUpcomingDraw(item.gameId);
      if (!proximo) {
        setOrderError({
          codigo: 'draw_not_found',
          mensagem: 'Não há sorteio futuro cadastrado para esta modalidade. '
            + 'Tente novamente mais tarde.',
          status: null,
        });
        return;
      }
      setItemDraw(item.id, proximo.id);
      setOrderError(null);
      toast({
        title: 'Sorteio atualizado',
        description: `Seus jogos passaram para o sorteio de ${formatDrawMoment(proximo.drawAt)}.`,
      });
    } catch (err) {
      setOrderError(await descreverErroDeFuncao(err));
    } finally {
      setPlacing(false);
    }
  }, [items, setItemDraw, toast]);

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

      <h1 className="mb-6 text-display-lg font-extrabold">Checkout</h1>

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
                  onClick={async () => {
                    const result = runComplianceCheck();
                    if (result.status === 'APPROVED') {
                      await ensureOrder();
                      setStep('pagamento');
                    }
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
              ) : orderError ? (
                <div className="space-y-space-sm">
                  <p role="alert" className="text-sm font-medium text-destructive">
                    Não foi possível criar o pedido: {orderError.mensagem}
                  </p>
                  {orderError.codigo === 'sales_closed' ? (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Seus números continuam aqui. Podemos movê-los para o próximo
                        sorteio desta modalidade — nada é cobrado nesta etapa.
                      </p>
                      <div className="flex flex-wrap gap-space-sm">
                        <Button onClick={() => { void trocarParaProximoSorteio(); }} loading={placing}>
                          Usar o próximo sorteio
                        </Button>
                        <Button variant="outline" asChild>
                          <Link to={`/loterias/${items[0]?.gameKey ?? ''}`}>
                            Escolher outro sorteio
                          </Link>
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button variant="outline" onClick={() => { void ensureOrder(); }} loading={placing}>
                      Tentar de novo
                    </Button>
                  )}
                </div>
              ) : !pendingOrderId ? (
                <div className="space-y-space-sm">
                  <p className="text-sm text-muted-foreground">
                    Criando o pedido no servidor — é ele que define o valor a cobrar.
                  </p>
                  <Button variant="outline" onClick={() => { void ensureOrder(); }} loading={placing}>
                    Criar pedido
                  </Button>
                </div>
              ) : (
                <>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Lock className="size-4" aria-hidden />
                    Os dados do meio de pagamento são processados pelo provedor. Esta plataforma
                    não recebe nem armazena o número completo do cartão.
                  </p>
                  <PaymentPanel
                    orderId={pendingOrderId}
                    payerName={profile?.fullName}
                    payerEmail={profile?.email}
                    onPaid={() => setStep('confirmacao')}
                  />
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

          <GuaranteeList />

          {/* Estado global sempre visível */}
          {!globalTransactionsEnabled && (
            <div className="rounded-xl bg-surface-container-low p-space-md shadow-soft">
              <p className="font-label-md text-label-md font-semibold uppercase tracking-wider text-on-surface-variant">
                Estado atual do sistema
              </p>
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
            onAction={async () => { await ensureOrder(); setStep('pagamento'); }}
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
    <section className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-md shadow-card">
      <h2 className="flex items-center gap-1.5 font-headline-sm text-headline-sm text-on-surface">
        <span aria-hidden className="h-4 w-1.5 shrink-0 rounded-full bg-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}


/**
 * O que a plataforma garante — e o que ela NÃO pode garantir.
 *
 * O Stitch desenha aqui um bloco "Garantia Chicago Courier" com três
 * promessas, e a terceira é "100% dos Prêmios sem Retenção · Ganhos integrais
 * repassados diretamente para você sem comissão oculta". Isso é falso: prêmio
 * de loteria americana sofre retenção na fonte acima de certos valores. Não é
 * questão de estilo, é informação errada sobre dinheiro do cliente — então o
 * bloco foi reescrito com o que de fato acontece.
 */
function GuaranteeList() {
  const items: { icon: IconName; title: string; body: string }[] = [
    {
      icon: 'payments',
      title: 'Preço e taxa sempre separados',
      body: 'O valor oficial da aposta e a taxa de serviço aparecem em linhas distintas, antes de qualquer confirmação. Não há cobrança embutida.',
    },
    {
      icon: 'document_scanner',
      title: 'Bilhete rastreável na sua conta',
      body: 'Cada pedido guarda número, data, a imagem do bilhete e o estado atual da custódia.',
    },
    {
      icon: 'encrypted',
      title: 'Sobre a retenção de imposto',
      body: 'Prêmios pagos nos Estados Unidos podem sofrer retenção na fonte, e a regra varia conforme o valor, o estado e a sua residência fiscal. Não prometemos repasse integral. [CONTEÚDO A SER VALIDADO POR ADVOGADO]',
    },
  ];

  return (
    <section className="flex flex-col gap-space-sm rounded-xl bg-surface-container-lowest p-space-md">
      <h2 className="flex items-center gap-space-xs font-label-md text-label-md font-semibold uppercase tracking-wider text-on-surface-variant">
        <Sym name="verified_user" size={18} className="text-tertiary" />
        O que está incluído
      </h2>
      <ul className="flex flex-col gap-space-sm">
        {items.map((item) => (
          <li key={item.title} className="flex items-start gap-space-sm">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-tertiary">
              <Sym name={item.icon} size={14} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="font-label-md text-label-md font-semibold text-on-surface">
                {item.title}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">{item.body}</span>
            </span>
          </li>
        ))}
      </ul>
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
