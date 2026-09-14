import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useGames, useLatestResults } from '@/hooks/useLotteryQueries';
import { formatDate, formatJackpotCompact, formatLongDate } from '@/lib/format';
import { Seo } from '@/components/common/Seo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EmptyState, ErrorState, LoadingCards } from '@/components/common/states';
import { NumberSequence } from '@/components/lottery/NumberBall';
import { GameTheme } from '@/components/lottery/GameTheme';

export function ResultsPage() {
  const gamesQuery = useGames();
  const resultsQuery = useLatestResults(30);
  const [gameFilter, setGameFilter] = React.useState<string>('all');
  const [periodFilter, setPeriodFilter] = React.useState<string>('all');

  const filtered = React.useMemo(() => {
    const all = resultsQuery.data ?? [];
    const cutoff = periodFilter === 'all' ? null : Date.now() - Number(periodFilter) * 86_400_000;
    return all
      .filter((r) => (gameFilter === 'all' ? true : r.game.gameKey === gameFilter))
      .filter((r) => (cutoff === null ? true : new Date(r.draw.drawAt).getTime() >= cutoff));
  }, [resultsQuery.data, gameFilter, periodFilter]);

  const activeGames = (gamesQuery.data ?? []).filter((g) => g.status === 'active');

  return (
    <div className="container py-10">
      <Seo
        title="Resultados das loterias americanas"
        description="Confira os números sorteados nas loterias dos Estados Unidos, com histórico por modalidade, data e jackpot de cada sorteio."
        canonicalPath="/resultados"
      />

      <header className="mb-6 max-w-prose">
        <h1 className="text-display-lg font-extrabold">Resultados</h1>
        <p className="mt-2 text-muted-foreground">
          Números sorteados por modalidade. O que estiver marcado como preliminar ainda não foi
          validado junto à fonte oficial.
        </p>
      </header>

      <div className="mb-8 flex flex-wrap gap-3">
        <div className="w-48 space-y-1.5">
          <label htmlFor="filter-game" className="text-sm font-medium">Loteria</label>
          <Select value={gameFilter} onValueChange={setGameFilter}>
            <SelectTrigger id="filter-game"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {activeGames.map((game) => (
                <SelectItem key={game.id} value={game.gameKey}>{game.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-48 space-y-1.5">
          <label htmlFor="filter-period" className="text-sm font-medium">Período</label>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger id="filter-period"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo o histórico</SelectItem>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* w-full no mobile: dois rótulos longos lado a lado estouravam a
            largura da página em telas estreitas. */}
        <div className="flex w-full flex-wrap items-end gap-2 sm:ml-auto sm:w-auto">
          {activeGames.map((game) => (
            <Button key={game.id} asChild variant="ghost" size="sm">
              <Link to={`/resultados/${game.gameKey}`}>
                Histórico de {game.name} <ArrowRight aria-hidden />
              </Link>
            </Button>
          ))}
        </div>
      </div>

      {resultsQuery.isLoading && <LoadingCards count={4} />}
      {resultsQuery.isError && (
        <ErrorState onRetry={() => resultsQuery.refetch()} />
      )}

      {resultsQuery.isSuccess && (
        filtered.length === 0 ? (
          <EmptyState
            title="Nenhum resultado no filtro selecionado"
            description="Tente ampliar o período ou escolher outra modalidade."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((result) => (
              <GameTheme key={result.id} game={result.game}>
                <article className="surface h-full space-y-4 p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2
                      className="font-display text-sm font-bold uppercase tracking-[0.14em]"
                      style={{ color: 'hsl(var(--game-bright, var(--primary)))' }}
                    >
                      {result.game.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {formatLongDate(result.draw.drawAt)}
                    </p>
                  </div>

                  <NumberSequence
                    numbers={result.mainNumbers}
                    specialNumbers={result.specialNumbers}
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      Jackpot: {formatJackpotCompact(result.jackpotAmount)}
                    </span>
                    {!result.isOfficial && <Badge variant="warning">preliminar</Badge>}
                  </div>
                </article>
              </GameTheme>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export function GameResultsPage({ gameKey }: { gameKey: string }) {
  return <GameResultsInner gameKey={gameKey} />;
}

function GameResultsInner({ gameKey }: { gameKey: string }) {
  const gamesQuery = useGames();
  const game = (gamesQuery.data ?? []).find((g) => g.gameKey === gameKey) ?? null;
  const resultsQuery = useLatestResults(60);

  const results = (resultsQuery.data ?? []).filter((r) => r.game.gameKey === gameKey);

  if (gamesQuery.isSuccess && !game) {
    return (
      <div className="container py-16">
        <ErrorState title="Modalidade não encontrada" />
      </div>
    );
  }

  return (
    <div className="container py-10">
      <Seo
        title={`Resultados de ${game?.name ?? gameKey}`}
        description={`Histórico completo de resultados de ${game?.name ?? gameKey}: números sorteados, datas e jackpot de cada sorteio.`}
        canonicalPath={`/resultados/${gameKey}`}
      />

      <header className="mb-8">
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-3">
          <Link to="/resultados">← Todos os resultados</Link>
        </Button>
        <h1 className="text-display-lg font-extrabold">
          Resultados de {game?.name ?? gameKey}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Histórico dos sorteios registrados na plataforma.
        </p>
      </header>

      {resultsQuery.isLoading && <LoadingCards count={4} />}

      {resultsQuery.isSuccess && (
        results.length === 0 ? (
          <EmptyState title="Ainda não há resultados registrados para esta modalidade." />
        ) : (
          <ul className="space-y-3">
            {results.map((result) => (
              <li
                key={result.id}
                className="surface flex flex-wrap items-center justify-between gap-4 p-5"
              >
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {formatDate(result.draw.drawDate)}
                    {result.draw.drawNumber && ` · Sorteio ${result.draw.drawNumber}`}
                  </p>
                  <NumberSequence
                    numbers={result.mainNumbers}
                    specialNumbers={result.specialNumbers}
                    size="sm"
                  />
                </div>
                <div className="flex items-center gap-3">
                  {!result.isOfficial && <Badge variant="warning">Preliminar</Badge>}
                  <p className="text-sm font-medium">
                    {formatJackpotCompact(result.jackpotAmount)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
