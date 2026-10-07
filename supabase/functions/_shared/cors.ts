/**
 * CORS das Edge Functions.
 *
 * A ORIGEM E A TRAVA; A LISTA DE CABECALHOS NAO E
 *   `Access-Control-Allow-Origin` sai de ALLOWED_ORIGINS e continua estrito:
 *   e ele que diz QUEM pode chamar. Nunca "*" em resposta que carrega
 *   credencial.
 *
 *   `Access-Control-Allow-Headers`, ao contrario, nao protege nada. O
 *   navegador o usa apenas para decidir se envia a requisicao; quem nao e
 *   navegador ignora o CORS inteiro. Tratar essa lista como controle de acesso
 *   so produz um modo de falha: o preflight responde 200, o navegador recusa
 *   calado, e a requisicao real nunca sai.
 *
 * O QUE ACONTECEU AQUI
 *   `src/lib/supabase.ts` manda `x-application-name` em toda requisicao
 *   (global.headers do createClient). A lista fixa daqui tinha quatro
 *   cabecalhos e nao incluia esse. Resultado: OPTIONS respondia 200, o
 *   navegador via um cabecalho pedido que nao estava autorizado, descartava o
 *   preflight e nao enviava o POST. Na tela aparecia "Failed to send a request
 *   to the Edge Function" — e nos logs da funcao nao havia POST nenhum,
 *   porque ele nunca foi enviado.
 *
 *   O PostgREST nao sofria do mesmo mal porque o CORS dele e resolvido pelo
 *   gateway do Supabase, nao por este arquivo. Era por isso que as leituras da
 *   tela funcionavam e so a Edge Function falhava.
 *
 *   Essa foi a SEGUNDA causa do mesmo sintoma: a primeira era `verify_jwt`
 *   fazendo o gateway responder 401 ao preflight. Consertar a primeira apenas
 *   revelou a segunda, e as duas davam exatamente a mesma mensagem na tela.
 *
 * A CORRECAO
 *   Refletir o que o navegador pediu em `Access-Control-Request-Headers`,
 *   unido a lista canonica do SDK. Assim um cabecalho novo — nosso ou de uma
 *   versao futura do supabase-js — nao volta a derrubar o checkout.
 */

const allowed = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

/**
 * Lista canonica do proprio supabase-js (`@supabase/supabase-js/cors`) mais os
 * nossos. Fica aqui como piso: se o navegador nao mandar
 * Access-Control-Request-Headers, ainda ha o que autorizar.
 */
const BASE_HEADERS = [
  'authorization',
  'apikey',
  'content-type',
  'x-client-info',
  'x-retry-count',
  'traceparent',
  'tracestate',
  'baggage',
  // Nosso, de global.headers em src/lib/supabase.ts. Explicito de proposito:
  // foi a ausencia dele nesta lista que quebrou o checkout.
  'x-application-name',
  // Enviado pelo supabase-js quando se escolhe regiao da function.
  'x-region',
];

/**
 * @param origin   valor do header Origin da requisicao.
 * @param requested valor de Access-Control-Request-Headers, quando houver
 *                  (so o preflight manda). Passar isso e o que torna a
 *                  resposta imune a cabecalho novo.
 */
export function corsHeaders(
  origin: string | null,
  requested?: string | null,
): Record<string, string> {
  const isAllowed = origin !== null && allowed.includes(origin);

  const pedidos = (requested ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': [...new Set([...BASE_HEADERS, ...pedidos])].join(', '),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // Sem isto o navegador refaz o preflight a cada chamada. Nao e so
    // desperdicio: dobra a chance de um erro intermitente aparecer no meio de
    // um checkout.
    'Access-Control-Max-Age': '86400',
    // A resposta agora depende dos dois, entao os dois entram no Vary.
    Vary: 'Origin, Access-Control-Request-Headers',
  };

  if (isAllowed) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (origin !== null) {
    // Omitir o header e mais honesto que anunciar outra origem: o navegador
    // diz "sem Access-Control-Allow-Origin", que aponta para a causa. E o log
    // registra a origem recusada, porque esse era o outro jeito de este
    // arquivo falhar sem deixar rastro.
    console.warn(
      `CORS: origem recusada "${origin}". ALLOWED_ORIGINS autoriza: ${allowed.join(', ') || '(vazio)'}`,
    );
  }

  return headers;
}

/** Resposta ao preflight. Reflete os cabecalhos que o navegador pediu. */
export function preflight(req: Request): Response {
  return new Response('ok', {
    headers: corsHeaders(
      req.headers.get('Origin'),
      req.headers.get('Access-Control-Request-Headers'),
    ),
  });
}

export function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}
