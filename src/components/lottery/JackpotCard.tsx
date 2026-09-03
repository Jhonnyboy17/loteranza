import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { Draw, ExchangeRate, LotteryGame } from '@/types/domain';
import { formatDrawMoment, formatJackpotCompact, timeZoneLabel } from '@/lib/format';
import { convert } from '@/services/exchange/exchangeService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Countdown } from './Countdown';
import { cn } from '@/lib/utils';

/**
 * Card de jackpot. Peca central da home e do catalogo.
 *
 * O valor exibido vem sempre do Data Provider — nunca de constante em codigo.
 * Quando nao ha jackpot informado, o card diz isso, em vez de mostrar um numero
 * inventado.
 */
export function JackpotCard({
  game,
  draw,
  rate,
  featured = false,
  className,
}: {
  game: LotteryGame;
  draw: Draw | null;
  rate: ExchangeRate | null;
  featured?: boolean;
  className?: string;
}) {
  const jackpot = draw?.advertisedJackpot ?? game.currentJackpot;
  const isPlayable = game.status === 'active';
  const brl = jackpot !== null && rate ? convert(jackpot, rate) : null;

  return (
    <article
      className={cn(
        'group surface relative flex flex-col overflow-hidden transition',
        'hover:-translate-y-0.5 hover:shadow-lift motion-reduce:hover:translate-y-0',
        featured && 'ring-1 ring-primary/20',
        className,
      )}
    >
      {/* Faixa de cor da modalidade: identificação sem usar logo de terceiros. */}
      <span
        aria-hidden
        className="h-1.5 w-full shrink-0"
        style={{ backgroundColor: game.brandColor ?? 'hsl(var(--primary))' }}
      />

      <div className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="font-display text-xl font-bold tracking-tight">{game.name}</h3>
            {game.operatorName && (
              <p className="text-xs text-muted-foreground">{game.operatorName}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {game.isDemo && <Badge variant="demo">Dados demonstrativos</Badge>}
            {!isPlayable && <Badge variant="neutral">Em breve</Badge>}
          </div>
        </header>

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Jackpot estimado
          </p>
          {jackpot !== null ? (
            <>
              <p
                className="font-display text-display-lg font-extrabold text-foreground"
                title={new Intl.NumberFormat('pt-BR', {
                  style: 'currency', currency: 'USD',
                }).format(jackpot)}
              >
                {formatJackpotCompact(jackpot)}
              </p>
              {brl !== null && (
                <p className="text-sm text-muted-foreground">
                  ≈ {formatJackpotCompact(brl, 'BRL')}{' '}
                  <span className="text-xs">(estimativa)</span>
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Valor ainda não informado pela fonte de dados.
            </p>
          )}
        </div>

        {draw ? (
          <div className="space-y-2">
            <p className="text-sm">
              <span className="text-muted-foreground">Próximo sorteio: </span>
              <span className="font-medium">{formatDrawMoment(draw.drawAt, game.timezone)}</span>{' '}
              <span className="text-xs text-muted-foreground">
                ({timeZoneLabel(draw.drawAt, game.timezone)})
              </span>
            </p>
            <Countdown target={draw.drawAt} variant="blocks" expiredLabel="Sorteio em apuração" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Próximo sorteio a definir.</p>
        )}

        <div className="mt-auto pt-1">
          {isPlayable ? (
            <Button asChild size="lg" block>
              <Link to={`/loterias/${game.gameKey}`}>
                Jogar agora <ArrowRight aria-hidden />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="lg" block disabled>
              Em breve
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
