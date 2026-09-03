import type { OrderStatus, PrizeClaimStatus, TicketStatus } from '@/types/domain';

/** Rotulos em portugues para os estados do pedido (secao 17). */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Aguardando pagamento',
  paid: 'Pagamento aprovado',
  compliance_review: 'Em análise de compliance',
  awaiting_purchase: 'Aguardando compra do bilhete',
  purchased: 'Bilhete adquirido',
  ticket_uploaded: 'Bilhete digitalizado',
  verified: 'Bilhete verificado',
  awaiting_draw: 'Aguardando sorteio',
  winner: 'Bilhete premiado',
  not_winner: 'Sem premiação',
  claim_processing: 'Resgate em andamento',
  paid_out: 'Prêmio pago',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};

export function orderStatusVariant(
  status: OrderStatus,
): 'default' | 'neutral' | 'success' | 'warning' | 'danger' | 'jackpot' {
  switch (status) {
    case 'winner':
    case 'paid_out':
      return 'jackpot';
    case 'verified':
    case 'purchased':
    case 'ticket_uploaded':
    case 'paid':
      return 'success';
    case 'cancelled':
    case 'refunded':
      return 'danger';
    case 'compliance_review':
    case 'pending_payment':
      return 'warning';
    default:
      return 'neutral';
  }
}

/** Sequencia canonica da linha do tempo exibida ao cliente. */
export const ORDER_TIMELINE: OrderStatus[] = [
  'paid',
  'awaiting_purchase',
  'purchased',
  'verified',
  'awaiting_draw',
];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  pending_purchase: 'Aguardando compra',
  purchased: 'Adquirido',
  uploaded: 'Digitalizado',
  verified: 'Verificado',
  discrepancy: 'Divergência',
  void: 'Anulado',
  redeemed: 'Resgatado',
  expired: 'Expirado',
};

export const PRIZE_CLAIM_LABELS: Record<PrizeClaimStatus, string> = {
  detected: 'Prêmio detectado',
  verified: 'Conferência validada',
  contacting_customer: 'Entrando em contato',
  documents_requested: 'Documentos solicitados',
  claim_started: 'Resgate iniciado junto ao órgão oficial',
  claim_completed: 'Resgate concluído',
  funds_received: 'Valores recebidos',
  customer_paid: 'Repassado ao cliente',
  rejected: 'Recusado',
  expired: 'Prazo expirado',
};
