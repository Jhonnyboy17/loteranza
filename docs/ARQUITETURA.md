# Arquitetura

## Camadas

```
Navegador (React + TypeScript)
   │  só lê catálogo público e os próprios dados; nunca decide elegibilidade
   ▼
Supabase
   ├── PostgreSQL + RLS ......... o padrão é negar; RLS forçada em todas as tabelas
   ├── Funções SQL .............. evaluate_compliance, calculate_order_totals,
   │                              compare_all_tickets, verify_ticket_against_order
   ├── Edge Functions ........... compliance-check, create-order, record-geolocation,
   │                              sync-lottery-data, process-draw-results
   ├── Auth ..................... senha com hash no provider, PKCE, refresh token
   └── Storage .................. bucket privado para imagens de bilhete (signed URL)
   ▲
   │  service role apenas nas Edge Functions, nunca no cliente
Fontes externas (fonte de loteria licenciada, KYC, sanções, câmbio, pagamento)
```

Nenhuma chamada a fonte externa parte do navegador. Isso mantém as chaves fora do
cliente e evita scraping frágil no frontend.

## Data Provider Layer

`src/services/lottery/types.ts` define a interface. Duas implementações:

| Provider | Quando | Origem |
|----------|--------|--------|
| `demoLotteryProvider` | sem Supabase configurado | dataset local determinístico |
| `supabaseLotteryProvider` | produção | tabelas alimentadas por worker |

`src/services/lottery/index.ts` escolhe uma e exporta `lotteryData`. **Nenhuma tela
importa um provider concreto** — trocar o fornecedor não toca em componente algum.

O worker (`sync-lottery-data`) é quem fala com a fonte licenciada. Enquanto
`LOTTERY_DATA_PROVIDER=demo`, ele apenas regenera o calendário e **não escreve
jackpot** — um valor ausente permanece ausente. A interface mostra "valor ainda não
informado" em vez de um número inventado.

## Modelo de dados

33 tabelas. Grupos principais:

- **Identidade**: `profiles`, `addresses`, `operators` (RBAC), `kyc_checks`
- **Regulatório**: `jurisdiction_rules`, `compliance_checks`, `geolocation_events`,
  `responsible_gaming_limits`, `self_exclusions`, `consent_logs`, `data_requests`
- **Catálogo**: `lottery_games`, `prize_tiers`, `draws`, `draw_results`,
  `draw_prize_breakdown`, `exchange_rates`
- **Transacional**: `orders`, `order_lines`, `payments`, `payment_providers`
- **Bilhete**: `tickets`, `ticket_images`, `ticket_vault`, `ticket_vault_events`
- **Prêmio**: `prize_claims`, `prize_claim_events`
- **Cliente**: `subscriptions`, `favorites`, `jackpot_alerts`, `notifications`,
  `notification_preferences`, `support_tickets`, `support_messages`
- **Operação**: `cms_content`, `faqs`, `system_settings`, `audit_logs`

### Decisões que valem explicar

**Dinheiro em `numeric`, nunca `float`.** Aritmética decimal exata; taxas de câmbio em
`numeric(16,6)`.

**A cotação é congelada no pedido.** `orders.exchange_rate` + `exchange_rate_id` +
`exchange_rate_at`. Pedido pago nunca é reescrito retroativamente.

**Serial e código de barras só como hash.** `tickets.serial_hash` / `barcode_hash`.
Guardar em claro permitiria resgate por quem tivesse acesso ao banco; a imagem exibida
ao cliente também tem essas áreas ocultadas.

**`audit_logs` é append-only no banco.** O gatilho `audit_logs_immutable` levanta
exceção em `UPDATE` e `DELETE`. Não é uma questão de permissão de tela — é impossível
pelo painel comum.

**Sem regra de jogo em código.** `lottery_games` carrega quantidade de números, faixas,
número especial, multiplicador, dias de sorteio, horário, fuso e corte de vendas. O
seletor de números lê tudo dali; adicionar Lotto, Pick 3 ou Pick 4 é cadastro.

**Fuso horário do sorteio.** `draws.draw_at` é `timestamptz` (instante absoluto), gerado
a partir de `draw_time_local` + `timezone` da modalidade — com horário de verão
respeitado. Na interface, o momento é exibido **no fuso oficial da loteria** com a
abreviação (`Sábado • 22:59 (EDT)`): mostrar no fuso do visitante mudaria o dia da
semana e contradiria o calendário divulgado. A contagem regressiva é que traduz
"quanto falta" para o relógio de quem está vendo.

## RLS — resumo

| Tabela | Leitura | Escrita |
|--------|---------|---------|
| `lottery_games`, `draws`, `draw_results`, `prize_tiers` | pública | `ADMIN`+ |
| `jurisdiction_rules` | pública (o usuário precisa saber se pode comprar) | `COMPLIANCE`, `SUPER_ADMIN` |
| `orders`, `order_lines` | dono + staff operacional | dono só em `pending_payment` |
| `payments` | dono + `FINANCE`/`COMPLIANCE` | **só servidor** |
| `kyc_checks` | dono + `COMPLIANCE` — **`FINANCE` fora** | `COMPLIANCE` |
| `geolocation_events` | dono (leitura) + `COMPLIANCE` | **só servidor** |
| `ticket_vault` | apenas staff — **cliente nunca vê onde está seu bilhete** | `TICKET_VERIFIER`+ |
| `audit_logs` | `SUPER_ADMIN`, `COMPLIANCE` | só via `write_audit_log()` |

`has_role()` e `is_staff()` são `SECURITY DEFINER` para poderem ser chamadas dentro das
policies sem provocar recursão de RLS sobre `operators`.

## Fluxo do pedido

```
carrinho (localStorage)
   ↓ create-order (Edge Function)
   ├─ valida cada linha contra lottery_games   ← o navegador pode ser contornado
   ├─ verifica o prazo do sorteio
   ├─ recalcula o preço a partir do banco      ← preço nunca vem do cliente
   ├─ congela a cotação
   └─ evaluate_compliance()
        ├─ APPROVED  → status pending_payment, is_demo = false
        └─ qualquer outro → status compliance_review, is_demo = true
   ↓ pagamento aprovado
awaiting_purchase → (operador assume) → purchased
   ↓ upload + conferência dupla (verify_ticket_against_order)
   ├─ confere  → verified
   └─ diverge  → discrepancy → revisão humana obrigatória
   ↓ resultado recebido
compare_all_tickets(draw_id)
   ├─ marca acertos e faixa; prize_confirmed permanece false
   └─ abre prize_claims em "detected" — nenhum pagamento automático
```

## Roteamento

`createBrowserRouter` por padrão (URLs limpas, exige reescrita para `index.html` no
servidor). `VITE_ROUTER=hash` troca para `createHashRouter`, para hospedagem estática
sem reescrita — protótipos e previews. A escolha é feita uma vez em `src/App.tsx`;
nenhuma rota ou componente muda.

## Testes executados

Verificação por navegador real (Chromium/Playwright), 68 asserções:

- **Rotas (23)** — todas as páginas públicas, 404, guarda do admin, conteúdo dinâmico
  da home, ausência de ganhadores/depoimentos fictícios.
- **Fluxo de compra (22)** — seletor dirigido pela configuração (69 e 26 bolas vindas do
  banco), limite de seleção, escolha rápida, cálculo do total, carrinho, prazo do
  sorteio, checkout com pagamento bloqueado.
- **Conta e admin (23)** — consentimentos obrigatórios travando o cadastro, checklist de
  compliance, pedido demonstrativo rotulado, RBAC negando e liberando, fila de compra,
  jurisdições todas bloqueadas, auditoria registrando as ações.

Responsividade medida de 360px a 1440px: alvos de toque de 44–48px, sem overflow
horizontal em nenhuma rota.

Migrations e Compliance Engine validados contra PostgreSQL 16 real, com oito cenários
de portão (ver `docs/COMPLIANCE.md`).
