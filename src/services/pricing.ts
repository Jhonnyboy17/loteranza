import type { CartItem, CartTotals, ExchangeRate, GameLine, LotteryGame } from '@/types/domain';

/**
 * Precificacao exibida na interface.
 *
 * O valor que vale e o calculado no servidor (calculate_order_totals no
 * Postgres). Este modulo existe para o resumo em tela responder instantaneamente
 * ao usuario, e mantem paridade de formula com a versao SQL.
 *
 * Regra de transparencia: preco oficial e taxa de servico sao SEMPRE calculados
 * e devolvidos separados. Nao existe função aqui que retorne apenas o total.
 */

export interface LinePrice {
  official: number;
  fee: number;
  total: number;
}

export function priceLine(game: LotteryGame, line: GameLine, drawsCount = 1): LinePrice {
  const multiplierCost = line.options.multiplier ? game.multiplierPrice : 0;
  const official = (game.officialPrice + multiplierCost) * drawsCount;
  const percentFee = game.officialPrice * game.serviceFeePercent;
  const fee = (game.serviceFee + percentFee) * drawsCount;
  return {
    official: round2(official),
    fee: round2(fee),
    total: round2(official + fee),
  };
}

export function priceLines(game: LotteryGame, lines: GameLine[], drawsCount = 1): LinePrice {
  return lines.reduce<LinePrice>(
    (acc, line) => {
      const price = priceLine(game, line, drawsCount);
      return {
        official: round2(acc.official + price.official),
        fee: round2(acc.fee + price.fee),
        total: round2(acc.total + price.total),
      };
    },
    { official: 0, fee: 0, total: 0 },
  );
}

export function calculateCartTotals(
  items: CartItem[],
  rate: ExchangeRate | null,
): CartTotals {
  let officialCost = 0;
  let serviceFee = 0;
  let lineCount = 0;
  let betCount = 0;

  for (const item of items) {
    for (const line of item.lines) {
      const multiplierCost = line.options.multiplier ? item.multiplierPrice : 0;
      officialCost += (item.unitOfficialPrice + multiplierCost) * item.drawsCount;
      serviceFee += item.unitServiceFee * item.drawsCount;
      lineCount += 1;
      betCount += item.drawsCount;
    }
  }

  officialCost = round2(officialCost);
  serviceFee = round2(serviceFee);
  const total = round2(officialCost + serviceFee);

  return {
    lineCount,
    betCount,
    officialCost,
    serviceFee,
    total,
    currency: items[0]?.currency ?? 'USD',
    totalDisplay: rate ? round2(total * rate.effectiveRate) : null,
    displayCurrency: 'BRL',
    exchangeRate: rate?.effectiveRate ?? null,
    exchangeRateAt: rate?.capturedAt ?? null,
    exchangeRateSource: rate?.source ?? null,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
