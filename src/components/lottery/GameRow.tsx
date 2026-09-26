import { Link } from 'react-router-dom';
import type { Draw, ExchangeRate, LotteryGame } from '@/types/domain';
import { convert } from '@/services/exchange/exchangeService';
import { formatBRL, formatDrawMoment, splitJackpot } from '@/lib/format';
import { Countdown } from '@/components/lottery/Countdown';
import { GameTheme } from '@/components/lottery/GameTheme';
import { Sym } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * Card da lista "Loterias Disponíveis" do Stitch
 * (design/stitch/inicio/code.html).
 *
 * Acabamento do original, mantido: `rounded-2xl`, fio de borda claríssimo que
 * acende na cor do jogo no hover, sombra, emblema quadrado de 48px com a
 * inicial da modalidade sobre fundo tingido e anel da mesma cor, e o botão de
 * ação com halo colorido.
 *
 * A cor vem de `lottery_games.brand_color` via <GameTheme> — o Stitch tingiu
 * os três cards à mão (vermelho, âmbar, ciano); aqui uma modalidade nova entra
 * já tingida, sem tocar em código.
 *
 * Correção de conformidade: o Stitch mostra Illinois Lotto e Lucky Day Lotto
 * com botão de jogar, mas as duas estão `coming_soon` no banco. Aqui o estado
 * vem do dado e uma modalidade indisponível não recebe CTA.
 */
export function GameRow({
  game,
  draw,
  rate,
}: {
  game: LotteryGame;
  draw: Draw | null;
  rate: ExchangeRate | null;
}) {
  // Só o status do catálogo decide se a modalidade aparece jogável. NÃO usar
  // `salesEnabled` aqui: ele é o portão 1 de 3 de transação e nasce `false`,
  // então marcaria TODA loteria como "Em breve". Quem barra a compra é o
  // Compliance Engine, no checkout.
  const playable = game.status === 'active';
  const amount = draw?.advertisedJackpot ?? game.currentJackpot;
  const jackpot = splitJackpot(amount, game.currency);
  const brl = rate && amount !== null ? convert(amount, rate) : null;
  const initial = (game.shortName ?? game.name).trim().charAt(0).toUpperCase();

  const body = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        {/* Emblema quadrado com a inicial: fundo e anel na cor do jogo.
            Tinta a 10%, não os 15% do Stitch: a 15% o pior caso (violeta do
            Lucky Day) dá 4,38:1 de contraste, abaixo do mínimo. A 10% sobe
            para 4,74:1 e a diferença visual é imperceptível. */}
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-xl border font-display text-lg font-black"
          style={{
            background: 'hsl(var(--game-bright, var(--primary)) / 0.10)',
            borderColor: 'hsl(var(--game-bright, var(--primary)) / 0.35)',
            color: 'hsl(var(--game-bright, var(--primary)))',
          }}
        >
          {initial}
        </span>

        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-display text-base font-extrabold leading-tight text-on-surface">
              {game.name}
            </span>
            {!playable && (
              <span className="rounded bg-surface-container-highest px-1.5 py-0.5 font-label-xs text-[0.5625rem] font-black uppercase text-on-surface-variant">
                Em breve
              </span>
            )}
          </div>

          {jackpot ? (
            <p
              className="mt-0.5 flex items-baseline gap-1 font-display text-xl font-black leading-tight text-secondary"
              title={jackpot.exact}
            >
              <span className="sr-only">Prêmio estimado de {jackpot.exact}</span>
              <span aria-hidden className="text-sm">{jackpot.symbol}</span>
              <span aria-hidden className="tabular-nums">{jackpot.amount}</span>
              {jackpot.unit && (
                <span aria-hidden className="text-sm uppercase">{jackpot.unit}</span>
              )}
            </p>
          ) : (
            <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
              Prêmio a divulgar
            </p>
          )}

          {/* Sem `truncate`: a linha quebra em duas em vez de cortar a data
              quando o nome da modalidade é longo. */}
          <span className="mt-0.5 font-label-xs text-label-xs font-medium leading-tight text-on-surface-variant">
            {brl !== null && <>≈ {formatBRL(brl, true)}</>}
            {brl !== null && draw && ' · '}
            {draw && formatDrawMoment(draw.drawAt, game.timezone)}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        {draw?.salesCloseAt && playable && (
          <span className="flex items-center gap-1 rounded-full border border-secondary/20 bg-black/40 px-2 py-1 text-secondary">
            <Sym name="timer" size={12} />
            <Countdown
              target={draw.salesCloseAt}
              variant="inline"
              className="font-mono text-[0.625rem] font-black tracking-wider"
              expiredLabel="Encerrado"
            />
          </span>
        )}
        {playable && (
          <span
            className="flex h-10 items-center gap-1 rounded-xl px-4 font-display text-xs font-bold uppercase tracking-wider transition-transform group-active:scale-95"
            style={{
              background: 'hsl(var(--primary))',
              color: 'hsl(var(--on-primary))',
              boxShadow: '0 0 15px hsl(var(--primary) / 0.35)',
            }}
          >
            Jogar <Sym name="arrow_forward" size={16} />
          </span>
        )}
      </div>
    </>
  );

  const shell = cn(
    'group flex items-center justify-between gap-3 rounded-2xl border p-4 shadow-lg transition-all',
    'border-on-surface/[0.06] bg-surface-container',
    playable
      ? 'hover:border-[hsl(var(--game-bright,var(--primary))/0.40)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      : 'opacity-70',
  );

  return (
    <GameTheme game={game}>
      {playable ? (
        <Link to={`/loterias/${game.gameKey}`} className={shell} aria-label={`Jogar ${game.name}`}>
          {body}
        </Link>
      ) : (
        <div className={shell}>{body}</div>
      )}
    </GameTheme>
  );
}
