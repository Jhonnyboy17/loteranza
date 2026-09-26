# Conflitos de conformidade no export do Stitch

Levantamento feito lendo os 4 HTMLs originais. Cada item viola uma regra
explícita do briefing (seção "NÃO FAZER" / restrições de compliance) ou uma
decisão de arquitetura já implementada no backend.

Coluna "Decisão" = o que a conversão para React fará, salvo instrução contrária.

---

## 1. Contadores falsos (regra: "Não criar contadores falsos")

| Arquivo | Evidência | Decisão |
|---|---|---|
| `inicio/code.html` | `let seconds = 1*86400 + 14*3600 + 22*60 + 40` + `setInterval` | Ligar ao `<Countdown>` existente, alimentado por `draws.sales_close_at` |
| `jogar/code.html` | `id="countdown"` inicia em `04:18:22`, script lê o próprio texto e decrementa | idem |
| `meus-bilhetes/code.html` | `let hours=4; let minutes=28; let seconds=15` | idem |

Os três contam para baixo a partir de um número fixo, sem relação nenhuma com
sorteio real. É literalmente o caso que o briefing proíbe.

## 2. Alegações de licença / homologação inexistentes

| Onde | Texto |
|---|---|
| `inicio` | `HOMOLOGADO`, `Terminal Oficial Chicago IL`, `OFFICIAL MESSENGER` (no SVG do logo) |
| `jogar` | `Seu bilhete oficial da Mega Millions é adquirido por nossos agentes licenciados em Chicago, Illinois` |
| `checkout` | `Garantia Chicago Courier`, `Agente credenciado compra o bilhete físico nas lotéricas oficiais de Illinois`, `Terminal Seguro Chicago IL` |
| `meus-bilhetes` | `Garantia Notarial Courier`, `Terminal 4410-A`, `Courier ID #7728`, `Terminal IL-Courier #8492` |
| `_sistema/DESIGN.md` | "officially licensed courier confirmation checks" |

Não existe licença, nem terminal, nem agente credenciado, nem cartório.
**Decisão:** substituir por linguagem condicional e verificável, ligada ao
Compliance Engine — ex. "Modo demonstração — nenhuma compra é processada"
enquanto `transactions_enabled = false`; e quando/se houver operador real,
o texto vem de `operators` + `[CONTEÚDO A SER VALIDADO POR ADVOGADO]`.

## 3. "100%" e garantias (regra: 'Não escreva "100% legal"', 'Não escreva "garantido"')

| Onde | Texto |
|---|---|
| `meus-bilhetes` | `100% Blindado` |
| `checkout` | `100% dos Prêmios sem Retenção` + `Ganhos integrais repassados diretamente para você sem comissão oculta` |

O segundo é pior que estilo: prêmio de loteria americana **tem** retenção
federal (e estadual) na fonte acima de certos valores. Afirmar "sem retenção"
é informação falsa sobre dinheiro.
**Decisão:** remover ambos; o checkout passa a mostrar a nota real de retenção.

## 4. Marca de terceiros sem autorização verificada

- `inicio`, `jogar`, `checkout`: logo da **Mega Millions** como `<img>` apontando
  para `lh3.googleusercontent.com/aida-public/...`
- `inicio`: logo próprio também hotlinkado no mesmo domínio

Dois problemas: uso de marca registrada de terceiro (o briefing manda verificar
licenciamento antes) e URL do Google que vai quebrar.
**Decisão:** trocar por marca-d'água tipográfica neutra gerada a partir de
`lottery_games` (nome + cor do jogo). Se você conseguir a autorização de marca,
basta preencher `lottery_games.logo_url` e o componente passa a usar.

## 5. Dados de custódia expostos ao cliente

`meus-bilhetes` mostra `Gaveta Blindada #A-108`, `Illinois Vault #12`,
`Terminal 4410-A`, `Courier ID #7728`.

Isso contraria a decisão de RLS já implementada: `ticket_vault` é
`vault_staff_only` — a posição física do bilhete **não** é visível ao cliente,
de propósito (se vaza a posição, vaza o alvo).
**Decisão:** cliente vê estado da custódia (`Em cofre` / `Digitalizado` /
`Resgatado`) e o hash de verificação; não vê localização.

## 6. Afirmações não verificáveis

| Onde | Texto | Problema |
|---|---|---|
| `inicio` | `MAIOR PRÊMIO DO MUNDO` | estático, ninguém verifica |
| `inicio` | `Câmbio Oficial: ≈ R$ 3,67 BILHÕES` | nosso câmbio é estimativa, não oficial |
| `inicio` | `Resultados Verificados` | resultados são preliminares até `is_official = true` |
| `meus-bilhetes` | `Powerball #1994 · Premiado US$ 100` | exemplo de ganhador sem rótulo de exemplo |
| `jogar`/`checkout` | `EXCHANGE_RATE = 5.50` hardcoded no JS | taxa tem que vir de `exchange_rates` e ser congelada no pedido |
| `jogar`/`checkout` | `BASE_PRICE = 5.00`, `MEGAPLIER_PRICE = 2.00` | regra de jogo no front — proibido; vem de `lottery_games` |

**Decisão:** "maior prêmio do mundo" sai; "Câmbio Oficial" vira "Câmbio
estimado (atualizado em …)"; "Resultados Verificados" vira "Oficial" só quando
`is_official`, senão "Preliminar"; o card de ganhador sai (ou vira exemplo
rotulado); preços e câmbio passam a vir do banco.

## 7. Jogos indisponíveis apresentados como jogáveis

`inicio` lista Illinois Lotto e Lucky Day Lotto com CTA de jogar. No banco os
dois estão `coming_soon`.
**Decisão:** trivial — a listagem passa a ser data-driven e o CTA respeita o
status.

## 8. Acessibilidade

| Onde | Problema |
|---|---|
| todos os 4 | `user-scalable=no, maximum-scale=1.0` no viewport — bloqueia pinch-zoom (falha WCAG 1.4.4) |
| todos os 4 | `::-webkit-scrollbar { display: none }` global |
| `jogar` | `alert()` como confirmação de jogo |
| `jogar` | grade de 70 bolas em `h-10` dentro de `grid-cols-7` — alvo de toque fica abaixo de 44px em telas de 360px |

**Decisão:** remover as duas primeiras; `alert()` vira o fluxo real de carrinho;
a grade ganha alvo mínimo de 44px (ajuste de `gap`/colunas, sem mudar o visual).

## 9. Simulações que fingem efeito real

`checkout`: o botão vira "Emitindo Ordem Courier..." e depois "Ordem Registrada
no Terminal!" — puro `setTimeout`, nada acontece.
`meus-bilhetes`: "Salvar Certificado" / "Comprovante" mostram "Salvo!" sem gerar
arquivo.

**Decisão:** ligar ao `create-order` real (que passa pelo Compliance Engine e
para em DEMO quando as transações estão desligadas); os downloads passam a
gerar arquivo de verdade ou somem.

---

## O que NÃO muda

Todo o resto do Stitch é aproveitado como está: paleta, tipografia, escala de
espaçamento, raios, sombras, glows, estrutura de cards, bottom nav, grades de
bolas, estados de seleção, modal de scan, timeline de custódia, discriminação de
valores no checkout. A estética "Nebula Jackpot" fica intacta.
