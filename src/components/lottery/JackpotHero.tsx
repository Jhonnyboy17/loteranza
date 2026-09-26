import { Link } from 'react-router-dom';
import type { Draw, ExchangeRate, LotteryGame } from '@/types/domain';
import { formatBRL, formatDrawMoment, splitJackpot, timeZoneLabel } from '@/lib/format';
import { convert, formatRateLabel } from '@/services/exchange/exchangeService';
import { Countdown } from '@/components/lottery/Countdown';
import { GameTheme } from '@/components/lottery/GameTheme';
import { GameWordmark } from '@/components/lottery/GameWordmark';
import { Button } from '@/components/ui/button';
import { Sym } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * Banner de jackpot em destaque — o herói da tela inicial do Stitch
 * (design/stitch/inicio/code.html e o topo de design/stitch/jogar/code.html).
 *
 * Composição preservada: selo pulsante, pílula de contagem regressiva, marca da
 * modalidade, valor monumental em ouro, conversão aproximada numa pílula
 * rebaixada e CTA dourado. Auras violeta e ouro desfocadas ao fundo.
 *
 * O que mudou em relação ao Stitch, e por quê (design/stitch/CONFORMIDADE.md):
 *
 *  - "MAIOR PRÊMIO DO MUNDO": afirmação estática e não verificável. Vira
 *    `eyebrow`, que a tela inicial preenche com "Maior prêmio em cartaz" —
 *    verdadeiro por construção, porque é calculado sobre os jogos listados.
 *  - contagem regressiva fixa em JS (`let seconds = 1*86400 + ...`): agora sai
 *    de `draw.salesCloseAt`, via <Countdown>, e expira de verdade.
 *  - "Câmbio Oficial": a cotação é estimativa, não oficial. O rótulo diz isso
 *    e informa o horário de captura.
 *  - logo da Mega Millions hotlinkada do Google: marca de terceiro sem
 *    autorização verificada. Vira <GameWordmark>, tipográfica.
 */
export function JackpotHero({
  game,
  draw,
  rate,
  eyebrow,
  className,
}: {
  game: LotteryGame;
  draw: Draw | null;
  rate: ExchangeRate | null;
  eyebrow?: string;
  className?: string;
}) {
  const jackpot = splitJackpot(draw?.advertisedJackpot ?? game.currentJackpot, game.currency);
  // `convert` usa a taxa efetiva (com spread) — a MESMA que o carrinho e o
  // checkout aplicam. Mostrar aqui a taxa nominal daria um número diferente do
  // que o usuário vê ao pagar, que é exatamente o tipo de divergência que o
  // briefing proíbe.
  const amount = draw?.advertisedJackpot ?? game.currentJackpot;
  const brlValue = rate && amount !== null ? convert(amount, rate) : null;
  const closesAt = draw?.salesCloseAt ?? null;

  return (
    <GameTheme game={game} className={cn('relative overflow-hidden', className)}>
      {/* Auras do Stitch: manchas de cor muito desfocadas atrás do conteúdo. */}
      <div aria-hidden className="aura-gold -top-10 left-1/2 size-80 -translate-x-1/2" />
      <div aria-hidden className="aura-violet right-0 top-40 size-64" />

      <section className="relative z-10 flex flex-col items-center px-space-md pt-space-sm text-center">
        {/* ---- selos ---------------------------------------------------- */}
        <div className="mb-space-sm flex flex-wrap items-center justify-center gap-space-xs">
          {eyebrow && (
            <span className="flex items-center gap-1.5 rounded-full bg-surface-container-high/90 px-3 py-1 shadow-soft">
              <span className="size-2 animate-pulse rounded-full bg-secondary" aria-hidden />
              <span className="font-label-xs text-label-xs font-bold uppercase tracking-[0.12em] text-secondary">
                {eyebrow}
              </span>
            </span>
          )}
          {closesAt && (
            <span className="flex items-center gap-1 rounded-full bg-surface-container-low px-3 py-1 text-tertiary shadow-soft">
              <Sym name="timer" size={14} />
              <Countdown
                target={closesAt}
                variant="inline"
                className="font-label-xs text-label-xs font-bold tracking-wider"
                expiredLabel="Vendas encerradas"
              />
            </span>
          )}
        </div>

        {/* ---- marca da modalidade -------------------------------------- */}
        <GameWordmark game={game} className="my-space-xs" />

        {/* ---- valor monumental ------------------------------------------ */}
        <div className="mt-space-xs flex flex-col items-center">
          <span className="font-label-md text-label-md uppercase tracking-[0.2em] text-outline">
            Prêmio estimado
          </span>

          {jackpot ? (
            <p
              className="my-1 flex items-baseline justify-center gap-1 text-secondary"
              title={jackpot.exact}
            >
              <span className="sr-only">Prêmio estimado de {jackpot.exact}</span>
              <span aria-hidden className="font-headline-md text-headline-md font-extrabold">
                {jackpot.symbol}
              </span>
              <span
                aria-hidden
                className="font-jackpot-display text-jackpot-fluid drop-glow-gold tabular-nums"
              >
                {jackpot.amount}
              </span>
              {jackpot.unit && (
                <span aria-hidden className="font-headline-md text-headline-md font-bold uppercase">
                  {jackpot.unit}
                </span>
              )}
            </p>
          ) : (
            <p className="my-1 font-headline-md text-headline-md text-on-surface-variant">
              Prêmio a divulgar
            </p>
          )}

          {brlValue !== null && rate && (
            <span className="rounded-full bg-surface-container-high/60 px-2.5 py-0.5 font-label-md text-label-md font-medium text-secondary-fixed">
              ≈ {formatBRL(brlValue, true)}
            </span>
          )}
          {rate && (
            <span className="mt-1.5 font-label-xs text-label-xs text-outline">
              Câmbio estimado · {formatRateLabel(rate)}
            </span>
          )}
        </div>

        {/* ---- sorteio + CTA ---------------------------------------------- */}
        {draw && (
          <p className="mt-space-sm font-body-sm text-body-sm text-on-surface-variant">
            Sorteio {formatDrawMoment(draw.drawAt, game.timezone)}{' '}
            <span className="text-outline">({timeZoneLabel(draw.drawAt, game.timezone)})</span>
          </p>
        )}

        <Button asChild variant="jackpot" size="lg" className="mt-space-md rounded-full px-8">
          <Link to={`/loterias/${game.gameKey}`}>
            Jogar agora <Sym name="arrow_forward" size={18} />
          </Link>
        </Button>
      </section>
    </GameTheme>
  );
}
