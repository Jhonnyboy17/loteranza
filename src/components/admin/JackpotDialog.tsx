import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { requireSupabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { formatUSD } from '@/lib/format';
import { describeAge, freshness } from '@/lib/freshness';
import type { LotteryGame } from '@/types/domain';

/**
 * Atualizacao manual do jackpot anunciado.
 *
 * POR QUE MANUAL
 *   Jackpot nao e publicado como dado aberto por ninguem: resultado de sorteio
 *   e fato e vira dado publico, mas jackpot e estimativa que a loteria revisa
 *   conforme as vendas entram. Enquanto nao houver fornecedor contratado,
 *   alguem digita — e a trava de validade cobre o esquecimento, trocando o
 *   numero por "Premio a confirmar" em vez de exibir valor velho como atual.
 *
 * O QUE ESTA TELA NAO FAZ
 *   Nao escreve `jackpot_updated_at`. Esse carimbo e definido pelo servidor
 *   dentro de set_game_jackpot(), e nao ha parametro para ele: se o cliente
 *   pudesse mandar a data, poderia carimbar o futuro e desligar a trava.
 */
export function JackpotDialog({
  game, open, onOpenChange, maxAgeHours,
}: {
  game: LotteryGame | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxAgeHours: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [jackpot, setJackpot] = React.useState('');
  const [cash, setCash] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reabrir para outro jogo precisa recarregar os campos; sem isto o dialogo
  // mostraria o valor do jogo anterior.
  React.useEffect(() => {
    if (!open || !game) return;
    setJackpot(game.currentJackpot != null ? String(game.currentJackpot) : '');
    setCash(game.currentJackpotCash != null ? String(game.currentJackpotCash) : '');
    setError(null);
  }, [open, game]);

  if (!game) return null;

  const age = freshness(game.jackpotUpdatedAt, maxAgeHours);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!game) return;

    const parsedJackpot = Number(jackpot);
    const parsedCash = cash.trim() === '' ? null : Number(cash);

    // Validacao local serve so para resposta imediata: a regra que vale e a do
    // banco, que roda de novo em set_game_jackpot().
    if (!Number.isFinite(parsedJackpot) || parsedJackpot <= 0) {
      setError('Informe o valor anunciado, maior que zero.');
      return;
    }
    if (parsedCash !== null && (!Number.isFinite(parsedCash) || parsedCash <= 0)) {
      setError('O valor à vista precisa ser maior que zero, ou ficar vazio.');
      return;
    }
    if (parsedCash !== null && parsedCash > parsedJackpot) {
      setError('O valor à vista não pode superar o anunciado. Os campos parecem trocados.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { error: rpcError } = await requireSupabase().rpc('set_game_jackpot', {
        p_game_id: game.id,
        p_jackpot: parsedJackpot,
        p_cash: parsedCash,
      });
      if (rpcError) throw rpcError;

      await queryClient.invalidateQueries({ queryKey: ['games'] });
      await queryClient.invalidateQueries({ queryKey: ['games-with-draws'] });
      toast({
        variant: 'success',
        title: 'Jackpot atualizado',
        description: `${game.name}: ${formatUSD(parsedJackpot)}. A validade reinicia agora.`,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Atualizar jackpot — {game.name}</DialogTitle>
            <DialogDescription>
              Copie o valor anunciado no site oficial da loteria. O horário da atualização é
              registrado pelo servidor, junto de quem fez a alteração.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <p>
                Valor atual:{' '}
                <strong className="tnum">
                  {game.currentJackpot != null ? formatUSD(game.currentJackpot) : 'não informado'}
                </strong>
              </p>
              <p className="mt-1 text-muted-foreground">
                {age.state === 'unknown'
                  ? 'Nunca atualizado.'
                  : `Atualizado ${describeAge(age.ageHours ?? 0)}.`}
                {age.state === 'stale' && (
                  <strong className="text-destructive">
                    {' '}Vencido — o site mostra “Prêmio a confirmar”.
                  </strong>
                )}
              </p>
            </div>

            <Field
              label="Valor anunciado (USD)"
              htmlFor="jackpot-advertised"
              required
              hint="O prêmio em anuidade, que é o número grande no site da loteria."
            >
              <Input
                id="jackpot-advertised" type="number" inputMode="decimal"
                min="1" step="any" required
                value={jackpot} onChange={(e) => setJackpot(e.target.value)}
                placeholder="467000000"
              />
            </Field>

            <Field
              label="Valor à vista (USD)"
              htmlFor="jackpot-cash"
              hint="Opcional. Sempre menor que o anunciado. Deixe vazio se não souber."
            >
              <Input
                id="jackpot-cash" type="number" inputMode="decimal"
                min="1" step="any"
                value={cash} onChange={(e) => setCash(e.target.value)}
                placeholder="211400000"
              />
            </Field>

            {error && (
              <p role="alert" className="text-sm font-medium text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button" variant="outline"
              onClick={() => onOpenChange(false)} disabled={saving}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando…' : 'Salvar jackpot'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
