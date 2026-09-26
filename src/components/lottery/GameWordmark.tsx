import type { LotteryGame } from '@/types/domain';
import { cn } from '@/lib/utils';

/**
 * Marca da modalidade, em tipografia.
 *
 * As telas do Stitch trazem a logo oficial da Mega Millions como <img> vinda de
 * lh3.googleusercontent.com. São dois problemas: é marca registrada de terceiro
 * usada sem autorização verificada (o briefing manda checar licenciamento
 * antes), e é uma URL do Google que vai quebrar.
 *
 * Aqui o nome é desenhado com a cor da própria modalidade — Powerball vermelho,
 * Mega Millions azul —, o que mantém o reconhecimento imediato sem reproduzir
 * identidade visual alheia.
 *
 * Se a autorização de marca for obtida, basta preencher `lottery_games.logo_url`
 * e a imagem passa a ser usada no lugar, sem tocar em componente nenhum.
 */
export function GameWordmark({
  game,
  size = 'lg',
  className,
}: {
  game: Pick<LotteryGame, 'name' | 'shortName' | 'logoUrl' | 'brandColor'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  if (game.logoUrl) {
    return (
      <img
        src={game.logoUrl}
        alt={game.name}
        className={cn(
          'w-auto object-contain',
          size === 'lg' ? 'max-h-16' : size === 'md' ? 'max-h-9' : 'max-h-6',
          className,
        )}
        loading="lazy"
      />
    );
  }

  return (
    <span
      className={cn(
        'inline-block font-display font-extrabold uppercase leading-none',
        size === 'lg'
          ? 'text-[clamp(1.5rem,7vw,2.25rem)] tracking-[0.02em]'
          : size === 'md'
            ? 'text-headline-sm tracking-tight'
            : 'font-label-lg text-label-lg tracking-wider',
        className,
      )}
      style={{ color: 'hsl(var(--game-bright, var(--primary)))' }}
    >
      {game.name}
    </span>
  );
}
