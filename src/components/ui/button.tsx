import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold ' +
    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
    'focus-visible:ring-offset-2 focus-visible:ring-offset-surface ' +
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Violeta claro sobre texto violeta-escuro — o par do Stitch (7,7:1).
        primary:
          'bg-primary text-on-primary hover:brightness-110 glow-primary ' +
          'hover:shadow-glow transition-shadow',
        // CTA dourado do Stitch: a única ação que recebe brilho âmbar.
        jackpot:
          'bg-secondary text-on-secondary hover:brightness-110 glow-gold font-bold ' +
          'uppercase tracking-wide',
        // Violeta cheio (botões secundários de ação, ex. "Ver Scan HD").
        // Texto em on-primary-fixed, não on-primary: sobre #a078ff o primeiro
        // dá 5,4:1 e o segundo só 4,1:1. Ver CONFORMIDADE.md §10.
        violet:
          'bg-primary-container text-on-primary-fixed hover:brightness-110 shadow-soft font-bold',
        // Neutra: elevação de superfície, sem cor de marca.
        secondary:
          'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
        // "Ghost" do Stitch: transparente com contorno violeta.
        outline:
          'border border-primary/40 bg-transparent text-on-surface backdrop-blur ' +
          'hover:border-primary/70 hover:bg-primary/10',
        ghost: 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
        subtle: 'bg-surface-container-low text-on-surface hover:bg-surface-container',
        destructive: 'bg-error text-on-error hover:brightness-110',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-[0.8125rem]',
        md: 'h-11 px-4',
        lg: 'h-12 px-6 text-base',
        xl: 'h-14 px-8 text-base',
        icon: 'h-11 w-11',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, block }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            <span>{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
