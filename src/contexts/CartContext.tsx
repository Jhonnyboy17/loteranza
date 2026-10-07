import * as React from 'react';
import type { CartItem, CartTotals, ExchangeRate, GameLine, LotteryGame } from '@/types/domain';
import { calculateCartTotals } from '@/services/pricing';
import { getExchangeRate } from '@/services/exchange/exchangeService';

/**
 * Carrinho.
 *
 * Fica no dispositivo do usuario (localStorage) enquanto o pedido nao existe no
 * servidor. Os precos guardados aqui servem apenas para o resumo em tela; o
 * valor cobrado e sempre o recalculado no servidor no momento do checkout
 * (calculate_order_totals). Se houver divergencia, vale o servidor.
 */

const STORAGE_KEY = 'jackpot-usa:cart:v1';

interface CartContextValue {
  items: CartItem[];
  totals: CartTotals;
  rate: ExchangeRate | null;
  itemCount: number;
  lineCount: number;
  isOpen: boolean;
  setOpen: (open: boolean) => void;

  addItem: (game: LotteryGame, lines: Omit<GameLine, 'id'>[], drawId: string | null, drawsCount: number) => void;
  addLinesToItem: (itemId: string, lines: Omit<GameLine, 'id'>[]) => void;
  removeLine: (itemId: string, lineId: string) => void;
  duplicateLine: (itemId: string, lineId: string) => void;
  removeItem: (itemId: string) => void;
  setDrawsCount: (itemId: string, drawsCount: number) => void;
  /**
   * Aponta o item para outro sorteio.
   *
   * O carrinho vive no localStorage e guarda o `drawId` do momento em que o
   * jogo foi montado. Sorteio fecha vendas; carrinho esquecido de um dia para
   * o outro aponta para sorteio morto, e o servidor recusa com `sales_closed`
   * — corretamente. Isto existe para a tela poder trocar o sorteio depois de
   * DIZER qual era e qual passa a ser, nunca em silêncio: a pessoa escolheu
   * aquele sorteio.
   */
  setItemDraw: (itemId: string, drawId: string | null) => void;
  clear: () => void;
}

const CartContext = React.createContext<CartContextValue | null>(null);

function loadItems(): CartItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

function newLine(line: Omit<GameLine, 'id'>): GameLine {
  return { ...line, id: `line-${crypto.randomUUID()}` };
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<CartItem[]>(loadItems);
  const [rate, setRate] = React.useState<ExchangeRate | null>(null);
  const [isOpen, setOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Sem persistencia disponivel: o carrinho segue apenas na memoria.
    }
  }, [items]);

  React.useEffect(() => {
    let active = true;
    getExchangeRate()
      .then((value) => { if (active) setRate(value); })
      .catch(() => { if (active) setRate(null); });
    return () => { active = false; };
  }, []);

  const addItem = React.useCallback<CartContextValue['addItem']>(
    (game, lines, drawId, drawsCount) => {
      if (lines.length === 0) return;
      setItems((current) => {
        // Agrupa por modalidade + sorteio + quantidade de sorteios.
        const existing = current.find(
          (item) => item.gameId === game.id && item.drawId === drawId && item.drawsCount === drawsCount,
        );

        if (existing) {
          const room = game.maxLinesPerOrder - existing.lines.length;
          const accepted = lines.slice(0, Math.max(0, room)).map(newLine);
          if (accepted.length === 0) return current;
          return current.map((item) =>
            item.id === existing.id ? { ...item, lines: [...item.lines, ...accepted] } : item,
          );
        }

        const accepted = lines.slice(0, game.maxLinesPerOrder).map(newLine);
        const item: CartItem = {
          id: `cart-${crypto.randomUUID()}`,
          gameId: game.id,
          gameKey: game.gameKey,
          gameName: game.name,
          drawId,
          drawsCount,
          lines: accepted,
          unitOfficialPrice: game.officialPrice,
          unitServiceFee: game.serviceFee + game.officialPrice * game.serviceFeePercent,
          multiplierPrice: game.multiplierPrice,
          currency: game.currency,
          addedAt: new Date().toISOString(),
        };
        return [...current, item];
      });
    },
    [],
  );

  const addLinesToItem = React.useCallback<CartContextValue['addLinesToItem']>((itemId, lines) => {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, lines: [...item.lines, ...lines.map(newLine)] } : item,
      ),
    );
  }, []);

  const removeLine = React.useCallback<CartContextValue['removeLine']>((itemId, lineId) => {
    setItems((current) =>
      current
        .map((item) =>
          item.id === itemId ? { ...item, lines: item.lines.filter((l) => l.id !== lineId) } : item,
        )
        // Item sem nenhuma linha deixa de existir.
        .filter((item) => item.lines.length > 0),
    );
  }, []);

  const duplicateLine = React.useCallback<CartContextValue['duplicateLine']>((itemId, lineId) => {
    setItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;
        const source = item.lines.find((l) => l.id === lineId);
        if (!source) return item;
        return { ...item, lines: [...item.lines, newLine({ ...source })] };
      }),
    );
  }, []);

  const removeItem = React.useCallback<CartContextValue['removeItem']>((itemId) => {
    setItems((current) => current.filter((item) => item.id !== itemId));
  }, []);

  const setDrawsCount = React.useCallback<CartContextValue['setDrawsCount']>((itemId, drawsCount) => {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, drawsCount } : item)),
    );
  }, []);

  const setItemDraw = React.useCallback<CartContextValue['setItemDraw']>((itemId, drawId) => {
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, drawId } : item)),
    );
  }, []);

  const clear = React.useCallback(() => setItems([]), []);

  const totals = React.useMemo(() => calculateCartTotals(items, rate), [items, rate]);
  const lineCount = React.useMemo(
    () => items.reduce((sum, item) => sum + item.lines.length, 0),
    [items],
  );

  const value = React.useMemo<CartContextValue>(
    () => ({
      items, totals, rate, itemCount: items.length, lineCount, isOpen, setOpen,
      addItem, addLinesToItem, removeLine, duplicateLine, removeItem, setDrawsCount,
      setItemDraw, clear,
    }),
    [items, totals, rate, lineCount, isOpen, addItem, addLinesToItem, removeLine,
     duplicateLine, removeItem, setDrawsCount, setItemDraw, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = React.useContext(CartContext);
  if (!context) throw new Error('useCart precisa estar dentro de <CartProvider>.');
  return context;
}
