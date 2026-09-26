import * as React from 'react';
import { padBall } from '@/lib/format';
import { cn } from '@/lib/utils';

type BallSize = 'xs' | 'sm' | 'draw' | 'md' | 'lg';
type BallTone = 'main' | 'special' | 'muted' | 'match' | 'miss';

const SIZES: Record<BallSize, string> = {
  xs: 'size-7 text-[0.6875rem]',
  sm: 'size-9 text-xs',
  /** 40px — o tamanho das esferas de resultado no Stitch. */
  draw: 'size-10 text-sm',
  md: 'size-11 text-sm',
  lg: 'size-14 text-lg',
};

/**
 * Estados de bola do Stitch. Sem borda: o que separa a bola do fundo é a
 * elevação de superfície mais o brilho, não um contorno.
 */
const TONES: Record<BallTone, string> = {
  main: 'border border-on-surface/10 bg-surface-container-highest text-on-surface',
  special: 'bg-secondary text-on-secondary-fixed shadow-[0_0_12px_hsl(var(--secondary))]',
  muted: 'border border-on-surface/10 bg-surface-container-highest text-on-surface-variant',
  match: 'bg-success text-success-foreground shadow-[0_0_12px_hsl(var(--success)/0.7)]',
  miss: 'border border-on-surface/10 bg-surface-container-high text-on-surface-variant opacity-60',
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
        'inline-flex shrink-0 items-center justify-center rounded-full font-display font-black tabular-nums',
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
          <span className="mx-0.5 text-outline" aria-hidden>|</span>
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
