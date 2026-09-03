import * as React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Info } from 'lucide-react';
import type { GameLine } from '@/types/domain';
import { brand } from '@/config/brand';
import { usePlatform } from '@/contexts/PlatformContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/components/ui/toast';
import {
  useGame, useHistoricalResults, usePrizeTiers, useUpcomingDraws,
} from '@/hooks/useLotteryQueries';
import {
  formatDate, formatDrawMoment, formatJackpotCompact, formatOdds, formatUSD,
  timeZoneLabel, weekdayName,
} from '@/lib/format';
import { convert } from '@/services/exchange/exchangeService';
import { priceLines } from '@/services/pricing';
import { Seo } from '@/components/common/Seo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger, Separator,
} from '@/components/ui/misc';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '@/components/ui/table';
import { ErrorState, LoadingCards } from '@/components/common/states';
import { Countdown } from '@/components/lottery/Countdown';
import { NumberPicker } from '@/components/lottery/NumberPicker';
import { QuickPickBar } from '@/components/lottery/QuickPickBar';
import { GameLineList } from '@/components/lottery/GameLineList';
import { NumberSequence } from '@/components/lottery/NumberBall';
import { CartSummary } from '@/components/cart/CartSummary';
import { StickyCartBar } from '@/components/cart/StickyCartBar';
import { JurisdictionNotice } from '@/components/compliance/notices';

const DRAW_PRESETS = [1, 2, 5, 10];

export function LotteryDetailPage() {
  const { gameKey } = useParams<{ gameKey: string }>();
  const navigate = useNavigate();
  const { rate, jurisdiction } = usePlatform();
  const { addItem, setOpen } = useCart();
  const { toast } = useToast();

  const gameQuery = useGame(gameKey);
  const game = gameQuery.data ?? null;

  const drawsQuery = useUpcomingDraws(game?.id, game?.maxDrawsAhead ?? 10);
  const tiersQuery = usePrizeTiers(game?.id);
  const resultsQuery = useHistoricalResults(game?.id, { limit: 10 });

  const [lines, setLines] = React.useState<GameLine[]>([]);
  const [drawsCount, setDrawsCount] = React.useState(1);
  const [selectedDrawId, setSelectedDrawId] = React.useState<string | null>(null);

  const draws = drawsQuery.data ?? [];
  const nextDraw = draws[0] ?? null;
  const activeDraw = draws.find((d) => d.id === selectedDrawId) ?? nextDraw;

  const remainingSlots = game ? game.maxLinesPerOrder - lines.length : 0;

  const addLines = React.useCallback((incoming: Omit<GameLine, 'id'>[]) => {
    setLines((current) => {
      const room = (game?.maxLinesPerOrder ?? 20) - current.length;
      const accepted = incoming.slice(0, Math.max(0, room));
      return [...current, ...accepted.map((line) => ({ ...line, id: `line-${crypto.randomUUID()}` }))];
    });
  }, [game?.maxLinesPerOrder]);

  const totals = React.useMemo(() => {
    if (!game) {
      return {
        lineCount: 0, betCount: 0, officialCost: 0, serviceFee: 0, total: 0,
        currency: 'USD', totalDisplay: null, displayCurrency: 'BRL',
        exchangeRate: null, exchangeRateAt: null, exchangeRateSource: null,
      };
    }
    const price = priceLines(game, lines, drawsCount);
    return {
      lineCount: lines.length,
      betCount: lines.length * drawsCount,
      officialCost: price.official,
      serviceFee: price.fee,
      total: price.total,
      currency: game.currency,
      totalDisplay: rate ? convert(price.total, rate) : null,
      displayCurrency: 'BRL',
      exchangeRate: rate?.effectiveRate ?? null,
      exchangeRateAt: rate?.capturedAt ?? null,
      exchangeRateSource: rate?.source ?? null,
    };
  }, [game, lines, drawsCount, rate]);

  const handleAddToCart = () => {
    if (!game || lines.length === 0) return;
    addItem(game, lines.map(({ id: _id, ...rest }) => rest), activeDraw?.id ?? null, drawsCount);
    setLines([]);
    toast({
      title: 'Adicionado ao carrinho',
      description: `${lines.length} ${lines.length === 1 ? 'jogo' : 'jogos'} de ${game.name}.`,
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

  const jackpot = activeDraw?.advertisedJackpot ?? game.currentJackpot;

  return (
    <div className="pb-24 lg:pb-10">
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

      {/* ------------------------------------------------------------ CABEÇALHO */}
      <header className="border-b border-border bg-muted/30">
        <div className="container py-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  aria-hidden
                  className="size-3 rounded-full"
                  style={{ backgroundColor: game.brandColor ?? 'hsl(var(--primary))' }}
                />
                <h1 className="text-display-xl font-extrabold">{game.name}</h1>
                {game.isDemo && <Badge variant="demo">Dados demonstrativos</Badge>}
              </div>
              {game.operatorName && (
                <p className="text-sm text-muted-foreground">
                  Operada por {game.operatorName}. {brand.affiliationDisclaimer}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Jackpot estimado
              </p>
              {jackpot !== null ? (
                <>
                  <p className="font-display text-display-lg font-extrabold">
                    {formatJackpotCompact(jackpot)}
                  </p>
                  {rate && (
                    <p className="text-sm text-muted-foreground">
                      ≈ {formatJackpotCompact(convert(jackpot, rate), 'BRL')} (estimativa)
                    </p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">Valor ainda não informado.</p>
              )}
            </div>
          </div>

          {activeDraw && (
            <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Próximo sorteio
                </p>
                <p className="mt-1 font-medium">
                  {formatDrawMoment(activeDraw.drawAt, game.timezone)} ·{' '}
                  {formatDate(activeDraw.drawDate)}{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    (horário oficial {timeZoneLabel(activeDraw.drawAt, game.timezone)})
                  </span>
                </p>
              </div>
              <Countdown target={activeDraw.salesCloseAt} label="Pedidos encerram em" />
            </div>
          )}
        </div>
      </header>

      <div className="container py-8">
        <Tabs defaultValue="jogar">
          <TabsList>
            <TabsTrigger value="jogar">Jogar</TabsTrigger>
            <TabsTrigger value="resultados">Resultados</TabsTrigger>
            <TabsTrigger value="como-jogar">Como jogar</TabsTrigger>
            <TabsTrigger value="premiacao">Premiação</TabsTrigger>
            <TabsTrigger value="faq">Perguntas frequentes</TabsTrigger>
          </TabsList>

          {/* ----------------------------------------------------------- JOGAR */}
          <TabsContent value="jogar">
            <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
              <div className="space-y-8">
                <JurisdictionNotice jurisdiction={jurisdiction} />

                <NumberPicker game={game} onAddLine={(line) => addLines([line])} />

                <QuickPickBar
                  game={game}
                  onGenerate={addLines}
                  remainingSlots={remainingSlots}
                />

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-display text-base font-semibold">
                      Seus jogos ({lines.length})
                    </h2>
                    {lines.length > 0 && (
                      <Button variant="ghost" size="sm" onClick={() => setLines([])}>
                        Limpar todos
                      </Button>
                    )}
                  </div>
                  <GameLineList
                    game={game}
                    lines={lines}
                    onRemove={(id) => setLines((c) => c.filter((l) => l.id !== id))}
                    onDuplicate={(id) =>
                      setLines((c) => {
                        const source = c.find((l) => l.id === id);
                        if (!source || c.length >= game.maxLinesPerOrder) return c;
                        return [...c, { ...source, id: `line-${crypto.randomUUID()}` }];
                      })
                    }
                  />
                </section>

                {/* Múltiplos sorteios */}
                <section className="space-y-3 rounded-xl border border-border p-5">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-5 text-primary" aria-hidden />
                    <h2 className="font-display text-base font-semibold">Sorteios</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Escolha em quantos sorteios consecutivos seus jogos devem participar. O valor é
                    multiplicado proporcionalmente.
                  </p>

                  <div className="flex flex-wrap gap-2" role="group" aria-label="Quantidade de sorteios">
                    {DRAW_PRESETS.filter((n) => n <= game.maxDrawsAhead).map((count) => (
                      <Button
                        key={count}
                        variant={drawsCount === count ? 'primary' : 'outline'}
                        size="sm"
                        onClick={() => setDrawsCount(count)}
                        aria-pressed={drawsCount === count}
                      >
                        {count} {count === 1 ? 'sorteio' : 'sorteios'}
                      </Button>
                    ))}
                  </div>

                  {draws.length > 1 && (
                    <div className="max-w-xs space-y-1.5 pt-1">
                      <label htmlFor="draw-select" className="text-sm font-medium">
                        A partir do sorteio de
                      </label>
                      <Select
                        value={activeDraw?.id ?? ''}
                        onValueChange={(value) => setSelectedDrawId(value)}
                      >
                        <SelectTrigger id="draw-select">
                          <SelectValue placeholder="Selecione um sorteio" />
                        </SelectTrigger>
                        <SelectContent>
                          {draws.map((draw) => (
                            <SelectItem key={draw.id} value={draw.id}>
                              {formatDate(draw.drawDate)} ·{' '}
                              {formatDrawMoment(draw.drawAt, game.timezone)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {!jurisdiction?.subscriptionsEnabled && (
                    <p className="flex items-start gap-2 pt-1 text-xs text-muted-foreground">
                      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                      Assinatura automática (renovação contínua) fica disponível apenas onde for
                      juridicamente permitida. Ainda não habilitada para a sua localização.
                    </p>
                  )}
                </section>
              </div>

              <aside className="lg:sticky lg:top-24 lg:self-start">
                <CartSummary
                  totals={totals}
                  gameName={game.name}
                  drawsCount={drawsCount}
                  actionLabel="Adicionar ao carrinho"
                  onAction={handleAddToCart}
                  actionDisabled={lines.length === 0}
                />
              </aside>
            </div>
          </TabsContent>

          {/* ------------------------------------------------------- RESULTADOS */}
          <TabsContent value="resultados">
            {resultsQuery.isLoading && <LoadingCards count={3} />}
            {resultsQuery.isSuccess && resultsQuery.data.length > 0 ? (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/resultados/${game.gameKey}`}>Ver histórico completo</Link>
                  </Button>
                </div>
                <ul className="space-y-3">
                  {resultsQuery.data.map((result) => (
                    <li key={result.id} className="surface flex flex-wrap items-center justify-between gap-4 p-5">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">
                          {formatDate(result.draw.drawDate)} · {weekdayName(new Date(result.draw.drawAt).getDay())}
                        </p>
                        <NumberSequence
                          numbers={result.mainNumbers}
                          specialNumbers={result.specialNumbers}
                          size="sm"
                        />
                      </div>
                      <div className="text-right">
                        {!result.isOfficial && <Badge variant="warning">Preliminar</Badge>}
                        {result.jackpotAmount !== null && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatJackpotCompact(result.jackpotAmount)}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              resultsQuery.isSuccess && (
                <p className="text-muted-foreground">Nenhum resultado registrado ainda.</p>
              )
            )}
          </TabsContent>

          {/* ------------------------------------------------------- COMO JOGAR */}
          <TabsContent value="como-jogar">
            <div className="max-w-2xl space-y-5">
              {game.howToPlay && <p className="text-base leading-relaxed">{game.howToPlay}</p>}

              <dl className="grid gap-4 sm:grid-cols-2">
                <Fact label="Números principais">
                  {game.mainNumbersCount} de {game.mainNumberMin} a {game.mainNumberMax}
                </Fact>
                {game.specialNumbersCount > 0 && (
                  <Fact label={game.specialNumberLabel ?? 'Número especial'}>
                    {game.specialNumbersCount} de {game.specialNumberMin} a {game.specialNumberMax}
                  </Fact>
                )}
                <Fact label="Preço oficial por aposta">{formatUSD(game.officialPrice)}</Fact>
                <Fact label="Taxa de serviço por aposta">{formatUSD(game.serviceFee)}</Fact>
                <Fact label="Dias de sorteio">
                  {game.drawDays.map((d) => weekdayName(d)).join(', ')}
                </Fact>
                <Fact label="Horário do sorteio">
                  {game.drawTimeLocal} ({game.timezone})
                </Fact>
                <Fact label="Encerramento dos pedidos">
                  {game.salesCutoffMinutes} minutos antes do sorteio
                </Fact>
                <Fact label="Máximo de jogos por pedido">{game.maxLinesPerOrder}</Fact>
                {game.multiplierEnabled && (
                  <Fact label={game.multiplierLabel ?? 'Multiplicador'}>
                    Opcional, {formatUSD(game.multiplierPrice)} por jogo
                  </Fact>
                )}
              </dl>

              <Separator />
              <p className="text-sm text-muted-foreground">{brand.oddsNotice}</p>
            </div>
          </TabsContent>

          {/* -------------------------------------------------------- PREMIAÇÃO */}
          <TabsContent value="premiacao">
            {tiersQuery.isSuccess && tiersQuery.data.length > 0 ? (
              <div className="space-y-4">
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
                              ? 'Jackpot acumulado'
                              : tier.fixedPrize !== null
                                ? formatUSD(tier.fixedPrize)
                                : 'Valor variável'}
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
                  Valores e probabilidades conforme a fonte de dados configurada. Prêmios podem
                  sofrer retenção de impostos e variar segundo as regras oficiais da modalidade e a
                  jurisdição. Confirme sempre com a fonte oficial.
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">Tabela de premiação ainda não cadastrada.</p>
            )}
          </TabsContent>

          {/* --------------------------------------------------------------- FAQ */}
          <TabsContent value="faq">
            <Accordion type="single" collapsible className="max-w-2xl">
              <AccordionItem value="oficial">
                <AccordionTrigger>O bilhete de {game.name} é oficial?</AccordionTrigger>
                <AccordionContent>
                  O modelo previsto é a aquisição do bilhete oficial por operador autorizado, com
                  digitalização e guarda. A operação só é habilitada em jurisdições expressamente
                  liberadas no painel administrativo. [CONTEÚDO A SER VALIDADO POR ADVOGADO]
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="prazo">
                <AccordionTrigger>Até quando posso fazer meu pedido?</AccordionTrigger>
                <AccordionContent>
                  Os pedidos para cada sorteio encerram {game.salesCutoffMinutes} minutos antes do
                  horário oficial ({game.drawTimeLocal}, {game.timezone}). O contador no topo da
                  página mostra o tempo restante.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="chance">
                <AccordionTrigger>Existe combinação com mais chance?</AccordionTrigger>
                <AccordionContent>
                  Não. {brand.oddsNotice} A escolha rápida usa geração aleatória de qualidade
                  criptográfica apenas para garantir imparcialidade na seleção, não para alterar
                  probabilidade — isso não é possível.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="cancelar">
                <AccordionTrigger>Posso cancelar depois de enviar?</AccordionTrigger>
                <AccordionContent>
                  O cancelamento é possível enquanto o bilhete ainda não tiver sido adquirido e
                  dentro do prazo do sorteio. [CONTEÚDO A SER VALIDADO POR ADVOGADO]
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>
        </Tabs>
      </div>

      <StickyCartBar
        lineCount={lines.length}
        total={totals.total}
        actionLabel="Adicionar"
        onAction={handleAddToCart}
      />
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{children}</dd>
    </div>
  );
}
