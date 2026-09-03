import * as React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock } from 'lucide-react';
import type { RgLimitKind } from '@/types/domain';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatform } from '@/contexts/PlatformContext';
import { useDemoState } from '@/hooks/useDemoState';
import { demoStore } from '@/services/platform/demoStore';
import { useToast } from '@/components/ui/toast';
import { formatDateTime, formatUSD } from '@/lib/format';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/misc';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/common/states';

const LIMIT_KINDS: { key: RgLimitKind; label: string; hint: string }[] = [
  { key: 'daily_spend', label: 'Limite diário', hint: 'Valor máximo de pedidos por dia.' },
  { key: 'weekly_spend', label: 'Limite semanal', hint: 'Valor máximo de pedidos por semana.' },
  { key: 'monthly_spend', label: 'Limite mensal', hint: 'Valor máximo de pedidos por mês.' },
];

export function ResponsibleGamingSettingsPage() {
  const { profile, isAuthenticated, updateProfile } = useAuth();
  const { settings } = usePlatform();
  const demo = useDemoState();
  const { toast } = useToast();
  const [values, setValues] = React.useState<Record<string, string>>({});

  if (!isAuthenticated || !profile) {
    return (
      <div className="container py-16">
        <Seo title="Jogo responsável" description="Configure seus limites." noIndex />
        <EmptyState
          title="Entre para configurar seus limites"
          action={<Button asChild><Link to="/entrar">Entrar</Link></Button>}
        />
      </div>
    );
  }

  const limits = demo.rgLimits.filter((l) => l.userId === profile.id && l.active);
  const currentFor = (kind: RgLimitKind) =>
    limits.find((l) => l.kind === kind && new Date(l.effectiveAt).getTime() <= Date.now()) ?? null;
  const pendingFor = (kind: RgLimitKind) =>
    limits.find((l) => l.kind === kind && new Date(l.effectiveAt).getTime() > Date.now()) ?? null;

  const saveLimit = (kind: RgLimitKind) => {
    const raw = values[kind];
    const amount = Number(raw);
    if (!raw || Number.isNaN(amount) || amount <= 0) {
      toast({ title: 'Informe um valor válido', variant: 'warning' });
      return;
    }

    const current = currentFor(kind);
    const isIncrease = current?.amount != null && amount > current.amount;
    // Reducoes valem na hora. Aumentos so passam a valer apos o periodo de
    // espera configurado — isto e uma protecao, nao um obstaculo burocratico.
    const effectiveAt = isIncrease
      ? new Date(Date.now() + settings.rgIncreaseCooldownHours * 3_600_000).toISOString()
      : new Date().toISOString();

    demoStore.update((draft) => {
      draft.rgLimits = draft.rgLimits.map((l) =>
        l.userId === profile.id && l.kind === kind ? { ...l, active: false } : l,
      );
      draft.rgLimits.push({
        id: `rg-${crypto.randomUUID()}`,
        userId: profile.id,
        kind,
        amount,
        currency: 'USD',
        active: true,
        requestedAt: new Date().toISOString(),
        effectiveAt,
        isIncrease: Boolean(isIncrease),
        previousAmount: current?.amount ?? null,
      });
    });

    demoStore.audit({
      userId: profile.id, role: 'CUSTOMER', action: 'rg_limit.set',
      entity: 'responsible_gaming_limits', entityId: kind,
      oldValue: { amount: current?.amount ?? null }, newValue: { amount, effectiveAt },
      severity: 'info',
    });

    toast({
      title: isIncrease ? 'Aumento agendado' : 'Limite atualizado',
      description: isIncrease
        ? `O novo limite passa a valer em ${settings.rgIncreaseCooldownHours} horas.`
        : 'O novo limite já está valendo.',
      variant: 'success',
    });
    setValues((c) => ({ ...c, [kind]: '' }));
  };

  const selfExclude = async (days: number | null) => {
    // Sem data final = bloqueio por tempo indeterminado. Guardamos uma data
    // distante para que a verificacao "esta excluido agora?" seja uniforme.
    const endsAt = days
      ? new Date(Date.now() + days * 86_400_000).toISOString()
      : new Date(Date.now() + 100 * 365 * 86_400_000).toISOString();

    // O Compliance Engine le selfExcludedUntil / accountPausedUntil do perfil:
    // gravar aqui e o que efetivamente bloqueia novos pedidos.
    await updateProfile(
      days ? { accountPausedUntil: endsAt } : { selfExcludedUntil: endsAt },
    );

    demoStore.audit({
      userId: profile.id, role: 'CUSTOMER', action: 'self_exclusion.create',
      entity: 'self_exclusions', entityId: profile.id,
      oldValue: null, newValue: { endsAt }, severity: 'critical',
    });
    toast({
      title: 'Autoexclusão registrada',
      description: days
        ? `Sua conta ficará bloqueada para novos pedidos por ${days} dias.`
        : 'Sua conta ficará bloqueada para novos pedidos por tempo indeterminado.',
      variant: 'warning',
    });
  };

  return (
    <div className="container py-10">
      <Seo title="Jogo responsável" description="Configure seus limites de gasto." noIndex />

      <header className="mb-8 max-w-2xl">
        <h1 className="text-display-xl font-extrabold">Jogo responsável</h1>
        <p className="mt-2 text-muted-foreground">
          Defina limites que o sistema aplica automaticamente. Reduções valem na hora; aumentos
          passam por um período de espera de {settings.rgIncreaseCooldownHours} horas.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="surface space-y-5 p-6">
          <h2 className="font-display text-lg font-semibold">Limites de gasto</h2>

          {LIMIT_KINDS.map((item) => {
            const current = currentFor(item.key);
            const pending = pendingFor(item.key);
            return (
              <div key={item.key} className="space-y-2 border-b border-border pb-5 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{item.label}</span>
                  {current?.amount != null ? (
                    <Badge variant="success">Ativo: {formatUSD(current.amount)}</Badge>
                  ) : (
                    <Badge variant="neutral">Sem limite</Badge>
                  )}
                </div>

                <Field label={`Novo valor (USD)`} htmlFor={`limit-${item.key}`} hint={item.hint}>
                  <div className="flex gap-2">
                    <Input
                      id={`limit-${item.key}`}
                      inputMode="decimal"
                      placeholder="0,00"
                      value={values[item.key] ?? ''}
                      onChange={(e) => setValues((c) => ({ ...c, [item.key]: e.target.value }))}
                    />
                    <Button onClick={() => saveLimit(item.key)}>Salvar</Button>
                  </div>
                </Field>

                {pending && (
                  <p className="flex items-center gap-2 text-xs text-warning">
                    <Clock className="size-3.5" aria-hidden />
                    Aumento para {formatUSD(pending.amount)} passa a valer em{' '}
                    {formatDateTime(pending.effectiveAt)}.
                  </p>
                )}
              </div>
            );
          })}
        </section>

        <div className="space-y-6">
          <section className="surface space-y-4 p-6">
            <h2 className="font-display text-lg font-semibold">Pausar ou autoexcluir</h2>

            {(profile.selfExcludedUntil || profile.accountPausedUntil) && (
              <div className="notice-strip border-warning/40 bg-warning/10">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
                <div className="text-sm">
                  <p className="font-medium">
                    {profile.selfExcludedUntil ? 'Autoexclusão ativa' : 'Conta pausada'}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Novos pedidos estão bloqueados
                    {profile.accountPausedUntil && !profile.selfExcludedUntil
                      ? ` até ${formatDateTime(profile.accountPausedUntil)}`
                      : ''}
                    . Para reverter, fale com o suporte.
                  </p>
                </div>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Enquanto uma pausa ou autoexclusão estiver ativa, nenhum pedido é aceito —
              independentemente de qualquer outra configuração da conta.
            </p>

            <div className="flex flex-wrap gap-2">
              {[7, 30, 90].map((days) => (
                <Button key={days} variant="outline" onClick={() => selfExclude(days)}>
                  Pausar por {days} dias
                </Button>
              ))}
            </div>

            <Separator />

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="text-destructive">
                  <AlertTriangle aria-hidden /> Autoexcluir minha conta
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar autoexclusão</DialogTitle>
                  <DialogDescription>
                    Sua conta ficará bloqueada para novos pedidos por tempo indeterminado. Você
                    continuará podendo acessar o histórico e os bilhetes já adquiridos. Reverter
                    exige contato com o suporte e pode ter prazo mínimo definido pela legislação
                    aplicável.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="destructive" onClick={() => selfExclude(null)}>
                    Confirmar autoexclusão
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </section>

          <section className="surface space-y-3 p-6">
            <h2 className="font-display text-lg font-semibold">Histórico de gastos</h2>
            {demo.orders.filter((o) => o.userId === profile.id).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum pedido registrado ainda.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {demo.orders
                  .filter((o) => o.userId === profile.id)
                  .slice(0, 8)
                  .map((order) => (
                    <li key={order.id} className="flex justify-between gap-4">
                      <span className="text-muted-foreground">
                        {formatDateTime(order.createdAt)}
                      </span>
                      <span className="tnum font-medium">{formatUSD(order.total)}</span>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
