import { useCountdown, type CountdownParts } from '@/hooks/useCountdown';
import { cn } from '@/lib/utils';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Texto acessível: "faltam 2 dias, 4 horas e 12 minutos". */
function describe(parts: CountdownParts): string {
  if (parts.expired) return 'Prazo encerrado.';
  const chunks: string[] = [];
  if (parts.days) chunks.push(`${parts.days} ${parts.days === 1 ? 'dia' : 'dias'}`);
  if (parts.hours) chunks.push(`${parts.hours} ${parts.hours === 1 ? 'hora' : 'horas'}`);
  if (parts.minutes) chunks.push(`${parts.minutes} ${parts.minutes === 1 ? 'minuto' : 'minutos'}`);
  if (chunks.length === 0) chunks.push(`${parts.seconds} segundos`);
  return `Faltam ${chunks.join(', ')}.`;
}

export function Countdown({
  target,
  label,
  variant = 'blocks',
  expiredLabel = 'Encerrado',
  className,
}: {
  target: string | Date | null | undefined;
  label?: string;
  variant?: 'blocks' | 'inline';
  expiredLabel?: string;
  className?: string;
}) {
  const parts = useCountdown(target);
  if (!parts) return null;

  if (parts.expired) {
    return (
      <p className={cn('text-sm font-medium text-muted-foreground', className)}>{expiredLabel}</p>
    );
  }

  if (variant === 'inline') {
    return (
      <span className={cn('tnum text-sm font-semibold', className)}>
        <span className="sr-only">{describe(parts)}</span>
        <span aria-hidden>
          {parts.days > 0 && `${parts.days}d `}
          {pad(parts.hours)}:{pad(parts.minutes)}:{pad(parts.seconds)}
        </span>
      </span>
    );
  }

  const blocks = [
    { value: parts.days, label: parts.days === 1 ? 'dia' : 'dias' },
    { value: parts.hours, label: 'h' },
    { value: parts.minutes, label: 'min' },
    { value: parts.seconds, label: 's' },
  ];

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      )}
      <div className="flex items-center gap-1.5" role="timer" aria-live="off">
        <span className="sr-only">{describe(parts)}</span>
        {blocks.map((block, i) => (
          <div key={block.label} className="flex items-center gap-1.5" aria-hidden>
            <div className="flex min-w-[2.75rem] flex-col items-center rounded-lg bg-muted px-2 py-1.5">
              <span className="tnum font-display text-lg font-bold leading-none">
                {pad(block.value)}
              </span>
              <span className="mt-0.5 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
                {block.label}
              </span>
            </div>
            {i < blocks.length - 1 && <span className="text-muted-foreground">:</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
