# Export do Google Stitch — "Nebula Jackpot"

Arquivos originais gerados pelo Google Stitch, salvos **sem nenhuma alteração**
(byte a byte iguais ao export do Drive). Servem como referência visual para a
conversão em React. Não são build da aplicação e não entram no bundle.

| Pasta | Arquivo | Bytes | Tela |
|---|---|---|---|
| `_sistema/` | `DESIGN.md` | 12232 | Design system (tokens, tipografia, grid, estados) |
| `inicio/` | `code.html` | 21783 | Home — jackpot em destaque + loterias disponíveis |
| `jogar/` | `code.html` | 29295 | Seleção de números Mega Millions (70 + 25 + Megaplier) |
| `meus-bilhetes/` | `code.html` | 27897 | Meus bilhetes — custódia, scan HD, histórico |
| `checkout/` | `code.html` | 19953 | Checkout — discriminação de valores + pagamento |

## Design system efetivo

O `tailwind.config` inline dentro dos HTMLs é a fonte de verdade. O front-matter
YAML do `DESIGN.md` contradiz tanto a prosa do próprio arquivo quanto os HTMLs —
**os HTMLs vencem**. As quatro telas usam exatamente o mesmo config:

```
background/surface   #11131e     surface-container-lowest #0b0e18
surface-container-low #191b26    surface-container        #1d1f2a
surface-container-high #272935   surface-container-highest #323440
primary              #d0bcff     primary-container        #a078ff
on-primary           #3c0091     primary-fixed            #e9ddff
secondary (ouro)     #ffe083     secondary-container      #eec200
on-secondary         #3c2f00     on-secondary-fixed       #231b00
tertiary (ciano)     #4cd7f6     tertiary-container       #009eb9
on-surface           #e1e1f1     on-surface-variant       #cbc3d7
outline              #958ea0     outline-variant          #494454
error                #ffb4ab     error-container          #93000a
```

Fontes: **Outfit** (display/headline/label/ball-number) e **Inter** (body).
Ícones: Material Symbols Outlined.

## Pontos que NÃO podem ser convertidos como estão

Ver `CONFORMIDADE.md` nesta pasta. O Stitch gerou vários elementos que violam as
regras que você mesmo definiu (contadores falsos, "100%", alegações de licença,
marca de terceiros). A conversão troca cada um por equivalente honesto e
orientado a dados — o visual permanece.
