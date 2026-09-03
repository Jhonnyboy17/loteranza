import { brand } from '@/config/brand';
import { cn } from '@/lib/utils';

/**
 * Marca ORIGINAL. Nao reproduz, imita nem deriva de identidade visual de
 * loterias oficiais ou de outras plataformas.
 *
 * Conceito: um bilhete (retangulo arredondado com recortes laterais) com uma
 * esfera clara ao centro — a "bola" da loteria — e um brilho de quatro pontas.
 * Trocar a marca = substituir este arquivo e VITE_BRAND_NAME.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn('size-9', className)}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="jp-logo-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="100%" stopColor="hsl(var(--primary) / 0.72)" />
        </linearGradient>
        <mask id="jp-ticket-notches">
          <rect width="40" height="40" fill="#fff" />
          {/* Recortes laterais que dão a leitura de "bilhete". */}
          <circle cx="0" cy="20" r="4.2" fill="#000" />
          <circle cx="40" cy="20" r="4.2" fill="#000" />
        </mask>
      </defs>

      <rect width="40" height="40" rx="11" fill="url(#jp-logo-gradient)" mask="url(#jp-ticket-notches)" />
      <circle cx="20" cy="20" r="9.2" fill="hsl(var(--primary-foreground))" />
      {/* Brilho de quatro pontas: destaque, sem estética de cassino. */}
      <path
        d="M20 12.6c.5 3.4 1.4 4.3 4.8 4.8-3.4.5-4.3 1.4-4.8 4.8-.5-3.4-1.4-4.3-4.8-4.8 3.4-.5 4.3-1.4 4.8-4.8z"
        fill="hsl(var(--primary))"
      />
      <circle cx="20" cy="25.4" r="1.5" fill="hsl(var(--primary) / 0.55)" />
    </svg>
  );
}

export function Logo({
  className,
  showName = true,
}: {
  className?: string;
  showName?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {showName && (
        <span className="font-display text-lg font-extrabold tracking-tight">{brand.name}</span>
      )}
      <span className="sr-only">{brand.name} — página inicial</span>
    </span>
  );
}
