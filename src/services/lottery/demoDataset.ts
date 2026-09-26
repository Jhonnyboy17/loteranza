import type { Draw, DrawResult, LotteryGame, PrizeTier } from '@/types/domain';

/**
 * Conjunto de dados DEMONSTRATIVO.
 *
 * Espelha supabase/seed/seed.sql para que a aplicacao rode ponta a ponta sem
 * Supabase configurado. Regras: nada aqui e apresentado como oficial, todos os
 * registros carregam isDemo = true e os resultados nascem isOfficial = false.
 *
 * Valores de premiacao e odds sao demonstrativos e precisam ser conferidos com
 * a fonte oficial antes de qualquer operacao real.
 */

const NOTE = 'Valor demonstrativo. Confirmar com a fonte oficial antes de operar.';

export const demoGames: LotteryGame[] = [
  {
    id: 'game-powerball',
    gameKey: 'powerball',
    name: 'Powerball',
    shortName: 'PB',
    status: 'active',
    operatorName: 'Multi-State Lottery Association',
    description:
      'Modalidade multiestadual dos Estados Unidos com sorteios três vezes por semana e jackpot acumulativo.',
    howToPlay:
      'Escolha 5 números de 1 a 69 e 1 número Powerball de 1 a 26. O jackpot sai com os 5 números mais o Powerball.',
    logoUrl: null,
    brandColor: '#E4434B',
    sortOrder: 10,
    officialPrice: 2,
    serviceFee: 1.5,
    serviceFeePercent: 0,
    currency: 'USD',
    mainNumbersCount: 5,
    mainNumberMin: 1,
    mainNumberMax: 69,
    specialNumbersCount: 1,
    specialNumberMin: 1,
    specialNumberMax: 26,
    specialNumberLabel: 'Powerball',
    multiplierEnabled: true,
    multiplierLabel: 'Power Play',
    multiplierPrice: 1,
    drawDays: [1, 3, 6],
    drawTimeLocal: '22:59',
    salesCutoffMinutes: 60,
    timezone: 'America/New_York',
    currentJackpot: 150_000_000,
    currentJackpotCash: 71_300_000,
    jackpotUpdatedAt: new Date().toISOString(),
    nextDrawId: null,
    salesEnabled: false,
    allowedJurisdictions: [],
    maxLinesPerOrder: 20,
    maxDrawsAhead: 10,
    isDemo: true,
  },
  {
    id: 'game-mega-millions',
    gameKey: 'mega-millions',
    name: 'Mega Millions',
    shortName: 'MM',
    status: 'active',
    operatorName: 'Mega Millions Consortium',
    description:
      'Modalidade multiestadual com sorteios às terças e sextas-feiras e multiplicador já incluso na aposta.',
    howToPlay:
      'Escolha 5 números de 1 a 70 e 1 Mega Ball de 1 a 24. O jackpot sai com os 5 números mais a Mega Ball.',
    // Para usar o logotipo em vez do nome: colocar o arquivo em
    // public/logos/ e apontar aqui, com caminho relativo e sem barra
    // inicial — ex. 'logos/mega-millions.png'. O prefixo do site (/ ou
    // /loteranza/) é resolvido no componente. Ver public/logos/README.md.
    logoUrl: null,
    brandColor: '#3B82F6',
    sortOrder: 20,
    officialPrice: 5,
    serviceFee: 1.5,
    serviceFeePercent: 0,
    currency: 'USD',
    mainNumbersCount: 5,
    mainNumberMin: 1,
    mainNumberMax: 70,
    specialNumbersCount: 1,
    specialNumberMin: 1,
    specialNumberMax: 24,
    specialNumberLabel: 'Mega Ball',
    multiplierEnabled: false,
    multiplierLabel: null,
    multiplierPrice: 0,
    drawDays: [2, 5],
    drawTimeLocal: '23:00',
    salesCutoffMinutes: 60,
    timezone: 'America/New_York',
    currentJackpot: 486_000_000,
    currentJackpotCash: 231_700_000,
    jackpotUpdatedAt: new Date().toISOString(),
    nextDrawId: null,
    salesEnabled: false,
    allowedJurisdictions: [],
    maxLinesPerOrder: 20,
    maxDrawsAhead: 10,
    isDemo: true,
  },
  makeComingSoon('lotto', 'Lotto', 6, 1, 52, '#22B07D', 30, [1, 4, 6], '21:22'),
  makeComingSoon('lucky-day-lotto', 'Lucky Day Lotto', 5, 1, 45, '#A855F7', 40, [0, 1, 2, 3, 4, 5, 6], '21:22'),
  makeComingSoon('pick-3', 'Pick 3', 3, 0, 9, '#EC4899', 50, [0, 1, 2, 3, 4, 5, 6], '12:40'),
  makeComingSoon('pick-4', 'Pick 4', 4, 0, 9, '#06B6D4', 60, [0, 1, 2, 3, 4, 5, 6], '12:40'),
];

function makeComingSoon(
  gameKey: string, name: string, count: number, min: number, max: number,
  color: string, order: number, drawDays: number[], time: string,
): LotteryGame {
  return {
    id: `game-${gameKey}`,
    gameKey,
    name,
    shortName: null,
    status: 'coming_soon',
    operatorName: null,
    description: 'Modalidade estadual. Estrutura preparada; ativação depende de configuração no painel.',
    howToPlay: null,
    logoUrl: null,
    brandColor: color,
    sortOrder: order,
    officialPrice: 1,
    serviceFee: 1,
    serviceFeePercent: 0,
    currency: 'USD',
    mainNumbersCount: count,
    mainNumberMin: min,
    mainNumberMax: max,
    specialNumbersCount: 0,
    specialNumberMin: 1,
    specialNumberMax: 0,
    specialNumberLabel: null,
    multiplierEnabled: false,
    multiplierLabel: null,
    multiplierPrice: 0,
    drawDays,
    drawTimeLocal: time,
    salesCutoffMinutes: 30,
    timezone: 'America/Chicago',
    currentJackpot: null,
    currentJackpotCash: null,
    jackpotUpdatedAt: null,
    nextDrawId: null,
    salesEnabled: false,
    allowedJurisdictions: [],
    maxLinesPerOrder: 20,
    maxDrawsAhead: 10,
    isDemo: true,
  };
}

type TierSeed = [string, string, number, number, boolean, number | null, number];

const powerballTiers: TierSeed[] = [
  ['5+1', '5 números + Powerball', 5, 1, true, null, 292_201_338],
  ['5+0', '5 números', 5, 0, false, 1_000_000, 11_688_054],
  ['4+1', '4 números + Powerball', 4, 1, false, 50_000, 913_129],
  ['4+0', '4 números', 4, 0, false, 100, 36_525],
  ['3+1', '3 números + Powerball', 3, 1, false, 100, 14_494],
  ['3+0', '3 números', 3, 0, false, 7, 580],
  ['2+1', '2 números + Powerball', 2, 1, false, 7, 701],
  ['1+1', '1 número + Powerball', 1, 1, false, 4, 92],
  ['0+1', 'Somente o Powerball', 0, 1, false, 4, 38],
];

const megaTiers: TierSeed[] = [
  ['5+1', '5 números + Mega Ball', 5, 1, true, null, 290_472_336],
  ['5+0', '5 números', 5, 0, false, 1_000_000, 12_607_306],
  ['4+1', '4 números + Mega Ball', 4, 1, false, 10_000, 931_001],
  ['4+0', '4 números', 4, 0, false, 500, 38_792],
  ['3+1', '3 números + Mega Ball', 3, 1, false, 200, 14_547],
  ['3+0', '3 números', 3, 0, false, 10, 606],
  ['2+1', '2 números + Mega Ball', 2, 1, false, 10, 693],
  ['1+1', '1 número + Mega Ball', 1, 1, false, 4, 89],
  ['0+1', 'Somente a Mega Ball', 0, 1, false, 2, 37],
];

function buildTiers(gameId: string, seeds: TierSeed[]): PrizeTier[] {
  return seeds.map(([tierKey, label, mainMatches, specialMatches, isJackpot, fixedPrize, odds], i) => ({
    id: `${gameId}-tier-${tierKey}`,
    gameId,
    tierKey,
    label,
    mainMatches,
    specialMatches,
    isJackpot,
    fixedPrize,
    prizeNote: NOTE,
    oddsDenominator: odds,
    sortOrder: (i + 1) * 10,
  }));
}

export const demoPrizeTiers: PrizeTier[] = [
  ...buildTiers('game-powerball', powerballTiers),
  ...buildTiers('game-mega-millions', megaTiers),
];

/* -------------------------------------------------------------------------
 * Geracao de sorteios. Deterministica (semente fixa por sorteio) para que os
 * dados nao mudem a cada recarga da pagina.
 * ---------------------------------------------------------------------- */

/** PRNG deterministico (mulberry32). Usado SOMENTE para dados de demonstracao. */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededDistinct(rand: () => number, count: number, min: number, max: number): number[] {
  const pool = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  for (let i = 0; i < count; i += 1) {
    const j = i + Math.floor(rand() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

/**
 * Converte "YYYY-MM-DD" + "HH:MM" no fuso do jogo para um instante UTC.
 * Feito com Intl para respeitar horario de verao sem dependencia externa.
 */
function zonedToUtc(dateISO: string, time: string, timeZone: string): Date {
  const [h, m] = time.split(':').map(Number);
  const naive = new Date(`${dateISO}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`);
  // Descobre o deslocamento do fuso naquele instante e corrige.
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(naive).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const asZoned = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour) % 24, Number(parts.minute), Number(parts.second),
  );
  const offset = asZoned - naive.getTime();
  return new Date(naive.getTime() - offset);
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface GeneratedSchedule {
  draws: Draw[];
  results: DrawResult[];
}

/** Gera sorteios futuros e passados para um jogo, a partir do calendario. */
export function generateSchedule(game: LotteryGame, upcoming = 8, past = 8): GeneratedSchedule {
  const draws: Draw[] = [];
  const results: DrawResult[] = [];
  if (game.drawDays.length === 0) return { draws, results };

  const now = new Date();
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Futuros
  let created = 0;
  const forward = new Date(cursor);
  for (let guard = 0; guard < 400 && created < upcoming; guard += 1) {
    if (game.drawDays.includes(forward.getUTCDay())) {
      const drawAt = zonedToUtc(toDateKey(forward), game.drawTimeLocal, game.timezone);
      if (drawAt.getTime() > now.getTime()) {
        draws.push(makeDraw(game, forward, drawAt, 'scheduled'));
        created += 1;
      }
    }
    forward.setUTCDate(forward.getUTCDate() + 1);
  }

  // Passados, com resultado
  let back = 0;
  const backward = new Date(cursor);
  backward.setUTCDate(backward.getUTCDate() - 1);
  for (let guard = 0; guard < 400 && back < past; guard += 1) {
    if (game.drawDays.includes(backward.getUTCDay())) {
      const drawAt = zonedToUtc(toDateKey(backward), game.drawTimeLocal, game.timezone);
      const draw = makeDraw(game, backward, drawAt, 'drawn');
      const factor = 0.55 + 0.06 * back;
      draw.advertisedJackpot = game.currentJackpot ? Math.round(game.currentJackpot * factor) : null;

      const rand = seededRandom(hashString(draw.id));
      const main = seededDistinct(rand, game.mainNumbersCount, game.mainNumberMin, game.mainNumberMax);
      const special = game.specialNumbersCount > 0
        ? seededDistinct(rand, game.specialNumbersCount, game.specialNumberMin, game.specialNumberMax)
        : [];

      draws.push(draw);
      results.push({
        id: `result-${draw.id}`,
        drawId: draw.id,
        gameId: game.id,
        mainNumbers: main,
        specialNumbers: special,
        multiplier: game.multiplierEnabled ? 2 + Math.floor(rand() * 4) : null,
        jackpotAmount: draw.advertisedJackpot,
        jackpotWon: false,
        winnersCount: 0,
        source: 'demo-dataset',
        isOfficial: false,
        publishedAt: new Date(drawAt.getTime() + 30 * 60_000).toISOString(),
        isDemo: true,
      });
      back += 1;
    }
    backward.setUTCDate(backward.getUTCDate() - 1);
  }

  return { draws, results };
}

function makeDraw(game: LotteryGame, day: Date, drawAt: Date, status: Draw['status']): Draw {
  const dateKey = toDateKey(day);
  return {
    id: `draw-${game.gameKey}-${dateKey}`,
    gameId: game.id,
    drawNumber: null,
    drawDate: dateKey,
    drawAt: drawAt.toISOString(),
    salesCloseAt: new Date(drawAt.getTime() - game.salesCutoffMinutes * 60_000).toISOString(),
    status,
    advertisedJackpot: game.currentJackpot,
    cashValue: game.currentJackpotCash,
    isDemo: true,
  };
}
