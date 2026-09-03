import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/config/env';

/**
 * Cliente Supabase. Retorna null quando nao ha credenciais configuradas —
 * nesse caso a aplicacao roda inteiramente sobre o provider DEMO.
 *
 * Somente a chave publica (anon) chega ao browser. A service role key nunca
 * aparece no frontend: operacoes privilegiadas passam por Edge Functions.
 */
export const supabase: SupabaseClient | null = env.hasSupabase
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: {
        headers: { 'x-application-name': 'jackpot-usa-web' },
      },
    })
  : null;

/** Uso em caminhos que exigem Supabase; falha alto em vez de degradar silenciosamente. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase não está configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}
