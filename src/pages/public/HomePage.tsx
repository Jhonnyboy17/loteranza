import { Link } from 'react-router-dom';
import { brand } from '@/config/brand';
import { usePlatform } from '@/contexts/PlatformContext';
import { useGamesWithDraws, useLatestResults } from '@/hooks/useLotteryQueries';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/button';
import { Sym } from '@/components/ui/icon';
import { ErrorState, LoadingCards } from '@/components/common/states';
import { JackpotHero } from '@/components/lottery/JackpotHero';
import { GameRow } from '@/components/lottery/GameRow';
import { ResultRow } from '@/components/lottery/ResultRow';
import { TrustStrip } from '@/components/lottery/TrustStrip';
import { JurisdictionNotice } from '@/components/compliance/notices';

/** Cabeçalho de seção do Stitch: barrinha colorida + título + link à direita. */
function SectionHead({
  title,
  href,
  hrefLabel,
  accent = 'primary',
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  accent?: 'primary' | 'secondary';
}) {
  return (
    <div className="mb-space-sm flex items-center justify-between gap-space-sm px-1">
      <h2 className="flex items-center gap-1.5 font-headline-sm text-headline-sm text-on-surface">
        <span
          aria-hidden
          className={`h-4 w-1.5 shrink-0 rounded-full ${
            accent === 'secondary' ? 'bg-secondary' : 'bg-primary'
          }`}
        />
        {title}
      </h2>
      {href && hrefLabel && (
        <Link
          to={href}
          className="flex shrink-0 items-center gap-0.5 rounded-full font-label-xs text-label-xs font-semibold uppercase tracking-wider text-outline transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {hrefLabel} <Sym name="chevron_right" size={14} />
        </Link>
      )}
    </div>
  );
}

/**
 * Tela inicial, convertida de design/stitch/inicio/code.html.
 *
 * Ordem das seções do Stitch, preservada: herói com o maior jackpot ->
 * "Loterias Disponíveis" -> "Últimos Sorteios" -> trio de selos.
 *
 * As substituições de conformidade estão documentadas em cada componente e
 * reunidas em design/stitch/CONFORMIDADE.md.
 */
export function HomePage() {
  const { rate, jurisdiction } = usePlatform();
  const gamesQuery = useGamesWithDraws();
  const resultsQuery = useLatestResults(4);

  const entries = gamesQuery.data ?? [];
  const playable = entries.filter(({ game }) => game.status === 'active');

  // O maior prêmio ENTRE OS JOGOS LISTADOS. É o que o selo do herói afirma, e
  // é verdadeiro por construção — diferente do "MAIOR PRÊMIO DO MUNDO" que o
  // Stitch escreveu fixo e que ninguém consegue verificar.
  const featured = [...playable].sort(
    (a, b) =>
      ((b.draw?.advertisedJackpot ?? b.game.currentJackpot) ?? 0) -
      ((a.draw?.advertisedJackpot ?? a.game.currentJackpot) ?? 0),
  )[0];

  const others = featured ? entries.filter((e) => e.game.id !== featured.game.id) : entries;

  return (
    <>
      <Seo
        title={`${brand.name} — Jackpots e resultados das loterias americanas`}
        description="Acompanhe os jackpots das principais loterias dos Estados Unidos, veja resultados, monte seus jogos e confira seus números. Plataforma em português."
        canonicalPath="/"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: brand.name,
          inLanguage: 'pt-BR',
        }}
      />

      <div className="mx-auto w-full max-w-[560px] px-space-md pb-space-xl pt-space-sm lg:max-w-[1100px]">
        {/* ------------------------------------------------------ HERÓI */}
        {gamesQuery.isLoading && <LoadingCards count={1} />}
        {gamesQuery.isError && (
          <ErrorState
            description="Não conseguimos carregar os jackpots agora."
            onRetry={() => gamesQuery.refetch()}
          />
        )}
        {featured && (
          <JackpotHero
            game={featured.game}
            draw={featured.draw}
            rate={rate}
            eyebrow="Maior prêmio em cartaz"
            className="-mx-space-md mb-space-lg px-space-md pb-space-md"
          />
        )}

        {/* ------------------------------------------- LOTERIAS DISPONÍVEIS */}
        {entries.length > 0 && (
          <section className="mb-space-lg" aria-labelledby="loterias-title">
            <SectionHead title="Loterias disponíveis" href="/loterias" hrefLabel="Ver todas" />
            <div className="flex flex-col gap-space-sm lg:grid lg:grid-cols-2">
              {others.map(({ game, draw }) => (
                <GameRow key={game.id} game={game} draw={draw} rate={rate} />
              ))}
            </div>
          </section>
        )}

        {/* ----------------------------------------------- ÚLTIMOS SORTEIOS */}
        <section className="mb-space-lg" aria-labelledby="sorteios-title">
          <SectionHead
            title="Últimos sorteios"
            href="/resultados"
            hrefLabel="Ver todos"
            accent="secondary"
          />
          {resultsQuery.isLoading && <LoadingCards count={2} />}
          {resultsQuery.isSuccess && resultsQuery.data.length === 0 && (
            <p className="rounded-xl bg-surface-container-low p-space-md font-body-sm text-body-sm text-outline">
              Nenhum sorteio registrado ainda.
            </p>
          )}
          {resultsQuery.isSuccess && resultsQuery.data.length > 0 && (
            <div className="flex flex-col gap-space-sm lg:grid lg:grid-cols-2">
              {resultsQuery.data.map((result) => (
                <ResultRow key={result.id} result={result} />
              ))}
            </div>
          )}
        </section>

        {/* ------------------------------------------------------- SELOS */}
        <TrustStrip />

        {/* ------------------------------------------- AVISO DE JURISDIÇÃO */}
        <div className="mt-space-lg">
          <JurisdictionNotice jurisdiction={jurisdiction} />
        </div>

        {/* ------------------------------------------------ SAÍDAS DE APOIO */}
        <div className="mt-space-md grid gap-space-sm sm:grid-cols-2">
          <Button asChild variant="outline" size="lg" block>
            <Link to="/como-funciona">Como funciona</Link>
          </Button>
          <Button asChild variant="outline" size="lg" block>
            <Link to="/conferir-numeros">Conferir meus números</Link>
          </Button>
        </div>
      </div>
    </>
  );
}
