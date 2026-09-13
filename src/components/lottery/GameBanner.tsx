import type { Draw, ExchangeRate, LotteryGame } from '@/types/domain';
import { formatDrawMoment, formatJackpotCompact, timeZoneLabel } from '@/lib/format';
import { convert } from '@/services/exchange/exchangeService';
import { Badge } from '@/components/ui/badge';
import { Countdown } from './Countdown';

/**
 * Banner da modalidade.
 *
 * Carrega uma informacao principal — o jackpot — e apenas o que orienta a
 * decisao imediata: quando e o sorteio e quanto falta. Tudo que e referencia
 * (regras, premiacao, historico) vive abaixo, fora do caminho.
 */
export function GameBanner({
  game,
  draw,
  rate,
}: {
  game: LotteryGame;
  draw: Draw | null;
  rate: ExchangeRate | null;
}) {
  const jackpot = draw?.advertisedJackpot ?? game.currentJackpot;
  const brl = jackpot !== null && rate ? convert(jackpot, rate) : null;

  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Halo na cor da modalidade. Substitui o violeta da plataforma aqui. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(75% 120% at 50% -20%, hsl(var(--primary) / 0.32), transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.7), transparent)' }}
      />

      <div className="container relative py-12 text-center sm:py-16">
        <div className="mb-4 flex items-center justify-center gap-2">
          <h1
            className="font-display text-2xl font-extrabold uppercase tracking-[0.18em] sm:text-3xl"
            style={{ color: 'hsl(var(--game-bright, var(--primary)))' }}
          >
            {game.name}
          </h1>
          {game.isDemo && <Badge variant="demo">demo</Badge>}
        </div>

        {jackpot !== null ? (
          <>
            <p
              className="font-display font-extrabold leading-[0.95] tracking-tight"
              style={{ fontSize: 'clamp(2.75rem, 9vw, 6rem)' }}
              title={new Intl.NumberFormat('pt-BR', {
                style: 'currency', currency: 'USD',
              }).format(jackpot)}
            >
              {formatJackpotCompact(jackpot)}
            </p>
            {brl !== null && (
              <p className="mt-2 text-base text-muted-foreground sm:text-lg">
                ≈ {formatJackpotCompact(brl, 'BRL')}
              </p>
            )}
          </>
        ) : (
          <p className="font-display text-3xl font-bold text-muted-foreground">
            Jackpot a ser divulgado
          </p>
        )}

        {draw && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Próximo sorteio · {formatDrawMoment(draw.drawAt, game.timezone)}{' '}
              <span className="text-xs">({timeZoneLabel(draw.drawAt, game.timezone)})</span>
            </p>
            <Countdown
              target={draw.salesCloseAt}
              variant="blocks"
              expiredLabel="Pedidos encerrados para este sorteio"
            />
          </div>
        )}
      </div>
    </section>
  );
}
