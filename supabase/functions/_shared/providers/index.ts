import { demoFxProvider, demoLotteryProvider } from './demo.ts';
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
};

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

export function fxProvider(): FxProvider {
  return resolve(FX_PROVIDERS, parseList(Deno.env.get('FX_PROVIDER'), 'demo'), 'cambio')[0];
}

/** true quando nenhuma fonte real esta configurada. */
export function isDemoOnly(providers: { name: string }[]): boolean {
  return providers.every((p) => p.name === 'demo');
}
