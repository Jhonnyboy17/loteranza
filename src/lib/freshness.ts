/**
 * Validade de dado volatil.
 *
 * O modo de falha perigoso de uma sincronizacao nao e ela quebrar: e quebrar
 * sem ninguem notar, com a vitrine seguindo em frente. Um jackpot congelado
 * continua parecendo atual — e anunciar como atual um valor que nao vale mais
 * e, na pratica, o "jackpot falso" que o briefing proibe, so que por omissao
 * em vez de intencao.
 *
 * Por isso a decisao e tomada aqui, num lugar so, e nao espalhada em cada
 * tela: toda exibicao de valor volatil passa por `freshness()` e sabe dizer se
 * pode se apresentar como atual.
 */

export type Freshness =
  /** Dentro do prazo: pode ser apresentado como valor atual. */
  | { state: 'fresh'; ageHours: number; updatedAt: Date }
  /** Fora do prazo: mostrar como ultimo valor conhecido, nunca como atual. */
  | { state: 'stale'; ageHours: number; updatedAt: Date }
  /** Sem carimbo de atualizacao: nao da para afirmar nada sobre o valor. */
  | { state: 'unknown'; ageHours: null; updatedAt: null };

export function freshness(
  updatedAt: string | Date | null | undefined,
  maxAgeHours: number,
): Freshness {
  if (!updatedAt) return { state: 'unknown', ageHours: null, updatedAt: null };

  const date = typeof updatedAt === 'string' ? new Date(updatedAt) : updatedAt;
  if (Number.isNaN(date.getTime())) {
    return { state: 'unknown', ageHours: null, updatedAt: null };
  }

  const ageHours = (Date.now() - date.getTime()) / 3_600_000;

  // Carimbo no futuro conta como desconhecido, nao como "fresquissimo": ou o
  // relogio do aparelho esta errado, ou o dado esta errado. Nos dois casos
  // afirmar que o valor e atual seria um chute.
  if (ageHours < -0.25) return { state: 'unknown', ageHours: null, updatedAt: null };

  const limit = Number.isFinite(maxAgeHours) && maxAgeHours > 0 ? maxAgeHours : 12;
  return {
    state: ageHours > limit ? 'stale' : 'fresh',
    ageHours: Math.max(0, ageHours),
    updatedAt: date,
  };
}

/** "há 3 horas", "há 2 dias" — para dizer de quando é o valor exibido. */
export function describeAge(ageHours: number): string {
  if (ageHours < 1) return 'há menos de uma hora';
  if (ageHours < 2) return 'há cerca de uma hora';
  if (ageHours < 24) return `há ${Math.floor(ageHours)} horas`;
  const days = Math.floor(ageHours / 24);
  return days === 1 ? 'há um dia' : `há ${days} dias`;
}
