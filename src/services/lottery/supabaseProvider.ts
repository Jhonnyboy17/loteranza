import type { Draw, DrawResult, DrawResultWithContext, LotteryGame, PrizeTier } from '@/types/domain';
import { requireSupabase } from '@/lib/supabase';
import type { HistoricalResultsQuery, LotteryDataProvider } from './types';

/**
 * Provider de producao: le do Postgres, que e alimentado por um worker/Edge
 * Function conectado a fonte oficial ou licenciada. O browser nunca faz
 * scraping nem chama a fonte diretamente.
 */

type GameRow = Record<string, unknown>;

function mapGame(row: GameRow): LotteryGame {
  const r = row as Record<string, never> & Record<string, unknown>;
  return {
    id: String(r.id),
    gameKey: String(r.game_key),
    name: String(r.name),
    shortName: (r.short_name as string) ?? null,
    status: r.status as LotteryGame['status'],
    operatorName: (r.operator_name as string) ?? null,
    description: (r.description as string) ?? null,
    howToPlay: (r.how_to_play as string) ?? null,
    logoUrl: (r.logo_url as string) ?? null,
    brandColor: (r.brand_color as string) ?? null,
    sortOrder: Number(r.sort_order ?? 100),
    officialPrice: Number(r.official_price ?? 0),
    serviceFee: Number(r.service_fee ?? 0),
    serviceFeePercent: Number(r.service_fee_percent ?? 0),
    currency: String(r.currency ?? 'USD'),
    mainNumbersCount: Number(r.main_numbers_count),
    mainNumberMin: Number(r.main_number_min),
    mainNumberMax: Number(r.main_number_max),
    specialNumbersCount: Number(r.special_numbers_count ?? 0),
    specialNumberMin: Number(r.special_number_min ?? 1),
    specialNumberMax: Number(r.special_number_max ?? 0),
    specialNumberLabel: (r.special_number_label as string) ?? null,
    multiplierEnabled: Boolean(r.multiplier_enabled),
    multiplierLabel: (r.multiplier_label as string) ?? null,
    multiplierPrice: Number(r.multiplier_price ?? 0),
    drawDays: ((r.draw_days as number[]) ?? []).map(Number),
    drawTimeLocal: String(r.draw_time_local ?? '00:00'),
    salesCutoffMinutes: Number(r.sales_cutoff_minutes ?? 60),
    timezone: String(r.timezone ?? 'America/New_York'),
    currentJackpot: r.current_jackpot === null || r.current_jackpot === undefined ? null : Number(r.current_jackpot),
    currentJackpotCash:
      r.current_jackpot_cash === null || r.current_jackpot_cash === undefined ? null : Number(r.current_jackpot_cash),
    jackpotUpdatedAt: (r.jackpot_updated_at as string) ?? null,
    nextDrawId: (r.next_draw_id as string) ?? null,
    salesEnabled: Boolean(r.sales_enabled),
    allowedJurisdictions: ((r.allowed_jurisdictions as string[]) ?? []),
    maxLinesPerOrder: Number(r.max_lines_per_order ?? 20),
    maxDrawsAhead: Number(r.max_draws_ahead ?? 10),
    isDemo: Boolean(r.is_demo),
  };
}

function mapDraw(row: Record<string, unknown>): Draw {
  return {
    id: String(row.id),
    gameId: String(row.game_id),
    drawNumber: (row.draw_number as string) ?? null,
    drawDate: String(row.draw_date),
    drawAt: String(row.draw_at),
    salesCloseAt: String(row.sales_close_at),
    status: row.status as Draw['status'],
    advertisedJackpot: row.advertised_jackpot === null ? null : Number(row.advertised_jackpot),
    cashValue: row.cash_value === null ? null : Number(row.cash_value),
    isDemo: Boolean(row.is_demo),
  };
}

function mapResult(row: Record<string, unknown>): DrawResult {
  return {
    id: String(row.id),
    drawId: String(row.draw_id),
    gameId: String(row.game_id),
    mainNumbers: ((row.main_numbers as number[]) ?? []).map(Number),
    specialNumbers: ((row.special_numbers as number[]) ?? []).map(Number),
    multiplier: row.multiplier === null ? null : Number(row.multiplier),
    jackpotAmount: row.jackpot_amount === null ? null : Number(row.jackpot_amount),
    jackpotWon: (row.jackpot_won as boolean) ?? null,
    winnersCount: row.winners_count === null ? null : Number(row.winners_count),
    source: String(row.source ?? 'unknown'),
    isOfficial: Boolean(row.is_official),
    publishedAt: String(row.published_at),
    isDemo: Boolean(row.is_demo),
  };
}

function mapTier(row: Record<string, unknown>): PrizeTier {
  return {
    id: String(row.id),
    gameId: String(row.game_id),
    tierKey: String(row.tier_key),
    label: String(row.label),
    mainMatches: Number(row.main_matches),
    specialMatches: Number(row.special_matches),
    isJackpot: Boolean(row.is_jackpot),
    fixedPrize: row.fixed_prize === null ? null : Number(row.fixed_prize),
    prizeNote: (row.prize_note as string) ?? null,
    oddsDenominator: row.odds_denominator === null ? null : Number(row.odds_denominator),
    sortOrder: Number(row.sort_order ?? 100),
  };
}

const RESULT_WITH_CONTEXT = '*, draws!inner(*), lottery_games!inner(*)';

function mapResultWithContext(row: Record<string, unknown>): DrawResultWithContext {
  return {
    ...mapResult(row),
    draw: mapDraw(row.draws as Record<string, unknown>),
    game: mapGame(row.lottery_games as Record<string, unknown>),
  };
}

class SupabaseLotteryProvider implements LotteryDataProvider {
  readonly sourceId = 'supabase';
  readonly isDemo = false;

  async getGames(): Promise<LotteryGame[]> {
    const { data, error } = await requireSupabase()
      .from('lottery_games').select('*').neq('status', 'retired').order('sort_order');
    if (error) throw error;
    return (data ?? []).map(mapGame);
  }

  async getGameByKey(gameKey: string): Promise<LotteryGame | null> {
    const { data, error } = await requireSupabase()
      .from('lottery_games').select('*').eq('game_key', gameKey).maybeSingle();
    if (error) throw error;
    return data ? mapGame(data) : null;
  }

  async getPrizeTiers(gameId: string): Promise<PrizeTier[]> {
    const { data, error } = await requireSupabase()
      .from('prize_tiers').select('*').eq('game_id', gameId).order('sort_order');
    if (error) throw error;
    return (data ?? []).map(mapTier);
  }

  async getCurrentJackpot(gameId: string) {
    const { data, error } = await requireSupabase()
      .from('lottery_games')
      .select('current_jackpot, current_jackpot_cash, jackpot_updated_at')
      .eq('id', gameId).maybeSingle();
    if (error) throw error;
    return {
      amount: data?.current_jackpot === null || data?.current_jackpot === undefined ? null : Number(data.current_jackpot),
      cashValue:
        data?.current_jackpot_cash === null || data?.current_jackpot_cash === undefined
          ? null : Number(data.current_jackpot_cash),
      updatedAt: (data?.jackpot_updated_at as string) ?? null,
    };
  }

  async getUpcomingDraw(gameId: string): Promise<Draw | null> {
    const draws = await this.getUpcomingDraws(gameId, 1);
    return draws[0] ?? null;
  }

  async getUpcomingDraws(gameId: string, limit = 10): Promise<Draw[]> {
    const { data, error } = await requireSupabase()
      .from('draws').select('*')
      .eq('game_id', gameId).eq('status', 'scheduled')
      .gt('draw_at', new Date().toISOString())
      .order('draw_at').limit(limit);
    if (error) throw error;
    return (data ?? []).map(mapDraw);
  }

  async getResult(drawId: string): Promise<DrawResult | null> {
    const { data, error } = await requireSupabase()
      .from('draw_results').select('*').eq('draw_id', drawId).maybeSingle();
    if (error) throw error;
    return data ? mapResult(data) : null;
  }

  async getLatestResult(gameId: string): Promise<DrawResultWithContext | null> {
    const results = await this.getHistoricalResults(gameId, { limit: 1 });
    return results[0] ?? null;
  }

  async getLatestResults(limit = 6): Promise<DrawResultWithContext[]> {
    const { data, error } = await requireSupabase()
      .from('draw_results').select(RESULT_WITH_CONTEXT)
      .order('published_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []).map((row) => mapResultWithContext(row as Record<string, unknown>));
  }

  async getHistoricalResults(
    gameId: string,
    options: HistoricalResultsQuery = {},
  ): Promise<DrawResultWithContext[]> {
    const { limit = 20, from, to } = options;
    let query = requireSupabase()
      .from('draw_results').select(RESULT_WITH_CONTEXT).eq('game_id', gameId);
    if (from) query = query.gte('draws.draw_date', from);
    if (to) query = query.lte('draws.draw_date', to);

    const { data, error } = await query.order('published_at', { ascending: false }).limit(limit);
    if (error) throw error;
    return (data ?? []).map((row) => mapResultWithContext(row as Record<string, unknown>));
  }
}

export const supabaseLotteryProvider = new SupabaseLotteryProvider();
