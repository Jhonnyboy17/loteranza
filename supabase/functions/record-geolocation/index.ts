import { adminClient, hashIp, requireUser } from '../_shared/client.ts';
import { json, preflight } from '../_shared/cors.ts';

/**
 * Gravacao do evento de geolocalizacao.
 *
 * O cliente envia apenas coordenadas cruas do dispositivo. Quem resolve país e
 * estado e o servidor; quem le o IP e o servidor. O cliente nao consegue
 * afirmar em que país esta — e por isso que esta funcao existe.
 *
 * Divergencia entre a posicao do dispositivo e o país do IP e MARCADA
 * (mismatch_flag), nunca silenciada. O IP nunca e armazenado em claro.
 */
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);

  const user = await requireUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401, origin);

  let body: {
    latitude?: number;
    longitude?: number;
    accuracy_m?: number;
    context?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, origin);
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('cf-connecting-ip') ??
    null;
  const ipCountry =
    req.headers.get('cf-ipcountry') ?? req.headers.get('x-vercel-ip-country') ?? null;
  const ipState = req.headers.get('x-vercel-ip-country-region') ?? null;

  // Resolucao reversa das coordenadas para país/estado.
  //
  // TODO(integração): conectar um provedor de geocodificação reversa. Enquanto
  // não houver, ficamos apenas com o país do IP — o que é mais restritivo, e
  // portanto seguro: a ausência de dado nunca amplia permissão.
  const resolvedCountry: string | null = null;
  const resolvedState: string | null = null;

  const hasCoordinates =
    typeof body.latitude === 'number' && typeof body.longitude === 'number';

  const mismatch =
    resolvedCountry !== null && ipCountry !== null && resolvedCountry !== ipCountry;

  const admin = adminClient();
  const { error } = await admin.from('geolocation_events').insert({
    user_id: user.id,
    context: body.context ?? 'checkout',
    country: resolvedCountry ?? ipCountry,
    state: resolvedState ?? ipState,
    latitude: hasCoordinates ? body.latitude : null,
    longitude: hasCoordinates ? body.longitude : null,
    accuracy_m: body.accuracy_m ?? null,
    ip_country: ipCountry,
    ip_state: ipState,
    ip_hash: await hashIp(ip),
    source: hasCoordinates ? 'browser' : 'ip',
    mismatch_flag: mismatch,
  });

  if (error) return json({ error: 'insert_failed', detail: error.message }, 500, origin);

  // Devolvemos apenas o que a interface precisa saber. Nunca ecoamos o IP.
  return json(
    {
      country: resolvedCountry ?? ipCountry,
      state: resolvedState ?? ipState,
      mismatch,
      recorded: true,
    },
    200,
    origin,
  );
});
