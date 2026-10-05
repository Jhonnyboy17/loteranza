# Publicação

## O protótipo (GitHub Pages)

Cada push no branch de trabalho publica o app em:

**https://jhonnyboy17.github.io/loteranza/**

O workflow é `.github/workflows/deploy-pages.yml`. Ele roda typecheck, lint e
build antes de publicar — se algum falhar, nada vai ao ar.

### O que esta publicação é, e o que não é

É a **interface ligada no Supabase real, mas sem transação**. Os dados de
catálogo, sorteios e resultados vêm do banco; o que não acontece é venda:

- os três portões de transação nascem fechados;
- o Compliance Engine nunca aprova, porque nenhuma jurisdição está habilitada;
- nenhuma compra é processada e nenhum pagamento é cobrado.

Se as credenciais do Supabase faltarem ou chegarem inválidas ao build, o app
cai no provider de demonstração (`src/services/lottery/demoProvider.ts`) em
vez de quebrar — e o `dist/diagnostico.json` registra qual dos dois entrou.

O banner de demonstração diz isso em toda página. É de propósito: o objetivo
é mostrar e testar a interface, não vender nada.

### Por que `noindex`

O deploy passa `VITE_NOINDEX=true` e substitui o `robots.txt` por um
`Disallow: /`. Motivo: a marca ainda é provisória e os textos legais estão em
`[CONTEÚDO A SER VALIDADO POR ADVOGADO]`. Um protótipo de loteria indexado com
texto jurídico não validado é risco desnecessário.

Para o site real, basta não passar a variável — o padrão é indexar.

### Por que rotas com `#`

O GitHub Pages é hospedagem estática: não existe servidor reescrevendo
`/loterias/powerball` para o `index.html`. O deploy passa `VITE_ROUTER=hash`,
que o app já suporta, e as rotas viram `.../#/loterias/powerball`. Funcionam
em qualquer host. O `404.html` (cópia do index) é uma rede de segurança para
link direto sem `#`.

### Primeira execução — precisa de um clique

O `GITHUB_TOKEN` do Actions consegue **publicar** no Pages, mas não consegue
**criar** o site: criar exige direito de administração, que só o dono da conta
tem. Então, uma única vez:

1. Abrir <https://github.com/Jhonnyboy17/loteranza/settings/pages>
2. Em **Source**, escolher **GitHub Actions**
3. Em Actions, abrir o último run e clicar em **Re-run all jobs**

Depois disso todo push republica sozinho, sem mais cliques.

O workflow confere isso antes de tentar publicar e, se o Pages estiver
desligado, escreve essas instruções no resumo do run — em vez do erro
`Resource not accessible by integration`, que não diz o que fazer.

## Backend real

O projeto Supabase existe e está provisionado:

| | |
| --- | --- |
| Projeto | `pymgliyofizgfirekepg` ("loteranza") |
| Região | `sa-east-1` (São Paulo) — **não pode ser alterada depois** |
| URL | `https://pymgliyofizgfirekepg.supabase.co` |

O que está aplicado:

- **40 tabelas**, todas com RLS **ativado e forçado** (`force row level
  security`): a política vale até para o dono da tabela.
- **75 policies**, **26 funções** — todas com `search_path` fixado — e **22
  triggers**, incluindo `audit_logs_no_update`, que torna `audit_logs`
  append-only.
- **2 views** (`sync_health` e `draw_results_pending_review`), ambas fechadas
  a quem não é staff.
- **5 Edge Functions** publicadas e ACTIVE.
- Seed demonstrativo: 6 modalidades, 28 sorteios, 12 resultados
  (`is_official = false`), 11 FAQs, 10 blocos de CMS.

### Os três portões, no estado real

Todos fechados. Verificado chamando `evaluate_compliance()` no servidor com um
usuário completo — maior de idade, KYC aprovado, sem restrição de jogo
responsável, dentro dos limites. O veredito foi `BLOCKED`:

```
transactions_enabled_check  falhou  GLOBAL_TRANSACTIONS_DISABLED
jurisdiction_check          falhou  JURISDICTION_DISABLED
age_check                   ok
identity_check              ok
responsible_gaming_check    ok
purchase_limits_check       ok
```

As 5 jurisdições cadastradas (BR, US, US-IL, US-NY, PT) estão com
`transactions_enabled = false`, e os 4 provedores de pagamento com
`is_enabled = false`.

### Apontar o deploy público para ele

O repositório é público, então nenhuma credencial fica no workflow — nem a
chave anon, que é pública por desenho mas atrairia alerta de secret scanning.
O build lê duas **variáveis** do repositório:

1. Abrir <https://github.com/Jhonnyboy17/loteranza/settings/variables/actions>
2. **New repository variable**, duas vezes:
   - `VITE_SUPABASE_URL` → `https://pymgliyofizgfirekepg.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` → chave anon do projeto (Supabase → Settings →
     API Keys)
3. Rodar o workflow de novo.

Sem as variáveis o deploy **não quebra**: cai no provider de demonstração e o
resumo do run diz exatamente isso, com o link acima. Como são variáveis e não
código, rotacionar a chave não exige commit.

Para desenvolvimento local, as mesmas duas vão em `.env.local` (que está no
`.gitignore`).

### Secrets das Edge Functions

Ainda não definidos. Até existirem, as funções falham fechado — o que é o
comportamento desejado, não um bug:

| Secret | Efeito enquanto ausente |
| --- | --- |
| `SYNC_SECRET` | `sync-lottery-data` e `process-draw-results` respondem 401 a qualquer chamada |
| `ALLOWED_ORIGINS` | nenhuma origem recebe cabeçalho CORS permissivo |
| `IP_HASH_SALT` | o hash de IP fica sem sal (ainda não reversível, mas sujeito a rainbow table) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são injetados
pela própria plataforma.

### Histórico de migrations

As migrations foram aplicadas por partes, porque a ferramenta usada nesta
sessão interrompe qualquer comando que comece com `drop` (espera uma
confirmação interativa que não existe aqui). O resultado foi conferido contra
uma execução local completa das mesmas migrations: mesma contagem de tabelas,
policies, funções e triggers.

A tabela `supabase_migrations.schema_migrations` recebeu as 10 versões do
repositório, para que um `supabase db push` futuro não tente reaplicá-las.
Sobraram ali 7 linhas com versão `202610…`, resíduo das aplicações parciais;
são inócuas, mas podem ser removidas com um `delete` pelo SQL Editor.

## Sincronização automática

Jackpots, resultados e cotação são atualizados por rotinas agendadas dentro do
próprio banco: `pg_cron` dispara, `pg_net` chama as Edge Functions, e o segredo
compartilhado fica no Vault. Não há servidor extra nem runner de CI no caminho.

| Rotina | Quando | O que faz |
| --- | --- | --- |
| `sync-jackpots` | a cada 4h | regenera o calendário e busca o valor anunciado |
| `sync-results-numbers` | de hora em hora | números sorteados → `draw_result_observations` → conciliação |
| `sync-results-breakdown` | a cada 6h | quantos ganharam cada faixa → `draw_prize_breakdown` |
| `sync-exchange-rate` | a cada 6h | cotação USD/BRL, com o spread aplicado no servidor |
| `reconcile-dispatches` | a cada 5min | traduz a resposta HTTP em diagnóstico legível |

Os números rodam de hora em hora de propósito: a função só olha sorteios sem
resultado oficial dos últimos 7 dias, então se limita sozinha e não precisa
conhecer o calendário de cada loteria — que muda com o horário de verão
americano.

### Resultado só vira oficial com duas fontes

Cada fonte grava sua leitura em `draw_result_observations`, e
`reconcile_draw_result()` promove a oficial apenas quando **duas fontes
independentes concordam**. Divergência não escolhe a leitura mais conveniente:
segura em preliminar e aparece em **Admin → Sincronização**.

Oficial significa "resultado conferido", não "pode pagar":
`tickets.prize_confirmed` continua `false` e `prize_claims` segue exigindo
dupla aprovação.

Com `results_require_two_sources = false` em `system_settings`, uma fonte basta
— útil em teste, desaconselhado em produção.

### O que falta para ligar

**1. O segredo.** Já existe no Vault, gerado dentro do banco para nunca
transitar por chat ou log. Leia-o uma vez no SQL Editor:

```sql
select decrypted_secret from vault.decrypted_secrets where name = 'sync_secret';
```

e cadastre o valor como secret `SYNC_SECRET` das Edge Functions, em
Supabase → Edge Functions → Secrets. Até lá as chamadas respondem 401 — que é
falhar fechado, e aparece no painel como *"HTTP 401: a Edge Function recusou o
segredo"*.

**2. A fonte.** Enquanto `LOTTERY_DATA_PROVIDERS` não existir, vale `demo`, que
não busca nada e **não inventa nada** — as rotinas rodam, registram execução e
não escrevem valor.

Provedores já registrados:

| Nome | Cobre | Não cobre |
| --- | --- | --- |
| `demo` | nada, de propósito | — |
| `ny-open-data` | números sorteados e multiplicador de Powerball e Mega Millions | jackpot, quebra por faixa |

`ny-open-data` lê os dados abertos da loteria do estado de Nova York
(`d6yy-54nr` e `5xaw-6ayf`, plataforma Socrata). Sem chave e sem contrato; o
secret `NY_OPEN_DATA_APP_TOKEN` é opcional e só afeta limite de requisição.

Os dois datasets **não têm o mesmo formato** — Powerball traz as seis dezenas
juntas em `winning_numbers`, Mega Millions traz cinco ali e a sexta em
`mega_ball`. O parser resolve isso pelas contagens de `lottery_games`, nunca
por número fixo no código, e levanta erro quando a forma não casa com nenhuma
das duas hipóteses: dezena errada gravada como leitura de fonte é pior do que
leitura nenhuma, porque a conciliação pode promovê-la a oficial.

Para ligar outra fonte:

1. crie `supabase/functions/_shared/providers/<nome>.ts` implementando
   `LotteryProvider`;
2. registre-o em `LOTTERY_PROVIDERS` no `index.ts` ao lado;
3. defina o secret `LOTTERY_DATA_PROVIDERS` com o nome (lista separada por
   vírgula para usar duas fontes).

Nenhum outro arquivo muda. Nome desconhecido é erro ruidoso, não queda
silenciosa para `demo`.

> **Duas fontes precisam ser independentes.** Dois raspadores do mesmo site
> não são duas fontes: eles concordam até quando a leitura está errada, e a
> conciliação promoveria o erro a oficial. Independência real significa
> sistemas de origem diferentes — o registro próprio de um estado contra o de
> outro.

**2b. A trava de sanidade.** Toda leitura passa por
`validate_draw_observation()`, trigger em `draw_result_observations`, que
recusa quantidade errada de dezenas, número fora da faixa configurada no jogo
e dezena principal repetida. Fica no banco e não no provedor porque a regra já
vive uma vez só em `lottery_games` — assim ela vale para qualquer fonte
futura, sem depender de quem escrever o próximo arquivo lembrar de checar.

**3. Os demais secrets** já listados abaixo (`ALLOWED_ORIGINS`, `IP_HASH_SALT`).

### Quando o dado vence

`jackpot_max_age_hours` (12) e `fx_max_age_hours` (24), em `system_settings`,
definem a validade. Passou disso, a interface mostra **"Prêmio a confirmar"**
com o último valor conhecido e a data, em vez de anunciar como atual — e omite
a conversão em reais. Dado `is_demo` fica de fora da regra, porque já se
apresenta como demonstrativo.

### Divergência entre repositório e funções publicadas

As Edge Functions foram publicadas por chamada de API, colando o conteúdo. Os
arquivos do repositório são a fonte de verdade; as cópias publicadas podem ter
comentários abreviados. Um `supabase functions deploy` a partir do repositório
alinha as duas.

## Sair do modo demonstração

Ordem recomendada:

1. ~~Criar o projeto Supabase e aplicar as migrations~~ — **feito**.
2. ~~Publicar as Edge Functions~~ — **feito**.
3. ~~Definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`~~ — feito em
   `.env.local`; falta criar as duas variáveis do repositório para o deploy
   público (seção acima).
4. Definir os secrets das Edge Functions (`SYNC_SECRET`, `ALLOWED_ORIGINS`,
   `IP_HASH_SALT`).
5. Contratar e ligar provedor de triagem de sanções
   (`sanctions_provider_enabled`) e de KYC (`kyc_provider`) — hoje o Engine
   devolve `PENDING_REVIEW` por falta deles em qualquer jurisdição habilitada.
6. Habilitar uma jurisdição em `jurisdiction_rules` (portão 3) — **somente com
   parecer jurídico e licenciamento para aquela jurisdição**.
7. Ligar `system_settings.transactions_enabled` (portão 2).
8. Só então `VITE_TRANSACTIONS_ENABLED=true` (portão 1).

Os três portões são independentes de propósito. Nenhum deles sozinho libera
uma compra: a decisão final é sempre do `evaluate_compliance()`, no servidor.

Antes do passo 8, revise `design/stitch/CONFORMIDADE.md` e valide juridicamente
todo texto marcado com `[CONTEÚDO A SER VALIDADO POR ADVOGADO]`. Os textos
legais estão no banco com `is_published = false` e `requires_legal_review =
true`; como `anon` só lê CMS publicado, eles não vazam antes da revisão.
