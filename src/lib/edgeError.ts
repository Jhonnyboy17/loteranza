/**
 * Tradução de erro de Edge Function para algo que a tela possa mostrar.
 *
 * POR QUE ISSO É NECESSÁRIO
 *   `functions.invoke` lança `FunctionsHttpError` para qualquer status fora do
 *   2xx, e a `message` dessa classe é fixa: "Edge Function returned a non-2xx
 *   status code". O motivo real vem no CORPO da resposta, que fica em
 *   `error.context` e é descartado se ninguém o ler.
 *
 *   Nossas funções devolvem motivo explícito — `{"error":"sales_closed"}`,
 *   `{"error":"payment_refused","reason":"..."}` — justamente para a tela ter
 *   o que dizer. Enquanto o `catch` usava só `err.message`, esse trabalho era
 *   jogado no lixo: o usuário via uma frase de SDK e o operador precisava ir
 *   aos logs do servidor para descobrir que as vendas do sorteio tinham
 *   fechado. Um erro perfeitamente claro chegava à tela como se fosse
 *   desconhecido.
 *
 *   Por isso a leitura do corpo não é um detalhe de polimento: é o que fecha
 *   o circuito entre o que o servidor sabe e o que a pessoa na frente da tela
 *   consegue resolver.
 */

/** Códigos que as nossas funções devolvem, com o texto que o usuário lê. */
const MENSAGENS: Record<string, string> = {
  // create-order
  unauthorized: 'Sua sessão expirou. Entre novamente para continuar.',
  invalid_json: 'A requisição chegou malformada ao servidor.',
  game_not_found: 'Esta modalidade não existe mais no catálogo.',
  game_not_active: 'Esta modalidade não está aceitando jogos agora.',
  no_lines: 'Seu carrinho está vazio.',
  too_many_lines: 'O pedido tem mais jogos do que o máximo permitido para esta modalidade.',
  invalid_line: 'Um dos jogos não atende às regras da modalidade.',
  draw_not_found: 'O sorteio escolhido não existe mais.',
  sales_closed: 'As vendas do sorteio que estava no seu carrinho já fecharam.',
  order_failed: 'O servidor não conseguiu registrar o pedido.',
  lines_failed: 'O servidor não conseguiu registrar os jogos do pedido.',

  // create-payment
  missing_fields: 'Faltou informação obrigatória na abertura do pagamento.',
  missing_cpf: 'O PIX exige o CPF do pagador.',
  payment_refused: 'O pagamento não foi liberado.',
  unsupported_method: 'Este meio de pagamento ainda não está implementado.',
  provider_error: 'O provedor de pagamento recusou a cobrança.',
  missing_configuration: 'Falta uma configuração no servidor para este meio de pagamento.',
};

export interface ErroDeFuncao {
  /** Código devolvido pela função, quando houver. Serve para a tela decidir. */
  codigo: string | null;
  /** Frase pronta para exibição. */
  mensagem: string;
  status: number | null;
}

/**
 * Lê o corpo do erro e devolve código e frase.
 *
 * Assíncrona porque o corpo é um `Response` que precisa ser lido. O `catch`
 * de quem chama precisa aguardar isso antes de mostrar a mensagem.
 */
export async function descreverErroDeFuncao(err: unknown): Promise<ErroDeFuncao> {
  const contexto = (err as { context?: unknown })?.context;
  const resposta = contexto instanceof Response ? contexto : null;

  if (!resposta) {
    // Sem corpo: é falha de rede (FunctionsFetchError) ou erro nosso. A
    // mensagem original é o melhor que existe.
    return {
      codigo: null,
      mensagem: err instanceof Error ? err.message : String(err),
      status: null,
    };
  }

  let corpo: { error?: unknown; reason?: unknown; detail?: unknown } | null = null;
  try {
    // clone() porque um Response só pode ser lido uma vez, e quem chamou pode
    // querer inspecionar o mesmo objeto depois.
    corpo = await resposta.clone().json();
  } catch {
    corpo = null;
  }

  const codigo = typeof corpo?.error === 'string' ? corpo.error : null;
  // `reason` e `detail` são o texto que a própria função escreveu — em
  // payment_refused é a mensagem do Compliance Engine, que explica a recusa
  // melhor do que qualquer tradução nossa.
  const detalhe = typeof corpo?.reason === 'string'
    ? corpo.reason
    : typeof corpo?.detail === 'string' ? corpo.detail : null;

  const base = codigo !== null ? MENSAGENS[codigo] : undefined;

  let mensagem: string;
  if (base && detalhe) mensagem = `${base} ${detalhe}`;
  else if (base) mensagem = base;
  else if (detalhe) mensagem = detalhe;
  else if (codigo) mensagem = `O servidor recusou com o código "${codigo}".`;
  else mensagem = `O servidor respondeu ${resposta.status} sem explicar o motivo.`;

  return { codigo, mensagem, status: resposta.status };
}
