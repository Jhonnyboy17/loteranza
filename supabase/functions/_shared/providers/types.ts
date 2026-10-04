/**
 * Contrato das fontes de dados de loteria.
 *
 * Existe para que trocar de fornecedor seja uma variavel de ambiente, e nao um
 * refactor. E existe tambem para permitir rodar DUAS fontes ao mesmo tempo:
 * a conciliacao no banco so promove um resultado a oficial quando duas fontes
 * independentes concordam, e isso exige que o codigo trate "a fonte" como
 * plural desde o inicio.
 *
 * Regra que atravessa todas as implementacoes: quando a fonte nao sabe, o
 * retorno e `null`. Nunca um palpite, nunca o ultimo valor conhecido, nunca
 * zero. Valor ausente propaga como ausente ate a interface, que sabe dizer
 * "a confirmar" — inventar aqui seria criar um jackpot falso tres camadas
 * abaixo de onde alguem perceberia.
 */

/** Numeros sorteados, como uma fonte os reporta. */
export interface DrawNumbers {
  gameKey: string;
  /** YYYY-MM-DD, na data oficial do sorteio. */
  drawDate: string;
  mainNumbers: number[];
  specialNumbers: number[];
  multiplier?: number | null;
  jackpotAmount?: number | null;
  jackpotWon?: boolean | null;
  /** Total de ganhadores somando todas as faixas, quando a fonte informa. */
  winnersCount?: number | null;
  /** Identificador da fonte (url, id do sorteio) para rastreabilidade. */
  sourceReference?: string | null;
  /** Resposta crua, guardada para auditoria e para depurar divergencia. */
  raw?: unknown;
}

/** Uma faixa de premiacao: quantos ganharam e quanto cada um levou. */
export interface PrizeTierResult {
  /** Precisa casar com `prize_tiers.tier_key` do jogo ("5+1", "4+0", ...). */
  tierKey: string;
  winners: number | null;
  amount: number | null;
}

export interface JackpotSnapshot {
  gameKey: string;
  /** Valor anunciado. `null` quando a fonte nao informa. */
  jackpot: number | null;
  /** Valor a vista. `null` quando a fonte nao informa. */
  cashValue: number | null;
  sourceReference?: string | null;
}

export interface LotteryProvider {
  /** Vai para `draw_results.source`; precisa ser estavel e distinguivel. */
  readonly name: string;
  fetchJackpots(gameKeys: string[]): Promise<JackpotSnapshot[]>;
  fetchDrawNumbers(gameKey: string, drawDate: string): Promise<DrawNumbers | null>;
  /**
   * A quebra sai HORAS depois dos numeros, porque o premio e pari-mutuel e
   * depende de fechar a apuracao das vendas. `null` aqui costuma significar
   * "ainda nao publicada", nao "erro" — por isso e um estagio separado, que
   * volta mais tarde.
   */
  fetchPrizeBreakdown(gameKey: string, drawDate: string): Promise<PrizeTierResult[] | null>;
}

export interface FxProvider {
  readonly name: string;
  /** Taxa de referencia, SEM spread. O spread e aplicado pelo servidor. */
  fetchRate(base: string, quote: string): Promise<number | null>;
}
