import * as React from 'react';
import { padBall } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Grade de numeros selecionaveis.
 *
 * Mobile-first: cada alvo tem no minimo 44px, a grade cresce em colunas
 * conforme o espaco e a navegacao por teclado (setas, Home/End) funciona no
 * desktop. Nenhum limite e escrito aqui — tudo vem de `min`, `max` e
 * `maxSelections`, que por sua vez vem da configuracao do jogo.
 */
export function NumberGrid({
  min,
  max,
  selected,
  maxSelections,
  onToggle,
  tone = 'main',
  label,
  describedById,
}: {
  min: number;
  max: number;
  selected: number[];
  maxSelections: number;
  onToggle: (value: number) => void;
  tone?: 'main' | 'special';
  label: string;
  describedById?: string;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const numbers = React.useMemo(
    () => Array.from({ length: max - min + 1 }, (_, i) => min + i),
    [min, max],
  );
  const isFull = selected.length >= maxSelections;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>, index: number) => {
    const columns = getColumnCount(containerRef.current);
    let next: number | null = null;

    switch (event.key) {
      case 'ArrowRight': next = index + 1; break;
      case 'ArrowLeft': next = index - 1; break;
      case 'ArrowDown': next = index + columns; break;
      case 'ArrowUp': next = index - columns; break;
      case 'Home': next = 0; break;
      case 'End': next = numbers.length - 1; break;
      default: return;
    }

    if (next === null || next < 0 || next >= numbers.length) return;
    event.preventDefault();
    const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('[data-ball]');
    buttons?.[next]?.focus();
  };

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={label}
      aria-describedby={describedById}
      className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2"
    >
      {numbers.map((value, index) => {
        const isSelected = selected.includes(value);
        const isDisabled = !isSelected && isFull;
        return (
          <button
            key={value}
            type="button"
            data-ball
            aria-pressed={isSelected}
            aria-label={`Número ${value}${isSelected ? ', selecionado' : ''}`}
            disabled={isDisabled}
            onKeyDown={(event) => handleKeyDown(event, index)}
            onClick={() => onToggle(value)}
            className={cn(
              'touch-target flex aspect-square w-full items-center justify-center rounded-full border',
              'text-sm font-semibold tabular-nums transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isSelected
                ? tone === 'special'
                  ? 'animate-ball-pop border-transparent bg-jackpot text-jackpot-foreground shadow-ball'
                  : 'animate-ball-pop border-transparent bg-primary text-primary-foreground glow-primary'
                : 'border-border bg-secondary/60 text-foreground hover:border-primary/50 hover:bg-accent',
              isDisabled && 'cursor-not-allowed opacity-40 hover:border-border hover:bg-card',
            )}
          >
            {padBall(value)}
          </button>
        );
      })}
    </div>
  );
}

/** Descobre quantas colunas a grade renderizou, para as setas do teclado. */
function getColumnCount(element: HTMLDivElement | null): number {
  if (!element) return 1;
  const columns = getComputedStyle(element).gridTemplateColumns;
  return Math.max(1, columns.split(' ').filter(Boolean).length);
}
