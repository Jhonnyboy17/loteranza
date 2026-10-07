import type { FxProvider } from './types.ts';

/**
 * Cotacao USD/BRL pelo open.er-api.com (exchangerate-api, plano aberto).
 * Sem chave de API.
 *
 * Existe para ser a SEGUNDA fonte, confrontada com a primeira. Uma unica
 * cotacao nao tem como ser conferida: se a fonte publicar um numero errado —
 * e isso acontece —, o erro entra no pedido congelado e ninguem percebe. Duas
 * fontes independentes que concordam dentro de uma margem transformam esse
 * risco em recusa de gravacao, que e um problema visivel.
 *
 * A resposta traz TODAS as moedas num unico documento (~180 pares). Lemos so o
 * par pedido e descartamos o resto.
 */
export const erApiFxProvider: FxProvider = {
  name: 'er-api',

  async fetchRate(base: string, quote: string): Promise<number | null> {
    const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`;

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      throw new Error(`open.er-api.com respondeu HTTP ${res.status}`);
    }

    const data = await res.json() as {
      result?: string;
      rates?: Record<string, number>;
    };

    // A API devolve 200 com result: "error" em caso de falha logica.
    if (data.result !== 'success') return null;

    const value = data.rates?.[quote];
    if (typeof value !== 'number' || !(value > 0) || !Number.isFinite(value)) {
      return null;
    }
    return value;
  },
};
