import { Link } from 'react-router-dom';
import type { LotteryGame, Order, OrderStatus } from '@/types/domain';
import { formatDate, formatUSD } from '@/lib/format';
import { NumberBall } from '@/components/lottery/NumberBall';
import { GameTheme } from '@/components/lottery/GameTheme';
import { Sym } from '@/components/ui/icon';
import { ORDER_STATUS_LABELS, ORDER_TIMELINE } from '@/pages/account/orderStatus';
import { cn } from '@/lib/utils';

/**
 * Cartão de pedido, no desenho de design/stitch/meus-bilhetes/code.html.
 *
 * Mantém do Stitch: cartão com selo de estado, faixa de números sobre fundo
 * rebaixado, botões de ação lado a lado e a linha do tempo de custódia em
 * barras no rodapé.
 *
 * O que NÃO veio, e por quê (design/stitch/CONFORMIDADE.md):
 *
 *  - "Gaveta Blindada #A-108", "Illinois Vault #12", "Terminal 4410-A",
 *    "Courier ID #7728": a posição física do bilhete não é mostrada ao
 *    cliente. Isso não é detalhe de layout, é a decisão que já está na RLS
 *    (`ticket_vault` é vault_staff_only): se vaza a posição, vaza o alvo. O
 *    cliente vê o ESTADO da custódia, não onde o papel está.
 *  - "100% Blindado": o briefing proíbe "100%" e "garantido".
 *  - "Garantia Notarial Courier": não existe cartório envolvido.
 *  - contagem regressiva fixa em JS: some; o prazo real vem do pedido.
 *
 * A linha do tempo usa ORDER_TIMELINE, que já era a sequência canônica do
 * sistema — não uma sequência inventada para a tela.
 */

/** Rótulos curtos o bastante para caber sob as barras a 360px. */
const STEP_LABELS: Partial<Record<OrderStatus, string>> = {
  paid: 'Pago',
  awaiting_purchase: 'Fila',
  purchased: 'Emitido',
  verified: 'Conferido',
  awaiting_draw: 'Sorteio',
};

const TONE: Record<string, string> = {
  jackpot: 'bg-secondary/15 text-secondary',
  success: 'bg-tertiary/15 text-tertiary',
  danger: 'bg-error/15 text-error',
  warning: 'bg-secondary/15 text-secondary',
  neutral: 'bg-surface-container-highest text-on-surface-variant',
  default: 'bg-primary/15 text-primary-fixed',
};

export function OrderCard({
  order,
  game,
  tone,
}: {
  order: Order;
  game: LotteryGame | undefined;
  tone: keyof typeof TONE;
}) {
  const reached = ORDER_TIMELINE.indexOf(order.status);
  const isWinner = order.status === 'winner' || order.status === 'paid_out';
  const isClosed = ['cancelled', 'refunded'].includes(order.status);
  const preview = order.lines.slice(0, 2);

  const card = (
    <article className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-md shadow-card">
      {/* ---- cabeçalho ------------------------------------------------- */}
      <div className="flex items-start justify-between gap-space-sm">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-high"
            style={{ color: 'hsl(var(--game-bright, var(--primary)))' }}
          >
            <Sym name={isWinner ? 'emoji_events' : 'confirmation_number'} size={18} />
          </span>
          <div className="flex min-w-0 flex-col">
            <span
              className="truncate font-display text-label-lg font-bold uppercase tracking-wider"
              style={{ color: 'hsl(var(--game-bright, var(--primary)))' }}
            >
              {game?.name ?? 'Pedido'}
            </span>
            <span className="truncate font-label-xs text-label-xs text-outline">
              {order.orderNumber} · {formatDate(order.createdAt)}
            </span>
          </div>
        </div>

        {/* Rótulos como "Em análise de compliance" são longos; o selo quebra
            em duas linhas em vez de espremer o nome da modalidade. */}
        <span
          className={cn(
            'max-w-[46%] shrink-0 whitespace-normal rounded-xl px-2.5 py-1 text-right font-label-xs text-label-xs font-bold uppercase leading-tight tracking-wide',
            TONE[tone] ?? TONE.neutral,
          )}
        >
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      {/* ---- números ---------------------------------------------------- */}
      <div className="flex flex-col gap-1.5 rounded-lg bg-surface-container-lowest/60 p-2">
        {preview.map((line) => (
          <div key={line.id} className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {line.numbers.map((n, i) => (
                <NumberBall key={`m-${line.id}-${i}`} value={n} size="xs" tone="main" />
              ))}
            </div>
            {line.specialNumbers.length > 0 && (
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="max-w-[4.5rem] truncate font-label-xs text-label-xs uppercase text-outline">
                  {game?.specialNumberLabel ?? 'Especial'}
                </span>
                {line.specialNumbers.map((n, i) => (
                  <NumberBall key={`s-${line.id}-${i}`} value={n} size="xs" tone="special" />
                ))}
              </div>
            )}
          </div>
        ))}
        {order.lines.length > preview.length && (
          <p className="px-1 font-label-xs text-label-xs text-outline">
            + {order.lines.length - preview.length}{' '}
            {order.lines.length - preview.length === 1 ? 'jogo' : 'jogos'}
          </p>
        )}
      </div>

      {/* ---- total + detalhes ------------------------------------------- */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-label-xs text-label-xs text-outline">
          {order.lines.length} {order.lines.length === 1 ? 'jogo' : 'jogos'}
          {order.drawsCount > 1 ? ` · ${order.drawsCount} sorteios` : ''}
        </span>
        <span className="font-display text-headline-sm font-bold tabular-nums text-on-surface">
          {formatUSD(order.total)}
        </span>
      </div>

      {/* ---- linha do tempo da custódia ----------------------------------
          Estado, não localização: onde o bilhete está guardado é informação
          restrita à equipe do cofre (RLS vault_staff_only). */}
      {!isClosed && (
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-between font-label-xs text-label-xs text-outline">
            <span>Custódia do bilhete</span>
            <span className="flex items-center gap-1 text-tertiary">
              <Sym name="shield_lock" size={12} />
              {reached >= 3 ? 'Sob custódia' : 'Em processamento'}
            </span>
          </div>
          <ol className="grid grid-cols-5 gap-2">
            {ORDER_TIMELINE.map((step, index) => {
              const done = reached >= index;
              return (
                <li key={step} className="flex flex-col items-center gap-1 text-center">
                  <span
                    aria-hidden
                    className={cn(
                      'h-1.5 w-full rounded-full',
                      done ? 'bg-secondary' : 'bg-surface-container-highest',
                    )}
                  />
                  <span
                    className={cn(
                      'font-display text-[0.625rem] font-semibold leading-tight tracking-normal',
                      done ? 'text-on-surface' : 'text-outline',
                    )}
                  >
                    {STEP_LABELS[step]}
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="sr-only">
            Etapa atual: {ORDER_STATUS_LABELS[order.status]}.
          </p>
        </div>
      )}

      <Link
        to={`/meus-jogos/${order.id}`}
        className="touch-target flex items-center justify-center gap-2 rounded-lg bg-surface-container-highest font-label-lg text-label-lg font-bold text-primary-fixed transition-colors hover:bg-surface-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Sym name="receipt_long" size={18} />
        Ver detalhes do pedido
      </Link>
    </article>
  );

  return game ? <GameTheme game={game}>{card}</GameTheme> : card;
}
