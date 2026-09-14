import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { Draw, ExchangeRate, LotteryGame } from '@/types/domain';
import { formatDrawMoment, formatJackpotCompact, timeZoneLabel } from '@/lib/format';
import { convert } from '@/services/exchange/exchangeService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Countdown } from './Countdown';
import { GameTheme } from './GameTheme';
import { cn } from '@/lib/utils';

/**
 * Card de jackpot das listagens.
 *
 * O card inteiro assume a cor da modalidade, entao Powerball e Mega Millions
 * se distinguem de relance — antes eram dois cards identicos que so o texto
 * diferenciava.
 *
 * O valor exibido vem sempre do Data Provider. Quando nao ha jackpot
 * informado, o card diz isso, em vez de mostrar um numero inventado.
 */
export function JackpotCard({
  game,
  draw,
  rate,
  className,
}: {
  game: LotteryGame;
  draw: Draw | null;
  rate: ExchangeRate | null;
  className?: string;
}) {
  const jackpot = draw?.advertisedJackpot ?? game.currentJackpot;
  const brl = jackpot !== null && rate ? convert(jackpot, rate) : null;

  return (
    <GameTheme game={game} className={className}>
      <article
        className={cn(
          'group surface relative flex h-full flex-col overflow-hidden transition duration-300',
          'hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift',
          'motion-reduce:hover:translate-y-0',
        )}
      >
        {/* Halo na cor da modalidade, no lugar da barra sólida de antes. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-70 transition group-hover:opacity-100"
          style={{
            backgroundImage:
              'radial-gradient(120% 100% at 50% -30%, hsl(var(--primary) / 0.28), transparent 70%)',
          }}
        />

        <div className="relative flex flex-1 flex-col gap-5 p-6">
          <header className="flex items-start justify-between gap-3">
            <h3
              className="font-display text-lg font-bold uppercase tracking-[0.14em]"
              style={{ color: 'hsl(var(--game-bright, var(--primary)))' }}
            >
              {game.name}
            </h3>
            {game.isDemo && <Badge variant="demo" className="shrink-0">demo</Badge>}
          </header>

          <div className="space-y-1">
            {jackpot !== null ? (
              <>
                <p
                  className="font-display text-[clamp(1.9rem,3.4vw,2.6rem)] font-extrabold leading-none"
                  title={new Intl.NumberFormat('pt-BR', {
                    style: 'currency', currency: 'USD',
                  }).format(jackpot)}
                >
                  {formatJackpotCompact(jackpot)}
                </p>
                {brl !== null && (
                  <p className="text-sm text-muted-foreground">
                    ≈ {formatJackpotCompact(brl, 'BRL')}
                  </p>
                )}
              </>
            ) : (
              <p className="font-display text-xl font-semibold text-muted-foreground">
                Jackpot a ser divulgado
              </p>
            )}
          </div>

          {draw ? (
            <div className="mt-auto space-y-3 pt-1">
              <p className="text-sm text-muted-foreground">
                {formatDrawMoment(draw.drawAt, game.timezone)}{' '}
                <span className="text-xs">({timeZoneLabel(draw.drawAt, game.timezone)})</span>
              </p>
              <Countdown target={draw.drawAt} expiredLabel="Sorteio em apuração" />
              <Button asChild size="lg" block>
                <Link to={`/loterias/${game.gameKey}`}>
                  Jogar agora <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-auto pt-1">
              <Button asChild size="lg" block>
                <Link to={`/loterias/${game.gameKey}`}>
                  Ver modalidade <ArrowRight aria-hidden />
                </Link>
              </Button>
            </div>
          )}
        </div>
      </article>
    </GameTheme>
  );
}

/**
 * Modalidade ainda nao ativa. Linha compacta, nao um card cheio de espaco
 * vazio: sem jackpot e sem sorteio, um card do mesmo tamanho so evidenciava o
 * que ainda nao existe.
 */
export function UpcomingGameRow({ game }: { game: LotteryGame }) {
  return (
    <GameTheme game={game}>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card/50 px-4 py-3">
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: 'hsl(var(--primary))' }}
        />
        <span className="min-w-0 flex-1 truncate font-medium">{game.name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {game.mainNumbersCount} de {game.mainNumberMin}–{game.mainNumberMax}
        </span>
      </div>
    </GameTheme>
  );
}
