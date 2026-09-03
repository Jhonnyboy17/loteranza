import { Outlet, ScrollRestoration } from 'react-router-dom';
import { env } from '@/config/env';
import { usePlatform } from '@/contexts/PlatformContext';
import { Header } from './Header';
import { Footer } from './Footer';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { DemoModeBanner } from '@/components/compliance/notices';

export function AppLayout() {
  const { settings } = usePlatform();
  const showDemoBanner = !env.transactionsEnabled || settings.demoMode;

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      <Header />

      {showDemoBanner && (
        <div className="container pt-4">
          <DemoModeBanner />
        </div>
      )}

      <main id="conteudo" className="flex-1">
        <Outlet />
      </main>

      <Footer />
      <CartDrawer />
      <ScrollRestoration />
    </div>
  );
}
