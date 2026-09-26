import { Sym, type IconName } from '@/components/ui/icon';

/**
 * Trio de micro-selos do rodapé da tela inicial do Stitch
 * (design/stitch/inicio/code.html): grade de três colunas, ícone grande em
 * cima, rótulo curto embaixo, tudo centralizado, card translúcido com fio de
 * borda. Formato preservado.
 *
 * O texto não: o Stitch escreveu "Terminal Oficial", "Scan HD Real" e "Cofre
 * EUA", e os três afirmam uma operação licenciada nos EUA que não existe.
 * Trocados por três capacidades reais, cada uma apontável no código:
 *
 *  - preço oficial e taxa em linhas separadas  -> src/services/pricing.ts
 *  - imagem do bilhete anexada ao pedido       -> tabela ticket_images
 *  - conferência automática do resultado       -> compare_all_tickets()
 */
const ITEMS: { icon: IconName; title: string; tint: string }[] = [
  { icon: 'payments', title: 'Preço aberto', tint: 'text-secondary' },
  { icon: 'document_scanner', title: 'Bilhete digitalizado', tint: 'text-tertiary' },
  { icon: 'done_all', title: 'Conferência automática', tint: 'text-primary' },
];

export function TrustStrip() {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {ITEMS.map((item) => (
        <li
          key={item.title}
          className="flex flex-col items-center gap-1.5 rounded-xl border border-on-surface/[0.06] bg-surface-container/60 p-3 text-center"
        >
          <Sym name={item.icon} size={22} className={item.tint} />
          <span className="font-display text-[0.6875rem] font-bold leading-tight text-on-surface">
            {item.title}
          </span>
        </li>
      ))}
    </ul>
  );
}
