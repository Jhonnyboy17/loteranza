import type {
  AppNotification, AuditLogEntry, CartItem, ComplianceVerdict, Favorite,
  JackpotAlert, JurisdictionRule, Order, OrderLine, PrizeClaim,
  ResponsibleGamingLimit, SupportTicket, SystemSettings, Ticket,
} from '@/types/domain';

/**
 * Estado mutavel do modo DEMO.
 *
 * Existe para que toda a aplicacao (area do cliente, fila de compra, admin)
 * funcione ponta a ponta sem Supabase configurado. Persiste em localStorage,
 * portanto e por navegador e nunca sai do dispositivo do usuario.
 *
 * NADA aqui e uma transacao real. Todo registro nasce com isDemo = true e a
 * interface rotula isso de forma visivel.
 */

const STORAGE_KEY = 'jackpot-usa:demo-store:v1';

export interface DemoState {
  orders: Order[];
  tickets: Ticket[];
  prizeClaims: PrizeClaim[];
  favorites: Favorite[];
  jackpotAlerts: JackpotAlert[];
  notifications: AppNotification[];
  supportTickets: SupportTicket[];
  auditLogs: AuditLogEntry[];
  rgLimits: ResponsibleGamingLimit[];
  jurisdictions: JurisdictionRule[];
  settings: SystemSettings;
  lastVerdict: ComplianceVerdict | null;
}

function defaultJurisdictions(): JurisdictionRule[] {
  const now = new Date().toISOString();
  const base = {
    transactionsEnabled: false,
    paymentEnabled: false,
    subscriptionsEnabled: false,
    minimumAge: 18,
    kycRequired: true,
    allowedGames: [] as string[],
    maxTransaction: null as number | null,
    maxDailyAmount: null as number | null,
    requiresManualReview: true,
    updatedAt: now,
  };
  return [
    {
      id: 'jur-br', country: 'BR', state: null, currency: 'BRL',
      legalNotice:
        'Atualmente não podemos aceitar compras a partir da sua localização. Você pode consultar jackpots e resultados normalmente.',
      ...base,
    },
    {
      id: 'jur-us', country: 'US', state: null, currency: 'USD',
      legalNotice: 'Compras ainda não habilitadas. A liberação depende de análise por estado.',
      ...base,
    },
    {
      id: 'jur-us-il', country: 'US', state: 'IL', currency: 'USD',
      legalNotice: 'Jurisdição mapeada, porém ainda não habilitada para transações.',
      ...base, maxTransaction: 5000,
    },
    {
      id: 'jur-us-ny', country: 'US', state: 'NY', currency: 'USD',
      legalNotice: 'Jurisdição mapeada, porém ainda não habilitada para transações.',
      ...base, maxTransaction: 5000,
    },
    {
      id: 'jur-pt', country: 'PT', state: null, currency: 'EUR',
      legalNotice: 'Atualmente não podemos aceitar compras a partir da sua localização.',
      ...base,
    },
  ];
}

function defaultSettings(): SystemSettings {
  return {
    // Nasce desligado. Ligar aqui ainda nao autoriza nada: a jurisdicao
    // precisa estar habilitada e o Compliance Engine precisa aprovar.
    transactionsEnabled: false,
    demoMode: true,
    sanctionsProviderEnabled: false,
    lotteryDataProvider: 'demo',
    fxProvider: 'demo',
    fxSpreadPercent: 0,
    rgIncreaseCooldownHours: 24,
    prizeManualReviewThreshold: 600,
    brandName: 'Jackpot USA',
    supportEmail: 'suporte@exemplo.com',
  };
}

function emptyState(): DemoState {
  return {
    orders: [], tickets: [], prizeClaims: [], favorites: [], jackpotAlerts: [],
    notifications: [], supportTickets: [], auditLogs: [], rgLimits: [],
    jurisdictions: defaultJurisdictions(),
    settings: defaultSettings(),
    lastVerdict: null,
  };
}

let state: DemoState = load();
const listeners = new Set<() => void>();

function load(): DemoState {
  if (typeof localStorage === 'undefined') return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<DemoState>;
    return {
      ...emptyState(),
      ...parsed,
      // Configuracao e jurisdicoes ganham campos novos entre versoes; faz merge
      // para nao quebrar quem ja tem estado salvo.
      settings: { ...defaultSettings(), ...(parsed.settings ?? {}) },
      jurisdictions: parsed.jurisdictions?.length ? parsed.jurisdictions : defaultJurisdictions(),
    };
  } catch {
    return emptyState();
  }
}

function persist() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota cheia ou modo privado: o estado segue apenas em memoria.
  }
  listeners.forEach((fn) => fn());
}

export const demoStore = {
  getState(): DemoState {
    return state;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  update(mutate: (draft: DemoState) => void) {
    const next = structuredClone(state);
    mutate(next);
    state = next;
    persist();
  },

  reset() {
    state = emptyState();
    persist();
  },

  /** Registra uma acao no log de auditoria demonstrativo. */
  audit(entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) {
    this.update((draft) => {
      draft.auditLogs.unshift({
        ...entry,
        id: draft.auditLogs.length ? draft.auditLogs[0].id + 1 : 1,
        createdAt: new Date().toISOString(),
      });
      // Mantem o log demonstrativo com tamanho controlado.
      draft.auditLogs = draft.auditLogs.slice(0, 500);
    });
  },

  notify(notification: Omit<AppNotification, 'id' | 'createdAt' | 'readAt'>) {
    this.update((draft) => {
      draft.notifications.unshift({
        ...notification,
        id: `ntf-${crypto.randomUUID()}`,
        readAt: null,
        createdAt: new Date().toISOString(),
      });
    });
  },
};

/** Converte itens do carrinho em um pedido DEMO com numeracao propria. */
export function buildDemoOrder(params: {
  userId: string;
  items: CartItem[];
  drawsCount: number;
  exchangeRate: number | null;
  exchangeRateAt: string | null;
  purchaseDeadline: string | null;
}): Order {
  const { userId, items, exchangeRate, exchangeRateAt, purchaseDeadline } = params;
  const orderId = `ord-${crypto.randomUUID()}`;

  const lines: OrderLine[] = [];
  let index = 0;
  let officialCost = 0;
  let serviceFee = 0;

  for (const item of items) {
    for (const line of item.lines) {
      const multiplierCost = line.options.multiplier ? item.multiplierPrice : 0;
      const unitOfficial = (item.unitOfficialPrice + multiplierCost) * item.drawsCount;
      const unitFee = item.unitServiceFee * item.drawsCount;
      officialCost += unitOfficial;
      serviceFee += unitFee;
      lines.push({
        id: `oln-${crypto.randomUUID()}`,
        orderId,
        gameId: item.gameId,
        lineIndex: index,
        numbers: [...line.numbers],
        specialNumbers: [...line.specialNumbers],
        isQuickPick: line.isQuickPick,
        options: { ...line.options },
        quantity: 1,
        unitOfficialPrice: unitOfficial,
        unitServiceFee: unitFee,
        lineTotal: unitOfficial + unitFee,
      });
      index += 1;
    }
  }

  const total = officialCost + serviceFee;
  const first = items[0];
  const sequence = String(demoStore.getState().orders.length + 1001).padStart(6, '0');

  return {
    id: orderId,
    orderNumber: `JP-DEMO-${sequence}`,
    userId,
    status: 'pending_payment',
    currency: first?.currency ?? 'USD',
    officialTicketCost: round2(officialCost),
    serviceFee: round2(serviceFee),
    tax: 0,
    total: round2(total),
    displayCurrency: 'BRL',
    exchangeRate,
    exchangeRateAt,
    totalDisplay: exchangeRate ? round2(total * exchangeRate) : null,
    gameId: first?.gameId ?? null,
    drawId: first?.drawId ?? null,
    drawsCount: first?.drawsCount ?? 1,
    complianceStatus: 'NOT_EVALUATED',
    isDemo: true,
    purchaseDeadline,
    createdAt: new Date().toISOString(),
    paidAt: null,
    lines,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
