import * as React from 'react';
import { AlertTriangle, FileText, Lock, ScrollText, ShieldCheck } from 'lucide-react';
import type { AppRole } from '@/types/domain';
import { env, isDemoDataMode } from '@/config/env';
import { usePlatform } from '@/contexts/PlatformContext';
import { useDemoState } from '@/hooks/useDemoState';
import { useToast } from '@/components/ui/toast';
import { formatDateTime } from '@/lib/format';
import { Seo } from '@/components/common/Seo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Separator, Switch } from '@/components/ui/misc';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper,
} from '@/components/ui/table';
import { EmptyState } from '@/components/common/states';
import { sanctionsLabel } from '@/services/compliance/engine';

/* ==========================================================================
 * Configurações do sistema — inclui o kill switch global
 * ========================================================================== */

export function AdminSettings() {
  const { settings, updateSettings } = usePlatform();
  const { toast } = useToast();
  const [confirmKillSwitch, setConfirmKillSwitch] = React.useState(false);
  const [draft, setDraft] = React.useState({
    rgIncreaseCooldownHours: String(settings.rgIncreaseCooldownHours),
    prizeManualReviewThreshold: String(settings.prizeManualReviewThreshold),
    supportEmail: settings.supportEmail,
    brandName: settings.brandName,
  });

  React.useEffect(() => {
    setDraft({
      rgIncreaseCooldownHours: String(settings.rgIncreaseCooldownHours),
      prizeManualReviewThreshold: String(settings.prizeManualReviewThreshold),
      supportEmail: settings.supportEmail,
      brandName: settings.brandName,
    });
  }, [settings]);

  const enableTransactions = async () => {
    await updateSettings({ transactionsEnabled: true });
    setConfirmKillSwitch(false);
    toast({
      title: 'Kill switch ligado',
      description: 'Transações ainda dependem de jurisdição habilitada e aprovação do Compliance Engine.',
      variant: 'warning',
    });
  };

  return (
    <div className="space-y-6">
      <Seo title="Configurações" description="Configuração operacional." noIndex />

      <header>
        <h1 className="font-display text-2xl font-bold">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Parâmetros operacionais editáveis sem alteração de código.
        </p>
      </header>

      {/* Kill switch */}
      <section className="surface space-y-4 p-5">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="flex-1">
            <h2 className="font-display font-semibold">Kill switch global de transações</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Portão 2 de 3. Mesmo ligado, cada jurisdição precisa estar habilitada e o Compliance
              Engine precisa aprovar. Desligar aqui interrompe todas as transações imediatamente.
            </p>
          </div>
          <Switch
            checked={settings.transactionsEnabled}
            onCheckedChange={(checked) => {
              if (checked) setConfirmKillSwitch(true);
              else {
                updateSettings({ transactionsEnabled: false });
                toast({ title: 'Kill switch desligado', variant: 'success' });
              }
            }}
            aria-label="Kill switch global de transações"
          />
        </div>

        <div className="grid gap-2 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-3">
          <GateRow label="Portão 1 · Ambiente" enabled={env.transactionsEnabled} hint="VITE_TRANSACTIONS_ENABLED" />
          <GateRow label="Portão 2 · Sistema" enabled={settings.transactionsEnabled} hint="system_settings" />
          <GateRow label="Portão 3 · Jurisdição" enabled={false} hint="por país/estado" />
        </div>
        {!env.transactionsEnabled && (
          <p className="text-xs text-muted-foreground">
            O portão 1 está fechado pela variável de ambiente e não pode ser aberto por este painel —
            exige alteração no ambiente de execução e novo deploy. Isso é intencional.
          </p>
        )}
      </section>

      {/* Provedores */}
      <section className="surface space-y-4 p-5">
        <h2 className="font-display font-semibold">Provedores externos</h2>
        <div className="space-y-3">
          <ProviderRow
            label="Triagem de sanções"
            value={sanctionsLabel(settings.sanctionsScreeningMode)}
            enabled={settings.sanctionsScreeningMode === 'provider'}
            note="Enquanto não houver provedor, a verificação de sanções falha e o pedido vai para revisão manual."
          />
          <ProviderRow
            label="Verificação de identidade (KYC)"
            value={settings.lotteryDataProvider === 'demo' ? 'Não configurado' : 'Configurado'}
            enabled={false}
            note="Documentos são processados pelo provedor; a plataforma guarda apenas a referência."
          />
          <ProviderRow
            label="Dados de loteria"
            value={settings.lotteryDataProvider}
            enabled={settings.lotteryDataProvider !== 'demo'}
            note="Jackpots e resultados precisam vir de fonte oficial ou licenciada antes de operar."
          />
          <ProviderRow
            label="Cotação de câmbio"
            value={settings.fxProvider}
            enabled={settings.fxProvider !== 'demo'}
            note="A taxa usada no checkout é registrada no pedido e não é alterada depois."
          />
        </div>
      </section>

      {/* Parâmetros */}
      <section className="surface space-y-4 p-5">
        <h2 className="font-display font-semibold">Parâmetros operacionais</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Período de espera para aumento de limite (horas)"
            htmlFor="cooldown"
            hint="Reduções de limite valem imediatamente."
          >
            <Input
              id="cooldown" inputMode="numeric" value={draft.rgIncreaseCooldownHours}
              onChange={(e) => setDraft((c) => ({ ...c, rgIncreaseCooldownHours: e.target.value }))}
            />
          </Field>
          <Field
            label="Prêmio acima de (USD) exige revisão humana"
            htmlFor="threshold"
            hint="Prêmios acima deste valor exigem dupla aprovação."
          >
            <Input
              id="threshold" inputMode="numeric" value={draft.prizeManualReviewThreshold}
              onChange={(e) => setDraft((c) => ({ ...c, prizeManualReviewThreshold: e.target.value }))}
            />
          </Field>
          <Field label="Nome da marca" htmlFor="brand" hint="Trocar aqui renomeia a plataforma.">
            <Input
              id="brand" value={draft.brandName}
              onChange={(e) => setDraft((c) => ({ ...c, brandName: e.target.value }))}
            />
          </Field>
          <Field label="E-mail de suporte" htmlFor="support">
            <Input
              id="support" type="email" value={draft.supportEmail}
              onChange={(e) => setDraft((c) => ({ ...c, supportEmail: e.target.value }))}
            />
          </Field>
        </div>
        <Button
          onClick={async () => {
            await updateSettings({
              rgIncreaseCooldownHours: Number(draft.rgIncreaseCooldownHours) || 24,
              prizeManualReviewThreshold: Number(draft.prizeManualReviewThreshold) || 600,
              brandName: draft.brandName,
              supportEmail: draft.supportEmail,
            });
            toast({ title: 'Configurações salvas', variant: 'success' });
          }}
        >
          Salvar
        </Button>
      </section>

      <Dialog open={confirmKillSwitch} onOpenChange={setConfirmKillSwitch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ligar o kill switch global?</DialogTitle>
            <DialogDescription>
              Isto abre o portão 2 de 3. Nenhuma compra passa a acontecer automaticamente: cada
              jurisdição continua bloqueada até ser habilitada individualmente, e o Compliance
              Engine continua avaliando cada pedido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmKillSwitch(false)}>Cancelar</Button>
            <Button onClick={enableTransactions}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GateRow({ label, enabled, hint }: { label: string; enabled: boolean; hint: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 font-medium">
        <span
          aria-hidden
          className={'size-2 rounded-full ' + (enabled ? 'bg-success' : 'bg-muted-foreground/50')}
        />
        {label}
      </p>
      <p className="ml-4 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function ProviderRow({
  label, value, enabled, note,
}: {
  label: string; value: string; enabled: boolean; note: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
      </div>
      <Badge variant={enabled ? 'success' : 'neutral'}>{value}</Badge>
    </div>
  );
}

/* ==========================================================================
 * Compliance
 * ========================================================================== */

export function AdminCompliance() {
  const { jurisdictions, settings } = usePlatform();
  const demo = useDemoState();

  const enabled = jurisdictions.filter((j) => j.transactionsEnabled);
  const pending = demo.orders.filter((o) =>
    ['PENDING_REVIEW', 'BLOCKED'].includes(o.complianceStatus),
  );

  return (
    <div className="space-y-6">
      <Seo title="Compliance" description="Painel de compliance." noIndex />

      <header>
        <h1 className="font-display text-2xl font-bold">Compliance</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Estado das verificações que precedem qualquer transação.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Jurisdições habilitadas" value={`${enabled.length}/${jurisdictions.length}`} />
        <MetricCard label="Pedidos em revisão" value={String(pending.length)} />
        <MetricCard
          label="Triagem de sanções"
          value={sanctionsLabel(settings.sanctionsScreeningMode)}
        />
        <MetricCard label="Registros de auditoria" value={String(demo.auditLogs.length)} />
      </section>

      <section className="surface p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div>
            <h2 className="font-display font-semibold">Verificações executadas em cada pedido</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>• <strong className="text-foreground">age_check</strong> — idade mínima da jurisdição.</li>
              <li>• <strong className="text-foreground">identity_check</strong> — KYC quando exigido.</li>
              <li>• <strong className="text-foreground">jurisdiction_check</strong> — país/estado habilitado e jogo liberado.</li>
              <li>• <strong className="text-foreground">sanctions_check</strong> — triagem quando há provedor configurado.</li>
              <li>• <strong className="text-foreground">purchase_limits_check</strong> — limites do usuário e da jurisdição.</li>
              <li>• <strong className="text-foreground">responsible_gaming_check</strong> — pausa e autoexclusão.</li>
              <li>• <strong className="text-foreground">transactions_enabled_check</strong> — kill switch global.</li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              A avaliação que vale roda no servidor (<code>evaluate_compliance</code> no Postgres).
              A versão no navegador serve apenas para explicar ao usuário o que falta.
            </p>
          </div>
        </div>
      </section>

      {pending.length > 0 && (
        <section className="surface p-5">
          <h2 className="font-display font-semibold">Pedidos aguardando decisão</h2>
          <TableWrapper className="mt-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Status compliance</TableHead>
                  <TableHead>Criado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                    <TableCell><Badge variant="warning">{order.complianceStatus}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(order.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </section>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="tnum mt-2 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

/* ==========================================================================
 * Auditoria
 * ========================================================================== */

export function AdminAuditLogs() {
  const demo = useDemoState();
  const [filter, setFilter] = React.useState('');

  const logs = demo.auditLogs.filter((log) =>
    filter.trim() === ''
      ? true
      : `${log.action} ${log.entity}`.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <Seo title="Logs de auditoria" description="Trilha de auditoria." noIndex />

      <header>
        <h1 className="font-display text-2xl font-bold">Logs de auditoria</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Registro de toda ação crítica. Não há caminho no painel para editar ou apagar um log —
          no banco, um gatilho bloqueia UPDATE e DELETE nesta tabela.
        </p>
      </header>

      <div className="w-64">
        <Field label="Filtrar" htmlFor="audit-filter">
          <Input
            id="audit-filter" value={filter} onChange={(e) => setFilter(e.target.value)}
            placeholder="ação ou entidade"
          />
        </Field>
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="Nenhum registro" />
      ) : (
        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Entidade</TableHead>
                <TableHead>Severidade</TableHead>
                <TableHead>Novo valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatDateTime(log.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm">{log.role ?? '—'}</TableCell>
                  <TableCell className="font-medium">{log.action}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.entity}
                    {log.entityId && <span className="block text-xs">{log.entityId.slice(0, 12)}…</span>}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        log.severity === 'critical' ? 'danger'
                          : log.severity === 'warning' ? 'warning' : 'neutral'
                      }
                    >
                      {log.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {log.newValue ? JSON.stringify(log.newValue) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}
    </div>
  );
}

/* ==========================================================================
 * Conteúdo (CMS)
 * ========================================================================== */

const CMS_ENTRIES = [
  { key: 'home.hero', label: 'Banner da homepage', legal: false },
  { key: 'page.ticket-security', label: 'Segurança dos bilhetes', legal: true },
  { key: 'legal.terms', label: 'Termos de Uso', legal: true },
  { key: 'legal.privacy', label: 'Política de Privacidade', legal: true },
  { key: 'legal.cookies', label: 'Política de Cookies', legal: true },
  { key: 'legal.aml-kyc', label: 'Política AML/KYC', legal: true },
  { key: 'legal.responsible-gaming', label: 'Jogo Responsável', legal: true },
  { key: 'legal.prize-claim', label: 'Resgate de Prêmios', legal: true },
  { key: 'legal.refund', label: 'Política de Reembolso', legal: true },
  { key: 'legal.jurisdictions', label: 'Restrições por Jurisdição', legal: true },
];

export function AdminContent() {
  return (
    <div className="space-y-6">
      <Seo title="Conteúdo" description="CMS." noIndex />

      <header>
        <h1 className="font-display text-2xl font-bold">Conteúdo</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Textos institucionais, FAQ e documentos legais são editáveis sem alteração de código.
        </p>
      </header>

      <div className="notice-strip border-warning/40 bg-warning/5">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <p className="text-sm">
          Documentos legais entram com o marcador
          <strong> [CONTEÚDO A SER VALIDADO POR ADVOGADO] </strong>
          e só podem ser publicados após registro de revisão jurídica. O sistema não gera texto
          legal definitivo.
        </p>
      </div>

      <TableWrapper>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chave</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Revisão jurídica</TableHead>
              <TableHead>Publicado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {CMS_ENTRIES.map((entry) => (
              <TableRow key={entry.key}>
                <TableCell className="font-mono text-xs text-muted-foreground">{entry.key}</TableCell>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" aria-hidden />
                    {entry.label}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={entry.legal ? 'warning' : 'neutral'}>
                    {entry.legal ? 'obrigatória' : 'não exigida'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={entry.legal ? 'neutral' : 'success'}>
                    {entry.legal ? 'não' : 'sim'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">Editar</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableWrapper>
    </div>
  );
}

/* ==========================================================================
 * Operadores (RBAC)
 * ========================================================================== */

const ROLE_DESCRIPTIONS: { role: AppRole; description: string; sees: string }[] = [
  { role: 'SUPER_ADMIN', description: 'Acesso total, incluindo gestão de papéis.', sees: 'tudo' },
  { role: 'ADMIN', description: 'Operação e configuração, sem gestão de papéis.', sees: 'pedidos, bilhetes, catálogo, conteúdo' },
  { role: 'COMPLIANCE', description: 'Jurisdições, KYC, auditoria e decisões de compliance.', sees: 'perfis, KYC, geolocalização, auditoria' },
  { role: 'FINANCE', description: 'Pagamentos, reembolsos e prêmios.', sees: 'pagamentos e prêmios — não vê documentos de KYC' },
  { role: 'PURCHASER', description: 'Aquisição de bilhetes na fila de compra.', sees: 'apenas números, sorteio e prazo do pedido' },
  { role: 'TICKET_VERIFIER', description: 'Conferência dupla e cofre.', sees: 'bilhetes, imagens e cadeia de custódia' },
  { role: 'SUPPORT', description: 'Atendimento ao cliente.', sees: 'chamados e dados básicos do cliente' },
  { role: 'CUSTOMER', description: 'Cliente final.', sees: 'apenas os próprios dados' },
];

export function AdminOperators() {
  return (
    <div className="space-y-6">
      <Seo title="Operadores" description="Papéis e permissões." noIndex />

      <header>
        <h1 className="font-display text-2xl font-bold">Operadores e permissões</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Cada papel enxerga apenas o necessário para o seu trabalho. A separação é aplicada pelas
          policies de RLS no banco, não apenas pela interface.
        </p>
      </header>

      {isDemoDataMode && (
        <div className="notice-strip border-warning/40 bg-warning/5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p className="text-sm">
            Modo demonstração: não há usuários reais. Com Supabase configurado, esta tela lista a
            tabela <code>operators</code> e apenas SUPER_ADMIN consegue alterá-la.
          </p>
        </div>
      )}

      <TableWrapper>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Papel</TableHead>
              <TableHead>Responsabilidade</TableHead>
              <TableHead>O que enxerga</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ROLE_DESCRIPTIONS.map((item) => (
              <TableRow key={item.role}>
                <TableCell><Badge variant="default">{item.role}</Badge></TableCell>
                <TableCell className="text-sm">{item.description}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.sees}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableWrapper>

      <section className="surface p-5">
        <h2 className="font-display font-semibold">Separação de acesso a dados sensíveis</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li>
            • <strong className="text-foreground">FINANCE não acessa KYC.</strong> A policy de
            leitura de <code>kyc_checks</code> aceita apenas o próprio usuário, COMPLIANCE e
            SUPER_ADMIN.
          </li>
          <li>
            • <strong className="text-foreground">PURCHASER vê o mínimo.</strong> Na fila de compra
            aparecem números, sorteio e prazo — não endereço, documento ou meio de pagamento.
          </li>
          <li>
            • <strong className="text-foreground">Cofre é restrito.</strong> O cliente nunca vê a
            localização física do próprio bilhete.
          </li>
          <li>
            • <strong className="text-foreground">Auditoria é somente leitura.</strong> Apenas
            SUPER_ADMIN e COMPLIANCE leem; ninguém edita ou apaga.
          </li>
        </ul>
      </section>

      <Separator />
      <p className="text-xs text-muted-foreground">
        MFA deve ser exigido para contas administrativas e para operações financeiras críticas.
        A configuração é feita no provedor de autenticação.
      </p>
    </div>
  );
}
