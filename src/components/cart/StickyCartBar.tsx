import { formatUSD } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Barra fixa inferior no mobile (secao 48). Mostra quantidade e total, com um
 * unico alvo grande para o polegar.
 */
export function StickyCartBar({
  lineCount,
  total,
  actionLabel,
  onAction,
  disabled,
  className,
}: {
  lineCount: number;
  total: number;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  className?: string;
}) {
  if (lineCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 shadow-lift',
        'backdrop-blur safe-bottom lg:hidden',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {lineCount} {lineCount === 1 ? 'jogo' : 'jogos'}
          </p>
          <p className="tnum text-sm text-muted-foreground">{formatUSD(total)}</p>
        </div>
        <Button size="lg" className="ml-auto flex-1" onClick={onAction} disabled={disabled}>
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}
