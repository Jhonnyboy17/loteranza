import { Link } from 'react-router-dom';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { formatUSD } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/states';
import { NumberSequence } from '@/components/lottery/NumberBall';
import {
  Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';

/** Carrinho como drawer — comportamento principal no mobile. */
export function CartDrawer() {
  const { items, totals, isOpen, setOpen, removeLine, removeItem } = useCart();

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetContent side="right" className="gap-0 p-0">
        <SheetHeader>
          <SheetTitle>Seu carrinho</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {totals.lineCount} {totals.lineCount === 1 ? 'jogo' : 'jogos'}
          </p>
        </SheetHeader>

        <SheetBody className="py-5">
          {items.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="Seu carrinho está vazio"
              description="Escolha uma loteria e monte seus jogos para começar."
              action={
                <Button asChild onClick={() => setOpen(false)}>
                  <Link to="/loterias">Ver loterias</Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li key={item.id} className="rounded-xl border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display font-semibold">{item.gameName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.lines.length} {item.lines.length === 1 ? 'jogo' : 'jogos'} ·{' '}
                        {item.drawsCount} {item.drawsCount === 1 ? 'sorteio' : 'sorteios'}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remover todos os jogos de ${item.gameName}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>

                  <ul className="mt-3 space-y-2">
                    {item.lines.map((line, index) => (
                      <li key={line.id} className="flex items-center justify-between gap-2">
                        <NumberSequence
                          numbers={line.numbers}
                          specialNumbers={line.specialNumbers}
                          size="xs"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeLine(item.id, line.id)}
                          aria-label={`Remover jogo ${index + 1}`}
                        >
                          <Trash2 className="size-4" aria-hidden />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </SheetBody>

        {items.length > 0 && (
          <SheetFooter className="space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="tnum font-display text-xl font-bold">{formatUSD(totals.total)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Inclui {formatUSD(totals.serviceFee)} de taxa de serviço.
            </p>
            <Button asChild size="lg" block onClick={() => setOpen(false)}>
              <Link to="/carrinho">Ver carrinho completo</Link>
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
