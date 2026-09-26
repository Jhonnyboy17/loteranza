import { Sym, type IconName } from '@/components/ui/icon';

/**
 * Trio de micro-selos do rodapé da tela inicial do Stitch
 * (design/stitch/inicio/code.html).
 *
 * O Stitch escreveu "Terminal Oficial", "Scan HD Real" e "Cofre EUA" — os três
 * afirmam uma operação licenciada nos EUA que não existe. Trocados por três
 * capacidades que a plataforma realmente tem e que dá para apontar no código:
 *
 *  - preço oficial e taxa em linhas separadas  -> src/services/pricing.ts
 *  - imagem do bilhete anexada ao pedido       -> tabela ticket_images
 *  - conferência automática do resultado       -> compare_all_tickets()
 *
 * Mesma forma, mesmo peso visual, sem alegação de licença.
 */
const ITEMS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'payments',
    title: 'Preço aberto',
    body: 'Valor oficial e taxa sempre em linhas separadas',
  },
  {
    icon: 'document_scanner',
    title: 'Bilhete digitalizado',
    body: 'A imagem do bilhete fica anexada ao pedido',
  },
  {
    icon: 'done_all',
    title: 'Conferência automática',
    body: 'Seus números são comparados assim que sai o resultado',
  },
];

export function TrustStrip() {
  return (
    <ul className="grid grid-cols-1 gap-space-sm sm:grid-cols-3">
      {ITEMS.map((item) => (
        <li
          key={item.title}
          className="flex items-start gap-space-sm rounded-xl bg-surface-container-low p-space-sm shadow-soft"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sym name={item.icon} size={18} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-label-md text-label-md font-semibold text-on-surface">
              {item.title}
            </span>
            <span className="font-body-sm text-body-sm leading-tight text-outline">{item.body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
