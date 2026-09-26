import * as React from 'react';
import { Link } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { Sym, type IconName } from '@/components/ui/icon';
import type { OrderStatus } from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import { useDemoState } from '@/hooks/useDemoState';
import { useGames } from '@/hooks/useLotteryQueries';
import { formatUSD } from '@/lib/format';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/common/states';
import { NumberSequence } from '@/components/lottery/NumberBall';
import { OrderCard } from '@/components/account/OrderCard';
import { orderStatusVariant } from './orderStatus';

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
    <div className="mx-auto w-full max-w-[560px] px-space-md py-space-lg lg:max-w-[1100px]">
      <Seo title="Meus jogos" description="Acompanhe seus jogos e pedidos." noIndex />

      <header className="mb-space-md">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">
          Olá, {profile?.displayName ?? profile?.fullName ?? 'tudo bem'}
        </h1>
        <p className="mt-1 font-body-md text-body-md text-outline">
          Seus pedidos, bilhetes e resultados.
        </p>
      </header>

      <div className="mb-space-md grid grid-cols-2 gap-space-sm lg:grid-cols-4">
        <StatCard icon="confirmation_number" label="Pedidos ativos" value={String(buckets.ativos.length)} />
        <StatCard icon="document_scanner" label="Bilhetes" value={String(demo.tickets.length)} />
        <StatCard icon="emoji_events" label="Premiados" value={String(buckets.premiados.length)} />
        <StatCard icon="payments" label="Total pago" value={formatUSD(totalSpent)} />
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
              <ul className="flex flex-col gap-space-sm lg:grid lg:grid-cols-2">
                {buckets[key].map((order) => (
                  <li key={order.id}>
                    <OrderCard
                      order={order}
                      game={(gamesQuery.data ?? []).find((g) => g.id === order.gameId)}
                      tone={orderStatusVariant(order.status)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        ))}

        <TabsContent value="assinaturas">
          <EmptyState
            icon={Ticket}
            title="Nenhuma assinatura ativa"
            description="Assinatura automática fica disponível apenas nas jurisdições onde for juridicamente permitida. Ainda não habilitada."
          />
        </TabsContent>

        <TabsContent value="favoritos">
          {demo.favorites.length === 0 ? (
            <EmptyState
              icon={Ticket}
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
  icon, label, value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-space-sm rounded-xl bg-surface-container-low p-space-sm shadow-soft">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Sym name={icon} size={18} />
      </span>
      <div className="min-w-0">
        <p className="truncate font-label-xs text-label-xs uppercase tracking-wider text-outline">
          {label}
        </p>
        <p className="font-display text-headline-sm font-bold tabular-nums text-on-surface">
          {value}
        </p>
      </div>
    </div>
  );
}
