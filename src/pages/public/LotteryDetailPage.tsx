import * as React from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Sym } from '@/components/ui/icon';
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
import { convert, formatRateLabel } from '@/services/exchange/exchangeService';
import { priceLines } from '@/services/pricing';
import { Seo } from '@/components/common/Seo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Separator } from '@/components/ui/misc';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper,
} from '@/components/ui/table';
import { ErrorState, LoadingCards } from '@/components/common/states';
import { GameTheme } from '@/components/lottery/GameTheme';
import { JackpotHero } from '@/components/lottery/JackpotHero';
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
    <GameTheme game={game} className="pb-space-xl">
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

      <JackpotHero game={game} draw={nextDraw} rate={rate} showCta={false} className="pt-space-sm" />

      <div className="mx-auto w-full max-w-[560px] px-space-md py-space-lg">
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
    <ol className="mb-space-md flex items-center justify-center gap-space-xs" aria-label="Etapas">
      {steps.map((item, index) => {
        const current = index === activeIndex;
        const done = index < activeIndex || (index === 0 && lineCount > 0 && step === 'revisar');
        return (
          <li key={item.key} className="flex items-center gap-space-xs">
            <span
              aria-current={current ? 'step' : undefined}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 font-label-md text-label-md uppercase tracking-wider transition-colors',
                current
                  ? 'bg-surface-container-high font-bold text-secondary'
                  : 'font-semibold text-outline',
              )}
            >
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full font-label-xs text-label-xs font-bold',
                  current
                    ? 'bg-secondary text-on-secondary'
                    : done
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container-highest text-on-surface-variant',
                )}
              >
                {done && !current ? <Sym name="check" size={12} /> : index + 1}
              </span>
              {item.label}
            </span>
            {index < steps.length - 1 && (
              <span className="h-px w-5 bg-outline-variant" aria-hidden />
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
    <div className="flex flex-col gap-space-md">
      {onBackToReview && (
        <button
          type="button"
          onClick={onBackToReview}
          className="-ml-1 flex items-center gap-1 self-start rounded font-label-md text-label-md uppercase tracking-wider text-outline transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Sym name="arrow_back_ios_new" size={16} />
          Voltar para os {lineCount} jogos
        </button>
      )}

      <NumberPicker game={game} lineNumber={lineCount + 1} onSubmit={onAdd} />

      <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md shadow-card">
        <p className="text-center font-body-sm text-body-sm text-outline">
          Ou gere vários de uma vez, com sorteio criptográfico
        </p>
        <div className="flex flex-wrap justify-center gap-space-xs">
          {QUICK_COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => generate(count)}
              className="touch-target rounded-full border border-primary/40 px-4 font-label-md text-label-md uppercase tracking-wider text-on-surface transition-colors hover:border-primary/70 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {count} jogos
            </button>
          ))}
        </div>
      </div>

      <p className="text-center font-label-xs text-label-xs text-outline">{brand.oddsNotice}</p>
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
    <div className="flex flex-col gap-space-md pb-28">
      {/* ---- jogos montados ------------------------------------------- */}
      <section className="flex flex-col gap-space-sm">
        <h2 className="flex items-center gap-1.5 font-headline-sm text-headline-sm text-on-surface">
          <span aria-hidden className="h-4 w-1.5 shrink-0 rounded-full bg-primary" />
          {lines.length} {lines.length === 1 ? 'jogo montado' : 'jogos montados'}
        </h2>

        <ul className="flex flex-col gap-space-xs">
          {lines.map((line, index) => (
            <li
              key={line.id}
              className="flex items-center justify-between gap-space-sm rounded-xl bg-surface-container p-space-sm shadow-card"
            >
              <div className="flex min-w-0 items-center gap-space-sm">
                <span
                  className="shrink-0 rounded bg-surface-container-highest px-1.5 py-0.5 font-label-xs text-label-xs font-bold uppercase tracking-wider"
                  style={{ color: 'hsl(var(--game-bright, var(--primary)))' }}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <NumberSequence
                  numbers={line.numbers}
                  specialNumbers={line.specialNumbers}
                  size="xs"
                />
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onDuplicate(line.id)}
                  aria-label={`Duplicar jogo ${index + 1}`}
                  className="touch-target flex items-center justify-center rounded-full text-outline transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Sym name="add_circle" size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(line.id)}
                  aria-label={`Remover jogo ${index + 1}`}
                  className="touch-target flex items-center justify-center rounded-full text-outline transition-colors hover:bg-surface-container-high hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Sym name="close" size={18} />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onAddMore}
          className="touch-target flex items-center justify-center gap-2 rounded-full border border-primary/40 font-label-lg text-label-lg uppercase tracking-wide text-on-surface transition-colors hover:border-primary/70 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Sym name="add_circle" size={18} /> Adicionar outro jogo
        </button>
      </section>

      {/* ---- sorteios --------------------------------------------------- */}
      <section className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md shadow-card">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-label-lg text-label-lg font-semibold uppercase tracking-wider text-on-surface-variant">
            Em quantos sorteios
          </h2>
          <span
            className="rounded-full bg-surface-container-highest px-2 py-0.5 font-label-md text-label-md font-bold tabular-nums"
            style={{ color: 'hsl(var(--game-bright, var(--primary)))' }}
          >
            {drawsCount}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-space-xs" role="group" aria-label="Quantidade de sorteios">
          {DRAW_PRESETS.filter((n) => n <= game.maxDrawsAhead).map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => onDrawsCountChange(count)}
              aria-pressed={drawsCount === count}
              className={cn(
                'touch-target rounded-lg font-display text-headline-sm font-bold transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                drawsCount === count
                  ? 'glow-ball-violet bg-primary text-on-primary'
                  : 'bg-surface-container text-on-surface-variant hover:text-on-surface',
              )}
            >
              {count}
            </button>
          ))}
        </div>
      </section>

      {/* ---- multiplicador ---------------------------------------------
          O Stitch desenha quatro degraus fixos ("2x Até $2M" … "5x Até $5M").
          São regras da Mega Millions escritas no front, o que o briefing
          proíbe — e que ficariam erradas em qualquer outra modalidade. Aqui
          fica o que o banco de fato informa: rótulo e preço por jogo. Se um
          dia `prize_tiers` trouxer os degraus, eles entram por dado. */}
      {game.multiplierEnabled && (
        <section className="flex items-center justify-between gap-space-sm rounded-xl bg-surface-container-low p-space-md shadow-card">
          <div className="flex min-w-0 items-center gap-space-sm">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-secondary/20 text-secondary">
              <Sym name="bolt" size={18} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="font-label-lg text-label-lg font-bold text-on-surface">
                {game.multiplierLabel}
              </span>
              <span className="font-body-sm text-body-sm text-outline">
                + {formatUSD(game.multiplierPrice)} por jogo, por sorteio
              </span>
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={multiplier}
            aria-label={game.multiplierLabel ?? 'Multiplicador'}
            onClick={() => onMultiplierChange(!multiplier)}
            className={cn(
              'relative flex h-6 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
              multiplier ? 'bg-secondary' : 'bg-surface-container-highest',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'size-5 rounded-full transition-all duration-300',
                multiplier ? 'translate-x-6 bg-on-secondary' : 'bg-outline-variant',
              )}
            />
          </button>
        </section>
      )}

      {/* ---- discriminação de valores -----------------------------------
          Preço oficial e taxa SEMPRE em linhas separadas. */}
      {totals && (
        <section className="flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md shadow-card">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-label-lg text-label-lg font-semibold uppercase tracking-wider text-on-surface-variant">
              Discriminação de valores
            </h2>
            {rate && (
              <span className="rounded bg-surface-container px-1.5 py-0.5 font-label-xs text-label-xs text-outline">
                {formatRateLabel(rate)}
              </span>
            )}
          </div>
          <dl className="flex flex-col gap-2 font-body-md text-body-md">
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">Apostas (preço oficial)</dt>
              <dd className="tabular-nums text-on-surface">{formatUSD(totals.official)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-on-surface-variant">Taxa de serviço</dt>
              <dd className="tabular-nums text-on-surface">{formatUSD(totals.fee)}</dd>
            </div>
            <Separator />
            <div className="flex items-baseline justify-between gap-4 rounded-lg bg-surface-container p-space-sm">
              <div>
                <dt className="font-label-xs text-label-xs uppercase tracking-wider text-outline">
                  Total geral
                </dt>
                <dd className="font-display text-headline-md font-bold text-secondary">
                  {formatUSD(totals.total)}
                </dd>
              </div>
              {brl !== null && (
                <div className="text-right">
                  <span className="block font-label-xs text-label-xs uppercase tracking-wider text-tertiary">
                    Em reais (estimativa)
                  </span>
                  <span className="block font-display text-headline-md font-extrabold text-tertiary">
                    {formatBRL(brl)}
                  </span>
                </div>
              )}
            </div>
          </dl>
        </section>
      )}

      {!jurisdiction?.transactionsEnabled && (
        <JurisdictionNotice jurisdiction={jurisdiction} />
      )}

      {/* ---- barra fixa de confirmação (acima da barra de abas) ---------- */}
      <div className="fixed inset-x-0 bottom-20 z-40 bg-surface-container-lowest/95 px-space-md py-3 shadow-commitbar backdrop-blur-xl lg:bottom-0">
        <div className="mx-auto flex max-w-[560px] items-center justify-between gap-space-sm">
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-1.5">
              <span
                className="shrink-0 rounded bg-surface-container-high px-1.5 py-0.5 font-label-xs text-label-xs font-bold"
                style={{ color: 'hsl(var(--game-bright, var(--primary)))' }}
              >
                {lines.length} {lines.length === 1 ? 'JOGO' : 'JOGOS'}
              </span>
              <span className="font-display text-headline-sm font-bold text-on-surface">
                {totals ? formatUSD(totals.total) : '—'}
              </span>
            </div>
            {brl !== null && (
              <span className="truncate font-label-xs text-label-xs text-outline">
                ≈ {formatBRL(brl)} (estimativa)
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onConfirm}
            className="glow-gold flex shrink-0 items-center gap-1 rounded-full bg-secondary px-5 py-3.5 font-label-lg text-label-lg font-bold uppercase tracking-wide text-on-secondary transition-all hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Ao carrinho <Sym name="arrow_forward" size={18} />
          </button>
        </div>
      </div>
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
