# Publicação

## O protótipo (GitHub Pages)

Cada push no branch de trabalho publica o app em:

**https://jhonnyboy17.github.io/loteranza/**

O workflow é `.github/workflows/deploy-pages.yml`. Ele roda typecheck, lint e
build antes de publicar — se algum falhar, nada vai ao ar.

### O que esta publicação é, e o que não é

É a **interface rodando em modo demonstração**. Não há Supabase configurado,
então:

- os dados vêm do provider de demonstração (`src/services/lottery/demoProvider.ts`);
- os três portões de transação nascem fechados;
- o Compliance Engine nunca aprova, porque nenhuma jurisdição está habilitada;
- nenhuma compra é processada e nenhum pagamento é cobrado.

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

- **38 tabelas**, todas com RLS **ativado e forçado** (`force row level
  security`): a política vale até para o dono da tabela.
- **73 policies**, **21 funções** — todas com `search_path` fixado — e **23
  triggers**, incluindo `audit_logs_no_update`, que torna `audit_logs`
  append-only.
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
