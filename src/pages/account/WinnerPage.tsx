import { Link, useParams } from 'react-router-dom';
import { PartyPopper, ShieldCheck } from 'lucide-react';
import { useDemoState } from '@/hooks/useDemoState';
import { useGames, usePrizeTiers } from '@/hooks/useLotteryQueries';
import { useLatestResults } from '@/hooks/useLotteryQueries';
import { formatUSD } from '@/lib/format';
import { Seo } from '@/components/common/Seo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/common/states';
import { Confetti } from '@/components/common/Confetti';
import { NumberSequence } from '@/components/lottery/NumberBall';
import { PRIZE_CLAIM_LABELS } from './orderStatus';

/**
 * Pagina "Ganhei" (secao 24).
 *
 * Regras respeitadas aqui:
 *  - Confete APENAS quando o premio esta confirmado (prizeConfirmed).
 *  - Enquanto nao confirmado, o texto deixa claro que a conferencia e
 *    preliminar e que nada foi pago.
 *  - Premios relevantes exibem explicitamente que dependem de revisao humana.
 */
export function WinnerPage() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const demo = useDemoState();
  const gamesQuery = useGames();
  const resultsQuery = useLatestResults(60);

  const ticket = demo.tickets.find((t) => t.id === ticketId);
  const game = (gamesQuery.data ?? []).find((g) => g.id === ticket?.gameId);
  const tiersQuery = usePrizeTiers(ticket?.gameId);
  const claim = demo.prizeClaims.find((c) => c.ticketId === ticketId);
  const result = (resultsQuery.data ?? []).find((r) => r.draw.id === ticket?.drawId);

  if (!ticket) {
    return (
      <div className="container py-16">
        <ErrorState title="Bilhete não encontrado" />
      </div>
    );
  }

  const tier = (tiersQuery.data ?? []).find((t) => t.id === ticket.prizeTierId);
  const confirmed = ticket.prizeConfirmed;

  return (
    <div className="container py-12">
      <Seo title="Bilhete premiado" description="Detalhes do seu bilhete premiado." noIndex />
      <Confetti active={confirmed} />

      <div className="mx-auto max-w-2xl space-y-6">
        <header className="space-y-3 text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-jackpot-soft text-jackpot-foreground">
            <PartyPopper className="size-8" aria-hidden />
          </span>
          <h1 className="text-display-xl font-extrabold">
            Parabéns! Seu bilhete foi premiado.
          </h1>
          <p className="text-muted-foreground">
            {game?.name} · bilhete {ticket.ticketRef}
          </p>
        </header>

        {!confirmed && (
          <div className="notice-strip border-warning/40 bg-warning/10">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <div>
              <p className="font-medium">Conferência preliminar</p>
              <p className="mt-1 text-sm text-muted-foreground">
                A comparação foi feita automaticamente com o resultado recebido, mas o prêmio ainda
                não foi validado junto ao órgão oficial. Nenhum valor foi pago ou é devido até essa
                validação.
              </p>
            </div>
          </div>
        )}

        <section className="surface space-y-5 p-6">
          <div className="space-y-2">
            <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Seus números
            </h2>
            <NumberSequence
              numbers={ticket.numbers}
              specialNumbers={ticket.specialNumbers}
              matchedMain={result?.mainNumbers}
              matchedSpecial={result?.specialNumbers}
            />
          </div>

          {result && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                Números sorteados
              </h2>
              <NumberSequence
                numbers={result.mainNumbers}
                specialNumbers={result.specialNumbers}
              />
            </div>
          )}

          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-4">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Acertos</dt>
              <dd className="tnum mt-1 font-display text-xl font-bold">
                {ticket.matchedMain ?? 0}
                {ticket.specialNumbers.length > 0 && ` + ${ticket.matchedSpecial ?? 0}`}
              </dd>
            </div>
            <div className="rounded-lg border border-border p-4">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Categoria</dt>
              <dd className="mt-1 font-medium">{tier?.label ?? '—'}</dd>
            </div>
            <div className="rounded-lg border border-border p-4 sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Estimativa do prêmio
              </dt>
              <dd className="tnum mt-1 font-display text-2xl font-extrabold">
                {ticket.estimatedPrize !== null ? formatUSD(ticket.estimatedPrize) : 'A confirmar'}
              </dd>
              <p className="mt-2 text-xs text-muted-foreground">
                Valor bruto de referência, antes de retenções e impostos aplicáveis.
              </p>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Status da validação:</span>
            <Badge variant={confirmed ? 'success' : 'warning'}>
              {claim ? PRIZE_CLAIM_LABELS[claim.status] : 'Aguardando validação'}
            </Badge>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-muted/30 p-6">
          <h2 className="font-display text-lg font-semibold">Processo de recebimento</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            O caminho depende do valor e das regras do órgão oficial da loteria. Podem ser exigidos
            documentos, haver retenção de impostos na fonte e, em alguns casos, ser necessário
            comparecimento presencial. Prêmios relevantes passam por revisão humana e dupla
            aprovação antes de qualquer pagamento — não há pagamento automático.
          </p>
          <p className="mt-3 text-sm font-medium">[CONTEÚDO A SER VALIDADO POR ADVOGADO]</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/legal/resgate-de-premios">Ver processo de recebimento</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/meus-jogos/${ticket.orderId}`}>Ver pedido</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
