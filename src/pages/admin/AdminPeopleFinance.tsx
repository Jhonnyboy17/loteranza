import * as React from 'react';
import { CreditCard, LifeBuoy, ShieldCheck, Trophy, Users } from 'lucide-react';
import { useDemoState } from '@/hooks/useDemoState';
import { usePlatform } from '@/contexts/PlatformContext';
import { formatDateTime, formatUSD } from '@/lib/format';
import { Seo } from '@/components/common/Seo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper,
} from '@/components/ui/table';
import { EmptyState } from '@/components/common/states';
import { PRIZE_CLAIM_LABELS } from '@/pages/account/orderStatus';

export function AdminCustomers() {
  const demo = useDemoState();
  const customers = Array.from(
    demo.orders.reduce((map, order) => {
      const entry = map.get(order.userId) ?? { userId: order.userId, orders: 0, total: 0, last: '' };
      entry.orders += 1;
      entry.total += order.total;
      entry.last = order.createdAt > entry.last ? order.createdAt : entry.last;
      map.set(order.userId, entry);
      return map;
    }, new Map<string, { userId: string; orders: number; total: number; last: string }>()).values(),
  );

  return (
    <div className="space-y-6">
      <Seo title="Clientes" description="Base de clientes." noIndex />
      <header>
        <h1 className="font-display text-2xl font-bold">Clientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Visão operacional. Documentos de identidade não são exibidos aqui — apenas COMPLIANCE
          acessa a área de KYC.
        </p>
      </header>

      {customers.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum cliente com pedidos" />
      ) : (
        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Pedidos</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Último pedido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.userId}>
                  <TableCell className="font-mono text-xs">{customer.userId}</TableCell>
                  <TableCell className="tnum">{customer.orders}</TableCell>
                  <TableCell className="tnum">{formatUSD(customer.total)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(customer.last)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
    </div>
  );
}

export function AdminKyc() {
  const { settings } = usePlatform();

  return (
    <div className="space-y-6">
      <Seo title="KYC" description="Verificação de identidade." noIndex />
      <header>
        <h1 className="font-display text-2xl font-bold">Verificação de identidade</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Documentos e selfies são processados por um provedor externo. A plataforma guarda apenas
          a referência da verificação, o status e os quatro últimos dígitos do documento.
        </p>
      </header>

      <div className="notice-strip border-border bg-muted/40">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="text-sm">
          <p className="font-medium">
            Provedor atual: {settings.lotteryDataProvider === 'demo' ? 'nenhum configurado' : 'configurado'}
          </p>
          <p className="mt-1 text-muted-foreground">
            Enquanto não houver provedor, a verificação de identidade não pode ser concluída e
            qualquer jurisdição que exija KYC manterá os pedidos em revisão.
          </p>
        </div>
      </div>

      <EmptyState
        icon={ShieldCheck}
        title="Nenhuma verificação pendente"
        description="Verificações aparecem aqui quando um cliente inicia o processo em uma jurisdição que exige KYC."
      />

      <section className="surface p-5">
        <h2 className="font-display font-semibold">Estados possíveis</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {['not_started', 'pending', 'approved', 'rejected', 'manual_review', 'expired'].map((state) => (
            <Badge key={state} variant="neutral">{state}</Badge>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function AdminPayments() {
  const { settings } = usePlatform();

  return (
    <div className="space-y-6">
      <Seo title="Pagamentos" description="Transações." noIndex />
      <header>
        <h1 className="font-display text-2xl font-bold">Pagamentos</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Nenhum provedor de pagamento está habilitado. Habilitar exige provedor contratado que
          aceite expressamente este tipo de operação na jurisdição correspondente.
        </p>
      </header>

      <TableWrapper>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provedor</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Moeda</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Jurisdições</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              ['Cartão de crédito', 'card', 'USD'],
              ['Débito em conta (ACH)', 'ach', 'USD'],
              ['PIX', 'pix', 'BRL'],
              ['Transferência bancária', 'bank_transfer', 'USD'],
            ].map(([name, method, currency]) => (
              <TableRow key={method}>
                <TableCell className="font-medium">{name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{method}</TableCell>
                <TableCell className="text-sm">{currency}</TableCell>
                <TableCell><Badge variant="neutral">desabilitado</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">nenhuma</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableWrapper>

      <section className="surface p-5">
        <div className="flex items-start gap-3">
          <CreditCard className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="text-sm">
            <h2 className="font-display font-semibold">Regras da camada de pagamento</h2>
            <ul className="mt-2 space-y-1.5 text-muted-foreground">
              <li>• A natureza da operação é sempre declarada ao processador. O descritor de fatura e o código de categoria fazem parte da interface do provedor — não há caminho para disfarçar a transação.</li>
              <li>• O número completo do cartão nunca chega a esta plataforma. Guardamos, no máximo, bandeira e quatro últimos dígitos.</li>
              <li>• Cada provedor é habilitado individualmente por jurisdição.</li>
              <li>• Cotação: {settings.fxProvider}. A taxa usada é registrada no pedido e não muda depois.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

export function AdminRefunds() {
  const demo = useDemoState();
  const refundable = demo.orders.filter((o) => ['refunded', 'cancelled'].includes(o.status));

  return (
    <div className="space-y-6">
      <Seo title="Reembolsos" description="Reembolsos." noIndex />
      <header>
        <h1 className="font-display text-2xl font-bold">Reembolsos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pedidos cancelados ou reembolsados.
        </p>
      </header>

      {refundable.length === 0 ? (
        <EmptyState title="Nenhum reembolso registrado" />
      ) : (
        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {refundable.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
                  <TableCell className="tnum">{formatUSD(order.total)}</TableCell>
                  <TableCell><Badge variant="neutral">{order.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(order.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
    </div>
  );
}

export function AdminPrizes() {
  const demo = useDemoState();
  const { settings } = usePlatform();

  return (
    <div className="space-y-6">
      <Seo title="Prêmios" description="Processos de resgate." noIndex />
      <header>
        <h1 className="font-display text-2xl font-bold">Prêmios</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Prêmios acima de {formatUSD(settings.prizeManualReviewThreshold)} exigem revisão humana e
          dupla aprovação. Não há pagamento automático em nenhuma faixa.
        </p>
      </header>

      {demo.prizeClaims.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Nenhum processo de resgate"
          description="Processos são abertos automaticamente quando a conferência identifica um bilhete premiado — sempre no estado inicial 'detectado'."
        />
      ) : (
        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Processo</TableHead>
                <TableHead>Valor bruto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dupla aprovação</TableHead>
                <TableHead>Aberto em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demo.prizeClaims.map((claim) => (
                <TableRow key={claim.id}>
                  <TableCell className="font-medium">{claim.claimRef}</TableCell>
                  <TableCell className="tnum">{formatUSD(claim.grossAmount)}</TableCell>
                  <TableCell>
                    <Badge variant="warning">{PRIZE_CLAIM_LABELS[claim.status]}</Badge>
                  </TableCell>
                  <TableCell>{claim.requiresDualApproval ? 'exigida' : 'não exigida'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(claim.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      <section className="surface p-5">
        <h2 className="font-display font-semibold">Fluxo de resgate</h2>
        <ol className="mt-3 flex flex-wrap gap-2">
          {Object.entries(PRIZE_CLAIM_LABELS)
            .filter(([key]) => !['rejected', 'expired'].includes(key))
            .map(([key, label]) => (
              <li key={key}><Badge variant="neutral">{label}</Badge></li>
            ))}
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Prazos, documentos exigidos, retenções e eventual necessidade de comparecimento
          presencial dependem do órgão oficial da loteria e da jurisdição.
        </p>
      </section>
    </div>
  );
}

export function AdminSupport() {
  const demo = useDemoState();

  return (
    <div className="space-y-6">
      <Seo title="Suporte" description="Chamados." noIndex />
      <header>
        <h1 className="font-display text-2xl font-bold">Suporte</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chamados abertos pelos clientes.
        </p>
      </header>

      {demo.supportTickets.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="Nenhum chamado aberto"
          description="Chamados aparecem aqui com os estados: aberto, aguardando cliente, aguardando interno e resolvido."
        />
      ) : (
        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Chamado</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aberto em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demo.supportTickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell className="font-medium">{ticket.ticketRef}</TableCell>
                  <TableCell>{ticket.subject}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{ticket.category}</TableCell>
                  <TableCell><Badge variant="neutral">{ticket.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(ticket.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
    </div>
  );
}

export function AdminReports() {
  const demo = useDemoState();

  const totals = React.useMemo(() => {
    const valid = demo.orders.filter(
      (o) => !['cancelled', 'refunded', 'pending_payment'].includes(o.status),
    );
    return {
      orders: valid.length,
      official: valid.reduce((sum, o) => sum + o.officialTicketCost, 0),
      fees: valid.reduce((sum, o) => sum + o.serviceFee, 0),
      total: valid.reduce((sum, o) => sum + o.total, 0),
    };
  }, [demo.orders]);

  return (
    <div className="space-y-6">
      <Seo title="Relatórios" description="Relatórios operacionais." noIndex />
      <header>
        <h1 className="font-display text-2xl font-bold">Relatórios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consolidação de valores, sempre separando produto de taxa de serviço.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportCard label="Pedidos válidos" value={String(totals.orders)} />
        <ReportCard label="Valor oficial das apostas" value={formatUSD(totals.official)} />
        <ReportCard label="Taxas de serviço" value={formatUSD(totals.fees)} />
        <ReportCard label="Total processado" value={formatUSD(totals.total)} />
      </div>

      <section className="surface p-5">
        <h2 className="font-display font-semibold">Exportações</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Relatórios exportáveis para conciliação financeira e prestação de contas regulatória.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled>Pedidos (CSV)</Button>
          <Button variant="outline" size="sm" disabled>Pagamentos (CSV)</Button>
          <Button variant="outline" size="sm" disabled>Bilhetes (CSV)</Button>
          <Button variant="outline" size="sm" disabled>Trilha de auditoria (CSV)</Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Exportações são geradas no servidor, com registro de quem exportou e quando.
        </p>
      </section>
    </div>
  );
}

function ReportCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tnum mt-2 font-display text-xl font-bold">{value}</p>
    </div>
  );
}
