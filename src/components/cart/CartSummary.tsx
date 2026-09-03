import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import type { CartTotals } from '@/types/domain';
import { formatBRL, formatDateTime, formatUSD } from '@/lib/format';
import { env } from '@/config/env';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

/**
 * Resumo de compra.
 *
 * Regra de transparencia (secao 9 e 54): preco oficial e taxa da plataforma
 * aparecem SEMPRE em linhas separadas, com o mesmo peso visual. Nao existe
 * "taxa" embutida no preco nem revelada apenas no ultimo passo.
 */
export function CartSummary({
  totals,
  gameName,
  drawsCount,
  actionLabel = 'Adicionar ao carrinho',
  onAction,
  actionDisabled,
  actionHref,
  footer,
  className,
}: {
  totals: CartTotals;
  gameName?: string;
  drawsCount?: number;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  actionHref?: string;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('surface space-y-4 p-5', className)}>
      <div className="space-y-1">
        <h2 className="font-display text-base font-semibold">Resumo</h2>
        {gameName && (
          <p className="text-sm text-muted-foreground">
            {gameName} · {totals.lineCount} {totals.lineCount === 1 ? 'jogo' : 'jogos'}
            {drawsCount ? ` · ${drawsCount} ${drawsCount === 1 ? 'sorteio' : 'sorteios'}` : ''}
          </p>
        )}
      </div>

      <dl className="space-y-2.5 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">Valor oficial das apostas</dt>
          <dd className="tnum font-medium">{formatUSD(totals.officialCost)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">Taxa de serviço da plataforma</dt>
          <dd className="tnum font-medium">{formatUSD(totals.serviceFee)}</dd>
        </div>

        <Separator />

        <div className="flex items-baseline justify-between gap-4">
          <dt className="font-semibold">Total</dt>
          <dd className="tnum font-display text-xl font-bold">{formatUSD(totals.total)}</dd>
        </div>
      </dl>

      {totals.totalDisplay !== null && totals.exchangeRate !== null ? (
        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          <p className="flex items-baseline justify-between gap-4">
            <span className="text-muted-foreground">Estimativa em reais</span>
            <span className="tnum font-semibold">≈ {formatBRL(totals.totalDisplay)}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Cotação utilizada: US$ 1 ={' '}
            {new Intl.NumberFormat('pt-BR', {
              minimumFractionDigits: 2, maximumFractionDigits: 4,
            }).format(totals.exchangeRate)}{' '}
            · {formatDateTime(totals.exchangeRateAt)}
            {totals.exchangeRateSource === 'demo-dataset' && ' · demonstrativa'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            O valor em reais é uma estimativa. A cobrança oficial é em dólar.
          </p>
        </div>
      ) : (
        <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
          Cotação indisponível no momento — a estimativa em reais não é exibida.
        </p>
      )}

      {actionHref ? (
        <Button asChild size="lg" block disabled={actionDisabled}>
          <Link to={actionHref}>{actionLabel}</Link>
        </Button>
      ) : (
        <Button size="lg" block onClick={onAction} disabled={actionDisabled}>
          {actionLabel}
        </Button>
      )}

      {!env.transactionsEnabled && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          Modo demonstração: nenhum valor é cobrado e nenhum bilhete é adquirido.
        </p>
      )}

      {footer}
    </div>
  );
}
