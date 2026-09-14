import { Link } from 'react-router-dom';
import {
  ArrowRight, BellRing, FileCheck2, Languages, LayoutDashboard,
  MousePointerClick, ScanLine, ShieldCheck, Ticket,
} from 'lucide-react';
import { brand } from '@/config/brand';
import { usePlatform } from '@/contexts/PlatformContext';
import { useGamesWithDraws, useLatestResults } from '@/hooks/useLotteryQueries';
import { formatDate, formatJackpotCompact } from '@/lib/format';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/misc';
import { ErrorState, LoadingCards } from '@/components/common/states';
import { JackpotCard } from '@/components/lottery/JackpotCard';
import { NumberSequence } from '@/components/lottery/NumberBall';
import { GameTheme } from '@/components/lottery/GameTheme';
import { JurisdictionNotice } from '@/components/compliance/notices';

const STEPS = [
  {
    icon: MousePointerClick,
    title: 'Escolha sua loteria',
    body: 'Compare os jackpots do momento e veja quando é o próximo sorteio de cada modalidade.',
  },
  {
    icon: Ticket,
    title: 'Escolha seus números',
    body: 'Monte quantos jogos quiser, à mão ou com a escolha rápida. Você vê o custo antes de decidir.',
  },
  {
    icon: ShieldCheck,
    title: 'Verificamos a elegibilidade',
    body: 'Se a compra for legalmente permitida na sua localização, seu pedido segue para processamento.',
  },
  {
    icon: ScanLine,
    title: 'Acompanhe tudo pela conta',
    body: 'Bilhete digitalizado, status do pedido, resultado do sorteio e conferência automática.',
  },
];

const REASONS = [
  {
    icon: FileCheck2,
    title: 'Bilhete rastreável',
    body: 'Cada pedido tem número, data, imagem do bilhete e um registro de onde ele está guardado.',
  },
  {
    icon: ShieldCheck,
    title: 'Processo transparente',
    body: 'Preço oficial e taxa de serviço sempre separados, com a cotação usada registrada no pedido.',
  },
  {
    icon: BellRing,
    title: 'Resultados automáticos',
    body: 'Assim que o resultado chega, seus números são conferidos e você é avisado.',
  },
  {
    icon: Languages,
    title: 'Suporte em português',
    body: 'Toda a plataforma, os avisos e o atendimento em português do Brasil.',
  },
];

const FAQ = [
  {
    q: 'Como funciona?',
    a: 'Você escolhe a loteria e monta seus jogos. Onde a operação for legalmente permitida, o pedido segue para pagamento e um operador autorizado adquire o bilhete oficial, digitaliza e associa à sua conta. Onde não for permitida, você continua podendo consultar jackpots, resultados e usar o conferidor de números.',
  },
  {
    q: 'Existe taxa de serviço?',
    a: 'Sim, e ela aparece sempre em linha separada do preço oficial da aposta, antes de qualquer confirmação. Não há cobrança embutida.',
  },
  {
    q: 'Como funciona o câmbio?',
    a: 'Os preços oficiais são em dólar. O valor em reais é uma estimativa calculada com a cotação vigente, exibida junto do horário de captura. A taxa usada no checkout fica registrada no pedido e nunca é alterada depois.',
  },
  {
    q: 'Por que minha localização é verificada?',
    a: 'Porque a permissão para intermediar a compra depende do lugar de onde a solicitação parte. A verificação usa a localização do dispositivo e o país da conexão; divergências são registradas para auditoria.',
  },
  {
    q: 'O que acontece se eu ganhar?',
    a: 'O sistema compara automaticamente seus números quando o resultado é recebido e avisa você. O prêmio só é tratado como definitivo após a validação do resultado oficial. O resgate segue as regras do órgão oficial e da jurisdição.',
  },
];

export function HomePage() {
  const { rate, jurisdiction } = usePlatform();
  const gamesQuery = useGamesWithDraws();
  const resultsQuery = useLatestResults(4);

  const activeGames = (gamesQuery.data ?? []).filter(({ game }) => game.status === 'active');

  return (
    <>
      <Seo
        title={`${brand.name} — Jackpots e resultados das loterias americanas`}
        description="Acompanhe os jackpots das principais loterias dos Estados Unidos, veja resultados, monte seus jogos e confira seus números. Plataforma em português."
        canonicalPath="/"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: brand.name,
          inLanguage: 'pt-BR',
        }}
      />

      {/* ---------------------------------------------------------------- HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(65%_60%_at_50%_-10%,hsl(var(--primary)/0.22),transparent_70%)]"
        />
        <div className="container relative py-14 sm:py-20">
          <div className="mx-auto max-w-4xl text-center">
            <Badge variant="default" className="mb-5">
              Powerball · Mega Millions · e mais a caminho
            </Badge>
            <h1 className="text-gradient text-display-2xl font-extrabold">
              Os maiores jackpots dos Estados Unidos em um só lugar
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              Veja os prêmios acumulados e os resultados oficiais, monte seus jogos em português e,
              onde a operação for legalmente permitida, acompanhe cada etapa até o bilhete
              digitalizado na sua conta.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="xl">
                <Link to="/loterias">
                  Escolher meus números <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="xl" variant="outline">
                <Link to="/como-funciona">Como funciona</Link>
              </Button>
            </div>
          </div>

          <div className="mx-auto mt-10 max-w-3xl">
            <JurisdictionNotice jurisdiction={jurisdiction} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ JACKPOTS */}
      <section className="container py-14" aria-labelledby="jackpots-title">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="jackpots-title" className="text-display-lg font-bold">
              Jackpots do momento
            </h2>
            <p className="mt-1 text-muted-foreground">
              Valores estimados divulgados pela fonte de dados, com a conversão aproximada em reais.
            </p>
          </div>
          <Button asChild variant="ghost">
            <Link to="/loterias">
              Ver todas as loterias <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>

        {gamesQuery.isLoading && <LoadingCards count={2} />}
        {gamesQuery.isError && (
          <ErrorState
            description="Não conseguimos carregar os jackpots agora."
            onRetry={() => gamesQuery.refetch()}
          />
        )}
        {gamesQuery.isSuccess && (
          <div className="grid gap-5 sm:grid-cols-2">
            {activeGames.map(({ game, draw }) => (
              <JackpotCard key={game.id} game={game} draw={draw} rate={rate} />
            ))}
          </div>
        )}
      </section>

      {/* --------------------------------------------------------- COMO FUNCIONA */}
      <section className="border-y border-border bg-muted/30 py-14" aria-labelledby="steps-title">
        <div className="container">
          <h2 id="steps-title" className="text-display-lg font-bold">
            Como funciona
          </h2>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Quatro passos, sem letra miúda.
          </p>

          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="surface flex flex-col gap-3 p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <step.icon className="size-5" aria-hidden />
                  </span>
                  <span className="font-display text-2xl font-extrabold text-muted-foreground/40">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="font-display text-base font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -------------------------------------------------------- ÚLTIMOS RESULTADOS */}
      <section className="container py-14" aria-labelledby="results-title">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="results-title" className="text-display-lg font-bold">
              Últimos resultados
            </h2>
            <p className="mt-1 text-muted-foreground">
              Números sorteados nas modalidades disponíveis.
            </p>
          </div>
          <Button asChild variant="ghost">
            <Link to="/resultados">
              Ver todos os resultados <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>

        {resultsQuery.isLoading && <LoadingCards count={4} />}
        {resultsQuery.isSuccess && (
          <div className="grid gap-4 sm:grid-cols-2">
            {resultsQuery.data.map((result) => (
              <GameTheme key={result.id} game={result.game}>
                <article className="surface h-full space-y-3 p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3
                      className="font-display text-sm font-bold uppercase tracking-[0.14em]"
                      style={{ color: 'hsl(var(--game-bright, var(--primary)))' }}
                    >
                      {result.game.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      {!result.isOfficial && <Badge variant="warning">preliminar</Badge>}
                      <span className="text-sm text-muted-foreground">
                        {formatDate(result.draw.drawDate)}
                      </span>
                    </div>
                  </div>
                  <NumberSequence
                    numbers={result.mainNumbers}
                    specialNumbers={result.specialNumbers}
                    size="sm"
                  />
                  {result.jackpotAmount !== null && (
                    <p className="text-sm text-muted-foreground">
                      Jackpot: {formatJackpotCompact(result.jackpotAmount)}
                    </p>
                  )}
                </article>
              </GameTheme>
            ))}
          </div>
        )}
      </section>

      {/* --------------------------------------------------------------- POR QUE */}
      <section className="border-y border-border bg-muted/30 py-14" aria-labelledby="why-title">
        <div className="container">
          <h2 id="why-title" className="text-display-lg font-bold">
            Por que usar a plataforma
          </h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {REASONS.map((reason) => (
              <div key={reason.title} className="space-y-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-card text-primary shadow-soft">
                  <reason.icon className="size-5" aria-hidden />
                </span>
                <h3 className="font-display text-base font-semibold">{reason.title}</h3>
                <p className="text-sm text-muted-foreground">{reason.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- SEUS BILHETES */}
      <section className="container py-14" aria-labelledby="dashboard-title">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 id="dashboard-title" className="text-display-lg font-bold">
              Seus bilhetes em um só lugar
            </h2>
            <p className="text-muted-foreground">
              Cada pedido mostra os números jogados, o sorteio, a imagem do bilhete oficial, o
              status atual e o resultado da conferência. Sem planilha, sem foto perdida no celular.
            </p>
            <ul className="space-y-2.5">
              {[
                'Linha do tempo do pedido, do pagamento ao resultado',
                'Cópia digital do bilhete com dados sensíveis ocultados',
                'Conferência automática assim que o resultado chega',
                'Histórico completo de gastos e prêmios',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <Button asChild size="lg">
              <Link to="/meus-jogos">
                Ver meus jogos <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>

          {/* Prévia da interface — ilustração da própria plataforma, não mockup falso */}
          <div className="surface overflow-hidden p-5" aria-hidden>
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <LayoutDashboard className="size-4" /> Meus jogos
            </div>
            <div className="space-y-3">
              {[
                { name: 'Powerball', status: 'Aguardando sorteio', numbers: [7, 16, 28, 41, 62], special: [13] },
                { name: 'Mega Millions', status: 'Bilhete verificado', numbers: [3, 11, 25, 44, 57], special: [8] },
              ].map((row) => (
                <div key={row.name} className="rounded-xl border border-border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">{row.name}</span>
                    <Badge variant="neutral">{row.status}</Badge>
                  </div>
                  <NumberSequence numbers={row.numbers} specialNumbers={row.special} size="xs" />
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Exemplo da interface, com dados ilustrativos.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------- FAQ */}
      <section className="border-t border-border bg-muted/30 py-14" aria-labelledby="faq-title">
        <div className="container max-w-3xl">
          <h2 id="faq-title" className="text-display-lg font-bold">
            Perguntas frequentes
          </h2>
          <Accordion type="single" collapsible className="mt-6">
            {FAQ.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger>{item.q}</AccordionTrigger>
                <AccordionContent>{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/ajuda">Ver central de ajuda</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
