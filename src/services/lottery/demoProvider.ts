import type { Draw, DrawResult, DrawResultWithContext, LotteryGame, PrizeTier } from '@/types/domain';
import { demoGames, demoPrizeTiers, generateSchedule } from './demoDataset';
import type { HistoricalResultsQuery, LotteryDataProvider } from './types';

/**
 * Provider DEMONSTRATIVO. Serve para desenvolvimento e apresentacao.
 * Em producao deve ser substituido por um provider que leia do banco,
 * alimentado por uma fonte oficial/licenciada.
 */
class DemoLotteryProvider implements LotteryDataProvider {
  readonly sourceId = 'demo-dataset';
  readonly isDemo = true;

  private drawsByGame = new Map<string, Draw[]>();
  private resultsByDraw = new Map<string, DrawResult>();
  private built = false;

  private build() {
    if (this.built) return;
    for (const game of demoGames) {
      // Modalidades ainda nao ativas nao tem historico: exibir resultado de um
      // jogo marcado como "em breve" confundiria o usuario.
      const past = game.status === 'active' ? 8 : 0;
      const { draws, results } = generateSchedule(game, 8, past);
      this.drawsByGame.set(game.id, draws.sort((a, b) => a.drawAt.localeCompare(b.drawAt)));
      for (const result of results) this.resultsByDraw.set(result.drawId, result);
    }
    this.built = true;
  }

  private allDraws(): Draw[] {
    this.build();
    return Array.from(this.drawsByGame.values()).flat();
  }

  private withContext(result: DrawResult): DrawResultWithContext | null {
    const draw = this.allDraws().find((d) => d.id === result.drawId);
    const game = demoGames.find((g) => g.id === result.gameId);
    if (!draw || !game) return null;
    return { ...result, draw, game };
  }

  async getGames(): Promise<LotteryGame[]> {
    this.build();
    return demoGames
      .map((game) => ({ ...game, nextDrawId: this.nextDrawFor(game.id)?.id ?? null }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getGameByKey(gameKey: string): Promise<LotteryGame | null> {
    const games = await this.getGames();
    return games.find((g) => g.gameKey === gameKey) ?? null;
  }

  async getPrizeTiers(gameId: string): Promise<PrizeTier[]> {
    return demoPrizeTiers
      .filter((t) => t.gameId === gameId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async getCurrentJackpot(gameId: string) {
    const game = demoGames.find((g) => g.id === gameId);
    return {
      amount: game?.currentJackpot ?? null,
      cashValue: game?.currentJackpotCash ?? null,
      updatedAt: game?.jackpotUpdatedAt ?? null,
    };
  }

  private nextDrawFor(gameId: string): Draw | null {
    this.build();
    const now = Date.now();
    return (
      this.drawsByGame.get(gameId)?.find(
        (d) => d.status === 'scheduled' && new Date(d.drawAt).getTime() > now,
      ) ?? null
    );
  }

  async getUpcomingDraw(gameId: string): Promise<Draw | null> {
    return this.nextDrawFor(gameId);
  }

  async getUpcomingDraws(gameId: string, limit = 10): Promise<Draw[]> {
    this.build();
    const now = Date.now();
    return (this.drawsByGame.get(gameId) ?? [])
      .filter((d) => d.status === 'scheduled' && new Date(d.drawAt).getTime() > now)
      .slice(0, limit);
  }

  async getResult(drawId: string): Promise<DrawResult | null> {
    this.build();
    return this.resultsByDraw.get(drawId) ?? null;
  }

  async getLatestResult(gameId: string): Promise<DrawResultWithContext | null> {
    const results = await this.getHistoricalResults(gameId, { limit: 1 });
    return results[0] ?? null;
  }

  async getLatestResults(limit = 6): Promise<DrawResultWithContext[]> {
    this.build();
    return Array.from(this.resultsByDraw.values())
      .map((r) => this.withContext(r))
      .filter((r): r is DrawResultWithContext => r !== null)
      .sort((a, b) => b.draw.drawAt.localeCompare(a.draw.drawAt))
      .slice(0, limit);
  }

  async getHistoricalResults(
    gameId: string,
    options: HistoricalResultsQuery = {},
  ): Promise<DrawResultWithContext[]> {
    this.build();
    const { limit = 20, from, to } = options;
    return Array.from(this.resultsByDraw.values())
      .filter((r) => r.gameId === gameId)
      .map((r) => this.withContext(r))
      .filter((r): r is DrawResultWithContext => r !== null)
      .filter((r) => (from ? r.draw.drawDate >= from : true))
      .filter((r) => (to ? r.draw.drawDate <= to : true))
      .sort((a, b) => b.draw.drawAt.localeCompare(a.draw.drawAt))
      .slice(0, limit);
  }
}

export const demoLotteryProvider = new DemoLotteryProvider();
