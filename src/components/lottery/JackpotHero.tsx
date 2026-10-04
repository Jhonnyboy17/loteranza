import { Link } from 'react-router-dom';
import type { Draw, ExchangeRate, LotteryGame } from '@/types/domain';
import { formatBRL, formatDateTime, formatDrawMoment, splitJackpot, timeZoneLabel } from '@/lib/format';
import { convert, formatRateLabel } from '@/services/exchange/exchangeService';
import { Countdown } from '@/components/lottery/Countdown';
import { GameTheme } from '@/components/lottery/GameTheme';
import { GameWordmark } from '@/components/lottery/GameWordmark';
import { Sym } from '@/components/ui/icon';

/**
 * Banner de jackpot em destaque.
 *
 * A composição é a aprovada pelo cliente: bloco centrado, marca da modalidade
 * grande, valor em ouro escovado como centro de gravidade, contagem regressiva
 * em bloco próprio com selo de relógio, botão dourado com halo e a linha do
 * sorteio fechando embaixo.
 *
 * As cores NÃO são fixas em azul, embora a referência seja a Mega Millions.
 * Fundo, halo e borda saem de `--game-bright`/`--accent`, que <GameTheme>
 * deriva de `lottery_games.brand_color`: a Powerball acende vermelha com o
 * mesmo código, e uma modalidade nova acende sozinha ao ser cadastrada.
 * Fixar o azul aqui seria duplicar no CSS um dado que já vive no banco.
 *
 * Decisões de conformidade preservadas (design/stitch/CONFORMIDADE.md):
 *
 *  - "MAIOR PRÊMIO DO MUNDO" do layout original é afirmação não verificável.
 *    Vira `eyebrow`, que a tela inicial preenche com "Maior prêmio em cartaz"
 *    — verdadeiro por construção, porque é calculado sobre os jogos listados.
 *  - A contagem regressiva sai de `draw.salesCloseAt` e expira de verdade;
 *    não há contador decorativo.
 *  - A conversão é estimada, nunca "câmbio oficial": o rótulo diz isso e traz
 *    o horário de captura. É a única linha que a referência não mostrava, e
 *    ela fica pequena e discreta justamente para não disputar com o prêmio.
 *  - A marca da modalidade é <GameWordmark>, que usa o arquivo de
 *    `logo_url`. Nenhuma logo de terceiro é embutida no código sem o
 *    licenciamento verificado.
 */
export function JackpotHero({
  game,
  draw,
  rate,
  eyebrow,
  subtitle = 'Loteria internacional',
  showCta = true,
  className,
}: {
  game: LotteryGame;
  draw: Draw | null;
  rate: ExchangeRate | null;
  eyebrow?: string;
  /** Linha sob a marca. Descritiva, não promocional. */
  subtitle?: string;
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
  // Forma compacta ("≈ R$ 2,6 bilhões"): a conversão é estimada, e o centavo
  // exato de um valor aproximado finge uma precisão que não existe. O número
  // cheio segue no title e para leitor de tela.
  const brl = brlValue !== null ? splitJackpot(brlValue, 'BRL') : null;
  const closesAt = draw?.salesCloseAt ?? null;

  return (
    <GameTheme game={game} className={className}>
      <section className="hero-card relative overflow-hidden rounded-3xl px-space-md py-space-lg sm:px-space-lg">
        <div aria-hidden className="pointer-events-none absolute inset-0 hero-aura" />

        {/* A coluna é limitada e centrada: no desktop o card ocupa a largura
              toda, mas deixar o botão virar uma barra de mil pixels
              destruiria a proporção da referência, que é um cartão
              retrato. */}
        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          {eyebrow && (
            <p className="flex w-full items-center gap-2 font-label-md text-label-md font-bold uppercase tracking-[0.16em] text-on-surface-variant">
              <Sym name="stars" size={18} className="shrink-0 text-secondary" />
              {eyebrow}
            </p>
          )}

          {/* ---- marca + descritor -------------------------------------- */}
          <GameWordmark game={game} size="xl" className="mt-space-lg max-w-full" />

          {subtitle && (
            <p className="mt-space-sm font-label-md text-label-md uppercase tracking-[0.22em] text-on-surface-variant">
              {subtitle}
            </p>
          )}

          {/* ---- valor --------------------------------------------------- */}
          {jackpot ? (
            <p
              className="mt-space-lg flex w-full items-baseline justify-center gap-1"
              title={jackpot.exact}
            >
              <span className="sr-only">Prêmio estimado de {jackpot.exact}</span>
              <span
                aria-hidden
                className="jackpot-metal font-display text-[clamp(1.5rem,7vw,2.75rem)] font-black tracking-tight"
              >
                {jackpot.symbol}
              </span>
              <span
                aria-hidden
                className="jackpot-metal font-jackpot-display text-jackpot-fluid font-black tracking-tighter tabular-nums"
              >
                {jackpot.amount}
              </span>
              {jackpot.unit && (
                <span
                  aria-hidden
                  className="jackpot-metal font-display text-[clamp(1.5rem,7vw,2.75rem)] font-black tracking-tight"
                >
                  {jackpot.unit.toLowerCase()}
                </span>
              )}
            </p>
          ) : (
            <p className="mt-space-lg font-headline-md text-headline-md text-on-surface-variant">
              Prêmio a divulgar
            </p>
          )}

          {brl && brlValue !== null && (
            <p
              className="mt-space-sm font-display text-xl font-bold text-on-surface-variant"
              title={formatBRL(brlValue, true)}
            >
              <span className="sr-only">Equivalente aproximado a {formatBRL(brlValue, true)}.</span>
              <span aria-hidden>
                ≈ {brl.symbol} {brl.amount}
                {brl.unit ? ` ${brl.unit.toLowerCase()}` : ''}
              </span>
            </p>
          )}

          {/* A referência não tinha esta linha, mas ela não é decoração: a
              conversão é estimada, e o briefing exige dizer isso E quando a
              cotação foi captada — sem a captura, "estimado" não informa
              nada, porque não se sabe de quando é a estimativa. Fica no menor
              tamanho da escala e sem destaque, para não disputar com o
              prêmio. A data vai sem o ano para caber em uma linha no celular;
              o carimbo completo segue no title. */}
          {rate && (
            <p
              className="mt-1.5 font-label-xs text-label-xs text-on-surface-variant/75"
              title={`Cotação captada em ${formatDateTime(rate.capturedAt)}`}
            >
              Câmbio estimado · {formatRateLabel(rate)} · {shortStamp(rate.capturedAt)}
            </p>
          )}

          {/* ---- contagem ------------------------------------------------ */}
          {closesAt && (
            <>
              <div aria-hidden className="mt-space-lg h-px w-full bg-on-surface/10" />
              <div className="mt-space-md flex w-full items-center justify-center gap-space-md">
                <span
                  aria-hidden
                  className="flex size-14 shrink-0 items-center justify-center rounded-full border border-game-bright/25 bg-on-surface/[0.06] text-game-bright"
                >
                  <Sym name="schedule" size={26} />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block font-label-md text-label-md font-bold uppercase tracking-[0.16em] text-on-surface-variant">
                    Vendas fecham em
                  </span>
                  <Countdown
                    target={closesAt}
                    variant="inline"
                    className="block font-display text-[clamp(1.75rem,9vw,3rem)] font-black leading-none tabular-nums text-on-surface"
                    expiredLabel="Vendas encerradas"
                  />
                </span>
              </div>
            </>
          )}

          {/* ---- ação ---------------------------------------------------- */}
          {showCta && (
            <Link
              to={`/loterias/${game.gameKey}`}
              className="hero-cta mt-space-lg flex h-14 w-full items-center justify-center gap-2 rounded-2xl font-display text-lg font-black tracking-tight text-on-secondary-fixed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              Jogar agora
              <Sym name="arrow_forward" size={22} />
            </Link>
          )}

          {draw && (
            <p className="mt-space-md flex items-center justify-center gap-2 font-body-md text-body-md text-on-surface-variant">
              <Sym name="calendar_month" size={18} className="shrink-0" />
              Sorteio: {formatDrawMoment(draw.drawAt, game.timezone)}{' '}
              <span>({timeZoneLabel(draw.drawAt, game.timezone)})</span>
            </p>
          )}
        </div>
      </section>
    </GameTheme>
  );
}

/** Carimbo curto da cotação: "04/10 03:37". O ano fica no title. */
function shortStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(date).replace(',', '');
}
