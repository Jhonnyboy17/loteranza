/**
 * Formatacao para pt-BR. Nenhum valor monetario e arredondado para "parecer
 * maior": jackpots sao exibidos como recebidos da fonte de dados.
 */

const usd = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

const usdWhole = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

const brlWhole = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export function formatUSD(value: number | null | undefined, whole = false): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return (whole ? usdWhole : usd).format(value).replace('US$', 'US$ ').replace(/\s+/g, ' ');
}

export function formatBRL(value: number | null | undefined, whole = false): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return (whole ? brlWhole : brl).format(value);
}

export function formatMoney(value: number | null | undefined, currency: string, whole = false): string {
  if (currency === 'BRL') return formatBRL(value, whole);
  if (currency === 'USD') return formatUSD(value, whole);
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(value);
}

/**
 * Jackpots grandes em forma compacta e legivel ("US$ 150 milhões").
 * Mantem o valor exato disponivel para leitores de tela via `title`.
 */
export function formatJackpotCompact(value: number | null | undefined, currency = 'USD'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const symbol = currency === 'BRL' ? 'R$' : 'US$';
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    const n = value / 1_000_000_000;
    return `${symbol} ${trimNumber(n)} ${n === 1 ? 'bilhão' : 'bilhões'}`;
  }
  if (abs >= 1_000_000) {
    const n = value / 1_000_000;
    return `${symbol} ${trimNumber(n)} ${n === 1 ? 'milhão' : 'milhões'}`;
  }
  if (abs >= 1_000) {
    return `${symbol} ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value)}`;
  }
  return formatMoney(value, currency, true);
}

function trimNumber(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
  }).format(rounded);
}

const WEEKDAYS = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

export function weekdayName(day: number): string {
  return WEEKDAYS[day] ?? '';
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

/**
 * "Sábado • 22:59" — momento do sorteio.
 *
 * Recebe o fuso OFICIAL da modalidade. Sem ele, o mesmo sorteio apareceria
 * como "sábado 22:59" para um operador em Nova York e "domingo 02:59" para
 * quem estivesse em UTC — o dia da semana mudaria, contradizendo o calendário
 * divulgado. O horário oficial é o mesmo para todo mundo; a contagem regressiva
 * é que traduz "quanto falta" para o relógio de quem está vendo.
 */
export function formatDrawMoment(
  value: string | Date | null | undefined,
  timeZone?: string,
): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  };
  const parts = new Intl.DateTimeFormat('pt-BR', options).formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  const weekday = lookup('weekday');
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalized} • ${lookup('hour')}:${lookup('minute')}`;
}

/** Abreviação do fuso ("ET", "CT"), para deixar o horário oficial sem ambiguidade. */
export function timeZoneLabel(
  value: string | Date | null | undefined,
  timeZone: string,
): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'short',
  }).formatToParts(date);
  return parts.find((part) => part.type === 'timeZoneName')?.value ?? '';
}

export function formatLongDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).format(date);
}

/** Numero da bola sempre com dois digitos: 7 -> "07". */
export function padBall(n: number): string {
  return String(n).padStart(2, '0');
}

/** "1 em 292.201.338" */
export function formatOdds(denominator: number | null | undefined): string {
  if (!denominator) return '—';
  return `1 em ${new Intl.NumberFormat('pt-BR').format(denominator)}`;
}

export function formatPercent(value: number, digits = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
