import { useEffect, useState } from 'react';

/**
 * Confete.
 *
 * Regra de produto: so aparece quando existe premio CONFIRMADO. Nunca em
 * cadastro, adicao ao carrinho ou pagamento — celebrar o gasto seria um dark
 * pattern. Respeita prefers-reduced-motion.
 */
export function Confetti({ active, pieces = 60 }: { active: boolean; pieces?: number }) {
  const [render, setRender] = useState(false);

  useEffect(() => {
    if (!active) return;
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;

    setRender(true);
    const timer = setTimeout(() => setRender(false), 3200);
    return () => clearTimeout(timer);
  }, [active]);

  if (!render) return null;

  const colors = [
    'hsl(var(--jackpot))', 'hsl(var(--primary))',
    'hsl(var(--success))', 'hsl(var(--accent-foreground))',
  ];

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden" aria-hidden>
      {Array.from({ length: pieces }).map((_, i) => (
        <span
          key={i}
          className="absolute block animate-confetti-fall rounded-[2px]"
          style={{
            left: `${(i * 97) % 100}%`,
            width: i % 3 === 0 ? 6 : 8,
            height: i % 3 === 0 ? 10 : 6,
            backgroundColor: colors[i % colors.length],
            animationDelay: `${(i % 12) * 0.14}s`,
            animationDuration: `${2.4 + ((i % 5) * 0.22)}s`,
          }}
        />
      ))}
    </div>
  );
}
