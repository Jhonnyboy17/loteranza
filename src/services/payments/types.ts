/**
 * Payment Provider Abstraction Layer (secao 15).
 *
 * Politica inegociavel deste modulo:
 *  - A natureza da operacao e SEMPRE declarada ao processador. `descriptor` e
 *    `mcc` fazem parte do contrato da interface justamente para que nao exista
 *    caminho de codigo capaz de disfarcar a transacao.
 *  - Nao existe metodo para descrever a cobranca de outra forma, nem campo
 *    livre que substitua o descritor.
 *  - Nenhum provider e habilitado por padrao. Habilitar exige decisao
 *    administrativa por jurisdicao (payment_providers.allowed_jurisdictions).
 *  - Dados de cartao nunca transitam por este codigo: o provider devolve um
 *    token/redirect e guardamos no maximo bandeira e 4 ultimos digitos.
 */

export type PaymentMethod = 'card' | 'ach' | 'pix' | 'bank_transfer';

export interface PaymentIntentRequest {
  orderId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  /** Jurisdicao ja aprovada pelo Compliance Engine. */
  jurisdictionId: string;
  /** Descritor que aparecera na fatura do cliente. Obrigatorio. */
  descriptor: string;
  /** Codigo de categoria do estabelecimento acordado com o adquirente. */
  mcc: string;
  customerReference: string;
}

export interface PaymentIntentResult {
  providerKey: string;
  providerTransactionId: string;
  status: 'requires_action' | 'pending' | 'authorized' | 'captured' | 'failed' | 'demo';
  redirectUrl?: string;
  clientSecret?: string;
  failureCode?: string;
  failureMessage?: string;
  /** true quando nenhuma cobranca real ocorreu. */
  isDemo: boolean;
}

export interface PaymentProvider {
  readonly key: string;
  readonly displayName: string;
  readonly method: PaymentMethod;
  readonly isEnabled: boolean;
  readonly allowedJurisdictions: string[];

  supportsJurisdiction(jurisdictionKey: string): boolean;
  createIntent(request: PaymentIntentRequest): Promise<PaymentIntentResult>;
}
