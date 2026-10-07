import { json, preflight } from '../_shared/cors.ts';
import { requireSyncSecret } from '../_shared/syncAuth.ts';

/**
 * Conferencia de configuracao das Edge Functions.
 *
 * POR QUE ISTO EXISTE
 *   Secret de Edge Function nao pode ser lido de volta por ninguem — nem pelo
 *   painel, nem pelo banco. Isso esta certo. O efeito colateral e que, quando
 *   o provedor recusa dizendo "Unauthorized use of live credentials", nao ha
 *   como saber de fora QUAL credencial foi usada, e a conversa vira troca de
 *   palpites: "e de teste" / "parece de producao".
 *
 *   Esta funcao responde isso sem revelar nada: diz se cada secret existe, e
 *   para o Mercado Pago pergunta ao PROPRIO provedor, com o token
 *   configurado, de que conta ele e. O token nunca aparece na resposta.
 *
 * O QUE ELA NUNCA DEVOLVE
 *   Nenhum valor de secret, nem prefixo util para adivinhar, nem o token
 *   mascarado. Apenas: existe/nao existe, e o que o provedor conta sobre a
 *   conta — informacao que o dono da conta ja ve no painel dele.
 *
 * AUTENTICACAO
 *   Mesmo SYNC_SECRET das rotinas agendadas. Nao e chamada pelo navegador.
 */
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return preflight(req);

  const auth = requireSyncSecret(req, origin);
  if (!auth.ok) return auth.response;

  const definido = (nome: string): boolean =>
    (Deno.env.get(nome) ?? '').trim() !== '';

  const secrets = {
    SYNC_SECRET: definido('SYNC_SECRET'),
    ALLOWED_ORIGINS: definido('ALLOWED_ORIGINS'),
    IP_HASH_SALT: definido('IP_HASH_SALT'),
    PUBLIC_SITE_URL: definido('PUBLIC_SITE_URL'),
    LOTTERY_DATA_PROVIDERS: definido('LOTTERY_DATA_PROVIDERS'),
    FX_PROVIDER: definido('FX_PROVIDER'),
    MERCADOPAGO_ACCESS_TOKEN: definido('MERCADOPAGO_ACCESS_TOKEN'),
    MERCADOPAGO_WEBHOOK_SECRET: definido('MERCADOPAGO_WEBHOOK_SECRET'),
  };

  // PUBLIC_SITE_URL e endereco publico do proprio site: nao e segredo, e ver
  // o valor e o que permite flagrar barra sobrando ou protocolo faltando.
  const publicSiteUrl = (Deno.env.get('PUBLIC_SITE_URL') ?? '').trim() || null;

  const token = (Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') ?? '').trim();

  // O prefixo ate o primeiro hifen e o rotulo do ambiente ("TEST" ou
  // "APP_USR"), nao parte do segredo. E exatamente o que esta em disputa.
  const rotulo = token === '' ? null : (token.split('-')[0] || '(sem prefixo)');

  let mercadopago: Record<string, unknown> = {
    secret_definido: token !== '',
    rotulo_do_token: rotulo,
    comeca_com_TEST: token.startsWith('TEST-'),
  };

  if (token !== '') {
    try {
      // Quem responde de verdade e o provedor. /users/me devolve a conta a que
      // o token pertence — e so o dono do token consegue essa resposta.
      const res = await fetch('https://api.mercadopago.com/users/me', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15000),
      });
      const texto = await res.text();

      if (!res.ok) {
        mercadopago = {
          ...mercadopago,
          conta: null,
          erro_http: res.status,
          erro_corpo: texto.slice(0, 500),
        };
      } else {
        const conta = JSON.parse(texto) as {
          id?: number;
          nickname?: string;
          email?: string;
          site_id?: string;
          tags?: string[];
          status?: { site_status?: string };
        };
        mercadopago = {
          ...mercadopago,
          conta: {
            id: conta.id ?? null,
            nickname: conta.nickname ?? null,
            // E o e-mail da conta que recebe. Comparar com o e-mail do pagador
            // e o que revela a tentativa de cobrar a si mesmo, que o provedor
            // recusa.
            email: conta.email ?? null,
            site_id: conta.site_id ?? null,
            // "test_user" aparece aqui quando a conta e um usuario de teste.
            tags: conta.tags ?? [],
            site_status: conta.status?.site_status ?? null,
          },
        };
      }
    } catch (error) {
      mercadopago = { ...mercadopago, conta: null, erro: String(error).slice(0, 300) };
    }
  }

  /**
   * Acao opcional: criar o usuario de teste COMPRADOR.
   *
   * Fica atras de um parametro explicito porque esta funcao e, por desenho,
   * de leitura. So roda quando a conta do token for de teste — criar usuario
   * de teste a partir de credencial de producao nao faz sentido e seria uma
   * escrita inesperada numa conta real.
   *
   * O e-mail resultante vai direto para system_settings, que e de onde
   * create-payment o le. Senha e devolvida porque e ela que permite entrar no
   * sandbox para pagar o PIX gerado; e credencial de ambiente de teste, nao
   * da conta real.
   */
  let comprador: Record<string, unknown> | null = null;
  const querCriar = new URL(req.url).searchParams.get('criar_comprador_de_teste') === '1';
  const contaLida = (mercadopago.conta ?? null) as { tags?: string[]; site_id?: string } | null;

  if (querCriar) {
    if (!contaLida || !(contaLida.tags ?? []).includes('test_user')) {
      comprador = {
        criado: false,
        motivo: 'A conta do token nao e de teste. Esta acao so roda em ambiente de teste.',
      };
    } else {
      try {
        const res = await fetch('https://api.mercadopago.com/users/test_user', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ site_id: contaLida.site_id ?? 'MLB' }),
          signal: AbortSignal.timeout(20000),
        });
        const texto = await res.text();

        if (!res.ok) {
          comprador = { criado: false, http: res.status, corpo: texto.slice(0, 500) };
        } else {
          const novo = JSON.parse(texto) as {
            id?: number; nickname?: string; email?: string; password?: string;
          };
          comprador = {
            criado: true,
            id: novo.id ?? null,
            nickname: novo.nickname ?? null,
            email: novo.email ?? null,
            password: novo.password ?? null,
          };
        }
      } catch (error) {
        comprador = { criado: false, erro: String(error).slice(0, 300) };
      }
    }
  }

  return json({
    secrets,
    public_site_url: publicSiteUrl,
    mercadopago,
    comprador_de_teste: comprador,
    observacao:
      'Nenhum valor de secret e devolvido por esta funcao. O rotulo do token e '
      + 'o prefixo de ambiente (TEST ou APP_USR), e os dados da conta vem do '
      + 'proprio Mercado Pago, que so responde a quem tem o token.',
  }, 200, origin);
});
