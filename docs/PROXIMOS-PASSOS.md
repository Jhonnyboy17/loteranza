# Próximos passos — o que depende de você

Estado conferido direto no banco em **2026-10-07**:

| | |
| --- | --- |
| Contas de usuário | 1 (`jonathangabriel88@gmail.com`) |
| Operadores ativos | ✅ 1 (`SUPER_ADMIN`) — passo 1 feito |
| `SYNC_SECRET` na Edge Function | ✅ definido — passo 2 feito, painel verde |
| `ALLOWED_ORIGINS` / `IP_HASH_SALT` | ✅ definidos — passos 3 e 4 feitos |
| Fonte de resultados | ✅ `ny-open-data` ligado (`LOTTERY_DATA_PROVIDERS`) |
| Fonte de câmbio | ✅ `frankfurter,er-api` — duas fontes, com recusa na divergência |
| Jackpots | ✅ reais, conferidos em duas fontes; **entrada manual** (ver 5.1) |
| Pagamento | ✅ Mercado Pago em **sandbox** (PIX inline + cartão no Checkout Pro) |
| Rótulo de demonstração | ✅ desligado (`demo_mode = false`) |
| Portão 1 (`VITE_TRANSACTIONS_ENABLED`) | 🔴 **aberto** |
| Portão 2 (kill switch global) | 🔴 **aberto** (`true`) |
| Portão 3 (jurisdições habilitadas) | 🔴 **1 de 5 aberta: Brasil** |
| Triagem de sanções | ⚠️ `risk_accepted` — não roda, e o registro diz isso |
| KYC | ⚠️ `approved` à mão na conta de teste; sem provedor contratado |

**Os três portões estão abertos.** Isso foi decisão sua, registrada em
`audit_logs`. O que ainda impede uma venda de verdade não é portão: é
credencial de teste no Mercado Pago. Com credencial de produção, o site passa
a cobrar. Os itens marcados ⚠️ são o que falta para isso ser defensável — leia
o passo 7 antes de trocar a credencial.

---

## 1. Criar o primeiro operador — sem isso o `/admin` não abre

**Por quê.** Toda rota de `/admin` passa por um `Guard` que chama
`has_role()`, que lê a tabela `operators`. Com zero linhas, *qualquer* pessoa
— inclusive você — vê "Acesso restrito". Não existe botão de "virar admin" em
produção: um botão desses seria uma porta dos fundos. A primeira linha é
criada à mão, uma única vez.

**Decisão antes do comando.** A única conta cadastrada hoje é
`jonathangabriel88@gmail.com`. Se ela é sua, use o comando como está. Se você
quer usar outro e-mail, **crie a conta primeiro** no site
(`/criar-conta`), confirme o e-mail, e só então troque o endereço no comando.
O `insert` precisa de um `user_id` que já exista em `auth.users`.

**Onde rodar.** Supabase → SQL Editor.

```sql
insert into public.operators (user_id, role, display_name, notes)
select id, 'SUPER_ADMIN', 'Operador inicial', 'Criado manualmente no bootstrap'
from auth.users
where email = 'jonathangabriel88@gmail.com'
on conflict do nothing;
```

**Conferir.**

```sql
select u.email, o.role, o.is_active
from public.operators o join auth.users u on u.id = o.user_id;
```

Deve voltar uma linha. No site, saia e entre de novo (o papel é lido no login)
— o link **Admin** aparece no menu.

Papéis disponíveis, se depois você for dividir acesso por pessoa:
`SUPER_ADMIN`, `ADMIN`, `COMPLIANCE`, `FINANCE`, `PURCHASER`,
`TICKET_VERIFIER`, `SUPPORT`, `CUSTOMER`.

---

## 2. Definir o `SYNC_SECRET` — a automação está devolvendo 401

**O que está acontecendo agora.** O `pg_cron` dispara nos horários certos, o
`pg_net` faz o POST na Edge Function, e a função compara o cabeçalho
`x-sync-secret` com a variável `SYNC_SECRET` dela. O banco tem o segredo
(está no Vault); a função não tem. Então toda chamada volta **401** e nada é
atualizado. O painel já diz isso com todas as letras:

> `HTTP 401: a Edge Function recusou o segredo. Confira SYNC_SECRET nos secrets da funcao.`

Isso é o sistema funcionando como projetado — ele falha fechado e **avisa**,
em vez de falhar em silêncio.

**Passo a passo.**

1. Supabase → SQL Editor, rode:

   ```sql
   select decrypted_secret from vault.decrypted_secrets where name = 'sync_secret';
   ```

2. Copie o valor (não cole em chat, commit, issue nem print).
3. Supabase → Edge Functions → **Secrets** → **Add new secret**
   - Nome: `SYNC_SECRET`
   - Valor: o que você copiou
4. Salvar. **Não precisa fazer deploy de novo** — os secrets são injetados a
   cada invocação.

**Conferir.** Espere no máximo 5 minutos (o job `reconcile-dispatches` roda a
cada 5 min e é ele que traduz o status HTTP em diagnóstico). Depois abra
`/admin/sincronizacao`, ou rode:

```sql
select job, status, error_message, minutes_since from public.sync_health order by 1;
```

As linhas devem sair de `failed` para `success` sem `error_message`.

---

## 3. `ALLOWED_ORIGINS` — hoje nenhum navegador consegue chamar as funções

**Por quê.** O CORS é restrito por lista, nunca `*` (resposta com `*` e
credencial junto é falha de segurança). Com a variável vazia, o cabeçalho
`Access-Control-Allow-Origin` sai em branco e **todo** chamado vindo de
navegador é recusado. O cron não é afetado — é servidor-para-servidor, e CORS
só existe em navegador. Por isso a automação funciona mesmo sem isso, mas
qualquer função chamada pelo site não.

**Valor.** Supabase → Edge Functions → Secrets → `ALLOWED_ORIGINS`:

```
https://jhonnyboy17.github.io
```

Vírgula separa, sem espaço, se um dia houver domínio próprio:
`https://jhonnyboy17.github.io,https://seudominio.com.br`

---

## 4. `IP_HASH_SALT` — sem isso o hash de IP é reversível

**Por quê.** As evidências de compliance guardam o IP como SHA-256, não em
claro. Só que SHA-256 sem sal, num espaço de endereços IPv4 que tem só ~4
bilhões de valores, é quebrável por força bruta em minutos. Ou seja: sem o
sal, a promessa de "não guardamos IP" não se sustenta na prática. O código
hoje usa `''` como padrão, que é exatamente esse caso.

**Gerar o valor** (SQL Editor):

```sql
select encode(gen_random_bytes(32), 'hex');
```

**Guardar** em Edge Functions → Secrets → `IP_HASH_SALT`.

> **Nunca troque esse valor depois.** Trocar o sal muda todos os hashes
> futuros, e aí evidência velha e evidência nova deixam de ser comparáveis.

---

## 5. Escolher a fonte de dados real — o único item que é decisão, não clique

**Por quê isso é diferente dos outros.** Mesmo com o item 2 resolvido, a
automação vai rodar, marcar `success` e **não atualizar nada**. O provedor
`demo` devolve `null` e lista vazia de propósito: ele nunca inventa número de
sorteio nem valor de prêmio. Jackpot falso e resultado falso estão na lista do
que o projeto não faz. Então "automático" só vira dado de verdade quando
existir uma fonte de verdade.

**As três categorias, com o trade-off de cada uma:**

| | Confiabilidade | Custo | Risco |
| --- | --- | --- | --- |
| Site/feed oficial de cada loteria estadual | máxima | grátis | formato muda sem aviso; um integrador por estado |
| API comercial de dados de loteria | alta | mensalidade | depende do fornecedor continuar existindo |
| Scraping de agregador | baixa | grátis | quebra sozinho, e os termos de uso costumam proibir |

**O que perguntar para cada candidato, antes de assinar qualquer coisa:**

1. A API entrega o **detalhamento por faixa** — quantos ganhadores em cada
   prêmio — ou só os números sorteados? (Muita API só dá os números. O
   detalhamento é o que você disse que não quer digitar à mão.)
2. Quanto tempo depois do sorteio o dado aparece? Números saem em minutos;
   faixas de prêmio em loteria pari-mutuel saem horas depois, porque dependem
   de fechar a apuração de vendas. O sistema já trata os dois momentos
   separados.
3. Tem SLA e página de status?
4. Os termos permitem **uso comercial e redistribuição**? Isso é o que
   normalmente derruba a opção de scraping.
5. Preço por chamada ou por mês.

**Por que vale contratar duas.** O banco só promove um resultado a oficial
quando **duas fontes independentes concordam** no mesmo conjunto de números.
Com uma fonte só, todo resultado fica preliminar esperando conferência humana
— que é o comportamento seguro, e é o motivo dos 14 na fila hoje. Com duas, a
conferência vira exceção em vez de rotina.

**O que eu preciso de você.** Só o nome e o link da documentação da fonte
escolhida. A ligação é um arquivo novo em
`supabase/functions/_shared/providers/` mais o secret
`LOTTERY_DATA_PROVIDERS` com o nome dela. Nenhum outro arquivo muda — a
camada de provedor existe exatamente para isso.

### 5.1 Onde isso está hoje

**Resultados** — `ny-open-data` ligado. É o registro de dados abertos do
estado de Nova York: API documentada, sem chave, sem contrato. Entrega data,
números e multiplicador. **Não** entrega detalhamento por faixa nem jackpot.
Como é uma fonte só, todo resultado continua entrando como preliminar e
esperando conferência — por isso a fila ainda existe. Falta a **segunda**
fonte, e ela precisa ser independente de verdade: dois raspadores do mesmo
site erram juntos.

**Câmbio** — `frankfurter,er-api`, duas fontes públicas sem chave. A rotina
confronta as duas e **não grava nada** quando divergem acima de
`fx_max_divergence_percent` (2%). Cotação entra congelada no pedido e vira
cobrança: número não conferido é pior que cotação vencida, porque a vencida a
interface recusa sozinha. Na primeira execução real: 4,9686 contra 4,980405,
divergência de 0,24%, gravado.

> Até 07/10/2026 não havia fonte de câmbio nenhuma registrada no código, e a
> única linha de `exchange_rates` era a semente de demonstração — 5,40, spread
> zero, cinco dias velha. Ela não ficava só na vitrine: `orders.total_display`
> sai dela e é o valor que o PIX cobra. Era cerca de 8,7% acima do dólar do
> dia, em cobrança real.

**Jackpot** — nenhuma fonte aberta publica. Jackpot é estimativa de marketing
revisada conforme as vendas entram, não é fato registrado como resultado de
sorteio. Sondado: nenhum dataset Socrata tem; `megamillions.com` responde 403
de Cloudflare; `powerball.com` não expõe JSON.

Então **a entrada é manual**, pelo painel (`/admin/catalogo`, botão de
jackpot), e a trava de 12h (`jackpot_max_age_hours`) cobre o esquecimento: o
valor vencido deixa de ser exibido como atual e passa a aparecer como "Prêmio
a confirmar", com a idade declarada.

Os valores de 07/10/2026 foram lidos e conferidos em mais de uma fonte antes
de serem gravados — Powerball em `powerball.com` (oficial), `texaslottery.com`
e `valottery.com`; Mega Millions nas duas últimas. As fontes de cada gravação
ficam em `audit_logs`.

**Só o PRÓXIMO sorteio carrega jackpot anunciado.** Até 07/10/2026,
`generate_upcoming_draws` copiava o jackpot do dia para os oito sorteios que
criava — havia oito linhas da Mega Millions, de 07/10 a 31/10, todas
anunciando os mesmos 486 milhões. Jackpot é acumulado: ninguém, nem a loteria,
sabe hoje o prêmio do sorteio do fim do mês. Afirmar um valor para aquela data
é jackpot inventado, agravado por estar amarrado a uma data específica. Agora
os sorteios seguintes ficam com o campo nulo, e nulo ali quer dizer a verdade.

---

## 6. Variáveis do repositório no GitHub — opcional

Hoje o workflow tem um fallback: se as variáveis estiverem ausentes ou
inválidas, ele usa a URL e a chave anon embutidas. Funciona. A desvantagem é
que **rotacionar a chave exige um commit**.

Se quiser desacoplar:
<https://github.com/Jhonnyboy17/loteranza/settings/variables/actions>

- `VITE_SUPABASE_URL` → `https://pymgliyofizgfirekepg.supabase.co`
- `VITE_SUPABASE_ANON_KEY` → chave anon (Supabase → Settings → API)

> Cole **em uma linha só**. O erro de `non ISO-8859-1 code point` que você viu
> no cadastro foi exatamente isso: um caractere invisível entrou junto quando
> a chave foi quebrada em várias linhas. O workflow hoje valida o formato
> antes de usar, e o `src/config/env.ts` trata credencial inválida como
> credencial ausente — mas é melhor não produzir o problema.

---

## 7. Os três portões — abertos, e o que isso quer dizer

| Portão | Onde | Estado |
| --- | --- | --- |
| 1 | `VITE_TRANSACTIONS_ENABLED` (build) | **aberto** |
| 2 | `system_settings.transactions_enabled` (kill switch) | **aberto** (`true`) |
| 3 | `jurisdiction_rules.transactions_enabled` (por país/estado) | **Brasil aberto**, 4 fechadas |

Além dos três, `evaluate_compliance()` continua decidindo cada compra: idade,
KYC, jogo responsável, limites e sanções. Nenhum portão dispensa esse veredito,
e não existe caminho alternativo de aprovação.

### O que SEGURA a cobrança hoje

Apenas uma coisa: o `MERCADOPAGO_ACCESS_TOKEN` é de **teste** (começa com
`TEST-`). O PIX gerado tem QR válido na aparência e não move dinheiro; o
cartão abre o sandbox do Mercado Pago. Trocar esse secret pela credencial de
produção é o ato que transforma o site em operação real — **não é mais um
portão, é o último**.

### O que precisa estar resolvido ANTES dessa troca

Isto não é zelo excessivo; cada item abaixo é algo que um banco, um
adquirente ou um regulador pede para ver:

| Pendência | Estado | Por que importa |
| --- | --- | --- |
| Aprovação comercial no Mercado Pago | não solicitada | Loteria é atividade restrita. A resposta pode ser "não atendemos esse ramo", e é melhor saber antes de ter cliente. Esconder o ramo do processador está na lista do que este projeto não faz — e o descritor da cobrança é fixo em `LOTERIA INTERMEDIACAO`, sem caminho no código para disfarçá-lo. |
| Textos revisados por advogado | pendente | Ver passo 9. São eles que dizem ao cliente o que ele está comprando. |
| Modelo de operação definido | pendente | Courier, revenda ou agente têm exigências diferentes. A definição muda o texto, o KYC e o contrato. |
| Provedor de KYC | nenhum | Hoje `kyc_status` foi posto em `approved` à mão na conta de teste. Com cliente real isso é verificação fingida. |
| Triagem de sanções | `risk_accepted` | **Não roda.** O registro em `compliance_checks` diz isso por extenso, com quem assumiu o risco — documentado em vez de escondido. Contratar provedor e mudar para `provider` é o que torna a checagem real. |
| `PUBLIC_SITE_URL` | não definido | Sem ele o cartão não devolve o cliente ao site depois do Checkout Pro. O valor é `https://jhonnyboy17.github.io/loteranza`. PIX não depende dele. |

### Como fechar tudo em um comando, se precisar

```sql
-- Fecha o portão 2. Vale imediatamente, sem rebuild: toda compra passa a
-- parar no Compliance Engine com GLOBAL_TRANSACTIONS_DISABLED.
update public.system_settings set value = 'false'::jsonb, updated_at = now()
where key = 'transactions_enabled';
```

O portão 1 é de build e só muda com um push; o 2 é o que existe justamente
para ser virado às pressas.

---

## 8. Logos oficiais

`public/logos/` está vazio e o site usa wordmarks originais, desenhadas aqui.
Para trocar pelas oficiais são necessárias duas coisas juntas: os arquivos
**e** a autorização de uso de marca por escrito. Sem a segunda, o que está no
ar hoje é o caminho seguro.

---

## 9. Revisão jurídica dos textos

Arquivos com o marcador `[CONTEÚDO A SER VALIDADO POR ADVOGADO]`:

- `src/pages/public/ContentPages.tsx`
- `src/pages/public/CheckoutPage.tsx`
- `src/pages/public/LotteryDetailPage.tsx`
- `src/pages/account/WinnerPage.tsx`
- `supabase/seed/seed.sql`
- `src/pages/admin/AdminSystem.tsx`

Enquanto houver placeholder, o deploy continua com `noindex` e `robots.txt`
bloqueando tudo — ver `docs/DEPLOY.md`.

---

## Ordem sugerida

Itens 1 a 4 estão feitos. Daqui para frente, em ordem de tempo de espera —
comece pelo que não depende de você:

1. **Aprovação comercial no Mercado Pago** (dias a semanas, e pode ser
   negada). É o item de maior prazo e o único que pode derrubar o plano
   inteiro. Abra agora, mesmo com o resto pendente.
2. **`PUBLIC_SITE_URL`** (colar, 1 minuto) → o cartão volta para o site.
3. **Advogado** nos textos e no modelo de operação (item 9, semanas).
4. **Provedor de KYC e de sanções** (contrato) → tira os dois ⚠️ do quadro.
5. **Segunda fonte de resultados** (item 5) → a conferência manual vira
   exceção em vez de rotina.
6. **Credencial de produção do Mercado Pago** — por último, e só depois dos
   anteriores. É esse secret que faz o site cobrar de verdade.

Jackpot, enquanto não houver fornecedor: digitar no painel a cada rolagem, ou
o valor vence em 12h e a tela passa a dizer "Prêmio a confirmar" — que é o
comportamento correto, mas não é vitrine.

Detalhe técnico de cada peça em `docs/DEPLOY.md` e `docs/COMPLIANCE.md`.
