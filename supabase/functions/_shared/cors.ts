/**
 * CORS restrito por lista de origens. Nunca use "*" em respostas que carregam
 * credenciais — a origem permitida vem de ALLOWED_ORIGINS (secret).
 */
const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null): Record<string, string> {
  const isAllowed = origin !== null && allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : (allowed[0] ?? ''),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}
