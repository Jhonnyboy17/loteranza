import * as React from 'react';
import { Link } from 'react-router-dom';
import { Bell, Heart, Star, Ticket, Trophy } from 'lucide-react';
import type { OrderStatus } from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import { useDemoState } from '@/hooks/useDemoState';
import { useGames } from '@/hooks/useLotteryQueries';
import { formatDate, formatUSD } from '@/lib/format';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/common/states';
import { NumberSequence } from '@/components/lottery/NumberBall';
import { ORDER_STATUS_LABELS, orderStatusVariant } from './orderStatus';

const ACTIVE_STATUSES: OrderStatus[] = [
  'pending_payment', 'paid', 'compliance_review', 'awaiting_purchase',
  'purchased', 'ticket_uploaded', 'verified', 'awaiting_draw',
];
const FINISHED_STATUSES: OrderStatus[] = [
  'not_winner', 'paid_out', 'cancelled', 'refunded',
];
const WINNER_STATUSES: OrderStatus[] = ['winner', 'claim_processing'];

export function MyGamesPage() {
  const { isAuthenticated, profile } = useAuth();
  const demo = useDemoState();
  const gamesQuery = useGames();

  const orders = demo.orders.filter((order) => order.userId === (profile?.id ?? ''));

  const buckets = React.useMemo(
    () => ({
      ativos: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)),
      finalizados: orders.filter((o) => FINISHED_STATUSES.includes(o.status)),
      premiados: orders.filter((o) => WINNER_STATUSES.includes(o.status)),
    }),
    [orders],
  );

  if (!isAuthenticated) {
    return (
      <div className="container py-16">
        <Seo title="Meus jogos" description="Acompanhe seus jogos e pedidos." noIndex />
        <EmptyState
          icon={Ticket}
          title="Entre para ver seus jogos"
          description="Sua conta reúne pedidos, bilhetes, resultados e histórico em um só lugar."
          action={
            <div className="flex gap-2">
              <Button asChild><Link to="/entrar">Entrar</Link></Button>
              <Button asChild variant="outline"><Link to="/criar-conta">Criar conta</Link></Button>
            </div>
          }
        />
      </div>
    );
  }

  const totalSpent = orders
    .filter((o) => !['cancelled', 'refunded', 'pending_payment'].includes(o.status))
    .reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="container py-10">
      <Seo title="Meus jogos" description="Acompanhe seus jogos e pedidos." noIndex />

      <header className="mb-8">
        <h1 className="text-display-xl font-extrabold">
          Olá, {profile?.displayName ?? profile?.fullName ?? 'tudo bem'}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Seus pedidos, bilhetes e resultados.
        </p>
      </header>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Ticket} label="Pedidos ativos" value={String(buckets.ativos.length)} />
        <StatCard icon={Star} label="Bilhetes" value={String(demo.tickets.length)} />
        <StatCard icon={Trophy} label="Premiados" value={String(buckets.premiados.length)} />
        <StatCard icon={Bell} label="Total investido" value={formatUSD(totalSpent)} />
      </div>

      <Tabs defaultValue="ativos">
        <TabsList>
          <TabsTrigger value="ativos">Ativos</TabsTrigger>
          <TabsTrigger value="finalizados">Finalizados</TabsTrigger>
          <TabsTrigger value="premiados">Premiados</TabsTrigger>
          <TabsTrigger value="assinaturas">Assinaturas</TabsTrigger>
          <TabsTrigger value="favoritos">Favoritos</TabsTrigger>
        </TabsList>

        {(['ativos', 'finalizados', 'premiados'] as const).map((key) => (
          <TabsContent key={key} value={key}>
            {buckets[key].length === 0 ? (
              <EmptyState
                icon={Ticket}
                title={`Nenhum pedido ${key === 'ativos' ? 'ativo' : key === 'finalizados' ? 'finalizado' : 'premiado'}`}
                description={
                  key === 'ativos'
                    ? 'Monte seus jogos para começar a acompanhar por aqui.'
                    : 'Assim que houver pedidos nesta situação, eles aparecem aqui.'
                }
                action={
                  key === 'ativos'
                    ? <Button asChild><Link to="/loterias">Ver loterias</Link></Button>
                    : undefined
                }
              />
            ) : (
              <ul className="space-y-3">
                {buckets[key].map((order) => {
                  const game = (gamesQuery.data ?? []).find((g) => g.id === order.gameId);
                  return (
                    <li key={order.id} className="surface p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-display font-semibold">
                              {game?.name ?? 'Pedido'}
                            </h2>
                            <Badge variant={orderStatusVariant(order.status)}>
                              {ORDER_STATUS_LABELS[order.status]}
                            </Badge>
                            {order.isDemo && <Badge variant="demo">Demonstração</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {order.orderNumber} · {formatDate(order.createdAt)} ·{' '}
                            {order.lines.length} {order.lines.length === 1 ? 'jogo' : 'jogos'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="tnum font-semibold">{formatUSD(order.total)}</p>
                          <Button asChild variant="ghost" size="sm">
                            <Link to={`/meus-jogos/${order.id}`}>Ver detalhes</Link>
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 space-y-1.5">
                        {order.lines.slice(0, 3).map((line) => (
                          <NumberSequence
                            key={line.id}
                            numbers={line.numbers}
                            specialNumbers={line.specialNumbers}
                            size="xs"
                          />
                        ))}
                        {order.lines.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            + {order.lines.length - 3} jogo(s)
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </TabsContent>
        ))}

        <TabsContent value="assinaturas">
          <EmptyState
            icon={Bell}
            title="Nenhuma assinatura ativa"
            description="Assinatura automática fica disponível apenas nas jurisdições onde for juridicamente permitida. Ainda não habilitada."
          />
        </TabsContent>

        <TabsContent value="favoritos">
          {demo.favorites.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="Nenhuma combinação salva"
              description="Salve suas combinações preferidas para jogar de novo com um clique."
              action={<Button asChild><Link to="/loterias">Montar um jogo</Link></Button>}
            />
          ) : (
            <ul className="space-y-3">
              {demo.favorites.map((favorite) => (
                <li key={favorite.id} className="surface flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="space-y-2">
                    <p className="font-medium">{favorite.label}</p>
                    <NumberSequence
                      numbers={favorite.numbers}
                      specialNumbers={favorite.specialNumbers}
                      size="sm"
                    />
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/loterias/${(gamesQuery.data ?? []).find((g) => g.id === favorite.gameId)?.gameKey ?? ''}`}>
                      Jogar novamente
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="surface flex items-center gap-4 p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="tnum font-display text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}
