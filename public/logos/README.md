# Logotipos das modalidades

Coloque aqui o arquivo de cada loteria e aponte `lottery_games.logo_url` para
ele — no modo demonstração, em `src/services/lottery/demoDataset.ts`.

    logoUrl: 'logos/mega-millions.png'

Caminho **relativo**, sem barra na frente. O componente resolve o prefixo em
que o site está servido (`/` em domínio próprio, `/loteranza/` no GitHub
Pages), então o mesmo valor funciona nos dois.

## O que funciona melhor

- **PNG com fundo transparente** ou **SVG**. O herói é quase preto; logotipo
  com fundo branco aparece como um retângulo claro.
- Versão clara da marca, quando existir. A maioria das loterias publica uma
  para fundo escuro.
- Altura útil de 64px no herói, 36px nos cards. Mande em 2x (128px) para não
  serrilhar em tela retina.

Sem `logo_url`, o componente desenha o nome da modalidade na cor da marca —
é o padrão, e continua valendo para quem não tiver arquivo.

## Os arquivos que estão aqui agora são PROVISÓRIOS

Os `.svg` desta pasta foram desenhados para testar o layout, não são os
logotipos oficiais e não os imitam: é um sistema próprio (anel + esfera +
nome) aplicado igual a todas as modalidades, variando só a cor e o texto.

Vieram daqui porque o ambiente onde o projeto é construído bloqueia todo
host externo — não havia como baixar arquivo nenhum.

Regenerar: `node scripts/gen-placeholder-logos.mjs`

Substituir pelos oficiais é trocar o arquivo mantendo o nome; nenhum código
muda. A cor do texto dentro do SVG usa a mesma regra de contraste do
`derivePalette` (ver o comentário no script): com a cor de marca crua,
Powerball dava 4,06:1 e Mega Millions 4,45:1 sobre o card, abaixo do mínimo.

## Antes de publicar com a marca de terceiro

Logotipo de loteria é marca registrada. Usar exige autorização do órgão ou do
licenciador. Enquanto isso não estiver resolvido, o padrão em texto evita o
problema. Ver `design/stitch/CONFORMIDADE.md`, seção 4.
