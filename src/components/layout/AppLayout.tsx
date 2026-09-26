import { Outlet, ScrollRestoration } from 'react-router-dom';
import { env } from '@/config/env';
import { usePlatform } from '@/contexts/PlatformContext';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';
import { Footer } from './Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { DemoModeBanner } from '@/components/compliance/notices';

/**
 * Casca do aplicativo, no formato do Stitch: cabeçalho fixo no topo, barra de
 * abas fixa no rodapé, conteúdo rolando entre os dois.
 *
 * `pt-16` no <main> compensa o cabeçalho fixo; o `pb-24` que libera a barra de
 * abas fica no rodapé, que é o último elemento no fluxo. A partir de `lg` a
 * barra some (a navegação migra para o cabeçalho) e sobra só o rodapé, onde
 * ficam os links legais obrigatórios.
 */
export function AppLayout() {
  const { settings } = usePlatform();
  const showDemoBanner = !env.transactionsEnabled || settings.demoMode;

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <AppHeader />

      <main id="conteudo" className="flex-1 pt-16">
        {showDemoBanner && (
          <div className="mx-auto max-w-[1360px] px-space-md pt-space-md">
            <DemoModeBanner />
          </div>
        )}
        <Outlet />
      </main>

      {/* O rodapé carrega os avisos legais; no mobile ele vem depois do
          conteúdo, acima da barra de abas. */}
      <Footer />

      <BottomNav />
      <CartDrawer />
      <ScrollRestoration />
    </div>
  );
}
