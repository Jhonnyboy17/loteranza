import { NavLink } from 'react-router-dom';
import { Sym, type IconName } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/**
 * Barra de abas inferior do Stitch (design/stitch/<tela>/code.html, elemento
 * <nav> fixo no rodapé).
 *
 * Aba ativa em ouro com brilho; inativas em on-surface-variant. Altura 80px
 * (h-20) mais o recorte da área segura, alvo de toque de 56px.
 *
 * Só aparece no mobile: a partir de `lg` a navegação vai para o cabeçalho,
 * onde há largura para ela. O Stitch só desenhou a versão mobile.
 */
const TABS: { to: string; icon: IconName; label: string; end?: boolean }[] = [
  { to: '/', icon: 'home', label: 'Início', end: true },
  { to: '/loterias', icon: 'add_circle', label: 'Jogar' },
  { to: '/meus-jogos', icon: 'confirmation_number', label: 'Bilhetes' },
  { to: '/resultados', icon: 'emoji_events', label: 'Resultados' },
  { to: '/conta', icon: 'badge', label: 'Perfil' },
];

export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 lg:hidden',
        'bg-surface-container-lowest/90 backdrop-blur-xl shadow-bottombar pb-safe',
      )}
    >
      <div className="mx-auto flex h-20 max-w-lg items-center justify-around px-space-xs">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                'flex h-14 w-14 flex-col items-center justify-center gap-1 rounded-lg transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'text-secondary [filter:drop-shadow(0_0_10px_hsl(var(--secondary)/0.5))]'
                  : 'text-on-surface-variant hover:text-on-surface',
              )
            }
          >
            <Sym name={tab.icon} size={24} />
            <span className="font-label-xs text-label-xs font-semibold uppercase tracking-wider">
              {tab.label}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
