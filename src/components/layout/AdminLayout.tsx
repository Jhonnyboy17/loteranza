import * as React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  Banknote, BarChart3, Building2, ClipboardList, Coins, CreditCard, FileText,
  Gavel, LayoutDashboard, LifeBuoy, Menu, ReceiptText, RotateCcw, ScanLine,
  RefreshCw, ScrollText, Settings, ShieldCheck, Ticket, Trophy, Users, Vault,
} from 'lucide-react';
import type { AppRole } from '@/types/domain';
import { isDemoDataMode } from '@/config/env';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/**
 * Estrutura do painel administrativo.
 *
 * Cada item declara quais papeis podem ve-lo. Isto e apenas a camada de
 * interface: o acesso real e barrado pelas policies de RLS no banco. Esconder
 * um link nunca e a protecao — e a conveniencia.
 */
interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
}

const ALL_STAFF: AppRole[] = [
  'SUPER_ADMIN', 'ADMIN', 'COMPLIANCE', 'FINANCE', 'PURCHASER', 'TICKET_VERIFIER', 'SUPPORT',
];

export const ADMIN_NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Operação',
    items: [
      { to: '/admin', label: 'Visão geral', icon: LayoutDashboard, roles: ALL_STAFF },
      { to: '/admin/pedidos', label: 'Pedidos', icon: ClipboardList, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT', 'COMPLIANCE'] },
      { to: '/admin/fila-de-compra', label: 'Fila de compra', icon: Ticket, roles: ['SUPER_ADMIN', 'ADMIN', 'PURCHASER'] },
      { to: '/admin/bilhetes', label: 'Bilhetes', icon: ScanLine, roles: ['SUPER_ADMIN', 'ADMIN', 'TICKET_VERIFIER', 'PURCHASER'] },
      { to: '/admin/cofre', label: 'Cofre', icon: Vault, roles: ['SUPER_ADMIN', 'ADMIN', 'TICKET_VERIFIER'] },
    ],
  },
  {
    group: 'Sorteios e prêmios',
    items: [
      { to: '/admin/sorteios', label: 'Sorteios', icon: Coins, roles: ['SUPER_ADMIN', 'ADMIN'] },
      { to: '/admin/resultados', label: 'Resultados', icon: BarChart3, roles: ['SUPER_ADMIN', 'ADMIN'] },
      { to: '/admin/premios', label: 'Prêmios', icon: Trophy, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'COMPLIANCE'] },
      { to: '/admin/sincronizacao', label: 'Sincronização', icon: RefreshCw, roles: ['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE'] },
    ],
  },
  {
    group: 'Clientes',
    items: [
      { to: '/admin/clientes', label: 'Clientes', icon: Users, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'COMPLIANCE'] },
      { to: '/admin/kyc', label: 'KYC', icon: ShieldCheck, roles: ['SUPER_ADMIN', 'COMPLIANCE'] },
      { to: '/admin/suporte', label: 'Suporte', icon: LifeBuoy, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
    ],
  },
  {
    group: 'Financeiro',
    items: [
      { to: '/admin/pagamentos', label: 'Pagamentos', icon: CreditCard, roles: ['SUPER_ADMIN', 'FINANCE'] },
      { to: '/admin/reembolsos', label: 'Reembolsos', icon: RotateCcw, roles: ['SUPER_ADMIN', 'FINANCE'] },
      { to: '/admin/relatorios', label: 'Relatórios', icon: ReceiptText, roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE'] },
    ],
  },
  {
    group: 'Configuração',
    items: [
      { to: '/admin/loterias', label: 'Loterias', icon: Banknote, roles: ['SUPER_ADMIN', 'ADMIN'] },
      { to: '/admin/jurisdicoes', label: 'Jurisdições', icon: Gavel, roles: ['SUPER_ADMIN', 'COMPLIANCE'] },
      { to: '/admin/compliance', label: 'Compliance', icon: ShieldCheck, roles: ['SUPER_ADMIN', 'COMPLIANCE'] },
      { to: '/admin/operadores', label: 'Operadores', icon: Building2, roles: ['SUPER_ADMIN'] },
      { to: '/admin/conteudo', label: 'Conteúdo', icon: FileText, roles: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] },
      { to: '/admin/auditoria', label: 'Logs de auditoria', icon: ScrollText, roles: ['SUPER_ADMIN', 'COMPLIANCE'] },
      { to: '/admin/configuracoes', label: 'Configurações', icon: Settings, roles: ['SUPER_ADMIN', 'ADMIN'] },
    ],
  },
];

export function AdminLayout() {
  const { roles } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const visibleGroups = ADMIN_NAV.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.roles.some((role) => roles.includes(role))),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <a href="#admin-conteudo" className="skip-link">Pular para o conteúdo</a>

      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-card lg:block">
        <div className="sticky top-0 flex h-dvh flex-col">
          <div className="border-b border-border p-5">
            <Link to="/"><Logo /></Link>
            <p className="mt-2 text-xs text-muted-foreground">Painel administrativo</p>
          </div>
          <SidebarNav groups={visibleGroups} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur lg:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <div className="border-b border-border p-5 pt-14">
                <Logo />
                <p className="mt-2 text-xs text-muted-foreground">Painel administrativo</p>
              </div>
              <div onClick={() => setMobileOpen(false)}>
                <SidebarNav groups={visibleGroups} />
              </div>
            </SheetContent>
          </Sheet>

          <span className="font-display text-sm font-semibold lg:hidden">Painel</span>

          <div className="ml-auto flex items-center gap-2">
            {isDemoDataMode && <Badge variant="demo">Dados demonstrativos</Badge>}
            <Button asChild variant="ghost" size="sm">
              <Link to="/">Ver site</Link>
            </Button>
          </div>
        </header>

        <main id="admin-conteudo" className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarNav({
  groups,
}: {
  groups: { group: string; items: NavItem[] }[];
}) {
  return (
    <nav className="flex-1 overflow-y-auto p-3" aria-label="Navegação do painel">
      {groups.map((group) => (
        <div key={group.group} className="mb-5">
          <p className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {group.group}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === '/admin'}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  <item.icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
