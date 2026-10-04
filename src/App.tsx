import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createBrowserRouter, createHashRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { PlatformProvider } from '@/contexts/PlatformContext';
import { CartProvider } from '@/contexts/CartContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { RequireRole } from '@/components/layout/RequireRole';
import { ErrorState } from '@/components/common/states';

// Público
import { HomePage } from '@/pages/public/HomePage';
import { LotteriesPage } from '@/pages/public/LotteriesPage';
import { LotteryDetailPage } from '@/pages/public/LotteryDetailPage';
import { ResultsPage } from '@/pages/public/ResultsPage';
import { GameResultsRoute } from '@/pages/public/GameResultsRoute';
import { CartPage } from '@/pages/public/CartPage';
import { CheckoutPage } from '@/pages/public/CheckoutPage';
import { HowItWorksPage } from '@/pages/public/HowItWorksPage';
import { CheckNumbersPage } from '@/pages/public/CheckNumbersPage';
import { ResponsibleGamingPage } from '@/pages/public/ResponsibleGamingPage';
import {
  AboutPage, ContactPage, HelpPage, LegalPage, TicketSecurityPage,
} from '@/pages/public/ContentPages';

// Autenticação
import { SignInPage } from '@/pages/auth/SignInPage';
import { SignUpPage } from '@/pages/auth/SignUpPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';

// Área do cliente
import { MyGamesPage } from '@/pages/account/MyGamesPage';
import { OrderDetailPage } from '@/pages/account/OrderDetailPage';
import { AccountPage } from '@/pages/account/AccountPage';
import { WinnerPage } from '@/pages/account/WinnerPage';
import { ResponsibleGamingSettingsPage } from '@/pages/account/ResponsibleGamingSettingsPage';

// Admin
import { AdminOverview } from '@/pages/admin/AdminOverview';
import { AdminPurchaseQueue } from '@/pages/admin/AdminPurchaseQueue';
import { AdminOrders, AdminTickets, AdminVault } from '@/pages/admin/AdminOrders';
import { AdminDraws, AdminGames, AdminResults } from '@/pages/admin/AdminCatalog';
import { AdminJurisdictions } from '@/pages/admin/AdminJurisdictions';
import { AdminDataSync } from '@/pages/admin/AdminDataSync';
import {
  AdminAuditLogs, AdminCompliance, AdminContent, AdminOperators, AdminSettings,
} from '@/pages/admin/AdminSystem';
import {
  AdminCustomers, AdminKyc, AdminPayments, AdminPrizes, AdminRefunds,
  AdminReports, AdminSupport,
} from '@/pages/admin/AdminPeopleFinance';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60_000,
    },
  },
});

/** Papéis com acesso a cada área do painel. A barreira real é a RLS no banco. */
const ALL_STAFF = [
  'SUPER_ADMIN', 'ADMIN', 'COMPLIANCE', 'FINANCE', 'PURCHASER', 'TICKET_VERIFIER', 'SUPPORT',
] as const;

/**
 * Hospedagem estatica (sem reescrita de rota no servidor) nao consegue servir
 * /loterias/powerball diretamente: o arquivo nao existe. Para esses casos —
 * protótipo publicado, preview estático — VITE_ROUTER=hash troca para rotas
 * com "#", que funcionam em qualquer host. Em produção, com um servidor que
 * reescreve para index.html, mantenha o padrão (URLs limpas).
 */
const createRouter =
  import.meta.env.VITE_ROUTER === 'hash' ? createHashRouter : createBrowserRouter;

const router = createRouter([
  {
    element: <AppLayout />,
    errorElement: (
      <div className="container py-20">
        <ErrorState
          title="Algo deu errado"
          description="Não foi possível carregar esta página. Tente novamente."
          onRetry={() => window.location.reload()}
        />
      </div>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'loterias', element: <LotteriesPage /> },
      { path: 'loterias/:gameKey', element: <LotteryDetailPage /> },
      { path: 'resultados', element: <ResultsPage /> },
      { path: 'resultados/:gameKey', element: <GameResultsRoute /> },
      { path: 'carrinho', element: <CartPage /> },
      { path: 'checkout', element: <CheckoutPage /> },
      { path: 'como-funciona', element: <HowItWorksPage /> },
      { path: 'conferir-numeros', element: <CheckNumbersPage /> },
      { path: 'seguranca-dos-bilhetes', element: <TicketSecurityPage /> },
      { path: 'jogo-responsavel', element: <ResponsibleGamingPage /> },
      { path: 'ajuda', element: <HelpPage /> },
      { path: 'sobre', element: <AboutPage /> },
      { path: 'contato', element: <ContactPage /> },
      { path: 'legal/:slug', element: <LegalPage /> },

      { path: 'entrar', element: <SignInPage /> },
      { path: 'entrar/recuperar', element: <ForgotPasswordPage /> },
      { path: 'criar-conta', element: <SignUpPage /> },

      { path: 'meus-jogos', element: <MyGamesPage /> },
      { path: 'meus-jogos/:orderId', element: <OrderDetailPage /> },
      { path: 'meus-jogos/premio/:ticketId', element: <WinnerPage /> },
      { path: 'conta', element: <AccountPage /> },
      { path: 'conta/jogo-responsavel', element: <ResponsibleGamingSettingsPage /> },

      {
        path: '*',
        element: (
          <div className="container py-20">
            <ErrorState
              title="Página não encontrada"
              description="O endereço acessado não existe. Use o menu para continuar navegando."
            />
          </div>
        ),
      },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Guard roles={[...ALL_STAFF]}><AdminOverview /></Guard> },
      { path: 'pedidos', element: <Guard roles={['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'SUPPORT', 'COMPLIANCE']}><AdminOrders /></Guard> },
      { path: 'fila-de-compra', element: <Guard roles={['SUPER_ADMIN', 'ADMIN', 'PURCHASER']}><AdminPurchaseQueue /></Guard> },
      { path: 'bilhetes', element: <Guard roles={['SUPER_ADMIN', 'ADMIN', 'TICKET_VERIFIER', 'PURCHASER']}><AdminTickets /></Guard> },
      { path: 'cofre', element: <Guard roles={['SUPER_ADMIN', 'ADMIN', 'TICKET_VERIFIER']}><AdminVault /></Guard> },
      { path: 'sorteios', element: <Guard roles={['SUPER_ADMIN', 'ADMIN']}><AdminDraws /></Guard> },
      { path: 'resultados', element: <Guard roles={['SUPER_ADMIN', 'ADMIN']}><AdminResults /></Guard> },
      { path: 'sincronizacao', element: <Guard roles={['SUPER_ADMIN', 'ADMIN', 'COMPLIANCE']}><AdminDataSync /></Guard> },
      { path: 'premios', element: <Guard roles={['SUPER_ADMIN', 'ADMIN', 'FINANCE', 'COMPLIANCE']}><AdminPrizes /></Guard> },
      { path: 'clientes', element: <Guard roles={['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'COMPLIANCE']}><AdminCustomers /></Guard> },
      { path: 'kyc', element: <Guard roles={['SUPER_ADMIN', 'COMPLIANCE']}><AdminKyc /></Guard> },
      { path: 'suporte', element: <Guard roles={['SUPER_ADMIN', 'ADMIN', 'SUPPORT']}><AdminSupport /></Guard> },
      { path: 'pagamentos', element: <Guard roles={['SUPER_ADMIN', 'FINANCE']}><AdminPayments /></Guard> },
      { path: 'reembolsos', element: <Guard roles={['SUPER_ADMIN', 'FINANCE']}><AdminRefunds /></Guard> },
      { path: 'relatorios', element: <Guard roles={['SUPER_ADMIN', 'ADMIN', 'FINANCE']}><AdminReports /></Guard> },
      { path: 'loterias', element: <Guard roles={['SUPER_ADMIN', 'ADMIN']}><AdminGames /></Guard> },
      { path: 'jurisdicoes', element: <Guard roles={['SUPER_ADMIN', 'COMPLIANCE']}><AdminJurisdictions /></Guard> },
      { path: 'compliance', element: <Guard roles={['SUPER_ADMIN', 'COMPLIANCE']}><AdminCompliance /></Guard> },
      { path: 'operadores', element: <Guard roles={['SUPER_ADMIN']}><AdminOperators /></Guard> },
      { path: 'conteudo', element: <Guard roles={['SUPER_ADMIN', 'ADMIN', 'SUPPORT']}><AdminContent /></Guard> },
      { path: 'auditoria', element: <Guard roles={['SUPER_ADMIN', 'COMPLIANCE']}><AdminAuditLogs /></Guard> },
      { path: 'configuracoes', element: <Guard roles={['SUPER_ADMIN', 'ADMIN']}><AdminSettings /></Guard> },
    ],
  },
]);

function Guard({
  roles, children,
}: {
  roles: Parameters<typeof RequireRole>[0]['roles'];
  children: React.ReactNode;
}) {
  return <RequireRole roles={roles}>{children}</RequireRole>;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <TooltipProvider delayDuration={200}>
          <AuthProvider>
            <PlatformProvider>
              <CartProvider>
                <RouterProvider router={router} />
              </CartProvider>
            </PlatformProvider>
          </AuthProvider>
        </TooltipProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
