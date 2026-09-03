import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Dois clientes, com propositos distintos:
 *  - `userClient` roda COMO o usuario (respeita RLS). Use para ler dados dele.
 *  - `adminClient` usa a service role (ignora RLS). Use apenas para escritas
 *    controladas que o usuario nao pode fazer sozinho — nunca para ler dados
 *    de terceiros sem checagem explicita.
 */

export function userClient(req: Request): SupabaseClient {
  const authorization = req.headers.get('Authorization') ?? '';
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  );
}

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

/** Resolve o usuario autenticado; null quando o token e invalido ou ausente. */
export async function requireUser(req: Request) {
  const client = userClient(req);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/** Hash do IP: guardamos a evidencia sem armazenar o endereco em claro. */
export async function hashIp(ip: string | null): Promise<string | null> {
  if (!ip) return null;
  const salt = Deno.env.get('IP_HASH_SALT') ?? '';
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
