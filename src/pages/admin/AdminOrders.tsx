import * as React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Archive, ScanLine } from 'lucide-react';
import type { OrderStatus } from '@/types/domain';
import { useDemoState } from '@/hooks/useDemoState';
import { useGames } from '@/hooks/useLotteryQueries';
import { demoStore } from '@/services/platform/demoStore';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import { formatDateTime, formatUSD } from '@/lib/format';
import { Seo } from '@/components/common/Seo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper,
} from '@/components/ui/table';
import { EmptyState } from '@/components/common/states';
import { NumberSequence } from '@/components/lottery/NumberBall';
import { ORDER_STATUS_LABELS, TICKET_STATUS_LABELS, orderStatusVariant } from '@/pages/account/orderStatus';

const STATUS_OPTIONS: (OrderStatus | 'all')[] = [
  'all', 'pending_payment', 'paid', 'compliance_review', 'awaiting_purchase',
  'purchased', 'ticket_uploaded', 'verified', 'awaiting_draw', 'winner',
  'not_winner', 'cancelled', 'refunded',
];

export function AdminOrders() {
  const demo = useDemoState();
  const gamesQuery = useGames();
  const [status, setStatus] = React.useState<string>('all');
  const [search, setSearch] = React.useState('');

  const filtered = demo.orders
    .filter((o) => (status === 'all' ? true : o.status === status))
    .filter((o) =>
      search.trim() === ''
        ? true
        : o.orderNumber.toLowerCase().includes(search.trim().toLowerCase()),
    );

  return (
    <div className="space-y-6">
      <Seo title="Pedidos" description="Todos os pedidos." noIndex />

      <header>
        <h1 className="font-display text-2xl font-bold">Pedidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {demo.orders.length} pedido(s) registrados.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="w-56">
          <Field label="Status" htmlFor="status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === 'all' ? 'Todos' : ORDER_STATUS_LABELS[option as OrderStatus]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="w-56">
          <Field label="Buscar por número" htmlFor="search">
            <Input id="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="JP-…" />
          </Field>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Nenhum pedido encontrado"
          description="Ajuste os filtros ou aguarde novos pedidos."
        />
      ) : (
        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Loteria</TableHead>
                <TableHead>Jogos</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead>Criado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((order) => {
                const game = (gamesQuery.data ?? []).find((g) => g.id === order.gameId);
                return (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {order.orderNumber}
                        {order.isDemo && <Badge variant="demo">demo</Badge>}
                      </span>
                    </TableCell>
                    <TableCell>{game?.name ?? '—'}</TableCell>
                    <TableCell className="tnum">{order.lines.length}</TableCell>
                    <TableCell className="tnum">{formatUSD(order.total)}</TableCell>
                    <TableCell>
                      <Badge variant={orderStatusVariant(order.status)}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{order.complianceStatus}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(order.createdAt)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
    </div>
  );
}

/* ========================================================================== */

export function AdminTickets() {
  const demo = useDemoState();
  const gamesQuery = useGames();
  const { profile } = useAuth();
  const { toast } = useToast();

  const resolveDiscrepancy = (ticketId: string, accept: boolean) => {
    demoStore.update((draft) => {
      const ticket = draft.tickets.find((t) => t.id === ticketId);
      if (!ticket) return;
      ticket.status = accept ? 'verified' : 'void';
      ticket.verifiedAt = accept ? new Date().toISOString() : null;
      ticket.discrepancyNotes = accept
        ? 'Divergência revisada e aceita manualmente.'
        : 'Bilhete anulado após revisão da divergência.';
    });
    demoStore.audit({
      userId: profile?.id ?? null, role: 'TICKET_VERIFIER',
      action: accept ? 'ticket.discrepancy_accepted' : 'ticket.voided',
      entity: 'tickets', entityId: ticketId,
      oldValue: { status: 'discrepancy' }, newValue: { status: accept ? 'verified' : 'void' },
      severity: 'critical',
    });
    toast({
      title: accept ? 'Divergência aceita' : 'Bilhete anulado',
      description: 'Ação registrada no log de auditoria.',
      variant: accept ? 'success' : 'warning',
    });
  };

  const discrepancies = demo.tickets.filter((t) => t.status === 'discrepancy');

  return (
    <div className="space-y-6">
      <Seo title="Bilhetes" description="Bilhetes adquiridos." noIndex />

      <header>
        <h1 className="font-display text-2xl font-bold">Bilhetes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {demo.tickets.length} bilhete(s) · {discrepancies.length} com divergência.
        </p>
      </header>

      {discrepancies.length > 0 && (
        <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
            <div className="flex-1 space-y-4">
              <div>
                <h2 className="font-display font-semibold">Divergências aguardando revisão</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  O bilhete adquirido não bate com o pedido original. Revise manualmente antes de
                  qualquer decisão.
                </p>
              </div>
              <ul className="space-y-3">
                {discrepancies.map((ticket) => {
                  const order = demo.orders.find((o) => o.id === ticket.orderId);
                  const line = order?.lines.find((l) => l.id === ticket.orderLineId);
                  return (
                    <li key={ticket.id} className="rounded-lg border border-border bg-card p-4">
                      <p className="text-sm font-medium">{ticket.ticketRef}</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase text-muted-foreground">Pedido original</p>
                          {line && (
                            <NumberSequence
                              numbers={line.numbers} specialNumbers={line.specialNumbers} size="xs"
                            />
                          )}
                        </div>
                        <div>
                          <p className="text-xs uppercase text-muted-foreground">Bilhete adquirido</p>
                          <NumberSequence
                            numbers={ticket.numbers} specialNumbers={ticket.specialNumbers} size="xs"
                          />
                        </div>
                      </div>
                      {ticket.discrepancyNotes && (
                        <p className="mt-3 text-xs text-muted-foreground">{ticket.discrepancyNotes}</p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={() => resolveDiscrepancy(ticket.id, true)}>
                          Aceitar após revisão
                        </Button>
                        <Button
                          size="sm" variant="outline" className="text-destructive"
                          onClick={() => resolveDiscrepancy(ticket.id, false)}
                        >
                          Anular bilhete
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      )}

      {demo.tickets.length === 0 ? (
        <EmptyState
          icon={ScanLine}
          title="Nenhum bilhete registrado"
          description="Bilhetes aparecem aqui depois que um operador conclui a compra e faz o upload."
        />
      ) : (
        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bilhete</TableHead>
                <TableHead>Loteria</TableHead>
                <TableHead>Números</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Adquirido</TableHead>
                <TableHead>Pedido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demo.tickets.map((ticket) => {
                const game = (gamesQuery.data ?? []).find((g) => g.id === ticket.gameId);
                return (
                  <TableRow key={ticket.id}>
                    <TableCell className="font-medium">{ticket.ticketRef}</TableCell>
                    <TableCell>{game?.name ?? '—'}</TableCell>
                    <TableCell>
                      <NumberSequence
                        numbers={ticket.numbers} specialNumbers={ticket.specialNumbers} size="xs"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={ticket.status === 'discrepancy' ? 'danger' : 'neutral'}>
                        {TICKET_STATUS_LABELS[ticket.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(ticket.purchasedAt)}
                    </TableCell>
                    <TableCell>
                      <Link
                        to={`/meus-jogos/${ticket.orderId}`}
                        className="text-sm underline underline-offset-4"
                      >
                        ver
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
    </div>
  );
}

/* ========================================================================== */

export function AdminVault() {
  const demo = useDemoState();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [location, setLocation] = React.useState('Cofre A');
  const [box, setBox] = React.useState('01');

  const storable = demo.tickets.filter((t) => ['verified', 'uploaded'].includes(t.status));

  const store = (ticketId: string) => {
    demoStore.audit({
      userId: profile?.id ?? null, role: 'TICKET_VERIFIER', action: 'vault.store',
      entity: 'ticket_vault', entityId: ticketId,
      oldValue: null, newValue: { location, box, storedAt: new Date().toISOString() },
      severity: 'warning',
    });
    toast({
      title: 'Movimentação registrada',
      description: `Bilhete guardado em ${location} · caixa ${box}. Evento adicionado à cadeia de custódia.`,
      variant: 'success',
    });
  };

  return (
    <div className="space-y-6">
      <Seo title="Cofre" description="Guarda física dos bilhetes." noIndex />

      <header>
        <h1 className="font-display text-2xl font-bold">Cofre de bilhetes</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Cada movimentação — guardar, conferir, retirar — cria um evento de cadeia de custódia com
          responsável e horário, além de um registro imutável no log de auditoria.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        <div className="w-44">
          <Field label="Local" htmlFor="vault-location">
            <Input id="vault-location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
        </div>
        <div className="w-28">
          <Field label="Caixa" htmlFor="vault-box">
            <Input id="vault-box" value={box} onChange={(e) => setBox(e.target.value)} />
          </Field>
        </div>
      </div>

      {storable.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="Nenhum bilhete pronto para guarda"
          description="Bilhetes verificados aparecem aqui para registro no cofre."
        />
      ) : (
        <ul className="space-y-3">
          {storable.map((ticket) => (
            <li
              key={ticket.id}
              className="surface flex flex-wrap items-center justify-between gap-4 p-4"
            >
              <div className="space-y-2">
                <p className="font-medium">{ticket.ticketRef}</p>
                <NumberSequence
                  numbers={ticket.numbers} specialNumbers={ticket.specialNumbers} size="xs"
                />
              </div>
              <Button size="sm" onClick={() => store(ticket.id)}>
                <Archive aria-hidden /> Registrar guarda
              </Button>
            </li>
          ))}
        </ul>
      )}

      <section className="surface p-5">
        <h2 className="font-display font-semibold">Cadeia de custódia recente</h2>
        {demo.auditLogs.filter((l) => l.entity === 'ticket_vault').length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {demo.auditLogs
              .filter((l) => l.entity === 'ticket_vault')
              .slice(0, 10)
              .map((log) => (
                <li key={log.id} className="flex flex-wrap justify-between gap-2 py-2.5">
                  <span className="font-medium">{log.action}</span>
                  <span className="text-muted-foreground">{formatDateTime(log.createdAt)}</span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}
