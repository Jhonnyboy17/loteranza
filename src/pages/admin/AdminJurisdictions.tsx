import * as React from 'react';
import { AlertTriangle, Globe2 } from 'lucide-react';
import type { JurisdictionRule } from '@/types/domain';
import { usePlatform } from '@/contexts/PlatformContext';
import { useGames } from '@/hooks/useLotteryQueries';
import { useToast } from '@/components/ui/toast';
import { formatDateTime, formatUSD } from '@/lib/format';
import { Seo } from '@/components/common/Seo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { Checkbox, Separator, Switch } from '@/components/ui/misc';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper,
} from '@/components/ui/table';

/**
 * Gestao de jurisdicoes (secao 12).
 *
 * Esta e a tela que efetivamente autoriza transacoes em um pais/estado. Por
 * isso: confirmacao explicita antes de habilitar, registro de quem habilitou e
 * quando, e log de auditoria com severidade critica.
 */
export function AdminJurisdictions() {
  const { jurisdictions, updateJurisdiction } = usePlatform();
  const gamesQuery = useGames();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState<JurisdictionRule | null>(null);
  const [confirming, setConfirming] = React.useState<JurisdictionRule | null>(null);

  const label = (rule: JurisdictionRule) =>
    rule.state ? `${rule.country}-${rule.state}` : rule.country;

  const enable = async (rule: JurisdictionRule) => {
    await updateJurisdiction(rule.id, { transactionsEnabled: true });
    toast({
      title: `Transações habilitadas em ${label(rule)}`,
      description: 'A ação foi registrada no log de auditoria.',
      variant: 'warning',
    });
    setConfirming(null);
  };

  const disable = async (rule: JurisdictionRule) => {
    await updateJurisdiction(rule.id, { transactionsEnabled: false, paymentEnabled: false });
    toast({ title: `Transações desabilitadas em ${label(rule)}`, variant: 'success' });
  };

  return (
    <div className="space-y-6">
      <Seo title="Jurisdições" description="Regras por país e estado." noIndex />

      <header>
        <h1 className="font-display text-2xl font-bold">Jurisdições</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Cada país ou estado tem sua própria regra. O padrão é negar: uma jurisdição só aceita
          transações após ser habilitada aqui, e essa decisão fica registrada.
        </p>
      </header>

      <div className="notice-strip border-warning/40 bg-warning/5">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <p className="text-sm">
          Habilitar uma jurisdição deve acontecer somente após parecer jurídico e, quando exigido,
          licenciamento formal para a operação naquele local. A plataforma não valida isso por
          você — apenas registra quem tomou a decisão.
        </p>
      </div>

      <TableWrapper>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jurisdição</TableHead>
              <TableHead>Transações</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Idade mín.</TableHead>
              <TableHead>KYC</TableHead>
              <TableHead>Jogos liberados</TableHead>
              <TableHead>Máx. por transação</TableHead>
              <TableHead>Atualizado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {jurisdictions.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-2">
                    <Globe2 className="size-4 text-muted-foreground" aria-hidden />
                    {label(rule)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={rule.transactionsEnabled ? 'success' : 'neutral'}>
                    {rule.transactionsEnabled ? 'Habilitadas' : 'Bloqueadas'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={rule.paymentEnabled ? 'success' : 'neutral'}>
                    {rule.paymentEnabled ? 'Sim' : 'Não'}
                  </Badge>
                </TableCell>
                <TableCell className="tnum">{rule.minimumAge}</TableCell>
                <TableCell>{rule.kycRequired ? 'Exigido' : 'Dispensado'}</TableCell>
                <TableCell className="text-muted-foreground">
                  {rule.allowedGames.length > 0 ? rule.allowedGames.join(', ') : 'nenhum'}
                </TableCell>
                <TableCell className="tnum">
                  {rule.maxTransaction !== null ? formatUSD(rule.maxTransaction) : '—'}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(rule.updatedAt)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(rule)}>
                      Editar
                    </Button>
                    {rule.transactionsEnabled ? (
                      <Button variant="ghost" size="sm" onClick={() => disable(rule)}>
                        Desabilitar
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setConfirming(rule)}>
                        Habilitar
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableWrapper>

      {/* Confirmação explícita para habilitar */}
      <Dialog open={Boolean(confirming)} onOpenChange={(open) => !open && setConfirming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Habilitar transações em {confirming ? label(confirming) : ''}?
            </DialogTitle>
            <DialogDescription>
              Isto abre o portão de jurisdição para esta localidade. Compras ainda dependem do kill
              switch global e da aprovação do Compliance Engine, mas esta é a decisão que assume a
              responsabilidade regulatória pela operação neste local.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-muted/60 p-4 text-sm">
            <p className="font-medium">Antes de confirmar, verifique:</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>• Existe parecer jurídico favorável para este país/estado.</li>
              <li>• O licenciamento exigido, se houver, está em vigor.</li>
              <li>• A idade mínima e a exigência de KYC estão corretas.</li>
              <li>• Os jogos liberados foram revisados.</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)}>Cancelar</Button>
            <Button onClick={() => confirming && enable(confirming)}>
              Confirmar e habilitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor da regra */}
      <JurisdictionEditor
        rule={editing}
        gameKeys={(gamesQuery.data ?? []).map((g) => g.gameKey)}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          if (!editing) return;
          await updateJurisdiction(editing.id, patch);
          toast({ title: 'Regra atualizada', variant: 'success' });
          setEditing(null);
        }}
      />
    </div>
  );
}

function JurisdictionEditor({
  rule, gameKeys, onClose, onSave,
}: {
  rule: JurisdictionRule | null;
  gameKeys: string[];
  onClose: () => void;
  onSave: (patch: Partial<JurisdictionRule>) => Promise<void>;
}) {
  const [draft, setDraft] = React.useState<Partial<JurisdictionRule>>({});

  React.useEffect(() => {
    setDraft(rule ? { ...rule } : {});
  }, [rule]);

  if (!rule) return null;

  const toggleGame = (key: string, checked: boolean) => {
    const current = draft.allowedGames ?? [];
    setDraft((c) => ({
      ...c,
      allowedGames: checked ? [...current, key] : current.filter((g) => g !== key),
    }));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Regras de {rule.state ? `${rule.country}-${rule.state}` : rule.country}
          </DialogTitle>
          <DialogDescription>
            Estas configurações alimentam diretamente o Compliance Engine.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="payment-enabled">Pagamento habilitado</Label>
            <Switch
              id="payment-enabled"
              checked={draft.paymentEnabled ?? false}
              onCheckedChange={(v) => setDraft((c) => ({ ...c, paymentEnabled: v }))}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="subs-enabled">Assinaturas permitidas</Label>
            <Switch
              id="subs-enabled"
              checked={draft.subscriptionsEnabled ?? false}
              onCheckedChange={(v) => setDraft((c) => ({ ...c, subscriptionsEnabled: v }))}
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="kyc-required">Verificação de identidade exigida</Label>
            <Switch
              id="kyc-required"
              checked={draft.kycRequired ?? true}
              onCheckedChange={(v) => setDraft((c) => ({ ...c, kycRequired: v }))}
            />
          </div>

          <Separator />

          <Field label="Idade mínima" htmlFor="min-age">
            <Input
              id="min-age" type="number" min={18} max={99}
              value={draft.minimumAge ?? 18}
              onChange={(e) => setDraft((c) => ({ ...c, minimumAge: Number(e.target.value) }))}
            />
          </Field>

          <Field
            label="Valor máximo por transação (USD)"
            htmlFor="max-tx"
            hint="Deixe vazio para não aplicar limite."
          >
            <Input
              id="max-tx" inputMode="decimal"
              value={draft.maxTransaction ?? ''}
              onChange={(e) =>
                setDraft((c) => ({
                  ...c,
                  maxTransaction: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
            />
          </Field>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Jogos liberados</legend>
            <p className="text-xs text-muted-foreground">
              Nenhum jogo marcado significa que nenhuma modalidade pode ser comprada nesta
              jurisdição.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {gameKeys.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={(draft.allowedGames ?? []).includes(key)}
                    onCheckedChange={(v) => toggleGame(key, v === true)}
                  />
                  {key}
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Aviso legal exibido ao usuário" htmlFor="legal-notice">
            <Input
              id="legal-notice"
              value={draft.legalNotice ?? ''}
              onChange={(e) => setDraft((c) => ({ ...c, legalNotice: e.target.value }))}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(draft)}>Salvar regras</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
