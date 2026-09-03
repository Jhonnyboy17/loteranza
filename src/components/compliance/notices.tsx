import { AlertTriangle, Info, MapPin, ShieldCheck } from 'lucide-react';
import type { ComplianceVerdict, JurisdictionRule } from '@/types/domain';
import { CHECK_LABELS } from '@/services/compliance/engine';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Faixa de modo demonstracao. Enquanto TRANSACTIONS_ENABLED for false, esta
 * faixa aparece em todas as paginas: o usuario nunca deve ser levado a acreditar
 * que fez uma compra.
 */
export function DemoModeBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'notice-strip border-warning/40 bg-warning/10 text-foreground',
        className,
      )}
      role="status"
    >
      <Info className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <p>
        <strong className="font-semibold">Modo demonstração.</strong>{' '}
        Jackpots, resultados e pedidos exibidos aqui são dados de exemplo. Nenhuma compra é
        processada e nenhum pagamento é cobrado.
      </p>
    </div>
  );
}

/** Aviso de jurisdicao. Nunca sugere contornar a restricao. */
export function JurisdictionNotice({
  jurisdiction,
  detectedLabel,
  className,
}: {
  jurisdiction: JurisdictionRule | null;
  detectedLabel?: string | null;
  className?: string;
}) {
  const allowed = jurisdiction?.transactionsEnabled ?? false;

  return (
    <div
      className={cn(
        'notice-strip',
        allowed
          ? 'border-success/30 bg-success/5'
          : 'border-border bg-muted/40',
        className,
      )}
      role="status"
    >
      <MapPin
        className={cn('mt-0.5 size-5 shrink-0', allowed ? 'text-success' : 'text-muted-foreground')}
        aria-hidden
      />
      <div className="space-y-1">
        {/* Quando a jurisdição define um aviso próprio, ele é a mensagem
            principal — evita repetir a mesma frase em dois parágrafos. */}
        <p className="font-medium">
          {allowed
            ? 'Compras disponíveis na sua localização.'
            : (jurisdiction?.legalNotice ??
               'Atualmente não podemos aceitar compras a partir da sua localização.')}
        </p>
        {!allowed && (
          <p className="text-muted-foreground">
            Você continua podendo consultar jackpots, ver resultados, conferir números e
            criar alertas normalmente.
          </p>
        )}
        {detectedLabel && (
          <p className="text-xs text-muted-foreground">Localização considerada: {detectedLabel}</p>
        )}
      </div>
    </div>
  );
}

/** Lista das verificacoes do Compliance Engine, com o motivo de cada falha. */
export function ComplianceChecklist({
  verdict,
  className,
}: {
  verdict: ComplianceVerdict;
  className?: string;
}) {
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-primary" aria-hidden />
        <h3 className="font-display text-base font-semibold">Verificações de elegibilidade</h3>
        <StatusBadge status={verdict.status} />
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {verdict.checks.map((check) => (
          <li key={check.kind} className="flex items-start gap-3 bg-card p-4">
            <span
              aria-hidden
              className={cn(
                'mt-0.5 size-2.5 shrink-0 rounded-full',
                check.passed ? 'bg-success' : 'bg-warning',
              )}
            />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm font-medium">{CHECK_LABELS[check.kind]}</p>
              <p className="text-sm text-muted-foreground">{check.reasonMessage}</p>
            </div>
            <span className="sr-only">{check.passed ? 'Aprovado' : 'Pendente'}</span>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        A verificação definitiva é feita no servidor no momento do pagamento. Este resumo serve
        para você saber o que falta antes de continuar.
      </p>
    </div>
  );
}

export function StatusBadge({ status }: { status: ComplianceVerdict['status'] }) {
  const map = {
    APPROVED: { variant: 'success' as const, label: 'Aprovado' },
    PENDING_REVIEW: { variant: 'warning' as const, label: 'Em análise' },
    REJECTED: { variant: 'danger' as const, label: 'Recusado' },
    BLOCKED: { variant: 'danger' as const, label: 'Bloqueado' },
    NOT_EVALUATED: { variant: 'neutral' as const, label: 'Não avaliado' },
  };
  const { variant, label } = map[status];
  return <Badge variant={variant}>{label}</Badge>;
}

/** Bloco exibido no lugar do botao de pagamento quando a compra nao e possivel. */
export function TransactionsDisabledNotice({
  message,
  className,
}: {
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('notice-strip border-border bg-muted/50', className)}
      role="status"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">
          {message ?? 'Compra ainda não disponível na sua região.'}
        </p>
        <p className="text-sm text-muted-foreground">
          Assim que a operação for habilitada para a sua localização, esta etapa fica disponível
          automaticamente. Seus jogos permanecem salvos.
        </p>
      </div>
    </div>
  );
}
