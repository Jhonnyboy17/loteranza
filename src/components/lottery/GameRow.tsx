import { Link } from 'react-router-dom';
import type { Draw, ExchangeRate, LotteryGame } from '@/types/domain';
import { convert } from '@/services/exchange/exchangeService';
import { formatBRL, formatDrawMoment, splitJackpot } from '@/lib/format';
import { Countdown } from '@/components/lottery/Countdown';
import { GameTheme } from '@/components/lottery/GameTheme';
import { Sym } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * Linha da lista "Loterias Disponíveis" do Stitch
 * (design/stitch/inicio/code.html).
 *
 * Cada linha é tingida com a cor da própria modalidade via <GameTheme>: o
 * Stitch fez isso à mão (Powerball avermelhado, Illinois âmbar, Lucky Day
 * ciano); aqui a cor vem de `lottery_games.brand_color`, então uma modalidade
 * nova entra sem tocar em código.
 *
 * Correção de conformidade: o Stitch mostra Illinois Lotto e Lucky Day Lotto
 * com botão de jogar, mas as duas estão `coming_soon` no banco. Aqui o estado
 * vem do dado e uma modalidade indisponível não recebe CTA nenhum.
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
  // `salesEnabled` aqui: ele é o portão 1 de 3 de transação e nasce `false` por
  // decisão de projeto, então usá-lo marcaria TODA loteria como "Em breve".
  // Quem barra a compra é o Compliance Engine, no checkout.
  const playable = game.status === 'active';
  const amount = draw?.advertisedJackpot ?? game.currentJackpot;
  const jackpot = splitJackpot(amount, game.currency);
  const brl = rate && amount !== null ? convert(amount, rate) : null;

  const body = (
    <>
      {/* Faixa vertical na cor do jogo — a assinatura visual da linha. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: 'hsl(var(--game-bright, var(--primary)))' }}
      />
      {/* Halo suave da cor do jogo no canto. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full opacity-[0.12] blur-2xl"
        style={{ background: 'hsl(var(--game-bright, var(--primary)))' }}
      />

      <div className="relative flex items-center gap-space-sm">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="truncate font-display text-label-lg font-bold uppercase tracking-wider"
              style={{ color: 'hsl(var(--game-bright, var(--primary)))' }}
            >
              {game.name}
            </span>
            {!playable && (
              <span className="rounded-full bg-surface-container-highest px-2 py-0.5 font-label-xs text-label-xs font-bold uppercase tracking-wider text-on-surface-variant">
                Em breve
              </span>
            )}
          </div>

          {jackpot ? (
            <p className="mt-0.5 flex items-baseline gap-1 text-secondary" title={jackpot.exact}>
              <span className="sr-only">Prêmio estimado de {jackpot.exact}</span>
              <span aria-hidden className="font-label-lg text-label-lg font-bold">
                {jackpot.symbol}
              </span>
              <span aria-hidden className="font-display text-headline-md font-extrabold tabular-nums">
                {jackpot.amount}
              </span>
              {jackpot.unit && (
                <span aria-hidden className="font-label-lg text-label-lg font-bold uppercase">
                  {jackpot.unit}
                </span>
              )}
            </p>
          ) : (
            <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
              Prêmio a divulgar
            </p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-label-xs text-label-xs text-outline">
            {brl !== null && <span>≈ {formatBRL(brl, true)}</span>}
            {draw && (
              <>
                <span aria-hidden>·</span>
                <span>{formatDrawMoment(draw.drawAt, game.timezone)}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {draw?.salesCloseAt && playable && (
            <span className="flex items-center gap-1 rounded-full bg-surface-container-lowest/70 px-2 py-1 text-tertiary">
              <Sym name="timer" size={12} />
              <Countdown
                target={draw.salesCloseAt}
                variant="inline"
                className="font-label-xs text-label-xs font-bold"
                expiredLabel="Encerrado"
              />
            </span>
          )}
          {playable && (
            <span
              className="flex items-center gap-1 rounded-full px-3 py-1.5 font-label-md text-label-md font-bold uppercase tracking-wider"
              style={{
                background: 'hsl(var(--primary))',
                color: 'hsl(var(--on-primary))',
              }}
            >
              Jogar <Sym name="arrow_forward" size={14} />
            </span>
          )}
        </div>
      </div>
    </>
  );

  const shell = cn(
    'relative block overflow-hidden rounded-xl bg-surface-container p-space-md shadow-card transition-all',
    playable
      ? 'hover:brightness-110 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
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
