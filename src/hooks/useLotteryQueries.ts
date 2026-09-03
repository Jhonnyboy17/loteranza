import { useQuery } from '@tanstack/react-query';
import { lotteryData } from '@/services/lottery';

/**
 * Consultas de dados de loteria. Todas passam pelo Data Provider — nenhuma
 * tela conhece a origem concreta dos dados.
 */

const FIVE_MINUTES = 5 * 60_000;

export function useGames() {
  return useQuery({
    queryKey: ['games'],
    queryFn: () => lotteryData.getGames(),
    staleTime: FIVE_MINUTES,
  });
}

export function useGame(gameKey: string | undefined) {
  return useQuery({
    queryKey: ['game', gameKey],
    queryFn: () => lotteryData.getGameByKey(gameKey!),
    enabled: Boolean(gameKey),
    staleTime: FIVE_MINUTES,
  });
}

export function usePrizeTiers(gameId: string | undefined) {
  return useQuery({
    queryKey: ['prize-tiers', gameId],
    queryFn: () => lotteryData.getPrizeTiers(gameId!),
    enabled: Boolean(gameId),
    staleTime: FIVE_MINUTES,
  });
}

export function useUpcomingDraw(gameId: string | undefined) {
  return useQuery({
    queryKey: ['upcoming-draw', gameId],
    queryFn: () => lotteryData.getUpcomingDraw(gameId!),
    enabled: Boolean(gameId),
    // Jackpot e prazo mudam com frequencia: janela curta.
    staleTime: 60_000,
  });
}

export function useUpcomingDraws(gameId: string | undefined, limit = 10) {
  return useQuery({
    queryKey: ['upcoming-draws', gameId, limit],
    queryFn: () => lotteryData.getUpcomingDraws(gameId!, limit),
    enabled: Boolean(gameId),
    staleTime: 60_000,
  });
}

export function useLatestResults(limit = 6) {
  return useQuery({
    queryKey: ['latest-results', limit],
    queryFn: () => lotteryData.getLatestResults(limit),
    staleTime: FIVE_MINUTES,
  });
}

export function useHistoricalResults(
  gameId: string | undefined,
  options: { limit?: number; from?: string; to?: string } = {},
) {
  return useQuery({
    queryKey: ['historical-results', gameId, options],
    queryFn: () => lotteryData.getHistoricalResults(gameId!, options),
    enabled: Boolean(gameId),
    staleTime: FIVE_MINUTES,
  });
}

/** Jogos ativos + próximo sorteio de cada um, para a home e o catálogo. */
export function useGamesWithDraws() {
  return useQuery({
    queryKey: ['games-with-draws'],
    queryFn: async () => {
      const games = await lotteryData.getGames();
      const draws = await Promise.all(
        games.map(async (game) =>
          game.status === 'active' ? lotteryData.getUpcomingDraw(game.id) : null,
        ),
      );
      return games.map((game, index) => ({ game, draw: draws[index] }));
    },
    staleTime: 60_000,
  });
}
