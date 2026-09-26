import { usePlatform } from '@/contexts/PlatformContext';
import { useGamesWithDraws } from '@/hooks/useLotteryQueries';
import { Seo } from '@/components/common/Seo';
import { ErrorState, LoadingCards } from '@/components/common/states';
import { GameRow } from '@/components/lottery/GameRow';
import { JurisdictionNotice } from '@/components/compliance/notices';

/**
 * Catálogo de modalidades.
 *
 * Usa o mesmo <GameRow> da seção "Loterias Disponíveis" da tela inicial: é o
 * único tratamento de lista que o Stitch desenhou para modalidade, e repeti-lo
 * aqui mantém as duas telas falando a mesma língua.
 */
export function LotteriesPage() {
  const { rate, jurisdiction } = usePlatform();
  const query = useGamesWithDraws();

  const active = (query.data ?? []).filter(({ game }) => game.status === 'active');
  const upcoming = (query.data ?? []).filter(({ game }) => game.status === 'coming_soon');

  return (
    <div className="mx-auto w-full max-w-[560px] px-space-md py-space-lg lg:max-w-[1100px]">
      <Seo
        title="Loterias americanas disponíveis"
        description="Veja as loterias dos Estados Unidos disponíveis na plataforma, com jackpot estimado, data do próximo sorteio e regras de cada modalidade."
        canonicalPath="/loterias"
      />

      <header className="mb-space-md">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Loterias</h1>
        <p className="mt-1 font-body-md text-body-md text-outline">
          Escolha uma modalidade para montar seus jogos.
        </p>
      </header>

      <JurisdictionNotice jurisdiction={jurisdiction} className="mb-space-md" />

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
            <div className="flex flex-col gap-space-sm lg:grid lg:grid-cols-2 lg:items-start">
              {active.map(({ game, draw }) => (
                <GameRow key={game.id} game={game} draw={draw} rate={rate} />
              ))}
            </div>
          </section>

          {upcoming.length > 0 && (
            <section className="mt-space-lg" aria-labelledby="upcoming-title">
              <h2
                id="upcoming-title"
                className="flex items-center gap-1.5 font-headline-sm text-headline-sm text-on-surface"
              >
                <span aria-hidden className="h-4 w-1.5 shrink-0 rounded-full bg-outline-variant" />
                Em preparação
              </h2>
              <p className="mt-1 font-body-sm text-body-sm text-outline">
                Já estruturadas no sistema. A ativação depende de configuração e autorização para
                a jurisdição correspondente.
              </p>
              <div className="mt-space-sm flex flex-col gap-space-sm lg:grid lg:grid-cols-2 lg:items-start">
                {upcoming.map(({ game, draw }) => (
                  <GameRow key={game.id} game={game} draw={draw} rate={rate} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
