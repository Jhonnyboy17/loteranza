# Jackpot USA

Plataforma web para **consulta de loterias americanas** (jackpots, resultados, montagem
de jogos) e, **onde a operação for legalmente permitida**, intermediação da compra do
bilhete oficial no modelo *lottery courier*, com rastreabilidade completa.

Interface em português do Brasil, mobile-first.

> **Estado atual: MODO DEMONSTRAÇÃO.**
> Nenhuma jurisdição está habilitada, nenhum pagamento é processado e nenhum bilhete é
> adquirido. Os dados exibidos são demonstrativos e estão rotulados como tais na interface.

---

## Identidade visual

Tema **escuro por padrão**: violeta profundo sobre quase-preto, com âmbar reservado
exclusivamente ao valor do jackpot. Minimalista — o brilho aparece só onde guia a ação
(botão primário, número selecionado, jackpot).

| Papel | Token | Valor |
|-------|-------|-------|
| Fundo | `--background` | `hsl(258 32% 5%)` — quase-preto com viés violeta |
| Superfície | `--card` | `hsl(258 26% 8%)` |
| Primária | `--primary` | `hsl(263 88% 68%)` — violeta vibrante, abaixo do neon |
| Jackpot | `--jackpot` | `hsl(42 96% 62%)` — âmbar, **só** para jackpot |
| Sucesso | `--success` | `hsl(158 68% 46%)` |
| Alerta | `--warning` | `hsl(38 92% 62%)` |
| Erro | `--destructive` | `hsl(352 78% 62%)` |

Contraste medido no navegador: todos os pares de texto passam WCAG AA
(texto pequeno ≥ 4.5, grande ≥ 3). Os títulos em degradê ficam entre 9:1 e 18:1.

Um tema claro opcional vive na classe `.light` em `src/index.css` — aplicar em `<html>`.
Nenhum componente tem cor fixa: trocar a marca é trocar as variáveis.

## Protótipo navegável

```bash
npm run dev            # http://localhost:5173  — fonte, com hot reload
npm run preview        # build de produção
npm run build:proto    # build para hospedagem estática (usar com VITE_ROUTER=hash)
```

`VITE_ROUTER=hash` troca para rotas com `#`, que funcionam em qualquer host estático
sem reescrita de URL. Em produção, com um servidor que reescreve para `index.html`,
mantenha o padrão (URLs limpas).

---

## Os três portões

Nenhuma transação acontece sem que **os três** estejam abertos, e a decisão final é
sempre do servidor:

| # | Portão | Onde vive | Estado inicial |
|---|--------|-----------|----------------|
| 1 | `VITE_TRANSACTIONS_ENABLED` | variável de ambiente | `false` |
| 2 | `system_settings.transactions_enabled` | banco, editável no painel | `false` |
| 3 | `jurisdiction_rules.transactions_enabled` | banco, **por país/estado** | `false` em todas |

E, além dos três, o **Compliance Engine** precisa retornar `APPROVED` para aquele
pedido específico.

O portão 1 não pode ser aberto pelo painel — exige alteração no ambiente de execução e
novo deploy. Isso é intencional.

## O que este projeto deliberadamente não faz

Por decisão de projeto, não existe — e não deve ser adicionado — nenhum recurso para:

- falsificar GPS ou contornar verificação de geolocalização;
- usar VPN/proxy para burlar restrições regionais;
- mascarar o país do usuário;
- contornar KYC ou verificação de idade;
- comprar bilhetes através da conta oficial de outra pessoa;
- esconder do processador de pagamentos a natureza da operação.

A camada de pagamento (`src/services/payments/types.ts`) exige `descriptor` e `mcc` na
interface justamente para que não exista caminho de código capaz de disfarçar a cobrança.

Também não há: depoimentos fictícios, ganhadores fictícios, números de licença
fictícios, contadores falsos, jackpots inventados, taxas escondidas ou qualquer
afirmação de que uma combinação aumenta chances.

---

## Como rodar

```bash
npm install
cp .env.example .env.local     # opcional: sem Supabase, roda em modo demo
npm run dev                    # http://localhost:5173
```

Sem `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, a aplicação roda inteira sobre o
**provider de dados DEMO** (em memória + `localStorage`): homepage, catálogo, seleção de
números, carrinho, checkout com bloqueio de compliance, área do cliente e painel
administrativo — tudo navegável, nada cobrável.

### Scripts

| Comando | O que faz |
|---------|-----------|
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | typecheck + build de produção |
| `npm run typecheck` | apenas verificação de tipos |
| `npm run lint` | ESLint |

### Com Supabase

```bash
supabase db push                                  # aplica supabase/migrations/
psql "$DATABASE_URL" -f supabase/seed/seed.sql    # dados demonstrativos (opcional)
supabase functions deploy compliance-check create-order record-geolocation \
                          sync-lottery-data process-draw-results
```

Segredos das Edge Functions (nunca no frontend):

```
SUPABASE_SERVICE_ROLE_KEY, ALLOWED_ORIGINS, IP_HASH_SALT, SYNC_SECRET,
LOTTERY_DATA_PROVIDER, LOTTERY_DATA_API_KEY, FX_PROVIDER_API_KEY,
KYC_PROVIDER_API_KEY, PAYMENT_PROVIDER_API_KEY
```

Para promover um usuário a operador:

```sql
insert into public.operators (user_id, role) values ('<uuid>', 'SUPER_ADMIN');
```

---

## Arquitetura

```
src/
  config/       env (3 portões) e marca (renomear sem tocar em componente)
  lib/          supabase, formatação pt-BR, RNG criptográfico, utilitários
  types/        tipos do domínio, espelhando as tabelas
  services/
    lottery/    Data Provider Layer — demo | supabase (troca sem tocar em telas)
    compliance/ engine (espelho de UI) + captura de geolocalização
    payments/   camada de abstração de provedores (nenhum habilitado)
    exchange/   cotação USD/BRL, congelada no pedido
    platform/   estado do modo demo
  components/   ui (shadcn), lottery, cart, compliance, layout, brand
  contexts/     Auth, Platform (config + jurisdições), Cart
  pages/        public, auth, account, admin
supabase/
  migrations/   schema, RLS, funções de negócio
  functions/    Edge Functions (autoridade do lado servidor)
  seed/         dados demonstrativos
```

Detalhes em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) e
[`docs/COMPLIANCE.md`](docs/COMPLIANCE.md).

### Princípios aplicados

- **Nada de regra de jogo no frontend.** Quantidade de números, faixas, preço, taxa,
  calendário e horário de corte vêm de `lottery_games`. Adicionar uma modalidade é
  cadastrar uma linha, não escrever código.
- **Regra financeira crítica no servidor.** O preço exibido é conveniência de UI; o que
  vale é `calculate_order_totals` no Postgres. Se divergirem, vale o servidor.
- **Produto e taxa sempre separados.** Não existe função que devolva só o total.
- **RLS em todas as tabelas**, com *força* (`force row level security`). O padrão é negar.
- **`audit_logs` é append-only** — um gatilho bloqueia `UPDATE`/`DELETE` no banco,
  independentemente de qualquer permissão do painel.
- **Separação de acesso por papel**: `FINANCE` não lê KYC; `PURCHASER` vê apenas os
  números, o sorteio e o prazo — não endereço, documento ou meio de pagamento.

---

## Estado da entrega

Funcional e verificado por testes de navegador:

- [x] Schema completo (33 tabelas), RLS, funções de negócio, seed demonstrativo
- [x] Autenticação (Supabase Auth; sessão local no modo demo)
- [x] Layout global, header/footer responsivos, carrinho como drawer
- [x] Homepage, catálogo, páginas Powerball e Mega Millions
- [x] Seletor de números dirigido por configuração + Escolha Rápida (RNG criptográfico)
- [x] Carrinho, múltiplos sorteios, checkout em 5 etapas com bloqueio de compliance
- [x] Área do cliente: pedidos, linha do tempo, bilhete, favoritos, jogo responsável
- [x] Resultados, histórico e conferidor de números
- [x] Painel administrativo (21 telas), fila de compra, upload com conferência dupla
- [x] Compliance Engine (SQL + Edge Function + espelho de UI), RBAC, auditoria
- [x] Responsividade verificada de 360px a 1440px, sem overflow horizontal

Preparado, aguardando integração externa:

- [ ] Provedor de dados de loteria licenciado (hoje: dataset demo)
- [ ] Provedor de KYC
- [ ] Provedor de triagem de sanções
- [ ] Provedor de pagamento juridicamente compatível
- [ ] Geocodificação reversa no servidor (hoje: apenas país do IP — mais restritivo)
- [ ] **Revisão jurídica de todo o conteúdo legal** (todos marcados
      `[CONTEÚDO A SER VALIDADO POR ADVOGADO]`)

Nenhum desses itens pode ser considerado resolvido por código: dependem de contrato,
licenciamento e parecer jurídico.
