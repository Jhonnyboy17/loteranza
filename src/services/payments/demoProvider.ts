import type { PaymentIntentRequest, PaymentIntentResult, PaymentProvider } from './types';

/**
 * Provider de DEMONSTRACAO. Nao contata nenhum processador e nao movimenta
 * dinheiro. Recusa qualquer tentativa de uso, por construcao: `isEnabled` e
 * sempre false e `createIntent` devolve status 'demo'.
 *
 * Existe para que o fluxo de checkout possa ser percorrido e revisado sem que
 * exista qualquer caminho capaz de cobrar alguem.
 */
class DemoPaymentProvider implements PaymentProvider {
  readonly key = 'demo';
  readonly displayName = 'Modo demonstração';
  readonly method = 'card' as const;
  readonly isEnabled = false;
  readonly allowedJurisdictions: string[] = [];

  supportsJurisdiction(): boolean {
    return false;
  }

  async createIntent(request: PaymentIntentRequest): Promise<PaymentIntentResult> {
    return {
      providerKey: this.key,
      providerTransactionId: `demo-${request.orderId}`,
      status: 'demo',
      failureCode: 'DEMO_MODE',
      failureMessage:
        'Modo demonstração: nenhuma cobrança foi realizada e nenhum bilhete foi adquirido.',
      isDemo: true,
    };
  }
}

export const demoPaymentProvider = new DemoPaymentProvider();
