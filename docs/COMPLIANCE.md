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
