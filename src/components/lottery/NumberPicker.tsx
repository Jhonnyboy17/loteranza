import * as React from 'react';
import { ArrowRight, Dices, Eraser } from 'lucide-react';
import type { GameLine, LotteryGame } from '@/types/domain';
import { pickDistinct, pickWithRepetition } from '@/lib/rng';
import { Button } from '@/components/ui/button';
import { NumberBall } from './NumberBall';
import { NumberGrid } from './NumberGrid';
import { cn } from '@/lib/utils';

/**
 * Etapa de escolha dos numeros.
 *
 * Faz uma coisa so: montar UMA aposta. Multiplicador, quantidade de sorteios e
 * preco ficam na etapa seguinte — juntar tudo numa tela so era o que deixava
 * esta pagina pesada.
 *
 * Todo limite (quantidade, minimo, maximo, existencia de numero especial) vem
 * de `game`. Nao ha nenhuma regra de Powerball ou Mega Millions escrita aqui.
 */
export function NumberPicker({
  game,
  onSubmit,
  submitLabel = 'Continuar',
  className,
}: {
  game: LotteryGame;
  onSubmit: (line: Omit<GameLine, 'id'>) => void;
  submitLabel?: string;
  className?: string;
}) {
  const [main, setMain] = React.useState<number[]>([]);
  const [special, setSpecial] = React.useState<number[]>([]);
  const [wasQuickPick, setWasQuickPick] = React.useState(false);

  const hasSpecial = game.specialNumbersCount > 0;
  const isComplete =
    main.length === game.mainNumbersCount &&
    (!hasSpecial || special.length === game.specialNumbersCount);

  /** Modalidades de digitos (faixa iniciando em 0) admitem repeticao. */
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
    setMain(
      allowsRepetition
        ? pickWithRepetition(game.mainNumbersCount, game.mainNumberMin, game.mainNumberMax)
        : pickDistinct(game.mainNumbersCount, game.mainNumberMin, game.mainNumberMax),
    );
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

  const submit = () => {
    if (!isComplete) return;
    onSubmit({
      numbers: [...main],
      specialNumbers: [...special],
      isQuickPick: wasQuickPick,
      options: {},
    });
    clear();
  };

  const missingMain = game.mainNumbersCount - main.length;
  const missingSpecial = hasSpecial ? game.specialNumbersCount - special.length : 0;

  return (
    <div className={cn('space-y-8', className)}>
      {/* Espelho da seleção — a única coisa que acompanha a rolagem. */}
      <div className="sticky top-[4.25rem] z-10 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-card backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {Array.from({ length: game.mainNumbersCount }).map((_, i) =>
            main[i] !== undefined ? (
              <NumberBall key={`sel-${i}`} value={main[i]} size="sm" animate />
            ) : (
              <span
                key={`ph-${i}`}
                aria-hidden
                className="size-9 rounded-full border-2 border-dashed border-border"
              />
            ),
          )}
          {hasSpecial && (
            <>
              <span className="mx-0.5 text-muted-foreground" aria-hidden>|</span>
              {Array.from({ length: game.specialNumbersCount }).map((_, i) =>
                special[i] !== undefined ? (
                  <NumberBall key={`ssel-${i}`} value={special[i]} size="sm" tone="special" animate />
                ) : (
                  <span
                    key={`sph-${i}`}
                    aria-hidden
                    className="size-9 rounded-full border-2 border-dashed border-jackpot/50"
                  />
                ),
              )}
            </>
          )}
        </div>
        <p aria-live="polite" className="mt-2 text-center text-sm text-muted-foreground">
          {isComplete
            ? 'Aposta completa.'
            : `Faltam ${missingMain > 0 ? `${missingMain} número${missingMain > 1 ? 's' : ''}` : ''}` +
              `${missingMain > 0 && missingSpecial > 0 ? ' e ' : ''}` +
              `${missingSpecial > 0 ? `${missingSpecial} ${game.specialNumberLabel}` : ''}.`}
        </p>
      </div>

      {/* Números principais */}
      <section className="space-y-3">
        <header className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">
            Escolha {game.mainNumbersCount} número{game.mainNumbersCount > 1 ? 's' : ''}
          </h2>
          <span className="tnum text-sm text-muted-foreground">
            {main.length}/{game.mainNumbersCount}
          </span>
        </header>
        <NumberGrid
          min={game.mainNumberMin}
          max={game.mainNumberMax}
          selected={main}
          maxSelections={game.mainNumbersCount}
          onToggle={(value) => toggle(value, main, setMain, game.mainNumbersCount)}
          label={`Números principais, escolha ${game.mainNumbersCount} de ${game.mainNumberMin} a ${game.mainNumberMax}`}
        />
      </section>

      {/* Número especial */}
      {hasSpecial && (
        <section className="space-y-3">
          <header className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">
              Escolha {game.specialNumbersCount > 1 ? game.specialNumbersCount : 'o'}{' '}
              {game.specialNumberLabel}
            </h2>
            <span className="tnum text-sm text-muted-foreground">
              {special.length}/{game.specialNumbersCount}
            </span>
          </header>
          <NumberGrid
            min={game.specialNumberMin}
            max={game.specialNumberMax}
            selected={special}
            maxSelections={game.specialNumbersCount}
            onToggle={(value) => toggle(value, special, setSpecial, game.specialNumbersCount)}
            tone="special"
            label={`${game.specialNumberLabel}, escolha ${game.specialNumbersCount} de ${game.specialNumberMin} a ${game.specialNumberMax}`}
          />
        </section>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" size="lg" onClick={quickPick} className="sm:flex-1">
          <Dices aria-hidden /> Escolha rápida
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={clear}
          disabled={main.length === 0 && special.length === 0}
          className="sm:w-32"
        >
          <Eraser aria-hidden /> Limpar
        </Button>
        <Button size="lg" onClick={submit} disabled={!isComplete} className="sm:flex-[1.4]">
          {submitLabel} <ArrowRight aria-hidden />
        </Button>
      </div>
    </div>
  );
}
