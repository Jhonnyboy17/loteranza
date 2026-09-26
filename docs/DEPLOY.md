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

### Primeira execução

O workflow usa `actions/configure-pages` com `enablement: true`, que liga o
Pages sozinho. Se a organização bloquear isso, ligue à mão uma vez em
**Settings → Pages → Source: GitHub Actions** e rode o workflow de novo.

## Sair do modo demonstração

Ordem recomendada:

1. Criar o projeto Supabase e aplicar as migrations de `supabase/migrations/`.
2. Publicar as Edge Functions de `supabase/functions/`.
3. Definir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` — só com as duas o
   app sai do provider de demonstração.
4. Habilitar uma jurisdição em `jurisdiction_rules` (portão 3).
5. Ligar `system_settings.transactions_enabled` (portão 2).
6. Só então `VITE_TRANSACTIONS_ENABLED=true` (portão 1).

Os três portões são independentes de propósito. Nenhum deles sozinho libera
uma compra: a decisão final é sempre do `evaluate_compliance()`, no servidor.

Antes do passo 6, revise `design/stitch/CONFORMIDADE.md` e valide juridicamente
todo texto marcado com `[CONTEÚDO A SER VALIDADO POR ADVOGADO]`.
