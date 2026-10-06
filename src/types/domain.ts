/**
 * Tipos do dominio. Espelham as tabelas do Postgres (supabase/migrations).
 * Toda regra de jogo chega ao frontend por estes tipos — nunca hardcoded.
 */

export type AppRole =
  | 'SUPER_ADMIN' | 'ADMIN' | 'COMPLIANCE' | 'FINANCE'
  | 'PURCHASER' | 'TICKET_VERIFIER' | 'SUPPORT' | 'CUSTOMER';

export type OrderStatus =
  | 'pending_payment' | 'paid' | 'compliance_review' | 'awaiting_purchase'
  | 'purchased' | 'ticket_uploaded' | 'verified' | 'awaiting_draw'
  | 'winner' | 'not_winner' | 'claim_processing' | 'paid_out'
  | 'cancelled' | 'refunded';

export type PaymentStatus =
  | 'initiated' | 'pending' | 'authorized' | 'captured' | 'failed'
  | 'cancelled' | 'refunded' | 'partially_refunded' | 'chargeback' | 'demo';

export type KycStatus =
  | 'not_started' | 'pending' | 'approved' | 'rejected' | 'manual_review' | 'expired';

export type ComplianceStatus =
  | 'APPROVED' | 'REJECTED' | 'PENDING_REVIEW' | 'BLOCKED' | 'NOT_EVALUATED';

export type ComplianceCheckKind =
  | 'age_check' | 'identity_check' | 'jurisdiction_check' | 'sanctions_check'
  | 'purchase_limits_check' | 'responsible_gaming_check'
  | 'payment_eligibility_check' | 'transactions_enabled_check';

export type TicketStatus =
  | 'pending_purchase' | 'purchased' | 'uploaded' | 'verified'
  | 'discrepancy' | 'void' | 'redeemed' | 'expired';

export type PrizeClaimStatus =
  | 'detected' | 'verified' | 'contacting_customer' | 'documents_requested'
  | 'claim_started' | 'claim_completed' | 'funds_received' | 'customer_paid'
  | 'rejected' | 'expired';

export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'pending_activation';
export type DrawStatus = 'scheduled' | 'closed_for_sales' | 'drawn' | 'official' | 'cancelled';
export type GameStatus = 'active' | 'paused' | 'coming_soon' | 'retired';
export type SupportTicketStatus = 'open' | 'waiting_customer' | 'waiting_internal' | 'resolved' | 'closed';
export type RgLimitKind = 'daily_spend' | 'weekly_spend' | 'monthly_spend' | 'daily_orders' | 'session_time';

/** Configuracao completa de uma modalidade. Dirige o number picker inteiro. */
export interface LotteryGame {
  id: string;
  gameKey: string;
  name: string;
  shortName: string | null;
  status: GameStatus;
  operatorName: string | null;
  description: string | null;
  howToPlay: string | null;
  logoUrl: string | null;
  brandColor: string | null;
  sortOrder: number;

  officialPrice: number;
  serviceFee: number;
  serviceFeePercent: number;
  currency: string;

  mainNumbersCount: number;
  mainNumberMin: number;
  mainNumberMax: number;
  specialNumbersCount: number;
  specialNumberMin: number;
  specialNumberMax: number;
  specialNumberLabel: string | null;

  multiplierEnabled: boolean;
  multiplierLabel: string | null;
  multiplierPrice: number;

  drawDays: number[];
  drawTimeLocal: string;
  salesCutoffMinutes: number;
  timezone: string;

  currentJackpot: number | null;
  currentJackpotCash: number | null;
  jackpotUpdatedAt: string | null;
  nextDrawId: string | null;

  salesEnabled: boolean;
  allowedJurisdictions: string[];
  maxLinesPerOrder: number;
  maxDrawsAhead: number;
  isDemo: boolean;
}

export interface PrizeTier {
  id: string;
  gameId: string;
  tierKey: string;
  label: string;
  mainMatches: number;
  specialMatches: number;
  isJackpot: boolean;
  fixedPrize: number | null;
  prizeNote: string | null;
  oddsDenominator: number | null;
  sortOrder: number;
}

export interface Draw {
  id: string;
  gameId: string;
  drawNumber: string | null;
  drawDate: string;
  drawAt: string;
  salesCloseAt: string;
  status: DrawStatus;
  advertisedJackpot: number | null;
  cashValue: number | null;
  isDemo: boolean;
}

export interface DrawResult {
  id: string;
  drawId: string;
  gameId: string;
  mainNumbers: number[];
  specialNumbers: number[];
  multiplier: number | null;
  jackpotAmount: number | null;
  jackpotWon: boolean | null;
  winnersCount: number | null;
  source: string;
  /** Enquanto false o resultado e preliminar e nao pode fundamentar premio. */
  isOfficial: boolean;
  publishedAt: string;
  isDemo: boolean;
}

/** Resultado com o sorteio e o jogo ja resolvidos, para telas de listagem. */
export interface DrawResultWithContext extends DrawResult {
  draw: Draw;
  game: LotteryGame;
}

export interface JurisdictionRule {
  id: string;
  country: string;
  state: string | null;
  transactionsEnabled: boolean;
  paymentEnabled: boolean;
  subscriptionsEnabled: boolean;
  minimumAge: number;
  kycRequired: boolean;
  allowedGames: string[];
  maxTransaction: number | null;
  maxDailyAmount: number | null;
  currency: string;
  legalNotice: string | null;
  requiresManualReview: boolean;
  updatedAt: string;
}

export interface ExchangeRate {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  spreadPercent: number;
  effectiveRate: number;
  source: string;
  capturedAt: string;
  isDemo: boolean;
}

/** Uma linha de jogo montada pelo usuario, antes de virar pedido. */
export interface GameLine {
  /** Identificador local, estavel enquanto a linha existir no carrinho. */
  id: string;
  numbers: number[];
  specialNumbers: number[];
  isQuickPick: boolean;
  options: { multiplier?: boolean };
}

export interface CartItem {
  id: string;
  gameId: string;
  gameKey: string;
  gameName: string;
  drawId: string | null;
  drawsCount: number;
  lines: GameLine[];
  /** Congelado no momento da adicao para o resumo; recalculado no servidor. */
  unitOfficialPrice: number;
  unitServiceFee: number;
  multiplierPrice: number;
  currency: string;
  addedAt: string;
}

export interface CartTotals {
  lineCount: number;
  betCount: number;
  officialCost: number;
  serviceFee: number;
  total: number;
  currency: string;
  totalDisplay: number | null;
  displayCurrency: string;
  exchangeRate: number | null;
  exchangeRateAt: string | null;
  exchangeRateSource: string | null;
}

export interface Profile {
  id: string;
  fullName: string | null;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  phoneVerifiedAt: string | null;
  dateOfBirth: string | null;
  residenceCountry: string | null;
  preferredLocale: string;
  preferredCurrency: string;
  marketingOptIn: boolean;
  kycStatus: KycStatus;
  selfExcludedUntil: string | null;
  accountPausedUntil: string | null;
  termsAcceptedAt: string | null;
  privacyAcceptedAt: string | null;
  ageConfirmedAt: string | null;
  isDemo: boolean;
  createdAt: string;
}

export interface ComplianceCheckResult {
  kind: ComplianceCheckKind;
  passed: boolean;
  reasonCode: string;
  reasonMessage: string;
  evidence?: Record<string, unknown>;
}

export interface ComplianceVerdict {
  status: ComplianceStatus;
  engineVersion: string;
  jurisdictionId: string | null;
  minimumAge: number;
  checks: ComplianceCheckResult[];
  /** Mensagem pronta para exibicao ao usuario, ja em portugues. */
  summary: string;
  evaluatedAt: string;
}

export interface GeoSignal {
  country: string | null;
  state: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracyM: number | null;
  ipCountry: string | null;
  source: 'browser' | 'ip' | 'provider' | 'unavailable';
  mismatch: boolean;
  capturedAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  status: OrderStatus;
  currency: string;
  officialTicketCost: number;
  serviceFee: number;
  tax: number;
  total: number;
  displayCurrency: string;
  exchangeRate: number | null;
  exchangeRateAt: string | null;
  totalDisplay: number | null;
  gameId: string | null;
  drawId: string | null;
  drawsCount: number;
  complianceStatus: ComplianceStatus;
  isDemo: boolean;
  purchaseDeadline: string | null;
  createdAt: string;
  paidAt: string | null;
  lines: OrderLine[];
}

export interface OrderLine {
  id: string;
  orderId: string;
  gameId: string;
  lineIndex: number;
  numbers: number[];
  specialNumbers: number[];
  isQuickPick: boolean;
  options: Record<string, unknown>;
  quantity: number;
  unitOfficialPrice: number;
  unitServiceFee: number;
  lineTotal: number;
}

export interface Ticket {
  id: string;
  ticketRef: string;
  orderId: string;
  orderLineId: string | null;
  userId: string;
  gameId: string;
  drawId: string;
  status: TicketStatus;
  numbers: number[];
  specialNumbers: number[];
  options: Record<string, unknown>;
  retailerName: string | null;
  purchaseLocation: string | null;
  purchasedAt: string | null;
  verifiedAt: string | null;
  discrepancyNotes: string | null;
  checkedAt: string | null;
  won: boolean | null;
  matchedMain: number | null;
  matchedSpecial: number | null;
  prizeTierId: string | null;
  estimatedPrize: number | null;
  prizeConfirmed: boolean;
  resultSource: string | null;
  isDemo: boolean;
  images: TicketImage[];
}

export interface TicketImage {
  id: string;
  ticketId: string;
  kind: 'front' | 'back' | 'scan';
  url: string;
  redacted: boolean;
  createdAt: string;
}

export interface PrizeClaim {
  id: string;
  claimRef: string;
  ticketId: string;
  orderId: string;
  userId: string;
  status: PrizeClaimStatus;
  grossAmount: number | null;
  withholdingAmount: number | null;
  serviceDeduction: number | null;
  netAmount: number | null;
  currency: string;
  requiresInPerson: boolean;
  requiresDocuments: boolean;
  documentsNote: string | null;
  requiresDualApproval: boolean;
  isDemo: boolean;
  createdAt: string;
}

export interface Favorite {
  id: string;
  userId: string;
  gameId: string;
  label: string;
  numbers: number[];
  specialNumbers: number[];
  timesPlayed: number;
  createdAt: string;
}

export interface JackpotAlert {
  id: string;
  userId: string;
  gameId: string;
  minimumAmount: number;
  currency: string;
  active: boolean;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  eventKey: string;
  title: string;
  body: string | null;
  priority: 'normal' | 'high' | 'critical';
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ResponsibleGamingLimit {
  id: string;
  userId: string;
  kind: RgLimitKind;
  amount: number | null;
  currency: string;
  active: boolean;
  requestedAt: string;
  effectiveAt: string;
  isIncrease: boolean;
  previousAmount: number | null;
}

export interface SupportTicket {
  id: string;
  ticketRef: string;
  userId: string | null;
  category: string;
  subject: string;
  status: SupportTicketStatus;
  priority: string;
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  authorId: string | null;
  authorName: string;
  isInternal: boolean;
  body: string;
  createdAt: string;
}

export interface Faq {
  id: string;
  category: string;
  question: string;
  answer: string;
  gameId: string | null;
  sortOrder: number;
}

export interface CmsContent {
  id: string;
  contentKey: string;
  kind: string;
  title: string | null;
  body: string | null;
  data: Record<string, unknown>;
  isPublished: boolean;
  requiresLegalReview: boolean;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: number;
  userId: string | null;
  role: AppRole | null;
  action: string;
  entity: string;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  severity: string;
  createdAt: string;
}

export interface SystemSettings {
  transactionsEnabled: boolean;
  demoMode: boolean;
  /**
   * Triagem de sancoes. Os tres valores sao os mesmos do banco, e nenhum
   * deles afirma uma checagem que nao houve:
   *   provider       rodou de verdade;
   *   risk_accepted  NAO rodou, e isso fica registrado por extenso;
   *   none           nao rodou e o pedido para em revisao manual.
   */
  sanctionsScreeningMode: 'provider' | 'risk_accepted' | 'none';
  lotteryDataProvider: string;
  fxProvider: string;
  fxSpreadPercent: number;
  rgIncreaseCooldownHours: number;
  prizeManualReviewThreshold: number;
  /** Acima disso o premio deixa de ser apresentado como valor atual. */
  jackpotMaxAgeHours: number;
  /** Acima disso a conversao para real e omitida em vez de estimada com taxa velha. */
  fxMaxAgeHours: number;
  brandName: string;
  supportEmail: string;
}
