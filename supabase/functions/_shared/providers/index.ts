import { demoFxProvider, demoLotteryProvider } from './demo.ts';
import { erApiFxProvider } from './fxErApi.ts';
import { frankfurterFxProvider } from './fxFrankfurter.ts';
import { nyOpenDataProvider } from './nyOpenData.ts';
import type { FxProvider, LotteryProvider } from './types.ts';

export type { DrawNumbers, FxProvider, GameSpec, JackpotSnapshot, LotteryProvider, PrizeTierResult } from './types.ts';

/**
 * Registro de provedores.
 *
 * COMO LIGAR UMA FONTE REAL
 *   1. crie supabase/functions/_shared/providers/<nome>.ts exportando um
 *      objeto que satisfaca LotteryProvider;
 *   2. registre-o em LOTTERY_PROVIDERS abaixo;
 *   3. defina o secret LOTTERY_DATA_PROVIDERS com o nome dele.
 * Nenhum outro arquivo muda.
 *
 * LOTTERY_DATA_PROVIDERS aceita lista separada por virgula — e esse o ponto.
 * Com duas fontes, cada uma grava sua leitura e o banco so promove o
 * resultado a oficial quando as duas concordam. Com uma so, o resultado fica
 * preliminar esperando conferencia humana, que e o comportamento seguro.
 */
const LOTTERY_PROVIDERS: Record<string, LotteryProvider> = {
  demo: demoLotteryProvider,
  'ny-open-data': nyOpenDataProvider,
};

const FX_PROVIDERS: Record<string, FxProvider> = {
  demo: demoFxProvider,
  frankfurter: frankfurterFxProvider,
  'er-api': erApiFxProvider,
};

/**
 * Padrao do cambio: duas fontes reais, nao `demo`.
 *
 * Aqui a regra se inverte em relacao a loteria, e por um motivo concreto. Em
 * resultado de sorteio, a alternativa a uma fonte e nao ter resultado — e nao
 * ter e o certo, porque bilhete conferido por palpite e fraude. Em cambio, a
 * alternativa a uma fonte NAO e a ausencia: e a linha que sobrou no banco, que
 * neste projeto era uma semente de demonstracao de 5,40 com spread zero.
 * Enquanto o padrao foi `demo`, a rotina terminava com `skipped` e o checkout
 * seguiu convertendo por essa semente — 8% acima do dolar real do dia. Numero
 * inventado, em producao, no valor cobrado.
 *
 * Duas fontes publicas sem chave, conferidas uma contra a outra e recusadas
 * quando divergem, sao melhores que isso em todos os aspectos. `demo`
 * continua registrado para quem quiser desligar a captura de proposito.
 */
const FX_PADRAO = 'frankfurter,er-api';

/** Nome desconhecido e erro ruidoso, nao fallback silencioso para demo: cair
 *  em demo por causa de um erro de digitacao pararia de atualizar sem avisar. */
function resolve<T>(registry: Record<string, T>, names: string[], kind: string): T[] {
  return names.map((name) => {
    const found = registry[name];
    if (!found) {
      throw new Error(
        `Provedor de ${kind} desconhecido: "${name}". Registrados: ${Object.keys(registry).join(', ')}`,
      );
    }
    return found;
  });
}

function parseList(value: string | undefined, fallback: string): string[] {
  return (value ?? fallback)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function lotteryProviders(): LotteryProvider[] {
  return resolve(LOTTERY_PROVIDERS, parseList(Deno.env.get('LOTTERY_DATA_PROVIDERS'), 'demo'), 'loteria');
}

/**
 * Fontes de cambio configuradas, na ordem declarada em FX_PROVIDER.
 *
 * A ordem importa: quando as fontes concordam dentro da margem, e a taxa da
 * PRIMEIRA que e gravada. As demais entram no registro como corroboracao.
 * Escolher deterministicamente evita o pior dos mundos, que seria uma media
 * silenciosa entre numeros que ninguem conferiu.
 */
export function fxProviders(): FxProvider[] {
  return resolve(FX_PROVIDERS, parseList(Deno.env.get('FX_PROVIDER'), FX_PADRAO), 'cambio');
}

/** Compatibilidade: a primeira fonte configurada. */
export function fxProvider(): FxProvider {
  return fxProviders()[0];
}

/** true quando nenhuma fonte real esta configurada. */
export function isDemoOnly(providers: { name: string }[]): boolean {
  return providers.every((p) => p.name === 'demo');
}
