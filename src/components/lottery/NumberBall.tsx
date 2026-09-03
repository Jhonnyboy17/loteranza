import * as React from 'react';
import { padBall } from '@/lib/format';
import { cn } from '@/lib/utils';

type BallSize = 'xs' | 'sm' | 'md' | 'lg';
type BallTone = 'main' | 'special' | 'muted' | 'match' | 'miss';

const SIZES: Record<BallSize, string> = {
  xs: 'size-7 text-[0.6875rem]',
  sm: 'size-9 text-xs',
  md: 'size-11 text-sm',
  lg: 'size-14 text-lg',
};

const TONES: Record<BallTone, string> = {
  main: 'bg-card text-foreground border-border',
  special: 'bg-jackpot text-jackpot-foreground border-transparent',
  muted: 'bg-muted text-muted-foreground border-transparent',
  match: 'bg-success text-success-foreground border-transparent',
  miss: 'bg-card text-muted-foreground border-border opacity-55',
};

export interface NumberBallProps extends React.HTMLAttributes<HTMLSpanElement> {
  value: number;
  size?: BallSize;
  tone?: BallTone;
  /** Roda a animação de seleção. Respeita prefers-reduced-motion via CSS. */
  animate?: boolean;
}

/** Bola de loteria. Elemento visual central da identidade. */
export function NumberBall({
  value, size = 'md', tone = 'main', animate = false, className, ...props
}: NumberBallProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border font-semibold tabular-nums shadow-ball',
        SIZES[size],
        TONES[tone],
        animate && 'animate-ball-pop',
        className,
      )}
      {...props}
    >
      {padBall(value)}
    </span>
  );
}

/** Sequência de bolas com os números especiais destacados no fim. */
export function NumberSequence({
  numbers,
  specialNumbers = [],
  size = 'md',
  matchedMain,
  matchedSpecial,
  className,
}: {
  numbers: number[];
  specialNumbers?: number[];
  size?: BallSize;
  /** Quando informados, marcam quais números bateram com o resultado. */
  matchedMain?: number[];
  matchedSpecial?: number[];
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {numbers.map((n, i) => (
        <NumberBall
          key={`m-${n}-${i}`}
          value={n}
          size={size}
          tone={matchedMain ? (matchedMain.includes(n) ? 'match' : 'miss') : 'main'}
        />
      ))}
      {specialNumbers.length > 0 && (
        <>
          <span className="mx-0.5 text-muted-foreground" aria-hidden>|</span>
          {specialNumbers.map((n, i) => (
            <NumberBall
              key={`s-${n}-${i}`}
              value={n}
              size={size}
              tone={matchedSpecial ? (matchedSpecial.includes(n) ? 'match' : 'miss') : 'special'}
            />
          ))}
        </>
      )}
    </div>
  );
}
