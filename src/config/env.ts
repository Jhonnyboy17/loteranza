/**
 * Leitura centralizada de variaveis de ambiente.
 *
 * IMPORTANTE: `transactionsEnabled` aqui e apenas o PRIMEIRO dos tres portoes.
 * Ele nunca autoriza nada sozinho. A autorizacao efetiva exige:
 *   1. VITE_TRANSACTIONS_ENABLED = true            (este arquivo)
 *   2. jurisdiction_rules.transactions_enabled     (banco, por pais/estado)
 *   3. Compliance Engine => APPROVED               (servidor)
 * A verificacao final e sempre feita no servidor. O valor daqui serve para a
 * interface explicar o estado ao usuario, nunca para liberar uma operacao.
 */

function readBool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === 'true';
}

/**
 * Credencial malformada vale como credencial ausente.
 *
 * O motivo e concreto. O supabase-js coloca a chave nos cabecalhos `apikey` e
 * `Authorization`, e cabecalho HTTP so aceita ISO-8859-1. Uma chave copiada de
 * uma interface pode trazer reticencias, espaco de largura zero ou aspa curva
 * sem que nada apareca na tela; ai o `fetch` estoura antes de qualquer
 * requisicao sair, com a mensagem "String contains non ISO-8859-1 code point".
 *
 * Aceitando a chave assim, o app entraria em modo Supabase, toda chamada
 * falharia na origem e a tela ficaria carregando para sempre — parece falta de
 * dado, e nao e. Recusando-a aqui, o app cai no provider de demonstracao: a
 * interface continua utilizavel e o console diz exatamente o que houve.
 *
 * O teste e a propria regra do cabecalho (ASCII imprimivel), nao o formato da
 * chave: ha a chave anon em JWT e a publicavel em `sb_publishable_...`, e nao
 * cabe a este arquivo decidir qual delas e a correta.
 */
function usableCredential(value: string): boolean {
  return value.length > 0 && /^[\x21-\x7e]+$/.test(value);
}

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

const credentialsUsable = usableCredential(rawUrl) && usableCredential(rawAnonKey);

if (!credentialsUsable && (rawUrl || rawAnonKey)) {
  // Nao imprime a chave: diz onde esta o defeito e segue.
  console.error(
    '[config] Credenciais do Supabase descartadas por conterem caractere ' +
      'invalido para cabecalho HTTP (fora do ASCII imprimivel). Causa comum: ' +
      'valor colado de uma interface, trazendo reticencias ou espaco de ' +
      'largura zero. A aplicacao segue com dados de demonstracao.',
  );
}

const supabaseUrl = credentialsUsable ? rawUrl : '';
const supabaseAnonKey = credentialsUsable ? rawAnonKey : '';

export const env = {
  supabaseUrl,
  supabaseAnonKey,

  /** true somente quando ha credenciais completas e utilizaveis. */
  hasSupabase: credentialsUsable,

  /** Portao 1 de 3. Nasce desligado por decisao de projeto. */
  transactionsEnabled: readBool(import.meta.env.VITE_TRANSACTIONS_ENABLED, false),

  /**
   * Publicacao de demonstracao: pede aos buscadores para NAO indexar.
   *
   * Um prototipo de loteria com marca provisoria e textos legais ainda em
   * [CONTEUDO A SER VALIDADO POR ADVOGADO] nao deve aparecer em busca. Ligado
   * no deploy do GitHub Pages; desligado (padrao) no site real.
   */
  noIndex: readBool(import.meta.env.VITE_NOINDEX, false),

  brandName: import.meta.env.VITE_BRAND_NAME?.trim() || 'Jackpot USA',
  legalEntity: import.meta.env.VITE_BRAND_LEGAL_ENTITY?.trim() || '',
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL?.trim() || 'suporte@exemplo.com',
  fxSourceLabel: import.meta.env.VITE_FX_SOURCE_LABEL?.trim() || 'Cotacao demonstrativa',

  isDev: import.meta.env.DEV,
} as const;

/**
 * Sem Supabase configurado a aplicacao roda inteira sobre o provider DEMO.
 * Nesse modo nenhuma transacao existe, nem mesmo simulada como real.
 */
export const isDemoDataMode = !env.hasSupabase;
