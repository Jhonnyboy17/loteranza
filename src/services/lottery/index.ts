import { isDemoDataMode } from '@/config/env';
import { demoLotteryProvider } from './demoProvider';
import { supabaseLotteryProvider } from './supabaseProvider';
import type { LotteryDataProvider } from './types';

/**
 * Ponto unico de troca do fornecedor de dados de loteria.
 * Nenhuma tela importa um provider concreto — todas usam `lotteryData`.
 */
export const lotteryData: LotteryDataProvider = isDemoDataMode
  ? demoLotteryProvider
  : supabaseLotteryProvider;

export type { LotteryDataProvider, HistoricalResultsQuery } from './types';
