import { Link, NavLink } from 'react-router-dom';
import { brand } from '@/config/brand';
import { env } from '@/config/env';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { usePlatform } from '@/contexts/PlatformContext';
import { LogoMark } from '@/components/brand/Logo';
import { Sym } from '@/components/ui/icon';
import { formatUSD } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Cabeçalho fixo do Stitch (design/stitch/<tela>/code.html, elemento <header>).
 *
 * Estrutura mantida: 56px de conteúdo em h-16, fundo surface-container-lowest
 * a 80% com blur, sombra topbar, recorte de área segura no topo. À esquerda
 * marca + microtexto de status; à direita uma pílula e um avatar.
 *
 * Três elementos do Stitch foram substituídos porque afirmavam coisas que não
 * existem (ver design/stitch/CONFORMIDADE.md):
 *
 *  - selo "ORD" (código do aeroporto de Chicago, sugerindo operação local)
 *    -> selo do modo real da plataforma, vindo do Compliance Engine;
 *  - "Chicago Courier Hub" (hub de courier licenciado inexistente)
 *    -> estado real de transação na região do usuário;
 *  - pílula de carteira com saldo fixo "$140.00" (não existe carteira)
 *    -> total do carrinho, que é um número de verdade.
 *
 * A forma e o peso visual de cada um permanecem idênticos.
 */
export function AppHeader() {
  const { isAuthenticated } = useAuth();
  const { lineCount, totals, setOpen } = useCart();
  const { jurisdiction, assumedCountry, assumedState, globalTransactionsEnabled, settings } =
    usePlatform();

  const demoMode = !env.transactionsEnabled || settings.demoMode || !globalTransactionsEnabled;
  const regionLabel = [assumedState, assumedCountry].filter(Boolean).join('/') || null;

  /** Microtexto honesto no lugar de "Chicago Courier Hub". */
  const status = demoMode
    ? { tone: 'demo' as const, chip: 'Demo', text: 'Modo demonstração · nada é cobrado' }
    : jurisdiction?.transactionsEnabled
      ? { tone: 'live' as const, chip: regionLabel ?? 'Ativo', text: 'Compras liberadas nesta região' }
      : { tone: 'blocked' as const, chip: regionLabel ?? '—', text: 'Compras indisponíveis nesta região' };

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 pt-safe',
        'bg-surface-container-lowest/80 shadow-topbar backdrop-blur-xl',
      )}
    >
      <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-space-sm px-space-md">
        {/* ---- marca + estado ------------------------------------------- */}
        <Link
          to="/"
          className="flex min-w-0 items-center gap-space-sm rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogoMark className="size-8 shrink-0" />
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5">
              <span className="truncate font-headline-sm text-headline-sm font-bold leading-none tracking-tight text-on-surface">
                {brand.name}
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-1.5 py-0.5 font-label-xs text-label-xs font-bold uppercase tracking-wider',
                  status.tone === 'live'
                    ? 'bg-tertiary/15 text-tertiary'
                    : status.tone === 'demo'
                      ? 'bg-secondary/15 text-secondary'
                      : 'bg-error/15 text-error',
                )}
              >
                {status.chip}
              </span>
            </span>
            <span className="flex items-center gap-1 font-label-xs text-label-xs tracking-wider text-outline">
              <span
                className={cn(
                  'size-1.5 shrink-0 rounded-full',
                  status.tone === 'live'
                    ? 'animate-pulse bg-tertiary'
                    : status.tone === 'demo'
                      ? 'bg-secondary'
                      : 'bg-error',
                )}
                aria-hidden
              />
              <span className="truncate">{status.text}</span>
            </span>
          </span>
        </Link>

        {/* ---- navegação horizontal (só desktop; o Stitch é só mobile) ---- */}
        <nav aria-label="Seções" className="hidden items-center gap-1 lg:flex">
          {[
            { to: '/loterias', label: 'Jogar' },
            { to: '/resultados', label: 'Resultados' },
            { to: '/meus-jogos', label: 'Bilhetes' },
            { to: '/como-funciona', label: 'Como funciona' },
            { to: '/ajuda', label: 'Ajuda' },
          ].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'rounded-full px-3 py-2 font-label-lg text-label-lg transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-surface-container-high text-secondary'
                    : 'text-on-surface-variant hover:bg-surface-container-high/50 hover:text-on-surface',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* ---- carrinho + conta ------------------------------------------ */}
        <div className="flex shrink-0 items-center gap-space-xs">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={
              lineCount > 0
                ? `Abrir carrinho, ${lineCount} ${lineCount === 1 ? 'jogo' : 'jogos'}, total ${formatUSD(totals.total)}`
                : 'Abrir carrinho, vazio'
            }
            className={cn(
              'flex h-9 items-center gap-1 rounded-full px-2.5 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              lineCount > 0
                ? 'bg-surface-container-high/80 text-secondary-fixed hover:bg-surface-container-high'
                : 'text-on-surface-variant hover:bg-surface-container-high/50 hover:text-on-surface',
            )}
          >
            <Sym
              name="shopping_cart"
              size={16}
              className={lineCount > 0 ? 'text-secondary' : undefined}
            />
            <span className="font-label-md text-label-md font-bold tabular-nums">
              {lineCount > 0 ? formatUSD(totals.total) : '0'}
            </span>
          </button>

          <Link
            to={isAuthenticated ? '/conta' : '/entrar'}
            aria-label={isAuthenticated ? 'Minha conta' : 'Entrar'}
            className={cn(
              'flex size-9 items-center justify-center rounded-full transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isAuthenticated
                ? 'bg-primary text-on-primary hover:brightness-110'
                : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface',
            )}
          >
            <Sym name="person" size={18} />
          </Link>
        </div>
      </div>
    </header>
  );
}
