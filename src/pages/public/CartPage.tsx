import { Link } from 'react-router-dom';
import { Copy, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { usePlatform } from '@/contexts/PlatformContext';
import { useGames, useUpcomingDraws } from '@/hooks/useLotteryQueries';
import { formatDate, formatUSD } from '@/lib/format';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/states';
import { NumberSequence } from '@/components/lottery/NumberBall';
import { GameTheme } from '@/components/lottery/GameTheme';
import { Countdown } from '@/components/lottery/Countdown';
import { CartSummary } from '@/components/cart/CartSummary';
import { StickyCartBar } from '@/components/cart/StickyCartBar';
import { JurisdictionNotice } from '@/components/compliance/notices';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

export function CartPage() {
  const { items, totals, removeLine, duplicateLine, removeItem, setDrawsCount } = useCart();
  const { jurisdiction } = usePlatform();
  const gamesQuery = useGames();

  return (
    <div className="container py-10 pb-24 lg:pb-10">
      <Seo
        title="Carrinho"
        description="Revise seus jogos antes de continuar."
        canonicalPath="/carrinho"
        noIndex
      />

      <h1 className="mb-6 text-display-lg font-extrabold">Carrinho</h1>

      {items.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Seu carrinho está vazio"
          description="Escolha uma loteria e monte seus jogos para continuar."
          action={<Button asChild><Link to="/loterias">Ver loterias</Link></Button>}
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-6">
            <JurisdictionNotice jurisdiction={jurisdiction} />

            {items.map((item) => {
              const game = (gamesQuery.data ?? []).find((g) => g.id === item.gameId);
              return (
                <CartItemCard
                  key={item.id}
                  itemId={item.id}
                  gameName={item.gameName}
                  gameKey={item.gameKey}
                  drawId={item.drawId}
                  gameId={item.gameId}
                  drawsCount={item.drawsCount}
                  maxDrawsAhead={game?.maxDrawsAhead ?? 10}
                  lines={item.lines}
                  unitOfficialPrice={item.unitOfficialPrice}
                  unitServiceFee={item.unitServiceFee}
                  multiplierPrice={item.multiplierPrice}
                  multiplierLabel={game?.multiplierLabel ?? null}
                  brandColor={game?.brandColor ?? null}
                  onRemoveLine={(lineId) => removeLine(item.id, lineId)}
                  onDuplicateLine={(lineId) => duplicateLine(item.id, lineId)}
                  onRemoveItem={() => removeItem(item.id)}
                  onDrawsCountChange={(count) => setDrawsCount(item.id, count)}
                  showSubtotal={items.length > 1}
                />
              );
            })}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <CartSummary
              totals={totals}
              actionLabel="Ir para o checkout"
              actionHref="/checkout"
              footer={
                <p className="text-xs text-muted-foreground">
                  Os valores são recalculados no servidor no momento do checkout. Se houver
                  qualquer diferença, prevalece o cálculo do servidor.
                </p>
              }
            />
          </aside>
        </div>
      )}

      <StickyCartBar
        lineCount={totals.lineCount}
        total={totals.total}
        actionLabel="Checkout"
        onAction={() => { window.location.href = '/checkout'; }}
      />
    </div>
  );
}

function CartItemCard({
  gameName, gameKey, gameId, drawId, drawsCount, maxDrawsAhead, lines,
  unitOfficialPrice, unitServiceFee, multiplierPrice, showSubtotal,
  multiplierLabel, brandColor, onRemoveLine, onDuplicateLine, onRemoveItem, onDrawsCountChange,
}: {
  itemId: string;
  gameName: string;
  gameKey: string;
  gameId: string;
  drawId: string | null;
  drawsCount: number;
  maxDrawsAhead: number;
  lines: { id: string; numbers: number[]; specialNumbers: number[]; isQuickPick: boolean; options: { multiplier?: boolean } }[];
  unitOfficialPrice: number;
  unitServiceFee: number;
  multiplierPrice: number;
  showSubtotal: boolean;
  multiplierLabel: string | null;
  brandColor: string | null;
  onRemoveLine: (lineId: string) => void;
  onDuplicateLine: (lineId: string) => void;
  onRemoveItem: () => void;
  onDrawsCountChange: (count: number) => void;
}) {
  const drawsQuery = useUpcomingDraws(gameId, maxDrawsAhead);
  const draw = (drawsQuery.data ?? []).find((d) => d.id === drawId) ?? drawsQuery.data?.[0] ?? null;

  // Subtotal desta modalidade, com produto e taxa sempre discriminados.
  const subtotal = lines.reduce(
    (acc, line) => {
      const multiplierCost = line.options.multiplier ? multiplierPrice : 0;
      return {
        official: acc.official + (unitOfficialPrice + multiplierCost) * drawsCount,
        fee: acc.fee + unitServiceFee * drawsCount,
      };
    },
    { official: 0, fee: 0 },
  );

  return (
    <GameTheme game={{ brandColor }} className="contents">
    <section className="surface p-5 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2
            className="font-display text-sm font-bold uppercase tracking-[0.14em]"
            style={{ color: 'hsl(var(--game-bright, var(--primary)))' }}
          >
            {gameName}
          </h2>
          {draw && (
            <p className="text-sm text-muted-foreground">
              Sorteio: {formatDate(draw.drawDate)} · {lines.length}{' '}
              {lines.length === 1 ? 'aposta' : 'apostas'} × {drawsCount}{' '}
              {drawsCount === 1 ? 'sorteio' : 'sorteios'}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemoveItem}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 aria-hidden /> Remover tudo
        </Button>
      </header>

      {draw && (
        <div className="mt-4 rounded-lg bg-muted/50 p-3">
          <Countdown
            target={draw.salesCloseAt}
            label="Pedidos para este sorteio encerram em"
            variant="blocks"
            expiredLabel="Prazo encerrado para este sorteio"
          />
        </div>
      )}

      <ul className="mt-5 space-y-2">
        {lines.map((line, index) => (
          <li
            key={line.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <span className="tnum w-6 shrink-0 text-sm text-muted-foreground">
                {String(index + 1).padStart(2, '0')}
              </span>
              <NumberSequence numbers={line.numbers} specialNumbers={line.specialNumbers} size="sm" />
              {line.options.multiplier && multiplierLabel && (
                <Badge variant="jackpot">{multiplierLabel}</Badge>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                variant="ghost" size="icon"
                onClick={() => onDuplicateLine(line.id)}
                aria-label={`Duplicar jogo ${index + 1}`}
              >
                <Copy aria-hidden />
              </Button>
              <Button
                variant="ghost" size="icon"
                onClick={() => onRemoveLine(line.id)}
                aria-label={`Remover jogo ${index + 1}`}
                className="text-muted-foreground hover:text-destructive"
              >
                <Trash2 aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-end gap-4">
        <div className="w-44 space-y-1.5">
          <label htmlFor={`draws-${gameKey}`} className="text-sm font-medium">
            Participar de
          </label>
          <Select
            value={String(drawsCount)}
            onValueChange={(value) => onDrawsCountChange(Number(value))}
          >
            <SelectTrigger id={`draws-${gameKey}`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 5, 10].filter((n) => n <= maxDrawsAhead).map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {count} {count === 1 ? 'sorteio' : 'sorteios'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button asChild variant="outline">
          <Link to={`/loterias/${gameKey}`}>
            <Plus aria-hidden /> Adicionar mais jogos
          </Link>
        </Button>
      </div>

      {showSubtotal && (
      <dl className="mt-5 space-y-1.5 border-t border-border pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Valor oficial das apostas</dt>
          <dd className="tnum">{formatUSD(subtotal.official)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Taxa de serviço</dt>
          <dd className="tnum">{formatUSD(subtotal.fee)}</dd>
        </div>
        <div className="flex justify-between gap-4 font-semibold">
          <dt>Subtotal desta modalidade</dt>
          <dd className="tnum">{formatUSD(subtotal.official + subtotal.fee)}</dd>
        </div>
      </dl>
      )}
    </section>
    </GameTheme>
  );
}
