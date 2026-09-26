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

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

export const env = {
  supabaseUrl,
  supabaseAnonKey,

  /** true somente quando ha credenciais completas de Supabase configuradas. */
  hasSupabase: Boolean(supabaseUrl && supabaseAnonKey),

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
