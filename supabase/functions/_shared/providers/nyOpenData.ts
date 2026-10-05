import type {
  DrawNumbers, GameSpec, JackpotSnapshot, LotteryProvider, PrizeTierResult,
} from './types.ts';

/**
 * Loteria do Estado de Nova York — dados abertos, plataforma Socrata.
 *
 * POR QUE ESTA FONTE
 *   E o registro do proprio estado, publicado como dado aberto: API
 *   documentada, formato estavel, sem chave, sem contrato, e com permissao
 *   explicita de reuso. Para a regra das duas fontes isso importa mais do que
 *   parece — dois raspadores do powerball.com nao sao duas fontes, porque
 *   erram juntos quando a pagina muda. NY mantem o proprio registro, entao
 *   diverge de verdade quando algo esta errado.
 *
 * O QUE ELA NAO TEM
 *   Jackpot anunciado e quebra de premio por faixa. O dataset tem tres campos:
 *   data, numeros e multiplicador. `fetchJackpots` devolve lista vazia e
 *   `fetchPrizeBreakdown` devolve null — ausente propaga como ausente, e a
 *   interface mostra "a confirmar" em vez de inventar.
 *
 * SOBRE A FORMA DO REGISTRO
 *   Os dois datasets nao guardam a bola especial do mesmo jeito: um pode
 *   incluir tudo em `winning_numbers`, outro separar num campo proprio. Em vez
 *   de fixar qual e qual, o parser resolve pelas contagens que vem de
 *   lottery_games. Forma que nao casa com nenhuma das duas hipoteses levanta
 *   erro em vez de chutar: numero errado gravado como leitura de fonte e pior
 *   do que leitura nenhuma, porque a conciliacao pode promove-lo a oficial.
 */

const BASE = 'https://data.ny.gov/resource';

const DATASETS: Record<string, string> = {
  'powerball': 'd6yy-54nr',
  'mega-millions': '5xaw-6ayf',
};

/** Onde a bola especial aparece quando vem em campo proprio. */
const SPECIAL_FIELDS = ['mega_ball', 'bonus_ball', 'powerball', 'power_ball'];

/** Quantos sorteios recentes trazer por consulta. A rotina olha 7 dias; 30
 *  linhas cobrem meses mesmo no jogo de maior frequencia. */
const WINDOW = 30;

type Row = Record<string, unknown>;

function parseNumbers(value: unknown): number[] | null {
  if (typeof value !== 'string') return null;
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  const nums = parts.map((p) => Number.parseInt(p, 10));
  return nums.every((n) => Number.isInteger(n)) ? nums : null;
}

function parseOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isInteger(n) ? n : null;
}

async function recentRows(dataset: string): Promise<Row[]> {
  const url = new URL(`${BASE}/${dataset}.json`);
  url.searchParams.set('$order', 'draw_date DESC');
  url.searchParams.set('$limit', String(WINDOW));

  const headers: Record<string, string> = { Accept: 'application/json' };
  // O token e opcional: sem ele a Socrata atende, so com limite menor.
  const token = Deno.env.get('NY_OPEN_DATA_APP_TOKEN');
  if (token) headers['X-App-Token'] = token;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    throw new Error(`data.ny.gov respondeu HTTP ${res.status} em ${dataset}`);
  }
  const body = await res.json();
  if (!Array.isArray(body)) {
    throw new Error(`data.ny.gov devolveu algo que nao e lista em ${dataset}`);
  }
  return body as Row[];
}

/** O carimbo vem como 2026-10-03T00:00:00.000; comparamos so a parte da data. */
function matchesDate(row: Row, drawDate: string): boolean {
  const value = row.draw_date;
  return typeof value === 'string' && value.slice(0, 10) === drawDate;
}

function splitNumbers(row: Row, game: GameSpec, drawDate: string): {
  main: number[];
  special: number[];
} | null {
  const parsed = parseNumbers(row.winning_numbers);
  if (!parsed) return null;

  const total = game.mainCount + game.specialCount;

  // Hipotese 1: tudo junto em winning_numbers.
  if (parsed.length === total) {
    return { main: parsed.slice(0, game.mainCount), special: parsed.slice(game.mainCount) };
  }

  // Hipotese 2: principais em winning_numbers, especial em campo proprio.
  if (parsed.length === game.mainCount) {
    for (const field of SPECIAL_FIELDS) {
      const extra = parseNumbers(String(row[field] ?? ''));
      if (extra && extra.length === game.specialCount) {
        return { main: parsed, special: extra };
      }
    }
  }

  throw new Error(
    `data.ny.gov mudou de formato em ${game.gameKey} ${drawDate}: `
    + `winning_numbers trouxe ${parsed.length} numero(s), esperado ${total} `
    + `ou ${game.mainCount} com a bola especial em campo separado. `
    + `Campos recebidos: ${Object.keys(row).join(', ')}`,
  );
}

export const nyOpenDataProvider: LotteryProvider = {
  name: 'ny-open-data',

  /** O dataset nao publica jackpot. Lista vazia, nunca um palpite. */
  fetchJackpots(_gameKeys: string[]): Promise<JackpotSnapshot[]> {
    return Promise.resolve([]);
  },

  async fetchDrawNumbers(game: GameSpec, drawDate: string): Promise<DrawNumbers | null> {
    const dataset = DATASETS[game.gameKey];
    // Jogo sem dataset nesta fonte nao e erro — e so ausencia de cobertura.
    if (!dataset) return null;

    const row = (await recentRows(dataset)).find((r) => matchesDate(r, drawDate));
    // Sorteio ainda nao publicado: a rotina volta no proximo agendamento.
    if (!row) return null;

    const split = splitNumbers(row, game, drawDate);
    if (!split) return null;

    return {
      gameKey: game.gameKey,
      drawDate,
      mainNumbers: split.main,
      specialNumbers: split.special,
      multiplier: parseOptionalInt(row.multiplier),
      jackpotAmount: null,
      jackpotWon: null,
      winnersCount: null,
      sourceReference: `${BASE}/${dataset}.json?draw_date=${drawDate}`,
      raw: row,
    };
  },

  /** NY nao publica quantos ganharam cada faixa. Quem publica sao os sites
   *  oficiais do jogo e algumas loterias estaduais; enquanto nao houver uma
   *  dessas configurada, a quebra continua entrando pelo painel. */
  fetchPrizeBreakdown(_game: GameSpec, _drawDate: string): Promise<PrizeTierResult[] | null> {
    return Promise.resolve(null);
  },
};
