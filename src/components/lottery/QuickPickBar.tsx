import * as React from 'react';
import { Dices } from 'lucide-react';
import type { GameLine, LotteryGame } from '@/types/domain';
import { pickDistinct, pickWithRepetition } from '@/lib/rng';
import { brand } from '@/config/brand';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PRESETS = [1, 2, 3, 5, 10, 20];

/**
 * Escolha Rapida em lote. Gera combinacoes validas com RNG criptografico
 * (src/lib/rng.ts).
 *
 * A frase de probabilidade fica sempre visivel junto do controle: nao existe
 * nesta aplicacao nenhuma sugestao de que uma combinacao seja melhor que outra.
 */
export function QuickPickBar({
  game,
  onGenerate,
  remainingSlots,
  className,
}: {
  game: LotteryGame;
  onGenerate: (lines: Omit<GameLine, 'id'>[]) => void;
  remainingSlots: number;
  className?: string;
}) {
  const allowsRepetition = game.mainNumberMin === 0;

  const generate = React.useCallback(
    (count: number) => {
      const capped = Math.min(count, Math.max(0, remainingSlots));
      if (capped === 0) return;

      const lines = Array.from({ length: capped }, () => ({
        numbers: allowsRepetition
          ? pickWithRepetition(game.mainNumbersCount, game.mainNumberMin, game.mainNumberMax)
          : pickDistinct(game.mainNumbersCount, game.mainNumberMin, game.mainNumberMax),
        specialNumbers:
          game.specialNumbersCount > 0
            ? pickDistinct(game.specialNumbersCount, game.specialNumberMin, game.specialNumberMax)
            : [],
        isQuickPick: true,
        options: {},
      }));
      onGenerate(lines);
    },
    [allowsRepetition, game, onGenerate, remainingSlots],
  );

  return (
    <div className={cn('space-y-3 rounded-xl border border-border bg-muted/30 p-4', className)}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Dices className="size-5" aria-hidden />
        </span>
        <div className="space-y-0.5">
          <h3 className="font-display text-sm font-semibold">Escolha rápida</h3>
          <p className="text-sm text-muted-foreground">
            Geramos combinações válidas aleatórias para você.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Gerar jogos aleatórios">
        {PRESETS.map((count) => (
          <Button
            key={count}
            variant="outline"
            size="sm"
            disabled={remainingSlots <= 0}
            onClick={() => generate(count)}
          >
            {count} {count === 1 ? 'jogo' : 'jogos'}
          </Button>
        ))}
      </div>

      {remainingSlots <= 0 ? (
        <p className="text-xs font-medium text-warning">
          Limite de {game.maxLinesPerOrder} jogos por pedido atingido.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Você ainda pode adicionar {remainingSlots}{' '}
          {remainingSlots === 1 ? 'jogo' : 'jogos'} neste pedido.
        </p>
      )}

      <p className="text-xs text-muted-foreground">{brand.oddsNotice}</p>
    </div>
  );
}
