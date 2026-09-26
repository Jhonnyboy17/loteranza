import { Link } from 'react-router-dom';
import type { Draw, ExchangeRate, LotteryGame } from '@/types/domain';
import { formatBRL, formatDrawMoment, splitJackpot, timeZoneLabel } from '@/lib/format';
import { convert, formatRateLabel } from '@/services/exchange/exchangeService';
import { Countdown } from '@/components/lottery/Countdown';
import { GameTheme } from '@/components/lottery/GameTheme';
import { GameWordmark } from '@/components/lottery/GameWordmark';
import { Sym } from '@/components/ui/icon';

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
  showCta = true,
  className,
}: {
  game: LotteryGame;
  draw: Draw | null;
  rate: ExchangeRate | null;
  eyebrow?: string;
  /** Na própria página da modalidade o CTA seria circular; desliga-se aqui. */
  showCta?: boolean;
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
    <GameTheme game={game} className={className}>
      {/* O herói do Stitch é um CARD, não uma faixa: gradiente vertical
          próprio, cantos 3xl, anel dourado de 1px pulsando (.hero-card-glow) e
          uma aura animada por baixo (.animated-hero-aura). É essa camada que
          dá o ar "iluminado por dentro" — sem ela o bloco fica chapado. */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-surface-container-high via-surface-container-low to-surface-container-lowest p-6 hero-card-glow">
        <div aria-hidden className="pointer-events-none absolute -inset-10 animated-hero-aura" />

        <div className="relative z-10 flex flex-col items-center text-center">
        {/* ---- selos ---------------------------------------------------- */}
        <div className="mb-space-sm flex flex-wrap items-center justify-center gap-space-xs">
          {eyebrow && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-secondary/30 bg-surface-container-highest/80 px-3 py-1">
              <Sym name="stars" size={14} className="text-secondary" />
              <span className="font-label-xs text-label-xs font-extrabold uppercase tracking-[0.12em] text-secondary">
                {eyebrow}
              </span>
            </span>
          )}
          {closesAt && (
            <span className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-black/60 px-3.5 py-1.5 shadow-[0_0_15px_hsl(var(--secondary)/0.20)] backdrop-blur-md">
              <span
                aria-hidden
                className="size-2 animate-ping rounded-full bg-secondary shadow-[0_0_8px_hsl(var(--secondary))]"
              />
              <Sym name="timer" size={14} className="text-secondary" />
              <Countdown
                target={closesAt}
                variant="inline"
                className="font-mono font-black tracking-wider text-secondary drop-shadow-[0_0_8px_hsl(var(--secondary))]"
                expiredLabel="Vendas encerradas"
              />
            </span>
          )}
        </div>

        {/* ---- marca da modalidade -------------------------------------- */}
        <GameWordmark game={game} className="my-space-xs" />

        {/* ---- valor monumental ------------------------------------------ */}
        <div className="mt-space-xs flex flex-col items-center">
          <span className="font-label-md text-label-md uppercase tracking-[0.2em] text-on-surface-variant">
            Prêmio estimado
          </span>

          {jackpot ? (
            <p
              className="my-1 flex items-baseline justify-center gap-1 text-secondary drop-shadow-[0_0_25px_hsl(var(--secondary)/0.65)]"
              title={jackpot.exact}
            >
              <span className="sr-only">Prêmio estimado de {jackpot.exact}</span>
              <span aria-hidden className="font-headline-md text-headline-md font-extrabold">
                {jackpot.symbol}
              </span>
              <span
                aria-hidden
                className="font-jackpot-display text-jackpot-fluid font-black tracking-tighter tabular-nums"
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
            <span className="mt-2 inline-flex w-fit items-center gap-2 rounded-xl border border-secondary/30 bg-secondary/10 px-3 py-1.5">
              <span className="font-label-xs text-label-xs font-bold uppercase tracking-wider text-secondary">
                Em reais
              </span>
              <span className="font-display text-base font-black tracking-tight text-on-surface">
                ≈ {formatBRL(brlValue, true)}
              </span>
            </span>
          )}
          {rate && (
            <span className="mt-1.5 font-label-xs text-label-xs text-on-surface-variant">
              Câmbio estimado · {formatRateLabel(rate)}
            </span>
          )}
        </div>

        {/* ---- sorteio + CTA ---------------------------------------------- */}
        {draw && (
          <p className="mt-space-sm font-body-sm text-body-sm text-on-surface-variant">
            Sorteio {formatDrawMoment(draw.drawAt, game.timezone)}{' '}
            <span className="text-on-surface-variant">({timeZoneLabel(draw.drawAt, game.timezone)})</span>
          </p>
        )}

        {showCta && (
          <Link
            to={`/loterias/${game.gameKey}`}
            className="cta-pulse-button mt-space-md flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[hsl(var(--secondary-container))] via-[hsl(var(--secondary))] to-[hsl(var(--secondary-container))] font-display text-base font-black uppercase tracking-wider text-on-secondary-fixed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Jogar agora
            <Sym name="arrow_forward" size={22} />
          </Link>
        )}
        </div>
      </section>
    </GameTheme>
  );
}
