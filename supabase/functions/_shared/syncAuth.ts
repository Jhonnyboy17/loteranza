import { json } from './cors.ts';

/**
 * Autenticacao das rotinas de sincronizacao.
 *
 * O agendador (pg_cron) le o segredo do Vault e manda em x-sync-secret; a
 * funcao compara com o secret SYNC_SECRET dela. Sao dois lugares diferentes
 * guardando o mesmo valor, e e exatamente por isso que eles divergem.
 *
 * POR QUE O 401 DIZ QUAL E O CASO
 *   "unauthorized" sozinho obriga a adivinhar entre tres consertos que ficam
 *   em telas diferentes: secret ausente na funcao, cabecalho ausente na
 *   chamada, ou valor divergente. Nao e vazamento util — uma funcao sem
 *   segredo configurado recusa qualquer chamada do mesmo jeito, entao saber
 *   que ela esta desconfigurada nao abre caminho nenhum. O segredo em si
 *   nunca aparece na resposta.
 *
 * POR QUE O TRIM
 *   Colar segredo em campo de painel arrasta \n ou espaco invisivel junto.
 *   Fora isso a comparacao continua exata.
 */

/**
 * Comparacao de tempo constante: nao retorna no primeiro byte diferente,
 * entao o tempo de resposta nao revela quanto do prefixo esta correto.
 */
function sameSecret(received: string, expected: string): boolean {
  const a = new TextEncoder().encode(received);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

export type SyncAuth = { ok: true } | { ok: false; response: Response };

export function requireSyncSecret(req: Request, origin: string | null): SyncAuth {
  const expected = (Deno.env.get('SYNC_SECRET') ?? '').trim();
  const received = (req.headers.get('x-sync-secret') ?? '').trim();

  const deny = (reason: string): SyncAuth => ({
    ok: false,
    response: json({ error: 'unauthorized', reason }, 401, origin),
  });

  if (expected === '') {
    return deny(
      'SYNC_SECRET nao esta definido nos secrets desta Edge Function. '
      + 'Defina em Edge Functions > Secrets.',
    );
  }
  if (received === '') {
    return deny('Cabecalho x-sync-secret ausente na requisicao.');
  }
  if (!sameSecret(received, expected)) {
    return deny(
      'O segredo recebido difere do configurado. Compare o secret '
      + 'SYNC_SECRET com vault.decrypted_secrets onde name = sync_secret.',
    );
  }
  return { ok: true };
}
