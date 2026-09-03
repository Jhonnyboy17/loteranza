import * as React from 'react';
import { Coins, Play, RefreshCw } from 'lucide-react';
import { useGames, useLatestResults, useUpcomingDraws } from '@/hooks/useLotteryQueries';
import { usePlatform } from '@/contexts/PlatformContext';
import { formatDate, formatDateTime, formatJackpotCompact, formatUSD, weekdayName } from '@/lib/format';
import { Seo } from '@/components/common/Seo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper,
} from '@/components/ui/table';
import { EmptyState, LoadingRows } from '@/components/common/states';
import { NumberSequence } from '@/components/lottery/NumberBall';

/**
 * Gestao das modalidades. Em producao a escrita destas configuracoes passa
 * pelas policies de RLS (ADMIN/SUPER_ADMIN) e por Edge Functions; aqui a tela
 * exibe a configuracao vigente e de onde ela vem.
 */
export function AdminGames() {
  const gamesQuery = useGames();
  const { settings } = usePlatform();

  return (
    <div className="space-y-6">
      <Seo title="Loterias" description="Configuração das modalidades." noIndex />

      <header>
        <h1 className="font-display text-2xl font-bold">Loterias</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Toda regra de jogo do site vem desta tabela: quantidade de números, faixas, preço, taxa,
          calendário e horário de corte. Nada disso está escrito no código do frontend.
        </p>
      </header>

      <div className="notice-strip border-border bg-muted/40">
        <Coins className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-sm">
          Fonte de dados ativa: <strong>{settings.lotteryDataProvider}</strong>. Jackpots e
          resultados são atualizados por essa fonte — trocá-la não exige alteração de código.
        </p>
      </div>

      {gamesQuery.isLoading ? (
        <LoadingRows />
      ) : (
        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modalidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Números</TableHead>
                <TableHead>Preço oficial</TableHead>
                <TableHead>Taxa</TableHead>
                <TableHead>Sorteios</TableHead>
                <TableHead>Corte</TableHead>
                <TableHead>Jackpot</TableHead>
                <TableHead>Venda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(gamesQuery.data ?? []).map((game) => (
                <TableRow key={game.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden className="size-2.5 rounded-full"
                        style={{ backgroundColor: game.brandColor ?? 'hsl(var(--primary))' }}
                      />
                      {game.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={game.status === 'active' ? 'success' : 'neutral'}>
                      {game.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {game.mainNumbersCount} de {game.mainNumberMin}–{game.mainNumberMax}
                    {game.specialNumbersCount > 0 &&
                      ` + ${game.specialNumbersCount} de ${game.specialNumberMin}–${game.specialNumberMax}`}
                  </TableCell>
                  <TableCell className="tnum">{formatUSD(game.officialPrice)}</TableCell>
                  <TableCell className="tnum">{formatUSD(game.serviceFee)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {game.drawDays.map((d) => weekdayName(d).slice(0, 3)).join(', ')} ·{' '}
                    {game.drawTimeLocal}
                  </TableCell>
                  <TableCell className="tnum text-sm">{game.salesCutoffMinutes} min</TableCell>
                  <TableCell className="tnum">{formatJackpotCompact(game.currentJackpot)}</TableCell>
                  <TableCell>
                    <Badge variant={game.salesEnabled ? 'success' : 'neutral'}>
                      {game.salesEnabled ? 'ativa' : 'desativada'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
    </div>
  );
}

/* ========================================================================== */

export function AdminDraws() {
  const gamesQuery = useGames();
  const active = (gamesQuery.data ?? []).filter((g) => g.status === 'active');
  const [gameId, setGameId] = React.useState<string | null>(null);
  const selected = active.find((g) => g.id === gameId) ?? active[0] ?? null;
  const drawsQuery = useUpcomingDraws(selected?.id, 12);

  return (
    <div className="space-y-6">
      <Seo title="Sorteios" description="Sorteios agendados." noIndex />

      <header>
        <h1 className="font-display text-2xl font-bold">Sorteios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sorteios agendados, gerados a partir do calendário configurado em cada modalidade.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {active.map((game) => (
          <Button
            key={game.id}
            variant={selected?.id === game.id ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setGameId(game.id)}
          >
            {game.name}
          </Button>
        ))}
      </div>

      {drawsQuery.isLoading ? (
        <LoadingRows />
      ) : (drawsQuery.data ?? []).length === 0 ? (
        <EmptyState title="Nenhum sorteio agendado" />
      ) : (
        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Horário do sorteio</TableHead>
                <TableHead>Encerramento dos pedidos</TableHead>
                <TableHead>Jackpot anunciado</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(drawsQuery.data ?? []).map((draw) => (
                <TableRow key={draw.id}>
                  <TableCell className="font-medium">{formatDate(draw.drawDate)}</TableCell>
                  <TableCell>{formatDateTime(draw.drawAt)}</TableCell>
                  <TableCell>{formatDateTime(draw.salesCloseAt)}</TableCell>
                  <TableCell className="tnum">
                    {formatJackpotCompact(draw.advertisedJackpot)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">{draw.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
    </div>
  );
}

/* ========================================================================== */

export function AdminResults() {
  const resultsQuery = useLatestResults(30);

  return (
    <div className="space-y-6">
      <Seo title="Resultados" description="Resultados recebidos." noIndex />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Resultados</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Resultados recebidos da fonte de dados. Enquanto não forem marcados como oficiais, não
            fundamentam nenhum pagamento de prêmio.
          </p>
        </div>
        <Button variant="outline" onClick={() => resultsQuery.refetch()}>
          <RefreshCw aria-hidden /> Atualizar
        </Button>
      </header>

      {resultsQuery.isLoading ? (
        <LoadingRows />
      ) : (
        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loteria</TableHead>
                <TableHead>Sorteio</TableHead>
                <TableHead>Números</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Oficial</TableHead>
                <TableHead>Conferência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(resultsQuery.data ?? []).map((result) => (
                <TableRow key={result.id}>
                  <TableCell className="font-medium">{result.game.name}</TableCell>
                  <TableCell>{formatDate(result.draw.drawDate)}</TableCell>
                  <TableCell>
                    <NumberSequence
                      numbers={result.mainNumbers}
                      specialNumbers={result.specialNumbers}
                      size="xs"
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{result.source}</TableCell>
                  <TableCell>
                    <Badge variant={result.isOfficial ? 'success' : 'warning'}>
                      {result.isOfficial ? 'oficial' : 'preliminar'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" disabled={!result.isOfficial}>
                      <Play aria-hidden /> Conferir bilhetes
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      <p className="text-xs text-muted-foreground">
        A conferência em massa só é liberada para resultados marcados como oficiais. A rotina
        correspondente no banco é <code>compare_all_tickets(draw_id)</code>, que registra os
        acertos e abre processos de resgate em estado "detectado" — sem pagar nada
        automaticamente.
      </p>
    </div>
  );
}
