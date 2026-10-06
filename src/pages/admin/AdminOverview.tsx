import * as React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Banknote, ClipboardList, ScanLine, ShieldAlert, Ticket, TrendingUp, Users,
} from 'lucide-react';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { usePlatform } from '@/contexts/PlatformContext';
import { useDemoState } from '@/hooks/useDemoState';
import { formatDate, formatUSD } from '@/lib/format';
import { Seo } from '@/components/common/Seo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/states';
import { sanctionsBadge, sanctionsLabel } from '@/services/compliance/engine';

export function AdminOverview() {
  const demo = useDemoState();
  const { settings, jurisdictions, globalTransactionsEnabled } = usePlatform();

  const today = new Date().toISOString().slice(0, 10);
  const ordersToday = demo.orders.filter((o) => o.createdAt.slice(0, 10) === today);
  const salesToday = ordersToday.reduce((sum, o) => sum + o.total, 0);

  const counts = {
    pending: demo.orders.filter((o) => o.status === 'pending_payment').length,
    awaitingPurchase: demo.orders.filter((o) => o.status === 'awaiting_purchase').length,
    awaitingUpload: demo.orders.filter((o) => o.status === 'purchased').length,
    discrepancy: demo.tickets.filter((t) => t.status === 'discrepancy').length,
    processed: demo.orders
      .filter((o) => !['cancelled', 'refunded', 'pending_payment'].includes(o.status))
      .reduce((sum, o) => sum + o.total, 0),
    customers: new Set(demo.orders.map((o) => o.userId)).size,
    prizesPending: demo.prizeClaims.filter(
      (c) => !['customer_paid', 'rejected', 'expired'].includes(c.status),
    ).length,
  };

  const enabledJurisdictions = jurisdictions.filter((j) => j.transactionsEnabled);

  // Série dos últimos 14 dias, a partir dos pedidos existentes.
  const series = React.useMemo(() => {
    const days: { date: string; label: string; total: number; orders: number }[] = [];
    for (let i = 13; i >= 0; i -= 1) {
      const date = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      const dayOrders = demo.orders.filter((o) => o.createdAt.slice(0, 10) === date);
      days.push({
        date,
        label: formatDate(date).slice(0, 5),
        total: dayOrders.reduce((sum, o) => sum + o.total, 0),
        orders: dayOrders.length,
      });
    }
    return days;
  }, [demo.orders]);

  const hasData = demo.orders.length > 0;

  return (
    <div className="space-y-6">
      <Seo title="Painel administrativo" description="Visão geral da operação." noIndex />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Visão geral</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estado atual da operação e dos portões de compliance.
          </p>
        </div>
      </header>

      {/* Estado dos portões — informação mais importante da tela */}
      <section
        className={
          'rounded-xl border p-5 ' +
          (globalTransactionsEnabled
            ? 'border-success/30 bg-success/5'
            : 'border-warning/40 bg-warning/5')
        }
      >
        <div className="flex items-start gap-3">
          <ShieldAlert
            className={
              'mt-0.5 size-5 shrink-0 ' +
              (globalTransactionsEnabled ? 'text-success' : 'text-warning')
            }
            aria-hidden
          />
          <div className="space-y-2">
            <h2 className="font-display font-semibold">
              {globalTransactionsEnabled
                ? 'Transações habilitadas globalmente'
                : 'Plataforma em modo demonstração'}
            </h2>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant={settings.transactionsEnabled ? 'success' : 'neutral'}>
                Kill switch: {settings.transactionsEnabled ? 'ligado' : 'desligado'}
              </Badge>
              <Badge variant={enabledJurisdictions.length > 0 ? 'success' : 'neutral'}>
                Jurisdições habilitadas: {enabledJurisdictions.length}/{jurisdictions.length}
              </Badge>
              <Badge variant={sanctionsBadge(settings.sanctionsScreeningMode)}>
                Triagem de sanções: {sanctionsLabel(settings.sanctionsScreeningMode)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Uma compra só é processada com os três portões abertos — variável de ambiente,
              configuração do sistema e jurisdição — e com o Compliance Engine aprovando.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/jurisdicoes">Gerenciar jurisdições</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/admin/configuracoes">Configurações</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={TrendingUp} label="Vendas hoje" value={formatUSD(salesToday)} hint={`${ordersToday.length} pedido(s)`} />
        <StatCard icon={ClipboardList} label="Pedidos pendentes" value={String(counts.pending)} />
        <StatCard icon={Ticket} label="Aguardando compra" value={String(counts.awaitingPurchase)} accent={counts.awaitingPurchase > 0} />
        <StatCard icon={ScanLine} label="Aguardando upload" value={String(counts.awaitingUpload)} accent={counts.awaitingUpload > 0} />
        <StatCard icon={AlertTriangle} label="Bilhetes com divergência" value={String(counts.discrepancy)} accent={counts.discrepancy > 0} />
        <StatCard icon={Banknote} label="Valor processado" value={formatUSD(counts.processed)} />
        <StatCard icon={Users} label="Clientes ativos" value={String(counts.customers)} />
        <StatCard icon={Ticket} label="Prêmios pendentes" value={String(counts.prizesPending)} accent={counts.prizesPending > 0} />
      </section>

      {/* Gráfico */}
      <section className="surface p-5">
        <h2 className="font-display font-semibold">Pedidos nos últimos 14 dias</h2>
        {hasData ? (
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                <defs>
                  <linearGradient id="admin-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label" tickLine={false} axisLine={false}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  tickLine={false} axisLine={false} width={56}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [formatUSD(value), 'Total']}
                />
                <Area
                  type="monotone" dataKey="total"
                  stroke="hsl(var(--primary))" strokeWidth={2}
                  fill="url(#admin-area)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState
            className="mt-4"
            title="Sem pedidos registrados"
            description="Assim que houver pedidos, o gráfico e os indicadores passam a refletir a operação real."
          />
        )}
      </section>

      {/* Auditoria recente */}
      <section className="surface p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display font-semibold">Atividade recente</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin/auditoria">Ver todos os logs</Link>
          </Button>
        </div>
        {demo.auditLogs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhuma ação registrada ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {demo.auditLogs.slice(0, 8).map((log) => (
              <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="font-medium">{log.action}</span>
                <span className="text-muted-foreground">
                  {log.entity} · {new Date(log.createdAt).toLocaleString('pt-BR')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, hint, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div className={'surface p-5 ' + (accent ? 'ring-1 ring-warning/30' : '')}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className={'size-4 ' + (accent ? 'text-warning' : 'text-muted-foreground')} aria-hidden />
      </div>
      <p className="tnum mt-2 font-display text-2xl font-bold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
