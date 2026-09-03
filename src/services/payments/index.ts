import type { JurisdictionRule } from '@/types/domain';
import { demoPaymentProvider } from './demoProvider';
import type { PaymentMethod, PaymentProvider } from './types';

/**
 * Registro de provedores de pagamento.
 *
 * Em producao, cada provedor real e registrado aqui e habilitado por
 * jurisdicao no painel administrativo (tabela payment_providers). Enquanto
 * nao houver provedor contratado e juridicamente compativel, o unico
 * registrado e o de demonstracao, que nao cobra nada.
 */
const registry = new Map<string, PaymentProvider>([
  [demoPaymentProvider.key, demoPaymentProvider],
]);

export function registerPaymentProvider(provider: PaymentProvider) {
  registry.set(provider.key, provider);
}

export function getPaymentProvider(key: string): PaymentProvider | null {
  return registry.get(key) ?? null;
}

/** Chave canonica de jurisdicao: "BR" ou "US-IL". */
export function jurisdictionKey(rule: Pick<JurisdictionRule, 'country' | 'state'>): string {
  return rule.state ? `${rule.country}-${rule.state}` : rule.country;
}

/**
 * Metodos utilizaveis numa jurisdicao. Retorna vazio sempre que a jurisdicao
 * nao tiver pagamento habilitado — este e o estado atual de todas elas.
 */
export function availableMethods(rule: JurisdictionRule | null): PaymentMethod[] {
  if (!rule || !rule.paymentEnabled) return [];
  const key = jurisdictionKey(rule);
  return Array.from(registry.values())
    .filter((provider) => provider.isEnabled && provider.supportsJurisdiction(key))
    .map((provider) => provider.method);
}

export type { PaymentProvider, PaymentMethod, PaymentIntentRequest, PaymentIntentResult } from './types';
