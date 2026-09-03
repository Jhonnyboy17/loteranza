import * as React from 'react';
import { Link } from 'react-router-dom';
import { SearchCheck } from 'lucide-react';
import { brand } from '@/config/brand';
import { useAuth } from '@/contexts/AuthContext';
import { useDemoState } from '@/hooks/useDemoState';
import { useGames, useHistoricalResults } from '@/hooks/useLotteryQueries';
import { countMatches } from '@/lib/utils';
import { formatDate, formatUSD } from '@/lib/format';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { NumberSequence } from '@/components/lottery/NumberBall';
import { usePrizeTiers } from '@/hooks/useLotteryQueries';

/**
 * Conferidor de numeros (secao 22).
 *
 * O resultado exibido aqui e uma CONFERENCIA, nao uma confirmacao de premio.
 * Prêmio so e tratado como definitivo apos validacao do resultado oficial —
 * a interface diz isso explicitamente sempre que ha acerto.
 */
export function CheckNumbersPage() {
  const gamesQuery = useGames();
  const { isAuthenticated } = useAuth();
  const demo = useDemoState();

  const activeGames = (gamesQuery.data ?? []).filter((g) => g.status === 'active');
  const [gameId, setGameId] = React.useState<string>('');
  const game = activeGames.find((g) => g.id === gameId) ?? activeGames[0] ?? null;

  const resultsQuery = useHistoricalResults(game?.id, { limit: 20 });
  const tiersQuery = usePrizeTiers(game?.id);

  const [drawId, setDrawId] = React.useState<string>('');
  const [main, setMain] = React.useState<string>('');
  const [special, setSpecial] = React.useState<string>('');
  const [checked, setChecked] = React.useState<null | {
    mainMatches: number;
    specialMatches: number;
    tierLabel: string | null;
    prize: number | null;
    drawnMain: number[];
    drawnSpecial: number[];
    picked: number[];
    pickedSpecial: number[];
  }>(null);

  const results = resultsQuery.data ?? [];
  const selectedResult = results.find((r) => r.draw.id === drawId) ?? results[0] ?? null;

  const parseNumbers = (value: string): number[] =>
    value
      .split(/[\s,;]+/)
      .map((v) => Number(v.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);

  const check = (event: React.FormEvent) => {
    event.preventDefault();
    if (!game || !selectedResult) return;

    const picked = parseNumbers(main);
    const pickedSpecial = parseNumbers(special);
    const mainMatches = countMatches(picked, selectedResult.mainNumbers);
    const specialMatches = countMatches(pickedSpecial, selectedResult.specialNumbers);

    const tier = (tiersQuery.data ?? []).find(
      (t) => t.mainMatches === mainMatches && t.specialMatches === specialMatches,
    );

    setChecked({
      mainMatches,
      specialMatches,
      tierLabel: tier?.label ?? null,
      prize: tier?.fixedPrize ?? null,
      drawnMain: selectedResult.mainNumbers,
      drawnSpecial: selectedResult.specialNumbers,
      picked,
      pickedSpecial,
    });
  };

  return (
    <div className="container py-10">
      <Seo
        title="Confira seus números"
        description="Compare os números que você jogou com o resultado do sorteio e veja quantos acertos teve."
        canonicalPath="/conferir-numeros"
      />

      <header className="mb-8 max-w-2xl">
        <h1 className="text-display-xl font-extrabold">Confira seus números</h1>
        <p className="mt-2 text-muted-foreground">
          Escolha a modalidade e o sorteio, informe seus números e veja quantos acertos você teve.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <form onSubmit={check} className="surface space-y-5 p-6">
          <Field label="Loteria" htmlFor="game">
            <Select value={game?.id ?? ''} onValueChange={setGameId}>
              <SelectTrigger id="game"><SelectValue placeholder="Escolha a modalidade" /></SelectTrigger>
              <SelectContent>
                {activeGames.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Sorteio" htmlFor="draw">
            <Select value={selectedResult?.draw.id ?? ''} onValueChange={setDrawId}>
              <SelectTrigger id="draw"><SelectValue placeholder="Escolha a data" /></SelectTrigger>
              <SelectContent>
                {results.map((r) => (
                  <SelectItem key={r.draw.id} value={r.draw.id}>
                    {formatDate(r.draw.drawDate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {game && (
            <>
              <Field
                label="Seus números"
                htmlFor="main"
                required
                hint={`${game.mainNumbersCount} números de ${game.mainNumberMin} a ${game.mainNumberMax}, separados por espaço ou vírgula`}
              >
                <Input
                  id="main" inputMode="numeric" placeholder="07 16 28 41 62"
                  value={main} onChange={(e) => setMain(e.target.value)}
                />
              </Field>

              {game.specialNumbersCount > 0 && (
                <Field
                  label={game.specialNumberLabel ?? 'Número especial'}
                  htmlFor="special"
                  hint={`De ${game.specialNumberMin} a ${game.specialNumberMax}`}
                >
                  <Input
                    id="special" inputMode="numeric" placeholder="13"
                    value={special} onChange={(e) => setSpecial(e.target.value)}
                  />
                </Field>
              )}
            </>
          )}

          <Button type="submit" size="lg" block disabled={!selectedResult}>
            <SearchCheck aria-hidden /> Conferir
          </Button>

          <p className="text-xs text-muted-foreground">{brand.oddsNotice}</p>
        </form>

        <div className="space-y-6">
          {selectedResult && (
            <section className="surface space-y-3 p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-semibold">
                  Resultado de {formatDate(selectedResult.draw.drawDate)}
                </h2>
                {!selectedResult.isOfficial && <Badge variant="warning">Preliminar</Badge>}
              </div>
              <NumberSequence
                numbers={selectedResult.mainNumbers}
                specialNumbers={selectedResult.specialNumbers}
              />
            </section>
          )}

          {checked && (
            <section className="surface space-y-4 p-6" aria-live="polite">
              <h2 className="font-display text-lg font-semibold">Sua conferência</h2>

              <NumberSequence
                numbers={checked.picked}
                specialNumbers={checked.pickedSpecial}
                matchedMain={checked.drawnMain}
                matchedSpecial={checked.drawnSpecial}
              />

              <p className="text-sm">
                <strong className="tnum">{checked.mainMatches}</strong> acerto(s) nos números
                principais
                {checked.pickedSpecial.length > 0 && (
                  <>
                    {' '}e <strong className="tnum">{checked.specialMatches}</strong> no número
                    especial
                  </>
                )}
                .
              </p>

              {checked.tierLabel ? (
                <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                  <p className="font-medium">Faixa de premiação: {checked.tierLabel}</p>
                  {checked.prize !== null && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Valor de referência: {formatUSD(checked.prize)}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">
                    Esta é uma conferência informativa. Um prêmio só é tratado como definitivo
                    após a validação do resultado oficial pelo órgão responsável.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Esta combinação não corresponde a nenhuma faixa de premiação neste sorteio.
                </p>
              )}
            </section>
          )}

          {/* Conferência automática para quem tem bilhetes na conta */}
          <section className="rounded-xl border border-border bg-muted/30 p-6">
            <h2 className="font-display text-base font-semibold">Conferência automática</h2>
            {isAuthenticated ? (
              demo.tickets.length > 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Você tem {demo.tickets.length} bilhete(s) na conta. Eles são conferidos
                  automaticamente assim que o resultado é recebido — veja em{' '}
                  <Link to="/meus-jogos" className="underline underline-offset-4">Meus jogos</Link>.
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Quando houver bilhetes na sua conta, eles serão conferidos automaticamente a cada
                  sorteio, sem você precisar digitar nada.
                </p>
              )
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  Com uma conta, todos os seus bilhetes são conferidos automaticamente a cada
                  sorteio e você é avisado se houver acerto.
                </p>
                <Button asChild variant="outline" className="mt-4">
                  <Link to="/criar-conta">Criar conta</Link>
                </Button>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
