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
          // `--on-primary` (não `--primary-foreground`): é este o token que
          // Button, bolas e chips leem. Sem ele o botão tingido ficava com o
          // violeta-escuro da plataforma sobre o vermelho da Powerball — 3,3:1.
          '--on-primary': palette.primaryForeground,
          '--on-primary-fixed': palette.primaryForeground,
          '--primary-soft': palette.primarySoft,
          '--accent': palette.accent,
          '--accent-foreground': palette.accentForeground,
          '--ring': palette.primary,
          // Versão clara da cor do jogo, para TEXTO sobre superfície escura.
          // `--primary` é calibrada para servir de FUNDO, então não serve aqui.
          '--game-bright': palette.bright,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
