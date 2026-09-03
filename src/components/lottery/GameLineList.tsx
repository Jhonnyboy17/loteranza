import { Copy, Pencil, Trash2 } from 'lucide-react';
import type { GameLine, LotteryGame } from '@/types/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/states';
import { NumberSequence } from './NumberBall';
import { cn } from '@/lib/utils';

/** Lista editavel de jogos montados. Cada linha pode ser duplicada ou removida. */
export function GameLineList({
  game,
  lines,
  onRemove,
  onDuplicate,
  onEdit,
  className,
}: {
  game: LotteryGame;
  lines: GameLine[];
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onEdit?: (id: string) => void;
  className?: string;
}) {
  if (lines.length === 0) {
    return (
      <EmptyState
        title="Nenhum jogo adicionado ainda"
        description="Escolha seus números acima ou use a escolha rápida para começar."
        className={className}
      />
    );
  }

  return (
    <ul className={cn('space-y-2', className)}>
      {lines.map((line, index) => (
        <li
          key={line.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 sm:p-4"
        >
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <span className="w-14 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Jogo {String(index + 1).padStart(2, '0')}
            </span>
            <NumberSequence
              numbers={line.numbers}
              specialNumbers={line.specialNumbers}
              size="sm"
            />
            <div className="flex gap-1.5">
              {line.isQuickPick && <Badge variant="neutral">Escolha rápida</Badge>}
              {line.options.multiplier && game.multiplierLabel && (
                <Badge variant="jackpot">{game.multiplierLabel}</Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(line.id)}
                aria-label={`Editar jogo ${index + 1}`}
              >
                <Pencil aria-hidden />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDuplicate(line.id)}
              aria-label={`Duplicar jogo ${index + 1}`}
            >
              <Copy aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(line.id)}
              aria-label={`Remover jogo ${index + 1}`}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
