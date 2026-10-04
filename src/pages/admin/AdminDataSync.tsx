import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { isDemoDataMode } from '@/config/env';
import { formatDateTime } from '@/lib/format';
import { Seo } from '@/components/common/Seo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper,
} from '@/components/ui/table';
import { EmptyState, LoadingRows } from '@/components/common/states';
import { NumberSequence } from '@/components/lottery/NumberBall';

/**
 * Operacao da sincronizacao automatica.
 *
 * Duas perguntas, uma tela:
 *   1. "as rotinas estao rodando?" — e, quando nao estao, POR QUE;
 *   2. "o que esta esperando conferencia humana?"
 *
 * A segunda existe porque o sistema promove um resultado a oficial sozinho
 * apenas quando duas fontes independentes concordam. Com uma fonte so, ou com
 * fontes divergentes, ele para e pede gente — e esta e a fila dessa gente.
 */

interface SyncHealthRow {
  job: string;
  provider: string | null;
  status: string | null;
  last_run_at: string | null;
  items_ok: number | null;
  items_failed: number | null;
  error_message: string | null;
  minutes_since: number | null;
  failures_24h: number | null;
}

interface PendingRow {
  draw_id: string;
  game_key: string;
  game_name: string;
  draw_date: string;
  draw_at: string;
  main_numbers: number[] | null;
  special_numbers: number[] | null;
  source: string | null;
  observations: number;
  distinct_readings: number;
  breakdown_rows: number;
  reason: string;
}

const REASON_LABEL: Record<string, { label: string; tone: 'warn' | 'info' | 'ok' }> = {
  SOURCES_DISAGREE: { label: 'Fontes divergem', tone: 'warn' },
  AWAITING_SECOND_SOURCE: { label: 'Aguardando 2ª fonte', tone: 'info' },
  READY: { label: 'Pronto para conferir', tone: 'ok' },
};

export function AdminDataSync() {
  const health = useQuery<SyncHealthRow[]>({
    queryKey: ['sync-health'],
    enabled: !isDemoDataMode && supabase !== null,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase!.from('sync_health').select('*').order('job');
      if (error) throw error;
      return (data ?? []) as SyncHealthRow[];
    },
  });

  const pending = useQuery<PendingRow[]>({
    queryKey: ['draw-results-pending'],
    enabled: !isDemoDataMode && supabase !== null,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from('draw_results_pending_review').select('*').limit(50);
      if (error) throw error;
      return (data ?? []) as PendingRow[];
    },
  });

  if (isDemoDataMode) {
    return (
      <div className="space-y-6">
        <Seo title="Sincronização" description="Operação da sincronização de dados." noIndex />
        <Header />
        <EmptyState
          title="Sem backend configurado"
          description="Esta tela lê o diário de execuções e a fila de conferência do banco. Em modo de demonstração não há nem um nem outro."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Seo title="Sincronização" description="Operação da sincronização de dados." noIndex />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Header />
        <Button
          variant="outline"
          onClick={() => { health.refetch(); pending.refetch(); }}
        >
          <RefreshCw aria-hidden /> Atualizar
        </Button>
      </div>

      {/* ---- saude das rotinas ------------------------------------------ */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold">Rotinas</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Toda execução fica registrada, inclusive quando falha. As linhas com sufixo{' '}
            <code className="text-xs">.dispatch</code> são o disparo do agendador; disparo sem a
            execução correspondente significa que a função recusou a chamada — e a mensagem de
            erro diz qual é o caso.
          </p>
        </div>

        {health.isLoading ? <LoadingRows /> : (health.data ?? []).length === 0 ? (
          <EmptyState
            title="Nenhuma execução registrada"
            description="O agendador ainda não rodou nenhuma vez, ou as rotinas não foram agendadas neste projeto."
          />
        ) : (
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rotina</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Última execução</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Falhas 24h</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(health.data ?? []).map((row) => (
                  <TableRow key={row.job}>
                    <TableCell className="font-medium">{row.job}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} minutesSince={row.minutes_since} />
                      {row.error_message && (
                        <p className="mt-1 max-w-md text-xs text-muted-foreground">{row.error_message}</p>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {row.last_run_at ? formatDateTime(row.last_run_at) : '—'}
                      {row.minutes_since !== null && (
                        <span className="block text-xs text-muted-foreground">
                          há {row.minutes_since} min
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{row.provider ?? '—'}</TableCell>
                    <TableCell className="tabular-nums">{row.failures_24h ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        )}
      </section>

      {/* ---- fila de conferencia ---------------------------------------- */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold">Resultados aguardando conferência</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Sorteios já realizados cujo resultado ainda não é oficial. O sistema promove sozinho
            quando duas fontes independentes concordam; quando elas divergem, ele para aqui de
            propósito — escolher a leitura mais conveniente seria pior do que esperar.
          </p>
        </div>

        {pending.isLoading ? <LoadingRows /> : (pending.data ?? []).length === 0 ? (
          <EmptyState
            title="Nada pendente"
            description="Todos os sorteios realizados têm resultado oficial."
          />
        ) : (
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loteria</TableHead>
                  <TableHead>Sorteio</TableHead>
                  <TableHead>Números lidos</TableHead>
                  <TableHead>Leituras</TableHead>
                  <TableHead>Quebra por faixa</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pending.data ?? []).map((row) => {
                  const reason = REASON_LABEL[row.reason] ?? { label: row.reason, tone: 'info' as const };
                  return (
                    <TableRow key={row.draw_id}>
                      <TableCell className="font-medium">{row.game_name}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{row.draw_date}</TableCell>
                      <TableCell>
                        {row.main_numbers?.length ? (
                          <NumberSequence
                            numbers={row.main_numbers}
                            specialNumbers={row.special_numbers ?? []}
                            size="sm"
                          />
                        ) : (
                          <span className="text-sm text-muted-foreground">nenhuma leitura ainda</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {row.observations}
                        {row.distinct_readings > 1 && (
                          <span className="ml-1 text-xs text-destructive">
                            ({row.distinct_readings} versões)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {row.breakdown_rows > 0
                          ? `${row.breakdown_rows} faixas`
                          : <span className="text-muted-foreground">pendente</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={reason.tone === 'warn' ? 'danger' : reason.tone === 'ok' ? 'success' : 'neutral'}>
                          {reason.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableWrapper>
        )}
      </section>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Sincronização</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Jackpots, resultados e cotação são atualizados por rotinas agendadas. Esta tela mostra se
        elas estão rodando e o que ficou esperando decisão humana.
      </p>
    </div>
  );
}

function StatusBadge({ status, minutesSince }: { status: string | null; minutesSince: number | null }) {
  // Uma rotina que ficou "running" por muito tempo nao terminou: a funcao
  // caiu no meio, ou nunca chegou a responder. Mostrar isso como "em
  // andamento" indefinidamente esconderia a falha.
  const stuck = status === 'running' && (minutesSince ?? 0) > 15;

  if (stuck) {
    return (
      <Badge variant="danger" className="gap-1">
        <AlertTriangle className="size-3" aria-hidden /> Travada
      </Badge>
    );
  }
  if (status === 'success') {
    return (
      <Badge variant="success" className="gap-1">
        <CheckCircle2 className="size-3" aria-hidden /> Sucesso
      </Badge>
    );
  }
  if (status === 'partial') {
    return <Badge variant="warning" className="gap-1">Parcial</Badge>;
  }
  if (status === 'running') {
    return (
      <Badge variant="neutral" className="gap-1">
        <Clock className="size-3" aria-hidden /> Em andamento
      </Badge>
    );
  }
  return (
    <Badge variant="danger" className="gap-1">
      <AlertTriangle className="size-3" aria-hidden /> Falhou
    </Badge>
  );
}
