import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Diario de execucao.
 *
 * Toda rotina agendada abre uma linha ao comecar e fecha ao terminar, mesmo
 * quando falha — principalmente quando falha. O motivo e que o modo de falha
 * perigoso de um sync nao e o erro: e o silencio. Sem este registro, uma
 * rotina que parou de rodar fica indistinguivel de uma que rodou e nao tinha
 * nada para fazer, e a vitrine segue mostrando dado velho como atual.
 */
export class SyncRun {
  private id: number | null = null;
  private ok = 0;
  private failed = 0;
  private readonly notes: Record<string, unknown> = {};

  private constructor(
    private readonly db: SupabaseClient,
    readonly job: string,
    readonly provider: string,
  ) {}

  static async start(db: SupabaseClient, job: string, provider: string): Promise<SyncRun> {
    const run = new SyncRun(db, job, provider);
    const { data } = await db
      .from('sync_runs')
      .insert({ job, provider, status: 'running' })
      .select('id')
      .single();
    run.id = data?.id ?? null;
    return run;
  }

  success(n = 1): void { this.ok += n; }
  failure(n = 1): void { this.failed += n; }
  note(key: string, value: unknown): void { this.notes[key] = value; }

  /** `partial` existe porque o caso comum nao e tudo-ou-nada: a fonte responde
   *  para um jogo e falha para outro. Chamar isso de sucesso esconde metade do
   *  problema; de falha, esconde a metade que funcionou. */
  async finish(error?: unknown): Promise<void> {
    const status = error
      ? 'failed'
      : this.failed > 0
        ? (this.ok > 0 ? 'partial' : 'failed')
        : 'success';

    if (this.id === null) return;
    await this.db
      .from('sync_runs')
      .update({
        status,
        finished_at: new Date().toISOString(),
        items_ok: this.ok,
        items_failed: this.failed,
        error_message: error ? String(error instanceof Error ? error.message : error).slice(0, 500) : null,
        detail: this.notes,
      })
      .eq('id', this.id);
  }
}
