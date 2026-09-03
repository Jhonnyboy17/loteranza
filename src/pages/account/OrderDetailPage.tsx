import { Link, useParams } from 'react-router-dom';
import { Check, Image as ImageIcon, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDemoState } from '@/hooks/useDemoState';
import { useGames } from '@/hooks/useLotteryQueries';
import { formatBRL, formatDate, formatDateTime, formatUSD } from '@/lib/format';
import { Seo } from '@/components/common/Seo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/misc';
import { ErrorState } from '@/components/common/states';
import { NumberSequence } from '@/components/lottery/NumberBall';
import {
  ORDER_STATUS_LABELS, ORDER_TIMELINE, TICKET_STATUS_LABELS, orderStatusVariant,
} from './orderStatus';
import { cn } from '@/lib/utils';

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { profile } = useAuth();
  const demo = useDemoState();
  const gamesQuery = useGames();

  const order = demo.orders.find((o) => o.id === orderId);
  const tickets = demo.tickets.filter((t) => t.orderId === orderId);
  const game = (gamesQuery.data ?? []).find((g) => g.id === order?.gameId);

  if (!order) {
    return (
      <div className="container py-16">
        <ErrorState
          title="Pedido não encontrado"
          description="Ele pode ter sido removido ou pertencer a outra conta."
        />
      </div>
    );
  }

  if (order.userId !== (profile?.id ?? '')) {
    return (
      <div className="container py-16">
        <ErrorState
          title="Sem acesso a este pedido"
          description="Este pedido pertence a outra conta."
        />
      </div>
    );
  }

  const currentIndex = ORDER_TIMELINE.indexOf(order.status);

  return (
    <div className="container py-10">
      <Seo title={`Pedido ${order.orderNumber}`} description="Detalhes do pedido." noIndex />

      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-3">
        <Link to="/meus-jogos">← Meus jogos</Link>
      </Button>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-display-lg font-extrabold">{order.orderNumber}</h1>
            <Badge variant={orderStatusVariant(order.status)}>
              {ORDER_STATUS_LABELS[order.status]}
            </Badge>
            {order.isDemo && <Badge variant="demo">Demonstração</Badge>}
          </div>
          <p className="text-muted-foreground">
            {game?.name ?? 'Modalidade'} · criado em {formatDateTime(order.createdAt)}
          </p>
        </div>
      </header>

      {order.isDemo && (
        <div className="notice-strip mb-8 border-warning/40 bg-warning/10">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p className="text-sm">
            Pedido demonstrativo. Nenhuma cobrança foi realizada, nenhum bilhete oficial foi
            adquirido e nenhum valor é devido.
          </p>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-8">
          {/* ------------------------------------------------------- TIMELINE */}
          <section className="surface p-6">
            <h2 className="font-display text-lg font-semibold">Acompanhamento</h2>
            <ol className="mt-5 space-y-0">
              {ORDER_TIMELINE.map((status, index) => {
                const done = currentIndex >= 0 && index <= currentIndex;
                const current = index === currentIndex;
                return (
                  <li key={status} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold',
                          done
                            ? 'border-transparent bg-success text-success-foreground'
                            : 'border-border bg-card text-muted-foreground',
                        )}
                      >
                        {done ? <Check className="size-4" aria-hidden /> : index + 1}
                      </span>
                      {index < ORDER_TIMELINE.length - 1 && (
                        <span
                          className={cn('h-10 w-0.5', done ? 'bg-success' : 'bg-border')}
                          aria-hidden
                        />
                      )}
                    </div>
                    <div className="pb-4">
                      <p className={cn('text-sm', current ? 'font-semibold' : done ? '' : 'text-muted-foreground')}>
                        {ORDER_STATUS_LABELS[status]}
                      </p>
                      {current && (
                        <p className="mt-0.5 text-xs text-muted-foreground">Etapa atual</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>

            {['cancelled', 'refunded'].includes(order.status) && (
              <p className="mt-2 rounded-lg bg-muted p-3 text-sm">
                Este pedido foi {order.status === 'cancelled' ? 'cancelado' : 'reembolsado'}.
              </p>
            )}
          </section>

          {/* -------------------------------------------------------- NÚMEROS */}
          <section className="surface p-6">
            <h2 className="font-display text-lg font-semibold">
              Seus jogos ({order.lines.length})
            </h2>
            <ul className="mt-4 space-y-2">
              {order.lines.map((line, index) => (
                <li
                  key={line.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
                >
                  <span className="w-14 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Jogo {String(index + 1).padStart(2, '0')}
                  </span>
                  <NumberSequence
                    numbers={line.numbers}
                    specialNumbers={line.specialNumbers}
                    size="sm"
                  />
                  {line.isQuickPick && <Badge variant="neutral">Escolha rápida</Badge>}
                </li>
              ))}
            </ul>
          </section>

          {/* -------------------------------------------------------- BILHETE */}
          <section className="surface p-6">
            <h2 className="font-display text-lg font-semibold">Seu bilhete oficial</h2>
            {tickets.length === 0 ? (
              <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
                <ImageIcon className="size-8 text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">
                  A imagem do bilhete aparece aqui assim que o operador concluir a compra e fazer o
                  upload. A cópia exibida oculta serial e código de barras, por segurança.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-4">
                {tickets.map((ticket) => (
                  <li key={ticket.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{ticket.ticketRef}</p>
                      <Badge variant="neutral">{TICKET_STATUS_LABELS[ticket.status]}</Badge>
                    </div>
                    <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">Adquirido em</dt>
                        <dd>{formatDateTime(ticket.purchasedAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Local da compra</dt>
                        <dd>{ticket.purchaseLocation ?? '—'}</dd>
                      </div>
                    </dl>
                    <div className="mt-3">
                      <NumberSequence
                        numbers={ticket.numbers}
                        specialNumbers={ticket.specialNumbers}
                        size="sm"
                      />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Serial e código de barras não são exibidos: eles permitiriam o resgate por
                      terceiros.
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ------------------------------------------------------------ VALORES */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="surface space-y-4 p-5">
            <h2 className="font-display text-base font-semibold">Valores</h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Valor oficial das apostas</dt>
                <dd className="tnum">{formatUSD(order.officialTicketCost)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Taxa de serviço</dt>
                <dd className="tnum">{formatUSD(order.serviceFee)}</dd>
              </div>
              {order.tax > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Impostos</dt>
                  <dd className="tnum">{formatUSD(order.tax)}</dd>
                </div>
              )}
              <Separator />
              <div className="flex justify-between gap-4 font-semibold">
                <dt>Total</dt>
                <dd className="tnum font-display text-lg">{formatUSD(order.total)}</dd>
              </div>
            </dl>

            {order.exchangeRate && order.totalDisplay !== null && (
              <div className="rounded-lg bg-muted/60 p-3 text-sm">
                <p className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Estimativa em reais</span>
                  <span className="tnum font-medium">≈ {formatBRL(order.totalDisplay)}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cotação registrada no pedido: US$ 1 ={' '}
                  {new Intl.NumberFormat('pt-BR', {
                    minimumFractionDigits: 2, maximumFractionDigits: 4,
                  }).format(order.exchangeRate)}
                  {order.exchangeRateAt && ` · ${formatDateTime(order.exchangeRateAt)}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Esta taxa não é alterada retroativamente.
                </p>
              </div>
            )}

            <Separator />
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Sorteios</dt>
                <dd>{order.drawsCount}</dd>
              </div>
              {order.purchaseDeadline && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Prazo de compra</dt>
                  <dd>{formatDate(order.purchaseDeadline)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Compliance</dt>
                <dd>{order.complianceStatus}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
