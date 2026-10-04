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
 * A composição segue uma regra só: UM elemento domina e todo o resto recua.
 * O dominante é o valor do prêmio. O dourado aparece nele e no botão, e em
 * mais nada — antes havia cinco elementos dourados disputando atenção (selo,
 * contagem, valor, conversão e CTA), o que é o mesmo que não destacar nada.
 *
 * Dados secundários saem de caixas arredondadas e entram numa grade de
 * rótulo/valor separada por um fio de 1px. Quatro retângulos empilhados leem
 * como uma lista de etiquetas; rótulo pequeno sobre valor legível lê como
 * ficha técnica, que é o que esses dados são.
 *
 * Duas remoções são de postura, não de estética. O ponto pulsante ao lado da
 * contagem e o halo pulsante do botão fabricavam urgência que o dado não pede:
 * o prazo real já está escrito, com hora e fuso. Urgência inventada é padrao
 * escuro, e o briefing a proíbe — além de ser o traço que faz uma interface
 * parecer cassino em vez de serviço financeiro.
 *
 * O que vem do Stitch e permanece (design/stitch/inicio/code.html): o herói
 * como card de cantos 3xl, iluminado por dentro por uma aura ao fundo, com o
 * valor em ouro como centro de gravidade.
 *
 * Decisões de conformidade herdadas (design/stitch/CONFORMIDADE.md):
 *
 *  - "MAIOR PRÊMIO DO MUNDO": afirmação estática e não verificável. Vira
 *    `eyebrow`, que a tela inicial preenche com "Maior prêmio em cartaz" —
 *    verdadeiro por construção, porque é calculado sobre os jogos listados.
 *  - contagem regressiva fixa em JS: sai de `draw.salesCloseAt`, via
 *    <Countdown>, e expira de verdade.
 *  - "Câmbio Oficial": a cotação é estimativa. O rótulo diz isso e informa o
 *    horário de captura.
 *  - logo hotlinkada de terceiro: vira <GameWordmark>.
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
  // Forma compacta ("≈ R$ 2,6 bilhões") em vez dos onze dígitos de
  // R$ 2.624.400.000. Não é só economia de espaço: a conversão é estimada, e
  // escrever o centavo exato de um valor aproximado finge uma precisão que
  // não existe. O número cheio continua disponível no title e para leitor de
  // tela.
  const brl = brlValue !== null ? splitJackpot(brlValue, 'BRL') : null;
  const closesAt = draw?.salesCloseAt ?? null;

  return (
    <GameTheme game={game} className={className}>
      <section className="hero-card relative overflow-hidden rounded-3xl bg-gradient-to-b from-surface-container-high via-surface-container-low to-surface-container-lowest p-6 sm:p-8">
        <div aria-hidden className="pointer-events-none absolute -inset-10 hero-aura" />

        <div className="relative z-10 lg:flex lg:items-end lg:justify-between lg:gap-space-xl">
          {/* ---- identidade + valor ------------------------------------ */}
          <div className="min-w-0">
            {eyebrow && (
              <p className="flex items-center gap-1.5 font-label-xs text-label-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">
                <Sym name="stars" size={13} className="shrink-0 text-secondary" />
                {eyebrow}
              </p>
            )}

            <GameWordmark game={game} className="mt-space-sm" />

            <p className="mt-space-md font-label-md text-label-md uppercase tracking-[0.14em] text-on-surface-variant">
              Prêmio estimado
            </p>

            {jackpot ? (
              <p
                className="mt-1 flex items-baseline gap-1.5 text-secondary"
                title={jackpot.exact}
              >
                <span className="sr-only">Prêmio estimado de {jackpot.exact}</span>
                {/* Símbolo e unidade ficam menores e mais leves de propósito:
                    o algarismo é o dado, "US$" e "Milhões" são o contexto.
                    Com os três no mesmo peso, nada lidera. */}
                <span aria-hidden className="font-headline-sm text-headline-sm font-semibold text-secondary/75">
                  {jackpot.symbol}
                </span>
                <span
                  aria-hidden
                  className="font-jackpot-display text-jackpot-fluid font-black tracking-tighter tabular-nums"
                >
                  {jackpot.amount}
                </span>
                {jackpot.unit && (
                  <span aria-hidden className="font-headline-sm text-headline-sm font-semibold text-secondary/75">
                    {jackpot.unit.toLowerCase()}
                  </span>
                )}
              </p>
            ) : (
              <p className="mt-1 font-headline-md text-headline-md text-on-surface-variant">
                Prêmio a divulgar
              </p>
            )}

            {brl && brlValue !== null && (
              <p
                className="mt-space-xs font-body-md text-body-md font-medium text-on-surface-variant"
                title={formatBRL(brlValue, true)}
              >
                <span className="sr-only">
                  Equivalente aproximado a {formatBRL(brlValue, true)}.
                </span>
                <span aria-hidden>
                  ≈ {brl.symbol} {brl.amount}
                  {brl.unit ? ` ${brl.unit.toLowerCase()}` : ''}
                </span>
              </p>
            )}
          </div>

          {/* ---- ficha técnica + ação ---------------------------------- */}
          <div className="mt-space-lg shrink-0 border-t border-on-surface/10 pt-space-md lg:mt-0 lg:w-[21rem] lg:border-l lg:border-t-0 lg:pl-space-lg lg:pt-0">
            <dl className="grid grid-cols-2 gap-x-space-md gap-y-space-md lg:grid-cols-1">
              {draw && (
                <div className="min-w-0">
                  <dt className="font-label-xs text-label-xs uppercase tracking-[0.12em] text-on-surface-variant">
                    Sorteio
                  </dt>
                  {/* O fuso vai em linha própria: na coluna estreita do
                      celular ele sobrava sozinho na segunda linha e parecia
                      quebra acidental. */}
                  <dd className="mt-0.5 font-body-md text-body-md font-medium text-on-surface">
                    {formatDrawMoment(draw.drawAt, game.timezone)}
                    <span className="block font-body-sm text-body-sm font-normal text-on-surface-variant">
                      {timeZoneLabel(draw.drawAt, game.timezone)}
                    </span>
                  </dd>
                </div>
              )}

              {closesAt && (
                <div className="min-w-0">
                  <dt className="font-label-xs text-label-xs uppercase tracking-[0.12em] text-on-surface-variant">
                    Vendas fecham em
                  </dt>
                  <dd className="mt-0.5">
                    <Countdown
                      target={closesAt}
                      variant="inline"
                      className="font-body-md text-body-md font-semibold tabular-nums text-on-surface"
                      expiredLabel="Vendas encerradas"
                    />
                  </dd>
                </div>
              )}

              {/* A cotação é dado técnico, e é aqui que ela pertence: fora do
                  caminho de leitura do prêmio, mas visível sem clique. O
                  rótulo diz "estimado" e o horário de captura vem junto —
                  sem a captura, "estimado" não significa muito, porque não
                  se sabe de quando é a estimativa. */}
              {rate && (
                <div className="col-span-2 min-w-0 lg:col-span-1">
                  <dt className="font-label-xs text-label-xs uppercase tracking-[0.12em] text-on-surface-variant">
                    Câmbio estimado
                  </dt>
                  <dd className="mt-0.5 font-body-md text-body-md font-medium text-on-surface">
                    {formatRateLabel(rate)}{' '}
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      · captado {formatDateTime(rate.capturedAt)}
                    </span>
                  </dd>
                </div>
              )}
            </dl>

            {showCta && (
              <Link
                to={`/loterias/${game.gameKey}`}
                className="hero-cta mt-space-md flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-secondary font-display text-base font-extrabold tracking-tight text-on-secondary-fixed hover:bg-secondary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                Jogar agora
                <Sym name="arrow_forward" size={20} />
              </Link>
            )}
          </div>
        </div>
      </section>
    </GameTheme>
  );
}
