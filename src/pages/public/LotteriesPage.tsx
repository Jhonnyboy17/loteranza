import { usePlatform } from '@/contexts/PlatformContext';
import { useGamesWithDraws } from '@/hooks/useLotteryQueries';
import { Seo } from '@/components/common/Seo';
import { ErrorState, LoadingCards } from '@/components/common/states';
import { JackpotCard, UpcomingGameRow } from '@/components/lottery/JackpotCard';
import { JurisdictionNotice } from '@/components/compliance/notices';

export function LotteriesPage() {
  const { rate, jurisdiction } = usePlatform();
  const query = useGamesWithDraws();

  const active = (query.data ?? []).filter(({ game }) => game.status === 'active');
  const upcoming = (query.data ?? []).filter(({ game }) => game.status === 'coming_soon');

  return (
    <div className="container py-10">
      <Seo
        title="Loterias americanas disponíveis"
        description="Veja as loterias dos Estados Unidos disponíveis na plataforma, com jackpot estimado, data do próximo sorteio e regras de cada modalidade."
        canonicalPath="/loterias"
      />

      <header className="mb-6 max-w-prose">
        <h1 className="text-display-lg font-extrabold">Loterias</h1>
        <p className="mt-2 text-muted-foreground">
          Escolha uma modalidade para montar seus jogos.
        </p>
      </header>

      <JurisdictionNotice jurisdiction={jurisdiction} className="mb-8" />

      {query.isLoading && <LoadingCards count={3} />}
      {query.isError && (
        <ErrorState
          description="Não conseguimos carregar o catálogo agora."
          onRetry={() => query.refetch()}
        />
      )}

      {query.isSuccess && (
        <>
          <section aria-labelledby="active-title">
            <h2 id="active-title" className="sr-only">Modalidades disponíveis</h2>
            {/* Duas colunas: com duas modalidades ativas, três deixariam uma
                coluna vazia esticando o card. */}
            <div className="grid gap-5 sm:grid-cols-2">
              {active.map(({ game, draw }) => (
                <JackpotCard key={game.id} game={game} draw={draw} rate={rate} />
              ))}
            </div>
          </section>

          {upcoming.length > 0 && (
            <section className="mt-14" aria-labelledby="upcoming-title">
              <h2 id="upcoming-title" className="font-display text-lg font-semibold">
                Em preparação
              </h2>
              <p className="mt-1 max-w-prose text-sm text-muted-foreground">
                Já estruturadas no sistema. A ativação depende de configuração e autorização para
                a jurisdição correspondente.
              </p>
              {/* Linhas compactas: sem jackpot nem sorteio, um card cheio só
                  evidenciaria o espaço vazio. */}
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {upcoming.map(({ game }) => (
                  <li key={game.id}><UpcomingGameRow game={game} /></li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
