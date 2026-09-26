import { Link } from 'react-router-dom';
import type { DrawResultWithContext } from '@/types/domain';
import { formatDate } from '@/lib/format';
import { NumberBall } from '@/components/lottery/NumberBall';
import { GameTheme } from '@/components/lottery/GameTheme';
import { Sym } from '@/components/ui/icon';

/**
 * Seção "Últimos Sorteios" do Stitch (design/stitch/inicio/code.html).
 *
 * O Stitch agrupa TODOS os sorteios num card só, separados por um fio de 1px
 * — não um card por resultado. As esferas são de 40px com fio de borda e
 * ficam distribuídas com `justify-between`, sem rótulo de texto ao lado: é o
 * que faz caber numa linha até em tela estreita. O rótulo continua existindo
 * para leitor de tela.
 *
 * Correção de conformidade: o Stitch intitula a seção "Resultados
 * Verificados". Os nossos são preliminares até `draw_results.is_official` —
 * quem confere é o órgão oficial, não nós. O selo diz em que estado está.
 */
export function ResultsCard({ results }: { results: DrawResultWithContext[] }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-on-surface/[0.06] bg-surface-container p-4 shadow-lg">
      {results.map((result, index) => (
        <div key={result.id} className="flex flex-col gap-2">
          {index > 0 && <div aria-hidden className="-mt-2 mb-2 h-px w-full bg-on-surface/[0.06]" />}

          <GameTheme game={result.game}>
            <Link
              to={`/resultados/${result.game.gameKey}`}
              className="flex flex-col gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center justify-between gap-2 font-label-xs text-label-xs">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: 'hsl(var(--game-bright, var(--primary)))' }}
                  />
                  <span className="truncate font-display text-xs font-bold text-on-surface">
                    {result.game.name}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-2">
                  {result.isOfficial ? (
                    <span className="flex items-center gap-1 rounded-full bg-tertiary/15 px-2 py-0.5 font-black uppercase tracking-wider text-tertiary">
                      <Sym name="verified" size={11} /> Oficial
                    </span>
                  ) : (
                    <span className="rounded-full bg-secondary/15 px-2 py-0.5 font-black uppercase tracking-wider text-secondary">
                      Preliminar
                    </span>
                  )}
                  <span className="text-on-surface-variant">
                    {formatDate(result.draw.drawDate)}
                  </span>
                </span>
              </div>

              <div className="flex items-center justify-between gap-1.5">
                <span className="sr-only">
                  Números sorteados: {result.mainNumbers.join(', ')}
                  {result.specialNumbers.length > 0 &&
                    `. ${result.game.specialNumberLabel ?? 'Número especial'}: ${result.specialNumbers.join(', ')}`}
                </span>
                {result.mainNumbers.map((n, i) => (
                  <NumberBall key={`m-${n}-${i}`} value={n} size="draw" tone="main" aria-hidden />
                ))}
                {result.specialNumbers.map((n, i) => (
                  <NumberBall key={`s-${n}-${i}`} value={n} size="draw" tone="special" aria-hidden />
                ))}
              </div>
            </Link>
          </GameTheme>
        </div>
      ))}
    </div>
  );
}
