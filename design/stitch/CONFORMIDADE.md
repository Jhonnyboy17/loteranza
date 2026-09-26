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

## 10. Correções de contraste

A paleta do Stitch é boa: auditada par a par, passa em AA quase toda. Três
**usos** falham — a cor em si não foi alterada em nenhum dos casos, só o lugar
onde ela é aplicada.

| Uso no Stitch | Medido | Correção | Depois |
|---|---|---|---|
| `text-outline` sobre `surface-container-highest` sólido (selo "Não Premiado") | 3,91 | `text-on-surface-variant` | 8,36 |
| `text-outline-variant` como cor de TEXTO ("CONCURSO #2581", "Limpar", "Scan Auditado") | 1,75-2,05 | `text-outline` — no M3 `outline-variant` é cor de divisória, não de texto | 5,19-6,10 |
| `text-on-primary` sobre `bg-primary-container` (botão "Ver Scan HD") | 4,14 | `text-on-primary-fixed`, mesmo fundo violeta | 5,40 |

Três outras falhas apareceram só depois, medindo a página renderizada, e são
de integração — não vieram do Stitch:

- `<GameTheme>` sobrescrevia `--primary-foreground`, que deixou de existir na
  migração de tokens. O botão tingido ficava com o violeta-escuro da
  plataforma sobre o vermelho da Powerball (3,29) e o azul da Mega Millions
  (3,63). Passou a sobrescrever `--on-primary`.
- Selos e contadores tingidos usavam `--primary`, que é calibrada para servir
  de FUNDO. Para texto sobre superfície escura o token é `--game-bright`
  (3,12-3,31 -> acima de 4,5).
- Um `var(--primary-foreground)` inline sobrou em `GameRow` e não resolvia,
  deixando o texto herdado quase branco sobre o azul (2,79).

Estado atual: contraste medido no navegador em 15 rotas, nenhuma falha AA.

## 11. Ícones

O Stitch carrega Material Symbols do Google Fonts. É uma fonte de ícones por
ligadura: quando a CDN falha, cada ícone vira a palavra literal — um
`account_balance_wallet` de 20px vira uma frase e o layout quebra. E a CDN
falha mesmo: no ambiente onde este protótipo foi testado o Google Fonts está
bloqueado.

`src/components/ui/icon.tsx` mapeia os mesmos nomes do Stitch para o
lucide-react, que já está no bundle. Os glifos diferem um pouco (lucide é mais
arredondado); o tamanho, o peso e o significado são os mesmos. Um ícone que
sempre aparece vale mais que um pixel-perfect que some.

Uma troca de conteúdo: `casino` (dado de cassino) virou `home` na aba
"Início" — o briefing pede estética fintech, explicitamente não de cassino.

## 12. Densidade da grade de números

O Stitch usa `grid-cols-7` com bolas de 40px. A 360px de largura isso dá 35px
por alvo. A grade aqui mantém `auto-fill minmax(2.75rem, 1fr)`: garante 44px
de alvo e escolhe sozinha o número de colunas — 6 a 360px, mais conforme a
tela cresce. O resultado visual é praticamente o mesmo em telas de 390px para
cima, com alvo maior no pior caso.

---

## O que NÃO muda

Todo o resto do Stitch é aproveitado como está: paleta, tipografia, escala de
espaçamento, raios, sombras, glows, estrutura de cards, bottom nav, grades de
bolas, estados de seleção, timeline de custódia, discriminação de valores no
checkout. A estética "Nebula Jackpot" fica intacta.

---

## Estado

Todos os itens acima estão aplicados. As quatro telas foram convertidas:

| Tela do Stitch | Onde vive agora |
|---|---|
| `inicio/` | `src/pages/public/HomePage.tsx` + `JackpotHero`, `GameRow`, `ResultRow`, `TrustStrip` |
| `jogar/` | `src/components/lottery/NumberPicker.tsx` (etapa 1 de `LotteryDetailPage`) |
| `meus-bilhetes/` | `src/components/account/OrderCard.tsx` + `MyGamesPage` |
| `checkout/` | `src/pages/public/CheckoutPage.tsx` |

A casca (cabeçalho fixo + barra de abas) está em `src/components/layout/`.
