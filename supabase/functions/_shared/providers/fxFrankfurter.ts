import type { FxProvider } from './types.ts';

/**
 * Cotacao USD/BRL pelo Frankfurter (dados de referencia do Banco Central
 * Europeu). Sem chave de API.
 *
 * O QUE ESTA TAXA E E O QUE NAO E
 *   E taxa de REFERENCIA, publicada uma vez por dia util pelo BCE. Nao e a
 *   taxa comercial de ninguem, e nao e intradiaria: na segunda-feira de manha
 *   ela ainda e a de sexta. Serve como base justamente por ser verificavel e
 *   publica — o que o cliente paga e `effective_rate`, que a rotina calcula
 *   aplicando o spread de `system_settings` sobre esta referencia.
 *
 *   Por isso ela nao basta sozinha para operacao com volume. O desenho previsto
 *   e confrontar duas fontes e recusar a gravacao quando divergirem; e por isso
 *   que `FX_PROVIDER` aceita lista.
 */
export const frankfurterFxProvider: FxProvider = {
  name: 'frankfurter',

  async fetchRate(base: string, quote: string): Promise<number | null> {
    const url = `https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}&to=${encodeURIComponent(quote)}`;

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(`Frankfurter respondeu HTTP ${res.status}`);
    }

    const data = await res.json() as { rates?: Record<string, number>; date?: string };
    const value = data.rates?.[quote];

    // `null` quando a fonte nao sabe. Nunca o ultimo valor conhecido: taxa
    // chutada entra congelada num pedido e vira prejuizo registrado.
    if (typeof value !== 'number' || !(value > 0) || !Number.isFinite(value)) {
      return null;
    }
    return value;
  },
};
