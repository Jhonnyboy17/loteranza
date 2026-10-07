-- ---------------------------------------------------------------------------
-- E-mail do comprador de teste do Mercado Pago.
--
-- POR QUE EXISTE
--   O Mercado Pago nao aceita misturar ambientes. Com credencial de uma conta
--   de TESTE (vendedor de teste), o pagador tambem precisa ser um usuario de
--   teste. Mandar o e-mail real do cliente nessa combinacao devolve
--   `401 Unauthorized use of live credentials` — uma mensagem que fala de
--   "credenciais" e nao diz que o problema esta no PAGADOR.
--
--   Isso custou varias idas e vindas aqui, inclusive um diagnostico meu errado:
--   o codigo decidia o ambiente por `token.startsWith('TEST-')`, mas as
--   credenciais de teste do Mercado Pago passaram a comecar com `APP_USR-`,
--   iguais as de producao. Quem distingue e a tag `test_user` na conta, e isso
--   so o provedor sabe — por isso a funcao agora pergunta em /users/me.
--
-- POR QUE EM system_settings E NAO NUM SECRET
--   Nao e segredo: e um e-mail de teste do tipo
--   `test_user_123@testuser.com`, que o proprio painel do Mercado Pago
--   mostra. Aqui ele fica editavel pelo operador sem precisar do painel do
--   Supabase, e some sozinho da conversa quando a conta virar de producao:
--   com `test_user` ausente, o valor nem e lido.
--
-- is_public = false: nao ha razao para o navegador ver isto.
-- ---------------------------------------------------------------------------

insert into public.system_settings (key, value, description, is_public)
values (
  'mercadopago_test_payer_email',
  '""'::jsonb,
  'E-mail do usuario de teste COMPRADOR do Mercado Pago. Usado como pagador '
  'somente quando o token pertence a uma conta de teste. Vazio faz a abertura '
  'de pagamento parar com mensagem explicando o que criar, em vez de deixar o '
  'provedor recusar com "Unauthorized use of live credentials".',
  false
)
on conflict (key) do update
  set description = excluded.description;
