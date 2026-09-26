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

## Antes de publicar com a marca de terceiro

Logotipo de loteria é marca registrada. Usar exige autorização do órgão ou do
licenciador. Enquanto isso não estiver resolvido, o padrão em texto evita o
problema. Ver `design/stitch/CONFORMIDADE.md`, seção 4.
