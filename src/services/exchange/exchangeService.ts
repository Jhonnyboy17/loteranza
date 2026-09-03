import type { ExchangeRate } from '@/types/domain';
import { isDemoDataMode } from '@/config/env';
import { supabase } from '@/lib/supabase';

/**
 * Servico de cambio USD -> BRL.
 *
 * Regras que a interface precisa respeitar:
 *  - O valor em real e sempre uma ESTIMATIVA e deve ser rotulado assim.
 *  - A taxa usada no checkout fica gravada no pedido e nunca e reescrita
 *    depois (ver orders.exchange_rate / exchange_rate_id).
 *  - Sempre exibir a fonte e o horario de captura junto do valor convertido.
 */

const DEMO_RATE: ExchangeRate = {
  id: 'fx-demo',
  baseCurrency: 'USD',
  quoteCurrency: 'BRL',
  rate: 5.4,
  spreadPercent: 0,
  effectiveRate: 5.4,
  source: 'demo-dataset',
  capturedAt: new Date().toISOString(),
  isDemo: true,
};

let cached: { value: ExchangeRate; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60_000;

export async function getExchangeRate(
  base = 'USD',
  quote = 'BRL',
): Promise<ExchangeRate> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.value;

  if (isDemoDataMode || !supabase) {
    const value = { ...DEMO_RATE, capturedAt: new Date().toISOString() };
    cached = { value, fetchedAt: Date.now() };
    return value;
  }

  const { data, error } = await supabase
    .from('exchange_rates')
    .select('*')
    .eq('base_currency', base)
    .eq('quote_currency', quote)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    // Sem cotacao disponivel a interface deve omitir a estimativa em BRL,
    // nunca inventar um numero.
    throw new Error('Cotação indisponível no momento.');
  }

  const value: ExchangeRate = {
    id: String(data.id),
    baseCurrency: String(data.base_currency),
    quoteCurrency: String(data.quote_currency),
    rate: Number(data.rate),
    spreadPercent: Number(data.spread_percent ?? 0),
    effectiveRate: Number(data.effective_rate),
    source: String(data.source),
    capturedAt: String(data.captured_at),
    isDemo: Boolean(data.is_demo),
  };
  cached = { value, fetchedAt: Date.now() };
  return value;
}

export function convert(amountUSD: number, rate: ExchangeRate): number {
  return Math.round(amountUSD * rate.effectiveRate * 100) / 100;
}

/** "US$ 1 = R$ 5,40" — sempre exibido junto da estimativa. */
export function formatRateLabel(rate: ExchangeRate): string {
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 4,
  }).format(rate.effectiveRate);
  return `US$ 1 = R$ ${formatted}`;
}
