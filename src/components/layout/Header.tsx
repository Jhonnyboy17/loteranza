import * as React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Menu, ShoppingCart, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { to: '/loterias', label: 'Loterias' },
  { to: '/resultados', label: 'Resultados' },
  { to: '/meus-jogos', label: 'Meus Jogos' },
  { to: '/como-funciona', label: 'Como Funciona' },
  { to: '/ajuda', label: 'Ajuda' },
];

export function Header() {
  const { isAuthenticated, profile, signOut, roles } = useAuth();
  const { lineCount, setOpen } = useCart();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const navigate = useNavigate();

  const isStaff = roles.length > 0;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur-xl">
      <div className="container flex h-16 items-center gap-3">
        {/* Menu hambúrguer — apenas no mobile */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
              <Menu aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0">
            <nav className="flex flex-col gap-1 p-5 pt-14" aria-label="Menu principal">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'touch-target flex items-center rounded-lg px-3 text-base font-medium transition',
                      isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              {isStaff && (
                <NavLink
                  to="/admin"
                  onClick={() => setMobileOpen(false)}
                  className="touch-target mt-2 flex items-center rounded-lg px-3 text-base font-medium hover:bg-muted"
                >
                  Painel administrativo
                </NavLink>
              )}
            </nav>
            <div className="mt-auto border-t border-border p-5 safe-bottom">
              {isAuthenticated ? (
                <Button variant="outline" block onClick={handleSignOut}>
                  <LogOut aria-hidden /> Sair
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button asChild block onClick={() => setMobileOpen(false)}>
                    <Link to="/criar-conta">Criar conta</Link>
                  </Button>
                  <Button asChild variant="outline" block onClick={() => setMobileOpen(false)}>
                    <Link to="/entrar">Entrar</Link>
                  </Button>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>

        <Link to="/" className="shrink-0 rounded-lg">
          <Logo />
        </Link>

        <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Navegação principal">
          {NAV_LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Minha conta">
                  <User aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{profile?.displayName ?? profile?.email ?? 'Minha conta'}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/meus-jogos">Meus jogos</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/conta">Minha conta</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/conta/jogo-responsavel">Jogo responsável</Link></DropdownMenuItem>
                {isStaff && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild><Link to="/admin">Painel administrativo</Link></DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut}>
                  <LogOut aria-hidden /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button asChild variant="ghost" size="sm">
                <Link to="/entrar">Entrar</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/criar-conta">Criar conta</Link>
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            className="relative"
            aria-label={`Carrinho com ${lineCount} ${lineCount === 1 ? 'jogo' : 'jogos'}`}
          >
            <ShoppingCart aria-hidden />
            {lineCount > 0 && (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center
                           rounded-full bg-primary text-[0.625rem] font-bold text-primary-foreground"
              >
                {lineCount > 99 ? '99+' : lineCount}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
}
