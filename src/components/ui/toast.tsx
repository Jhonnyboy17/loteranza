import * as React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastVariant = 'default' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  durationMs: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (input: Omit<Toast, 'id' | 'variant' | 'durationMs'> & {
    variant?: ToastVariant;
    durationMs?: number;
  }) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = React.useCallback<ToastContextValue['toast']>(
    ({ title, description, variant = 'default', durationMs = 5000 }) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { id, title, description, variant, durationMs }]);
      timers.current.set(id, setTimeout(() => dismiss(id), durationMs));
      return id;
    },
    [dismiss],
  );

  React.useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = React.useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  return context;
}

const ICONS: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const STYLES: Record<ToastVariant, string> = {
  default: 'border-border bg-card text-foreground',
  success: 'border-success/30 bg-card text-foreground',
  warning: 'border-warning/40 bg-card text-foreground',
  error: 'border-destructive/40 bg-card text-foreground',
};

const ICON_COLOR: Record<ToastVariant, string> = {
  default: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-destructive',
};

function ToastViewport({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4
                 sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-auto sm:items-end"
      role="region"
      aria-label="Notificações"
    >
      {toasts.map((item) => {
        const Icon = ICONS[item.variant];
        return (
          <div
            key={item.id}
            role="status"
            aria-live="polite"
            className={cn(
              'pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3',
              'rounded-xl border p-4 shadow-lift',
              STYLES[item.variant],
            )}
          >
            <Icon className={cn('mt-0.5 size-5 shrink-0', ICON_COLOR[item.variant])} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{item.title}</p>
              {item.description && (
                <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
              <span className="sr-only">Fechar notificação</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
