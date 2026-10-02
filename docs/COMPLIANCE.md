# Compliance Engine

## Onde a decisão é tomada

Existem **duas** implementações, e isso é proposital:

| Implementação | Arquivo | Papel |
|---------------|---------|-------|
| **Autoritativa** | `evaluate_compliance()` em `supabase/migrations/…business_functions.sql` | decide |
| Espelho de UI | `src/services/compliance/engine.ts` | explica ao usuário o que falta |

A versão no navegador **não autoriza nada**. Se as duas discordarem, vale o servidor.
Ao alterar uma regra, altere as duas — elas são mantidas em paridade deliberada.

## Verificações

| Check | O que valida | Falha resulta em |
|-------|--------------|------------------|
| `transactions_enabled_check` | kill switch global | `BLOCKED` |
| `jurisdiction_check` | país/estado habilitado e modalidade liberada nele | `BLOCKED` |
| `age_check` | idade mínima **da jurisdição** | `BLOCKED` |
| `identity_check` | KYC quando a jurisdição exige | `PENDING_REVIEW` |
| `responsible_gaming_check` | pausa e autoexclusão ativas | `BLOCKED` |
| `purchase_limits_check` | limite diário do usuário e máximo da jurisdição | `BLOCKED` |
| `sanctions_check` | triagem, quando há provedor configurado | `PENDING_REVIEW` |

Cada verificação é gravada individualmente em `compliance_checks`, com código e mensagem
do motivo — é isso que permite dizer ao usuário exatamente o que está faltando, em vez
de um "não autorizado" opaco.

Não existe caminho alternativo de aprovação. Sem provedor de sanções contratado, o
resultado é `PENDING_REVIEW` — nunca uma aprovação silenciosa.

## Cenários verificados

Executados contra PostgreSQL 16 real:

| # | Situação | Resultado | Motivos |
|---|----------|-----------|---------|
| 1 | Estado inicial do projeto | `BLOCKED` | global desligado, jurisdição desabilitada, KYC pendente |
| 2 | Kill switch ligado, jurisdição ainda não | `BLOCKED` | jurisdição desabilitada, KYC |
| 3 | Jurisdição habilitada, jogo não liberado nela | `BLOCKED` | modalidade não permitida |
| 4 | Jogo liberado, sem provedor de sanções | `PENDING_REVIEW` | triagem não configurada |
| 5 | Tudo configurado | `APPROVED` | — |
| 6 | Menor de idade, tudo o mais ligado | `BLOCKED` | abaixo da idade mínima |
| 7 | Autoexclusão ativa | `BLOCKED` | conta autoexcluída |
| 8 | Localização sem regra cadastrada (ex.: FR) | `BLOCKED` | jurisdição não configurada |

Os cenários 6 e 7 são os importantes: mesmo com **todos** os portões abertos, idade e
autoexclusão derrubam o veredito.

O cenário 1 foi reexecutado no projeto Supabase real (`pymgliyofizgfirekepg`,
PostgreSQL 17), com um usuário deliberadamente **sem nenhum defeito próprio** —
maior de idade, KYC aprovado, sem restrição de jogo responsável, valor dentro
dos limites. Veredito `BLOCKED`, derrubado apenas pelos dois portões de
autorização:

```
transactions_enabled_check  falhou  GLOBAL_TRANSACTIONS_DISABLED
jurisdiction_check          falhou  JURISDICTION_DISABLED
age_check                   ok
identity_check              ok
responsible_gaming_check    ok
purchase_limits_check       ok
```

## Superfície exposta ao cliente

RLS protege linhas, mas não cobre tudo. Duas lacunas vinham dos privilégios
que o Supabase concede por padrão a `anon` e `authenticated`, e foram fechadas
na migration `0700_privilege_hardening`:

**`TRUNCATE` não passa por RLS.** Com o privilégio padrão, uma sessão
autenticada poderia esvaziar `audit_logs`, `jurisdiction_rules` ou
`system_settings`. O gatilho `audit_logs_immutable` cobre apenas
`UPDATE`/`DELETE` — uma trilha só é de fato append-only depois de revogar
`TRUNCATE`. Revogados também `REFERENCES` e `TRIGGER`, que nada no produto usa.

**Funções `SECURITY DEFINER` ignoram RLS** e ficam expostas em
`/rest/v1/rpc/<nome>`. Três consequências concretas, todas fechadas:

| Função | O que o cliente conseguia |
| --- | --- |
| `evaluate_compliance` | passar `p_country`/`p_state` próprios e gravar o veredito em qualquer pedido — exatamente o contorno de geolocalização que o projeto proíbe |
| `spent_in_window` | ler o gasto de outro usuário passando o `uuid` dele |
| `setting_bool` / `setting_numeric` | ler configuração marcada como não pública |
| `write_audit_log` | inserir registros na trilha de auditoria |

Nenhuma delas é chamada pelo frontend: todas vêm das Edge Functions com a
`service_role`. `EXECUTE` foi revogado de `PUBLIC`, `anon` e `authenticated` —
o `REVOKE` de `PUBLIC` é indispensável, porque o Postgres concede `EXECUTE` ao
pseudo-papel `PUBLIC` em toda função nova e isso cobre os dois papéis mesmo
depois de revogá-los nominalmente.

`has_role()` e `is_staff()` continuam executáveis de propósito: as 73 policies
as chamam, e expressão de policy é avaliada com os privilégios de quem
consulta. As duas são fixadas em `auth.uid()`, não aceitam identidade vinda do
chamador e devolvem apenas um booleano sobre o próprio solicitante.

Verificado no banco real, atuando como `anon`:

| Tabela | Linhas visíveis | Esperado |
| --- | --- | --- |
| `lottery_games` | 6 de 6 | catálogo é público |
| `draws` / `draw_results` | 28 / 12 | resultados são públicos |
| `system_settings` | 8 de 11 | só `is_public = true` |
| `cms_content` | 2 de 10 | só `is_published = true` |
| `profiles`, `orders`, `tickets`, `payments`, `ticket_vault`, `audit_logs`, `compliance_checks`, `geolocation_events`, `kyc_checks`, `operators` | 0 | nenhuma é pública |

## Geolocalização

A decisão de jurisdição usa dados resolvidos **no servidor**:

- país do IP da requisição (cabeçalho da borda);
- coordenadas capturadas pelo dispositivo, quando o usuário concede permissão.

O corpo da requisição **não pode escolher a jurisdição** — um país enviado pelo cliente é
ignorado. Essa é a razão de `compliance-check` existir como Edge Function em vez de
rodar no navegador.

O campo "país de residência" do cadastro serve para outras finalidades (comunicação,
fiscal) e **não** alimenta a decisão de compliance.

Divergência entre a posição do dispositivo e o país do IP é **marcada**
(`geolocation_events.mismatch_flag`) e leva a `PENDING_REVIEW`. Ela nunca é resolvida
escolhendo a opção mais conveniente.

O IP nunca é armazenado em claro — apenas um hash com salt (`IP_HASH_SALT`).

Recusar a permissão de localização é um estado legítimo: a pessoa continua consultando
jackpots, resultados e o conferidor de números; apenas não avança nas etapas
transacionais.

## Jogo responsável

Reduzir um limite vale imediatamente. **Aumentar** passa por um período de espera
(`system_settings.rg.increase_cooldown_hours`, padrão 24h): o registro é criado com
`effective_at` no futuro e o engine só considera limites já vigentes.

Pausa e autoexclusão são bloqueios duros: derrubam o veredito independentemente de
qualquer outra configuração da conta.

## Prêmios

`compare_all_tickets(draw_id)` marca acertos, faixa e valor estimado, e abre um
`prize_claims` por bilhete premiado no estado `detected`.

O que **não** acontece automaticamente:

- `prize_confirmed` continua `false` até validação do resultado oficial;
- nenhum pagamento é disparado;
- prêmios acima de `prize.manual_review_threshold` exigem dupla aprovação
  (`approved_by` **e** `second_approver_id`).

A interface acompanha isso: enquanto o prêmio não está confirmado, a página "Ganhei"
diz que a conferência é preliminar e **não** solta confete. Confete só aparece com
prêmio confirmado.

## Conteúdo legal

Todos os documentos legais entram no CMS com `requires_legal_review = true` e o marcador
`[CONTEÚDO A SER VALIDADO POR ADVOGADO]`. O sistema não gera texto jurídico definitivo e
não deve publicar nenhum desses documentos sem revisão profissional registrada.
