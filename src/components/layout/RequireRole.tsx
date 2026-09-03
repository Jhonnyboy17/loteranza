import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import type { AppRole } from '@/types/domain';
import { isDemoDataMode } from '@/config/env';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/misc';

/**
 * Guarda de rota por papel.
 *
 * IMPORTANTE: esta e uma barreira de INTERFACE. A protecao real esta nas
 * policies de RLS do Postgres e nas Edge Functions. Mesmo que alguem force a
 * rota, nao consegue ler nem escrever dado algum sem o papel correspondente.
 */
export function RequireRole({
  roles,
  children,
}: {
  roles: AppRole[];
  children: React.ReactNode;
}) {
  const { isAuthenticated, loading, roles: userRoles, setDemoRoles } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/entrar" state={{ from: location.pathname }} replace />;
  }

  const allowed = roles.some((role) => userRoles.includes(role));
  if (allowed) return <>{children}</>;

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <ShieldAlert className="size-10 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <h1 className="font-display text-xl font-bold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">
          Sua conta não tem permissão para esta área. As permissões são atribuídas por um
          administrador e verificadas no servidor.
        </p>
      </div>

      {isDemoDataMode && (
        <div className="w-full rounded-xl border border-dashed border-warning/50 bg-warning/5 p-4 text-left">
          <p className="text-sm font-medium">Modo demonstração</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Para inspecionar o painel sem Supabase configurado, você pode assumir um papel apenas
            nesta sessão local. Em produção isto não existe: o papel vem da tabela{' '}
            <code className="text-xs">operators</code>, protegida por RLS.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setDemoRoles(['SUPER_ADMIN'])}>
              Assumir SUPER_ADMIN
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDemoRoles(['PURCHASER'])}>
              Assumir PURCHASER
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDemoRoles(['COMPLIANCE'])}>
              Assumir COMPLIANCE
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
