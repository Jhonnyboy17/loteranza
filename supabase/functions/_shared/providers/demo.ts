import type {
  DrawNumbers, FxProvider, JackpotSnapshot, LotteryProvider, PrizeTierResult,
} from './types.ts';

/**
 * Provedor de demonstracao: nao busca nada e nao inventa nada.
 *
 * Ele nao e um stub preguicoso — e o comportamento correto enquanto nao ha
 * fonte contratada. Devolver numeros plausiveis aqui encheria o banco de
 * resultados falsos marcados como reais, que e exatamente o que o briefing
 * proibe. Com ele ativo os jobs rodam, registram execucao e nao escrevem
 * valor nenhum: o painel mostra "sem fonte configurada" em vez de dados
 * inventados.
 */
export const demoLotteryProvider: LotteryProvider = {
  name: 'demo',
  fetchJackpots(_gameKeys: string[]): Promise<JackpotSnapshot[]> {
    return Promise.resolve([]);
  },
  fetchDrawNumbers(_gameKey: string, _drawDate: string): Promise<DrawNumbers | null> {
    return Promise.resolve(null);
  },
  fetchPrizeBreakdown(_gameKey: string, _drawDate: string): Promise<PrizeTierResult[] | null> {
    return Promise.resolve(null);
  },
};

export const demoFxProvider: FxProvider = {
  name: 'demo',
  fetchRate(_base: string, _quote: string): Promise<number | null> {
    return Promise.resolve(null);
  },
};
