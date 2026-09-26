import { Link } from 'react-router-dom';
import type { DrawResultWithContext } from '@/types/domain';
import { formatDate } from '@/lib/format';
import { NumberBall } from '@/components/lottery/NumberBall';
import { GameTheme } from '@/components/lottery/GameTheme';
import { Sym } from '@/components/ui/icon';

/**
 * Linha de resultado da seção "Últimos Sorteios" do Stitch
 * (design/stitch/inicio/code.html e o histórico de meus-bilhetes).
 *
 * Correção de conformidade: o Stitch intitula a seção "Resultados Verificados"
 * e trata todo resultado como conferido. Os nossos são preliminares até que
 * `draw_results.is_official` seja verdadeiro — quem confere é o órgão oficial,
 * não nós. O selo aqui diz exatamente em que estado o resultado está.
 */
export function ResultRow({ result }: { result: DrawResultWithContext }) {
  return (
    <GameTheme game={result.game}>
      <Link
        to={`/resultados/${result.game.gameKey}`}
        className="block rounded-xl bg-surface-container p-space-sm shadow-card transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: 'hsl(var(--game-bright, var(--primary)))' }}
            />
            <span
              className="truncate font-display text-label-lg font-bold uppercase tracking-wider"
              style={{ color: 'hsl(var(--game-bright, var(--primary)))' }}
            >
              {result.game.name}
            </span>
          </span>

          {result.isOfficial ? (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-tertiary/15 px-2 py-0.5 font-label-xs text-label-xs font-bold uppercase tracking-wider text-tertiary">
              <Sym name="verified" size={12} /> Oficial
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-secondary/15 px-2 py-0.5 font-label-xs text-label-xs font-bold uppercase tracking-wider text-secondary">
              Preliminar
            </span>
          )}
        </div>

        {/* Dois grupos, não uma lista só: assim a bola especial nunca se
            separa do próprio rótulo quando os números principais quebram.
            Bolas de 28px (o tamanho compacto do Stitch) para os cinco números
            caberem numa linha só a partir de 360px de largura. */}
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-surface-container-lowest/60 p-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {result.mainNumbers.map((n, i) => (
              <NumberBall
                key={`m-${n}-${i}`}
                value={n}
                size="xs"
                tone="main"
                className="sm:size-9 sm:text-xs"
              />
            ))}
          </div>
          {result.specialNumbers.length > 0 && (
            <div className="flex shrink-0 items-center gap-1.5">
              <span
                className="max-w-[4.5rem] truncate font-label-xs text-label-xs uppercase text-outline sm:max-w-[6rem]"
                title={result.game.specialNumberLabel ?? 'Número especial'}
              >
                {result.game.specialNumberLabel ?? 'Especial'}
              </span>
              {result.specialNumbers.map((n, i) => (
                <NumberBall
                  key={`s-${n}-${i}`}
                  value={n}
                  size="xs"
                  tone="special"
                  className="sm:size-9 sm:text-xs"
                />
              ))}
            </div>
          )}
        </div>

        <p className="mt-1.5 px-1 font-label-xs text-label-xs text-outline">
          {result.draw.drawNumber ? `Concurso #${result.draw.drawNumber} · ` : ''}
          {formatDate(result.draw.drawDate)}
        </p>
      </Link>
    </GameTheme>
  );
}
