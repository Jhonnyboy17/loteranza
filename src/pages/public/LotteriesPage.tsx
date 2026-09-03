import { usePlatform } from '@/contexts/PlatformContext';
import { useGamesWithDraws } from '@/hooks/useLotteryQueries';
import { Seo } from '@/components/common/Seo';
import { ErrorState, LoadingCards } from '@/components/common/states';
import { JackpotCard } from '@/components/lottery/JackpotCard';
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

      <header className="mb-8 max-w-2xl">
        <h1 className="text-display-xl font-extrabold">Loterias</h1>
        <p className="mt-2 text-muted-foreground">
          Cada modalidade tem suas próprias regras de números, preço e calendário de sorteios.
          Toda essa configuração vem do painel administrativo — nada é fixo no site.
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
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {active.map(({ game, draw }) => (
                <JackpotCard key={game.id} game={game} draw={draw} rate={rate} />
              ))}
            </div>
          </section>

          {upcoming.length > 0 && (
            <section className="mt-12" aria-labelledby="upcoming-title">
              <h2 id="upcoming-title" className="text-display-lg font-bold">
                Em preparação
              </h2>
              <p className="mt-1 max-w-2xl text-muted-foreground">
                Modalidades já estruturadas no sistema. A ativação depende de configuração e
                autorização para a jurisdição correspondente.
              </p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {upcoming.map(({ game, draw }) => (
                  <JackpotCard key={game.id} game={game} draw={draw} rate={rate} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
