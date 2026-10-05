# Próximos passos — o que depende de você

Estado conferido direto no banco em **2026-10-05**:

| | |
| --- | --- |
| Contas de usuário | 1 (`jonathangabriel88@gmail.com`) |
| Operadores ativos | **0** ← trava o `/admin` inteiro |
| `SYNC_SECRET` na Edge Function | **ausente** ← a automação responde 401 |
| Fonte de dados real | **nenhuma** (só o provedor `demo`) |
| Agendamentos ativos | 5 (rodando) |
| Fila de conferência de resultados | 14 |
| Portão 2 (kill switch global) | `false` |
| Portão 3 (jurisdições habilitadas) | 0 de 5 |

Os itens estão em ordem de bloqueio: o 1 trava o painel, o 2 trava a
automação, o 3 e o 4 são segurança, o 5 é o único que exige **decisão** sua e
não só um clique.

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

Mesma coisa para câmbio, no secret `FX_PROVIDER`.

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

## 7. Os três portões — nada vende ainda, e isso é proposital

| Portão | Onde | Estado |
| --- | --- | --- |
| 1 | `VITE_TRANSACTIONS_ENABLED` (build) | desligado |
| 2 | `system_settings.transactions_enabled` (kill switch) | `false` |
| 3 | `jurisdiction_rules.transactions_enabled` (por país/estado) | 0 de 5 |

Além dos três, `evaluate_compliance()` precisa devolver `APPROVED` para cada
compra, checando idade, KYC, jogo responsável e limites.

**Abrir isso é decisão jurídica, não técnica.** Antes de qualquer portão:

- advogado valida os textos marcados `[CONTEÚDO A SER VALIDADO POR ADVOGADO]`;
- advogado define **quais jurisdições** podem ser habilitadas, uma a uma;
- define-se o modelo de operação (courier/mensageiro, revenda, agente) — e
  cada um tem exigência regulatória diferente;
- escolhe-se fornecedor de KYC/AML;
- escolhe-se processador de pagamento que **saiba** qual é o ramo. Esconder a
  natureza da operação do processador está na lista do que não se faz aqui.

Eu não vou virar esses portões por você, nem com acesso total ao banco.

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

1. Item 1 (SQL, 1 minuto) → o painel abre
2. Item 2 (SQL + colar, 3 minutos) → a automação para de dar 401
3. Itens 3 e 4 (colar, 2 minutos) → segurança fechada
4. Item 5 (pesquisa e contrato, dias) → dado real começa a entrar
5. Itens 7, 8 e 9 (jurídico, semanas) → só então se fala em vender

Detalhe técnico de cada peça em `docs/DEPLOY.md` e `docs/COMPLIANCE.md`.
