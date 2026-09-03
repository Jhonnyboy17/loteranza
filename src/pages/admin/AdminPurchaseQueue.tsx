import * as React from 'react';
import { CheckCircle2, ClipboardCheck, Upload, UserCheck } from 'lucide-react';
import type { Order, Ticket } from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import { useDemoState } from '@/hooks/useDemoState';
import { useGames } from '@/hooks/useLotteryQueries';
import { demoStore } from '@/services/platform/demoStore';
import { useToast } from '@/components/ui/toast';
import { formatDateTime, formatUSD } from '@/lib/format';
import { sameNumbers } from '@/lib/utils';
import { Seo } from '@/components/common/Seo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/states';
import { NumberSequence } from '@/components/lottery/NumberBall';
import { Countdown } from '@/components/lottery/Countdown';
import { ORDER_STATUS_LABELS } from '@/pages/account/orderStatus';

/**
 * Fila de compra (secao 34) — tela critica da operação.
 *
 * O operador PURCHASER ve apenas o necessario para adquirir o bilhete:
 * modalidade, sorteio, números, quantidade e prazo. Não vê documento de
 * identidade, endereço nem dados de pagamento do cliente. Essa separação é
 * reforçada pelas policies de RLS, não apenas por esta tela.
 */
export function AdminPurchaseQueue() {
  const demo = useDemoState();
  const gamesQuery = useGames();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [uploadFor, setUploadFor] = React.useState<Order | null>(null);

  // A fila inclui pedidos pagos aguardando compra e os já assumidos.
  const queue = demo.orders.filter((order) =>
    ['paid', 'awaiting_purchase', 'purchased'].includes(order.status),
  );

  const claim = (order: Order) => {
    demoStore.update((draft) => {
      const target = draft.orders.find((o) => o.id === order.id);
      if (target) target.status = 'awaiting_purchase';
    });
    demoStore.audit({
      userId: profile?.id ?? null, role: 'PURCHASER', action: 'order.claim',
      entity: 'orders', entityId: order.id,
      oldValue: { status: order.status }, newValue: { status: 'awaiting_purchase' },
      severity: 'info',
    });
    toast({ title: 'Pedido assumido', description: order.orderNumber, variant: 'success' });
  };

  const markPurchased = (order: Order) => {
    demoStore.update((draft) => {
      const target = draft.orders.find((o) => o.id === order.id);
      if (target) target.status = 'purchased';
    });
    demoStore.audit({
      userId: profile?.id ?? null, role: 'PURCHASER', action: 'order.mark_purchased',
      entity: 'orders', entityId: order.id,
      oldValue: { status: order.status }, newValue: { status: 'purchased' },
      severity: 'warning',
    });
    setUploadFor(order);
  };

  return (
    <div className="space-y-6">
      <Seo title="Fila de compra" description="Pedidos aguardando aquisição de bilhete." noIndex />

      <header>
        <h1 className="font-display text-2xl font-bold">Fila de compra</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos pagos aguardando a aquisição do bilhete oficial. Confira os números exatamente
          como aparecem aqui.
        </p>
      </header>

      {queue.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Fila vazia"
          description="Nenhum pedido aguardando compra no momento. Pedidos entram aqui automaticamente após a aprovação do pagamento."
        />
      ) : (
        <ul className="space-y-4">
          {queue.map((order) => {
            const game = (gamesQuery.data ?? []).find((g) => g.id === order.gameId);
            return (
              <li key={order.id} className="surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display font-semibold">{order.orderNumber}</h2>
                      <Badge variant="neutral">{ORDER_STATUS_LABELS[order.status]}</Badge>
                      {order.isDemo && <Badge variant="demo">Demonstração</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {game?.name ?? '—'} · {order.lines.length}{' '}
                      {order.lines.length === 1 ? 'aposta' : 'apostas'} · {order.drawsCount}{' '}
                      {order.drawsCount === 1 ? 'sorteio' : 'sorteios'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Recebido em {formatDateTime(order.createdAt)} · Compliance:{' '}
                      {order.complianceStatus}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="tnum font-semibold">{formatUSD(order.total)}</p>
                    {order.purchaseDeadline && (
                      <Countdown
                        target={order.purchaseDeadline}
                        variant="inline"
                        expiredLabel="Prazo vencido"
                        className="text-warning"
                      />
                    )}
                  </div>
                </div>

                {/* Números a comprar — o dado central para o operador */}
                <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Números a adquirir
                  </p>
                  <ul className="space-y-2">
                    {order.lines.map((line, index) => (
                      <li key={line.id} className="flex flex-wrap items-center gap-3">
                        <span className="w-14 text-xs font-semibold text-muted-foreground">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <NumberSequence
                          numbers={line.numbers}
                          specialNumbers={line.specialNumbers}
                          size="sm"
                        />
                        {Boolean(line.options.multiplier) && game?.multiplierLabel && (
                          <Badge variant="jackpot">{game.multiplierLabel}</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {order.status !== 'awaiting_purchase' && order.status !== 'purchased' && (
                    <Button onClick={() => claim(order)}>
                      <UserCheck aria-hidden /> Assumir pedido
                    </Button>
                  )}
                  {order.status === 'awaiting_purchase' && (
                    <Button onClick={() => markPurchased(order)}>
                      <CheckCircle2 aria-hidden /> Bilhete adquirido
                    </Button>
                  )}
                  {order.status === 'purchased' && (
                    <Button variant="outline" onClick={() => setUploadFor(order)}>
                      <Upload aria-hidden /> Enviar foto do bilhete
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <TicketUploadDialog
        order={uploadFor}
        onClose={() => setUploadFor(null)}
      />
    </div>
  );
}

/**
 * Upload do bilhete + conferencia dupla (secao 35).
 *
 * O operador redigita os numeros lidos no bilhete FISICO. O sistema compara
 * com o pedido original. Divergencia => status `discrepancy` e revisao manual;
 * nunca aceitamos automaticamente.
 */
function TicketUploadDialog({
  order, onClose,
}: {
  order: Order | null;
  onClose: () => void;
}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [typed, setTyped] = React.useState<Record<string, { main: string; special: string }>>({});
  const [retailer, setRetailer] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [fileName, setFileName] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTyped({});
    setRetailer('');
    setLocation('');
    setFileName(null);
  }, [order?.id]);

  if (!order) return null;

  const parse = (value: string): number[] =>
    value.split(/[\s,;]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 0);

  const confirm = () => {
    const tickets: Ticket[] = [];
    let discrepancies = 0;

    for (const line of order.lines) {
      const entry = typed[line.id];
      const typedMain = entry ? parse(entry.main) : [];
      const typedSpecial = entry ? parse(entry.special) : [];

      // Se o operador não digitou nada, assume-se conferência não feita:
      // marcamos divergência em vez de aceitar em silêncio.
      const matches =
        entry !== undefined &&
        sameNumbers(typedMain, line.numbers) &&
        sameNumbers(typedSpecial, line.specialNumbers);

      if (!matches) discrepancies += 1;

      tickets.push({
        id: `tk-${crypto.randomUUID()}`,
        ticketRef: `TK-DEMO-${Math.floor(Math.random() * 900000 + 100000)}`,
        orderId: order.id,
        orderLineId: line.id,
        userId: order.userId,
        gameId: line.gameId,
        drawId: order.drawId ?? '',
        status: matches ? 'verified' : 'discrepancy',
        numbers: entry ? typedMain : [],
        specialNumbers: entry ? typedSpecial : [],
        options: line.options,
        retailerName: retailer || null,
        purchaseLocation: location || null,
        purchasedAt: new Date().toISOString(),
        verifiedAt: matches ? new Date().toISOString() : null,
        discrepancyNotes: matches
          ? null
          : 'Números digitados não conferem com o pedido original. Revisão manual necessária.',
        checkedAt: null,
        won: null,
        matchedMain: null,
        matchedSpecial: null,
        prizeTierId: null,
        estimatedPrize: null,
        prizeConfirmed: false,
        resultSource: null,
        isDemo: true,
        images: fileName
          ? [{
              id: `img-${crypto.randomUUID()}`,
              ticketId: '',
              kind: 'front' as const,
              url: fileName,
              redacted: true,
              createdAt: new Date().toISOString(),
            }]
          : [],
      });
    }

    demoStore.update((draft) => {
      draft.tickets.unshift(...tickets);
      const target = draft.orders.find((o) => o.id === order.id);
      if (target) target.status = discrepancies > 0 ? 'ticket_uploaded' : 'verified';
    });

    demoStore.audit({
      userId: profile?.id ?? null, role: 'PURCHASER', action: 'ticket.upload_and_verify',
      entity: 'tickets', entityId: order.id,
      oldValue: null,
      newValue: { tickets: tickets.length, discrepancies },
      severity: discrepancies > 0 ? 'critical' : 'warning',
    });

    demoStore.notify({
      userId: order.userId, eventKey: 'ticket_uploaded',
      title: 'Bilhete digitalizado',
      body: `O bilhete do pedido ${order.orderNumber} foi anexado à sua conta.`,
      priority: 'normal', actionUrl: `/meus-jogos/${order.id}`,
    });

    toast(
      discrepancies > 0
        ? {
            title: `${discrepancies} divergência(s) encontrada(s)`,
            description: 'Os bilhetes foram marcados para revisão manual.',
            variant: 'warning',
          }
        : { title: 'Bilhetes conferidos e verificados', variant: 'success' },
    );
    onClose();
  };

  return (
    <Dialog open={Boolean(order)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conferência dupla · {order.orderNumber}</DialogTitle>
          <DialogDescription>
            Digite os números exatamente como aparecem no bilhete físico. O sistema compara com o
            pedido original — não confira "de olho".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Ponto de venda" htmlFor="retailer">
              <Input id="retailer" value={retailer} onChange={(e) => setRetailer(e.target.value)} />
            </Field>
            <Field label="Local da compra" htmlFor="location">
              <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
            </Field>
          </div>

          <Field
            label="Foto do bilhete (frente)"
            htmlFor="ticket-image"
            hint="A imagem vai para armazenamento privado; a cópia exibida ao cliente oculta serial e código de barras."
          >
            <Input
              id="ticket-image" type="file" accept="image/*"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            />
          </Field>

          <div className="space-y-3">
            <p className="text-sm font-medium">Números lidos no bilhete</p>
            {order.lines.map((line, index) => (
              <div key={line.id} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex flex-wrap items-center gap-3">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Pedido · jogo {String(index + 1).padStart(2, '0')}
                  </span>
                  <NumberSequence
                    numbers={line.numbers}
                    specialNumbers={line.specialNumbers}
                    size="xs"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                  <Input
                    placeholder="Números principais"
                    aria-label={`Números principais do jogo ${index + 1}`}
                    value={typed[line.id]?.main ?? ''}
                    onChange={(e) =>
                      setTyped((c) => ({
                        ...c,
                        [line.id]: { main: e.target.value, special: c[line.id]?.special ?? '' },
                      }))
                    }
                  />
                  <Input
                    placeholder="Especial"
                    aria-label={`Número especial do jogo ${index + 1}`}
                    value={typed[line.id]?.special ?? ''}
                    onChange={(e) =>
                      setTyped((c) => ({
                        ...c,
                        [line.id]: { main: c[line.id]?.main ?? '', special: e.target.value },
                      }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            Reconhecimento automático (OCR) pode ser adicionado depois para pré-preencher estes
            campos, mas a conferência humana permanece obrigatória nos casos críticos.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirm}>Confirmar conferência</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
