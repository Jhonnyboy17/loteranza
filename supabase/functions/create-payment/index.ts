import { adminClient, requireUser, userClient } from '../_shared/client.ts';
import { json, preflight } from '../_shared/cors.ts';
import {
  createCardPreference, createPixPayment, isSandbox, MercadoPagoError,
} from '../_shared/mercadopago.ts';

/**
 * Abertura de cobranca.
 *
 * A ORDEM IMPORTA
 *   1. `begin_payment()` roda COMO O USUARIO. E ele quem confere dono do
 *      pedido, estado do pedido, provedor habilitado e o veredito do
 *      Compliance Engine — e quem decide o valor, lendo a propria linha do
 *      pedido. Nada disso e refeito aqui, para nao existirem duas versoes da
 *      regra que possam divergir.
 *   2. so depois a funcao fala com o Mercado Pago, usando o valor que o banco
 *      devolveu. O corpo da requisicao do cliente nao carrega valor nenhum, e
 *      se carregasse seria ignorado.
 *
 * O CPF
 *   Chega no corpo, segue para o provedor e acaba aqui. Nao e gravado em
 *   lugar nenhum: nao vai para `payments`, nem para `metadata`, nem para o
 *   log. Foi decisao explicita de nao acumular dado sensivel que a operacao
 *   nao precisa guardar.
 *
 * SOBRE verify_jwt = false (ver supabase/config.toml)
 *   A verificacao de identidade NAO sumiu: ela acontece logo abaixo, em
 *   requireUser(), que valida o token no Supabase Auth. O que mudou e que ela
 *   deixou de ser feita pelo gateway, porque com verify_jwt o gateway responde
 *   401 ao preflight CORS do navegador — que vai sem Authorization por
 *   definicao — e o navegador aborta antes de enviar a requisicao real.
 *
 *   Trocar isto por true de novo quebra o pagamento.
 */
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  if (req.method === 'OPTIONS') return preflight(req);
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin);

  const user = await requireUser(req);
  if (!user) return json({ error: 'unauthorized' }, 401, origin);

  let body: {
    order_id?: string;
    provider_key?: string;
    payer?: { cpf?: string; name?: string; email?: string };
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400, origin);
  }

  if (!body.order_id || !body.provider_key) {
    return json({ error: 'missing_fields', reason: 'order_id e provider_key sao obrigatorios' }, 400, origin);
  }

  const asUser = userClient(req);
  const admin = adminClient();

  // Portao unico. Erro aqui e recusa de regra de negocio, nao falha tecnica:
  // a mensagem do banco ja explica o motivo e vai inteira para a tela.
  const { data: opened, error: openError } = await asUser.rpc('begin_payment', {
    p_order_id: body.order_id,
    p_provider_key: body.provider_key,
  });
  if (openError) {
    return json({ error: 'payment_refused', reason: openError.message }, 409, origin);
  }

  const intent = opened as {
    payment_id: string; order_number: string;
    amount: number; currency: string; method: string; is_demo: boolean;
  };

  const base = Deno.env.get('SUPABASE_URL') ?? '';
  const notificationUrl = `${base}/functions/v1/mercadopago-webhook`;
  const siteUrl = (Deno.env.get('PUBLIC_SITE_URL') ?? '').replace(/\/$/, '');

  // Descritor com a natureza real da operacao. Nunca generico.
  const descriptor = 'LOTERIA INTERMEDIACAO';
  const description = `Pedido ${intent.order_number} — intermediacao de bilhete de loteria`;

  try {
    if (intent.method === 'pix') {
      if (!body.payer?.cpf) {
        return json({ error: 'missing_cpf', reason: 'O PIX exige o CPF do pagador.' }, 400, origin);
      }

      const [firstName, ...rest] = (body.payer.name ?? '').trim().split(/\s+/);
      const charge = await createPixPayment({
        amount: Number(intent.amount),
        description,
        descriptor,
        externalReference: intent.payment_id,
        notificationUrl,
        expiresInMinutes: 30,
        payer: {
          email: body.payer.email ?? user.email,
          firstName: firstName || undefined,
          lastName: rest.join(' ') || undefined,
          cpf: body.payer.cpf.replace(/\D/g, ''),
        },
      });

      // Guardamos o id do provedor e o QR. O CPF nao entra aqui.
      await admin.from('payments').update({
        provider_transaction_id: charge.providerPaymentId,
        status: 'pending',
        merchant_descriptor: descriptor,
        metadata: {
          qr_code: charge.qrCode,
          ticket_url: charge.ticketUrl,
          expires_at: charge.expiresAt,
          mp_status: charge.status,
          sandbox: isSandbox(),
        },
        updated_at: new Date().toISOString(),
      }).eq('id', intent.payment_id);

      return json({
        payment_id: intent.payment_id,
        method: 'pix',
        amount: intent.amount,
        currency: intent.currency,
        pix: {
          qr_code: charge.qrCode,
          qr_code_base64: charge.qrCodeBase64,
          ticket_url: charge.ticketUrl,
          expires_at: charge.expiresAt,
        },
      }, 201, origin);
    }

    if (intent.method === 'card') {
      // Sem PUBLIC_SITE_URL as back_urls sairiam como "/#/meus-jogos" — um
      // caminho relativo, que o Mercado Pago recusa com
      // "back_urls invalid. Wrong format". Mandar um valor que sabemos invalido
      // e esperar o provedor reclamar troca uma configuracao faltando por um
      // erro que nao diz o que fazer. Melhor parar aqui e nomear o secret.
      if (siteUrl === '') {
        const motivo = 'O secret PUBLIC_SITE_URL nao esta definido nesta Edge Function. '
          + 'Sem ele o Checkout Pro nao tem para onde devolver o cliente. '
          + 'Defina com o endereco do site (ex.: https://jhonnyboy17.github.io/loteranza). '
          + 'O PIX nao depende dele.';

        // A tentativa precisa ser encerrada aqui tambem: begin_payment ja criou
        // a linha, e deixa-la em aberto trava a proxima tentativa do pedido.
        await admin.from('payments').update({
          status: 'failed',
          failure_message: motivo,
          metadata: { sandbox: isSandbox() },
          updated_at: new Date().toISOString(),
        }).eq('id', intent.payment_id);

        return json({ error: 'missing_configuration', reason: motivo }, 503, origin);
      }

      const preference = await createCardPreference({
        amount: Number(intent.amount),
        title: description,
        descriptor,
        externalReference: intent.payment_id,
        notificationUrl,
        payerEmail: body.payer?.email ?? user.email,
        backUrls: {
          success: `${siteUrl}/#/meus-jogos`,
          failure: `${siteUrl}/#/checkout`,
          pending: `${siteUrl}/#/meus-jogos`,
        },
      });

      await admin.from('payments').update({
        status: 'pending',
        merchant_descriptor: descriptor,
        metadata: { preference_id: preference.preferenceId, sandbox: isSandbox() },
        updated_at: new Date().toISOString(),
      }).eq('id', intent.payment_id);

      return json({
        payment_id: intent.payment_id,
        method: 'card',
        amount: intent.amount,
        currency: intent.currency,
        redirect_url: preference.checkoutUrl,
      }, 201, origin);
    }

    return json({ error: 'unsupported_method', reason: `Meio ${intent.method} nao implementado` }, 400, origin);
  } catch (error) {
    const mp = error instanceof MercadoPagoError ? error : null;

    // DUAS COISAS DIFERENTES, EM CAMPOS DIFERENTES
    //   `failure_message` guarda o corpo cru do provedor: e com ele que se
    //   depura meses depois, e ele nao cabe numa tela.
    //   `reason` leva a frase pronta, com o conserto junto quando o codigo do
    //   provedor e conhecido.
    //   `metadata.sandbox` registra em qual credencial a tentativa rodou. Sem
    //   isso, diante de "Unauthorized use of live credentials" nao ha como
    //   saber do lado de ca se o token era de teste ou de producao — e foi
    //   exatamente essa a duvida que custou tempo.
    await admin.from('payments').update({
      status: 'failed',
      failure_code: mp?.providerError ?? null,
      failure_message: (mp?.raw ?? String(error)).slice(0, 1000),
      metadata: {
        sandbox: isSandbox(),
        provider_status: mp?.status ?? null,
        provider_error: mp?.providerError ?? null,
      },
      updated_at: new Date().toISOString(),
    }).eq('id', intent.payment_id);

    return json({
      error: 'provider_error',
      provider_code: mp?.providerError ?? null,
      reason: (mp?.message ?? String(error)).slice(0, 500),
    }, 502, origin);
  }
});
