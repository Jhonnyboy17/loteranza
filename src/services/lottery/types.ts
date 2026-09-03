import type {
  Draw, DrawResult, DrawResultWithContext, LotteryGame, PrizeTier,
} from '@/types/domain';

/**
 * Data Provider Layer (secao 46 da especificacao).
 *
 * Jackpots e resultados NUNCA sao lidos direto de uma pagina de terceiros pelo
 * frontend. Toda origem de dados implementa esta interface, o que permite
 * trocar o fornecedor (provedor licenciado, feed oficial, etc.) sem tocar em
 * nenhuma tela.
 *
 * Em producao a implementacao ativa deve ser a que le do banco, alimentado por
 * um worker/Edge Function que fala com a fonte licenciada. O provider DEMO
 * existe apenas para desenvolvimento e apresentacao.
 */
export interface LotteryDataProvider {
  /** Identificador da fonte, exibido na interface e gravado nos resultados. */
  readonly sourceId: string;
  /** true quando os dados sao demonstrativos e precisam ser rotulados assim. */
  readonly isDemo: boolean;

  getGames(): Promise<LotteryGame[]>;
  getGameByKey(gameKey: string): Promise<LotteryGame | null>;
  getPrizeTiers(gameId: string): Promise<PrizeTier[]>;

  getCurrentJackpot(gameId: string): Promise<{ amount: number | null; cashValue: number | null; updatedAt: string | null }>;
  getUpcomingDraw(gameId: string): Promise<Draw | null>;
  getUpcomingDraws(gameId: string, limit?: number): Promise<Draw[]>;

  getResult(drawId: string): Promise<DrawResult | null>;
  getLatestResult(gameId: string): Promise<DrawResultWithContext | null>;
  getLatestResults(limit?: number): Promise<DrawResultWithContext[]>;
  getHistoricalResults(gameId: string, options?: HistoricalResultsQuery): Promise<DrawResultWithContext[]>;
}

export interface HistoricalResultsQuery {
  limit?: number;
  from?: string;
  to?: string;
}
