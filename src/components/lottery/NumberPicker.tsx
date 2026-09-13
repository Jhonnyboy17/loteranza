import * as React from 'react';
import { Dices, Eraser, Plus } from 'lucide-react';
import type { GameLine, LotteryGame } from '@/types/domain';
import { pickDistinct, pickWithRepetition } from '@/lib/rng';
import { brand } from '@/config/brand';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/misc';
import { NumberBall } from './NumberBall';
import { NumberGrid } from './NumberGrid';
import { cn } from '@/lib/utils';

/**
 * Seletor de numeros.
 *
 * Todo limite (quantidade, minimo, maximo, existencia de numero especial,
 * multiplicador) vem de `game`. Nao ha nenhuma regra de Powerball ou Mega
 * Millions escrita neste arquivo — adicionar uma modalidade nova e so cadastra-la
 * no banco.
 */
export function NumberPicker({
  game,
  onAddLine,
  className,
}: {
  game: LotteryGame;
  onAddLine: (line: Omit<GameLine, 'id'>) => void;
  className?: string;
}) {
  const [main, setMain] = React.useState<number[]>([]);
  const [special, setSpecial] = React.useState<number[]>([]);
  const [multiplier, setMultiplier] = React.useState(false);
  const [wasQuickPick, setWasQuickPick] = React.useState(false);

  const hasSpecial = game.specialNumbersCount > 0;
  const mainComplete = main.length === game.mainNumbersCount;
  const specialComplete = !hasSpecial || special.length === game.specialNumbersCount;
  const isComplete = mainComplete && specialComplete;

  /** Modalidades de digitos (Pick 3/4) admitem repeticao; as demais, nao. */
  const allowsRepetition = game.mainNumberMin === 0;

  const toggle = (
    value: number,
    list: number[],
    setList: (next: number[]) => void,
    limit: number,
  ) => {
    setWasQuickPick(false);
    if (list.includes(value)) {
      setList(list.filter((n) => n !== value));
      return;
    }
    if (list.length >= limit) return;
    setList([...list, value].sort((a, b) => a - b));
  };

  const quickPick = () => {
    const nextMain = allowsRepetition
      ? pickWithRepetition(game.mainNumbersCount, game.mainNumberMin, game.mainNumberMax)
      : pickDistinct(game.mainNumbersCount, game.mainNumberMin, game.mainNumberMax);
    setMain(nextMain);
    setSpecial(
      hasSpecial
        ? pickDistinct(game.specialNumbersCount, game.specialNumberMin, game.specialNumberMax)
        : [],
    );
    setWasQuickPick(true);
  };

  const clear = () => {
    setMain([]);
    setSpecial([]);
    setWasQuickPick(false);
  };

  const add = () => {
    if (!isComplete) return;
    onAddLine({
      numbers: [...main],
      specialNumbers: [...special],
      isQuickPick: wasQuickPick,
      options: game.multiplierEnabled && multiplier ? { multiplier: true } : {},
    });
    clear();
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Espelho da seleção, sempre visível no topo. */}
      <div className="sticky top-[4.5rem] z-10 rounded-xl border border-border bg-card/95 p-4 shadow-card backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Sua seleção
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {Array.from({ length: game.mainNumbersCount }).map((_, i) => (
                main[i] !== undefined ? (
                  <NumberBall key={`sel-${i}`} value={main[i]} size="sm" animate />
                ) : (
                  <span
                    key={`ph-${i}`}
                    aria-hidden
                    className="size-9 rounded-full border-2 border-dashed border-border"
                  />
                )
              ))}
              {hasSpecial && (
                <>
                  <span className="mx-0.5 text-muted-foreground" aria-hidden>|</span>
                  {Array.from({ length: game.specialNumbersCount }).map((_, i) => (
                    special[i] !== undefined ? (
                      <NumberBall key={`ssel-${i}`} value={special[i]} size="sm" tone="special" animate />
                    ) : (
                      <span
                        key={`sph-${i}`}
                        aria-hidden
                        className="size-9 rounded-full border-2 border-dashed border-jackpot/50"
                      />
                    )
                  ))}
                </>
              )}
            </div>
          </div>

          <p aria-live="polite" className="text-sm text-muted-foreground">
            {isComplete
              ? 'Jogo completo.'
              : `Faltam ${game.mainNumbersCount - main.length} número(s)${
                  hasSpecial && special.length < game.specialNumbersCount
                    ? ` e ${game.specialNumbersCount - special.length} ${game.specialNumberLabel}`
                    : ''
                }.`}
          </p>
        </div>
      </div>

      {/* Números principais */}
      <section className="space-y-3">
        <header className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-base font-semibold">
            Escolha {game.mainNumbersCount} número{game.mainNumbersCount > 1 ? 's' : ''}
          </h3>
          <span className="text-sm tabular-nums text-muted-foreground">
            {main.length}/{game.mainNumbersCount}
          </span>
        </header>
        <p id="main-hint" className="text-sm text-muted-foreground">
          De {game.mainNumberMin} a {game.mainNumberMax}.
        </p>
        <NumberGrid
          min={game.mainNumberMin}
          max={game.mainNumberMax}
          selected={main}
          maxSelections={game.mainNumbersCount}
          onToggle={(value) => toggle(value, main, setMain, game.mainNumbersCount)}
          label={`Números principais, escolha ${game.mainNumbersCount}`}
          describedById="main-hint"
        />
      </section>

      {/* Número especial */}
      {hasSpecial && (
        <section className="space-y-3">
          <header className="flex items-baseline justify-between gap-3">
            <h3 className="font-display text-base font-semibold">
              Escolha {game.specialNumbersCount} {game.specialNumberLabel}
            </h3>
            <span className="text-sm tabular-nums text-muted-foreground">
              {special.length}/{game.specialNumbersCount}
            </span>
          </header>
          <p id="special-hint" className="text-sm text-muted-foreground">
            De {game.specialNumberMin} a {game.specialNumberMax}.
          </p>
          <NumberGrid
            min={game.specialNumberMin}
            max={game.specialNumberMax}
            selected={special}
            maxSelections={game.specialNumbersCount}
            onToggle={(value) => toggle(value, special, setSpecial, game.specialNumbersCount)}
            tone="special"
            label={`${game.specialNumberLabel}, escolha ${game.specialNumbersCount}`}
            describedById="special-hint"
          />
        </section>
      )}

      {/* Multiplicador opcional, quando a modalidade oferece */}
      {game.multiplierEnabled && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <Checkbox
            checked={multiplier}
            onCheckedChange={(checked) => setMultiplier(checked === true)}
            aria-describedby="multiplier-hint"
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">
              Adicionar {game.multiplierLabel}
            </span>
            <span id="multiplier-hint" className="block text-sm text-muted-foreground">
              Custo adicional de US$ {game.multiplierPrice.toFixed(2)} por jogo. Multiplica prêmios
              secundários conforme as regras oficiais da modalidade.
            </span>
          </span>
        </label>
      )}

      <p className="text-xs text-muted-foreground">{brand.oddsNotice}</p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" size="lg" onClick={quickPick} className="sm:flex-1">
          <Dices aria-hidden /> Escolha rápida
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={clear}
          disabled={main.length === 0 && special.length === 0}
          className="sm:flex-1"
        >
          <Eraser aria-hidden /> Limpar
        </Button>
        <Button size="lg" onClick={add} disabled={!isComplete} className="sm:flex-[2]">
          <Plus aria-hidden /> Adicionar jogo
        </Button>
      </div>
    </div>
  );
}
