import type { LotteryGame } from '@/types/domain';
import { cn } from '@/lib/utils';

/**
 * Resolve o caminho de um logotipo guardado em `lottery_games.logo_url`.
 *
 * URL completa (o logotipo hospedado em outro lugar) passa direto. Caminho
 * local precisa ganhar o prefixo em que o site está servido: em domínio
 * próprio é "/", mas no GitHub Pages de projeto é "/loteranza/". Sem isso um
 * "/logos/x.png" cadastrado no banco quebraria exatamente na publicação.
 */
function resolveLogo(url: string): string {
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url;
  return `${import.meta.env.BASE_URL}${url.replace(/^\//, '')}`;
}

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
        src={resolveLogo(game.logoUrl)}
        alt={game.name}
        className={cn(
          'w-auto max-w-full object-contain',
          // O sombreamento destaca o logotipo do fundo escuro sem alterá-lo,
          // o que importa para marca de terceiro: nada de recolorir.
          'drop-shadow-[0_4px_16px_rgba(0,0,0,0.7)]',
          size === 'lg' ? 'max-h-16' : size === 'md' ? 'max-h-9' : 'max-h-6',
          className,
        )}
        loading="lazy"
        // Se o arquivo sumir, cai para o nome em texto em vez de deixar um
        // ícone quebrado no meio do herói.
        onError={(event) => {
          event.currentTarget.style.display = 'none';
          event.currentTarget.insertAdjacentHTML(
            'afterend',
            `<span class="font-display font-extrabold uppercase leading-none" style="color:hsl(var(--game-bright, var(--primary)))">${game.name}</span>`,
          );
        }}
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
