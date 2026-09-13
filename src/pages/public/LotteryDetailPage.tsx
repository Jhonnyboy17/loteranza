import * as React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Plus, Trash2 } from 'lucide-react';
import type { GameLine, LotteryGame } from '@/types/domain';
import { brand } from '@/config/brand';
import { usePlatform } from '@/contexts/PlatformContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/components/ui/toast';
import {
  useGame, useHistoricalResults, usePrizeTiers, useUpcomingDraws,
} from '@/hooks/useLotteryQueries';
import {
  formatBRL, formatDate, formatOdds, formatUSD, weekdayName,
} from '@/lib/format';
import { convert } from '@/services/exchange/exchangeService';
import { priceLines } from '@/services/pricing';
import { Seo } from '@/components/common/Seo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Checkbox, Separator } from '@/components/ui/misc';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper,
} from '@/components/ui/table';
import { ErrorState, LoadingCards } from '@/components/common/states';
import { GameTheme } from '@/components/lottery/GameTheme';
import { GameBanner } from '@/components/lottery/GameBanner';
import { NumberPicker } from '@/components/lottery/NumberPicker';
import { NumberSequence } from '@/components/lottery/NumberBall';
import { JurisdictionNotice } from '@/components/compliance/notices';
import { cn } from '@/lib/utils';

type Step = 'numeros' | 'revisar';

const QUICK_COUNTS = [2, 3, 5, 10];
const DRAW_PRESETS = [1, 2, 5, 10];

export function LotteryDetailPage() {
  const { gameKey } = useParams<{ gameKey: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { rate, jurisdiction } = usePlatform();
  const { addItem, setOpen } = useCart();
  const { toast } = useToast();

  const gameQuery = useGame(gameKey);
  const game = gameQuery.data ?? null;

  const drawsQuery = useUpcomingDraws(game?.id, game?.maxDrawsAhead ?? 10);
  const draws = drawsQuery.data ?? [];
  const nextDraw = draws[0] ?? null;

  const [lines, setLines] = React.useState<GameLine[]>([]);
  const [drawsCount, setDrawsCount] = React.useState(1);
  const [multiplier, setMultiplier] = React.useState(false);

  // A etapa vive na URL: o botão voltar do navegador funciona naturalmente.
  const step: Step = searchParams.get('etapa') === 'revisar' ? 'revisar' : 'numeros';
  const goToStep = React.useCallback(
    (next: Step) => {
      setSearchParams(next === 'numeros' ? {} : { etapa: next });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [setSearchParams],
  );

  // Sem nenhuma aposta montada não há o que revisar — volta para a etapa 1.
  React.useEffect(() => {
    if (step === 'revisar' && lines.length === 0) setSearchParams({});
  }, [step, lines.length, setSearchParams]);

  const addLines = React.useCallback(
    (incoming: Omit<GameLine, 'id'>[]) => {
      const room = (game?.maxLinesPerOrder ?? 20) - lines.length;
      const accepted = incoming.slice(0, Math.max(0, room));
      if (accepted.length === 0) {
        toast({
          title: `Limite de ${game?.maxLinesPerOrder} jogos por pedido`,
          variant: 'warning',
        });
        return;
      }
      setLines((current) => [
        ...current,
        ...accepted.map((line) => ({ ...line, id: `line-${crypto.randomUUID()}` })),
      ]);
      goToStep('revisar');
    },
    [game?.maxLinesPerOrder, lines.length, goToStep, toast],
  );

  const totals = React.useMemo(() => {
    if (!game) return null;
    const withOptions = lines.map((line) => ({
      ...line,
      options: multiplier && game.multiplierEnabled ? { multiplier: true } : {},
    }));
    return priceLines(game, withOptions, drawsCount);
  }, [game, lines, drawsCount, multiplier]);

  const handleAddToCart = () => {
    if (!game || lines.length === 0) return;
    const payload = lines.map(({ id: _id, ...rest }) => ({
      ...rest,
      options: multiplier && game.multiplierEnabled ? { multiplier: true } : {},
    }));
    addItem(game, payload, nextDraw?.id ?? null, drawsCount);
    setLines([]);
    setMultiplier(false);
    setDrawsCount(1);
    setSearchParams({});
    toast({
      title: 'Adicionado ao carrinho',
      description: `${payload.length} ${payload.length === 1 ? 'jogo' : 'jogos'} de ${game.name}.`,
      variant: 'success',
    });
    setOpen(true);
  };

  if (gameQuery.isLoading) {
    return <div className="container py-10"><LoadingCards count={2} /></div>;
  }

  if (gameQuery.isError || !game) {
    return (
      <div className="container py-16">
        <ErrorState
          title="Modalidade não encontrada"
          description="Verifique o endereço ou volte ao catálogo de loterias."
          onRetry={() => navigate('/loterias')}
        />
      </div>
    );
  }

  return (
    <GameTheme game={game} className="pb-16">
      <Seo
        title={`${game.name} — jackpot, sorteios e como jogar`}
        description={`${game.name}: jackpot estimado, data do próximo sorteio, regras de números, tabela de premiação e resultados anteriores.`}
        canonicalPath={`/loterias/${game.gameKey}`}
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: game.name,
          description: game.description ?? undefined,
          brand: { '@type': 'Brand', name: game.operatorName ?? game.name },
        }}
      />

      <GameBanner game={game} draw={nextDraw} rate={rate} />

      <div className="container max-w-3xl py-10">
        <StepIndicator step={step} lineCount={lines.length} />

        {step === 'numeros' ? (
          <StepNumbers
            game={game}
            lineCount={lines.length}
            onAdd={(line) => addLines([line])}
            onQuickGenerate={addLines}
            onBackToReview={lines.length > 0 ? () => goToStep('revisar') : undefined}
          />
        ) : (
          <StepReview
            game={game}
            lines={lines}
            drawsCount={drawsCount}
            multiplier={multiplier}
            totals={totals}
            rate={rate}
            jurisdiction={jurisdiction}
            onDrawsCountChange={setDrawsCount}
            onMultiplierChange={setMultiplier}
            onAddMore={() => goToStep('numeros')}
            onRemove={(id) => setLines((c) => c.filter((l) => l.id !== id))}
            onDuplicate={(id) =>
              setLines((c) => {
                const source = c.find((l) => l.id === id);
                if (!source || c.length >= game.maxLinesPerOrder) return c;
                return [...c, { ...source, id: `line-${crypto.randomUUID()}` }];
              })
            }
            onConfirm={handleAddToCart}
          />
        )}
      </div>

      <GameReference game={game} />
    </GameTheme>
  );
}

/* ========================================================================== */

function StepIndicator({ step, lineCount }: { step: Step; lineCount: number }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'numeros', label: 'Seus números' },
    { key: 'revisar', label: 'Revisar' },
  ];
  const activeIndex = steps.findIndex((s) => s.key === step);

  return (
    <ol className="mb-8 flex items-center justify-center gap-3" aria-label="Etapas">
      {steps.map((item, index) => {
        const done = index < activeIndex || (index === 0 && lineCount > 0 && step === 'revisar');
        const current = index === activeIndex;
        return (
          <li key={item.key} className="flex items-center gap-3">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-xs font-bold transition',
                  done && 'bg-primary text-primary-foreground',
                  current && !done && 'bg-primary text-primary-foreground',
                  !current && !done && 'bg-muted text-muted-foreground',
                )}
                aria-current={current ? 'step' : undefined}
              >
                {done && !current ? <Check className="size-4" aria-hidden /> : index + 1}
              </span>
              <span className={cn('text-sm', current ? 'font-semibold' : 'text-muted-foreground')}>
                {item.label}
              </span>
            </span>
            {index < steps.length - 1 && (
              <span className="h-px w-8 bg-border sm:w-12" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ========================================================================== */

function StepNumbers({
  game, lineCount, onAdd, onQuickGenerate, onBackToReview,
}: {
  game: LotteryGame;
  lineCount: number;
  onAdd: (line: Omit<GameLine, 'id'>) => void;
  onQuickGenerate: (lines: Omit<GameLine, 'id'>[]) => void;
  onBackToReview?: () => void;
}) {
  const allowsRepetition = game.mainNumberMin === 0;

  const generate = (count: number) => {
    // Import dinâmico evitaria carregar o RNG antes da hora; aqui o custo é
    // irrelevante e a leitura fica mais simples.
    import('@/lib/rng').then(({ pickDistinct, pickWithRepetition }) => {
      onQuickGenerate(
        Array.from({ length: count }, () => ({
          numbers: allowsRepetition
            ? pickWithRepetition(game.mainNumbersCount, game.mainNumberMin, game.mainNumberMax)
            : pickDistinct(game.mainNumbersCount, game.mainNumberMin, game.mainNumberMax),
          specialNumbers:
            game.specialNumbersCount > 0
              ? pickDistinct(game.specialNumbersCount, game.specialNumberMin, game.specialNumberMax)
              : [],
          isQuickPick: true,
          options: {},
        })),
      );
    });
  };

  return (
    <div className="space-y-8">
      {onBackToReview && (
        <Button variant="ghost" size="sm" onClick={onBackToReview} className="-ml-3">
          <ArrowLeft aria-hidden /> Voltar para os {lineCount} jogos
        </Button>
      )}

      <NumberPicker game={game} onSubmit={onAdd} submitLabel="Continuar" />

      <div className="space-y-3 border-t border-border pt-6">
        <p className="text-center text-sm text-muted-foreground">
          ou gere vários de uma vez
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {QUICK_COUNTS.map((count) => (
            <Button key={count} variant="outline" size="sm" onClick={() => generate(count)}>
              {count} jogos
            </Button>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">{brand.oddsNotice}</p>
    </div>
  );
}

/* ========================================================================== */

function StepReview({
  game, lines, drawsCount, multiplier, totals, rate, jurisdiction,
  onDrawsCountChange, onMultiplierChange, onAddMore, onRemove, onDuplicate, onConfirm,
}: {
  game: LotteryGame;
  lines: GameLine[];
  drawsCount: number;
  multiplier: boolean;
  totals: { official: number; fee: number; total: number } | null;
  rate: ReturnType<typeof usePlatform>['rate'];
  jurisdiction: ReturnType<typeof usePlatform>['jurisdiction'];
  onDrawsCountChange: (n: number) => void;
  onMultiplierChange: (v: boolean) => void;
  onAddMore: () => void;
  onRemove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onConfirm: () => void;
}) {
  const brl = totals && rate ? convert(totals.total, rate) : null;

  return (
    <div className="space-y-8">
      {/* Jogos montados */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">
            {lines.length} {lines.length === 1 ? 'jogo' : 'jogos'}
          </h2>
        </div>

        <ul className="space-y-2">
          {lines.map((line, index) => (
            <li
              key={line.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <span className="tnum w-6 text-sm text-muted-foreground">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <NumberSequence
                  numbers={line.numbers}
                  specialNumbers={line.specialNumbers}
                  size="sm"
                />
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost" size="icon"
                  onClick={() => onDuplicate(line.id)}
                  aria-label={`Duplicar jogo ${index + 1}`}
                >
                  <Copy aria-hidden />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => onRemove(line.id)}
                  aria-label={`Remover jogo ${index + 1}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <Button variant="outline" size="lg" block onClick={onAddMore}>
          <Plus aria-hidden /> Adicionar outro jogo
        </Button>
      </section>

      {/* Sorteios */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Em quantos sorteios?</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quantidade de sorteios">
          {DRAW_PRESETS.filter((n) => n <= game.maxDrawsAhead).map((count) => (
            <Button
              key={count}
              variant={drawsCount === count ? 'primary' : 'outline'}
              size="lg"
              onClick={() => onDrawsCountChange(count)}
              aria-pressed={drawsCount === count}
              className="flex-1"
            >
              {count}
            </Button>
          ))}
        </div>
      </section>

      {/* Multiplicador, quando a modalidade oferece */}
      {game.multiplierEnabled && (
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Checkbox
            checked={multiplier}
            onCheckedChange={(checked) => onMultiplierChange(checked === true)}
          />
          <span className="flex-1">
            <span className="block font-medium">{game.multiplierLabel}</span>
            <span className="block text-sm text-muted-foreground">
              + {formatUSD(game.multiplierPrice)} por jogo
            </span>
          </span>
        </label>
      )}

      {/* Preço — produto e taxa sempre separados */}
      {totals && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-5">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Apostas</dt>
              <dd className="tnum">{formatUSD(totals.official)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Taxa de serviço</dt>
              <dd className="tnum">{formatUSD(totals.fee)}</dd>
            </div>
            <Separator />
            <div className="flex items-baseline justify-between gap-4">
              <dt className="font-semibold">Total</dt>
              <dd className="tnum font-display text-2xl font-bold">{formatUSD(totals.total)}</dd>
            </div>
          </dl>
          {brl !== null && (
            <p className="text-right text-sm text-muted-foreground">
              ≈ {formatBRL(brl)} <span className="text-xs">(estimativa)</span>
            </p>
          )}
        </section>
      )}

      {!jurisdiction?.transactionsEnabled && (
        <JurisdictionNotice jurisdiction={jurisdiction} />
      )}

      <Button size="xl" block onClick={onConfirm}>
        Adicionar ao carrinho
      </Button>
    </div>
  );
}

/* ==========================================================================
 * Conteúdo de referência: fica abaixo do fluxo, fora do caminho de quem só
 * quer jogar.
 * ========================================================================== */

function GameReference({ game }: { game: LotteryGame }) {
  const tiersQuery = usePrizeTiers(game.id);
  const resultsQuery = useHistoricalResults(game.id, { limit: 5 });

  return (
    <div className="border-t border-border bg-card/30">
      <div className="container max-w-3xl py-10">
        <Tabs defaultValue="resultados">
          <TabsList>
            <TabsTrigger value="resultados">Resultados</TabsTrigger>
            <TabsTrigger value="como-jogar">Como jogar</TabsTrigger>
            <TabsTrigger value="premiacao">Premiação</TabsTrigger>
            <TabsTrigger value="duvidas">Dúvidas</TabsTrigger>
          </TabsList>

          <TabsContent value="resultados">
            {resultsQuery.isSuccess && resultsQuery.data.length > 0 ? (
              <div className="space-y-3">
                <ul className="space-y-2">
                  {resultsQuery.data.map((result) => (
                    <li
                      key={result.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
                    >
                      <NumberSequence
                        numbers={result.mainNumbers}
                        specialNumbers={result.specialNumbers}
                        size="xs"
                      />
                      <span className="text-sm text-muted-foreground">
                        {formatDate(result.draw.drawDate)}
                        {!result.isOfficial && (
                          <Badge variant="warning" className="ml-2">preliminar</Badge>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant="ghost" size="sm">
                  <Link to={`/resultados/${game.gameKey}`}>Ver histórico completo</Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum resultado registrado ainda.</p>
            )}
          </TabsContent>

          <TabsContent value="como-jogar">
            <div className="space-y-4">
              {game.howToPlay && <p className="leading-relaxed">{game.howToPlay}</p>}
              <dl className="grid gap-3 sm:grid-cols-2">
                <Fact label="Preço por aposta">{formatUSD(game.officialPrice)}</Fact>
                <Fact label="Taxa de serviço">{formatUSD(game.serviceFee)}</Fact>
                <Fact label="Sorteios">
                  {game.drawDays.map((d) => weekdayName(d).replace('-feira', '')).join(', ')}
                </Fact>
                <Fact label="Horário oficial">
                  {game.drawTimeLocal} · {game.timezone}
                </Fact>
              </dl>
              <p className="text-sm text-muted-foreground">{brand.oddsNotice}</p>
            </div>
          </TabsContent>

          <TabsContent value="premiacao">
            {tiersQuery.isSuccess && tiersQuery.data.length > 0 ? (
              <div className="space-y-3">
                <TableWrapper>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Acertos</TableHead>
                        <TableHead>Prêmio</TableHead>
                        <TableHead>Probabilidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tiersQuery.data.map((tier) => (
                        <TableRow key={tier.id}>
                          <TableCell className="font-medium">{tier.label}</TableCell>
                          <TableCell>
                            {tier.isJackpot
                              ? 'Jackpot'
                              : tier.fixedPrize !== null
                                ? formatUSD(tier.fixedPrize)
                                : 'Variável'}
                          </TableCell>
                          <TableCell className="tnum text-muted-foreground">
                            {formatOdds(tier.oddsDenominator)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableWrapper>
                <p className="text-xs text-muted-foreground">
                  Valores conforme a fonte de dados configurada. Prêmios podem sofrer retenção de
                  impostos e variar segundo as regras oficiais e a jurisdição.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Tabela ainda não cadastrada.</p>
            )}
          </TabsContent>

          <TabsContent value="duvidas">
            <Accordion type="single" collapsible>
              <AccordionItem value="oficial">
                <AccordionTrigger>O bilhete é oficial?</AccordionTrigger>
                <AccordionContent>
                  O modelo previsto é a aquisição do bilhete oficial por operador autorizado, com
                  digitalização e guarda. A operação só é habilitada em jurisdições expressamente
                  liberadas. [CONTEÚDO A SER VALIDADO POR ADVOGADO]
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="prazo">
                <AccordionTrigger>Até quando posso enviar meu pedido?</AccordionTrigger>
                <AccordionContent>
                  Os pedidos encerram {game.salesCutoffMinutes} minutos antes do horário oficial
                  ({game.drawTimeLocal}, {game.timezone}). O contador no topo mostra o tempo
                  restante.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="chance">
                <AccordionTrigger>Existe combinação com mais chance?</AccordionTrigger>
                <AccordionContent>
                  Não. {brand.oddsNotice} A escolha rápida usa geração aleatória de qualidade
                  criptográfica apenas para garantir imparcialidade na seleção — isso não altera
                  probabilidade, o que não é possível.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  );
}
