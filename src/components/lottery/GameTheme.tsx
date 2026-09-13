import * as React from 'react';
import type { LotteryGame } from '@/types/domain';
import { derivePalette } from '@/lib/color';
import { cn } from '@/lib/utils';

/**
 * Aplica a cor da modalidade como tema local.
 *
 * Sobrescreve as CSS variables de marca dentro deste escopo, entao TODO
 * componente descendente (botao, bola selecionada, badge, foco) passa a usar a
 * cor do jogo sem nenhuma prop extra. Powerball fica vermelho, Mega Millions
 * azul, e uma modalidade nova so precisa de `brand_color` cadastrado.
 *
 * Fora deste escopo o tema violeta da plataforma continua valendo.
 */
export function GameTheme({
  game,
  children,
  className,
}: {
  game: Pick<LotteryGame, 'brandColor'>;
  children: React.ReactNode;
  className?: string;
}) {
  const palette = React.useMemo(() => derivePalette(game.brandColor), [game.brandColor]);

  if (!palette) return <div className={className}>{children}</div>;

  return (
    <div
      className={cn(className)}
      style={
        {
          '--primary': palette.primary,
          '--primary-foreground': palette.primaryForeground,
          '--primary-soft': palette.primarySoft,
          '--accent': palette.accent,
          '--accent-foreground': palette.accentForeground,
          '--ring': palette.primary,
          '--game-bright': palette.bright,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
