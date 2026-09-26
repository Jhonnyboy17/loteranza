import * as React from 'react';
import type { GameLine, LotteryGame } from '@/types/domain';
import { pickDistinct, pickWithRepetition } from '@/lib/rng';
import { padBall } from '@/lib/format';
import { Sym } from '@/components/ui/icon';
import { NumberGrid } from './NumberGrid';
import { cn } from '@/lib/utils';

/**
 * Etapa de escolha dos números, no desenho de design/stitch/jogar/code.html.
 *
 * Faz uma coisa só: montar UMA aposta. Multiplicador, quantidade de sorteios e
 * preço ficam na etapa seguinte — foi o que o cliente pediu (números primeiro,
 * demais opções em outra tela), e é também o que impede esta página de inchar.
 * Por isso o módulo "Megaplier", que no Stitch mora aqui, foi para a revisão.
 *
 * Todo limite (quantidade, mínimo, máximo, existência de número especial) vem
 * de `game`. Não há nenhuma regra de Powerball ou Mega Millions escrita aqui.
 */
export function NumberPicker({
  game,
  lineNumber = 1,
  onSubmit,
  className,
}: {
  game: LotteryGame;
  /** Índice do jogo sendo montado, mostrado no selo "Jogo N" do Stitch. */
  lineNumber?: number;
  onSubmit: (line: Omit<GameLine, 'id'>) => void;
  className?: string;
}) {
  const [main, setMain] = React.useState<number[]>([]);
  const [special, setSpecial] = React.useState<number[]>([]);
  const [mode, setMode] = React.useState<'manual' | 'quick'>('manual');

  const hasSpecial = game.specialNumbersCount > 0;
  const isComplete =
    main.length === game.mainNumbersCount &&
    (!hasSpecial || special.length === game.specialNumbersCount);

  /** Modalidades de dígitos (faixa iniciando em 0) admitem repetição. */
  const allowsRepetition = game.mainNumberMin === 0;

  const toggle = (
    value: number,
    list: number[],
    setList: (next: number[]) => void,
    limit: number,
  ) => {
    setMode('manual');
    if (list.includes(value)) {
      setList(list.filter((n) => n !== value));
      return;
    }
    if (list.length >= limit) return;
    setList([...list, value].sort((a, b) => a - b));
  };

  const quickPick = () => {
    setMain(
      allowsRepetition
        ? pickWithRepetition(game.mainNumbersCount, game.mainNumberMin, game.mainNumberMax)
        : pickDistinct(game.mainNumbersCount, game.mainNumberMin, game.mainNumberMax),
    );
    setSpecial(
      hasSpecial
        ? pickDistinct(game.specialNumbersCount, game.specialNumberMin, game.specialNumberMax)
        : [],
    );
    setMode('quick');
  };

  const clear = () => {
    setMain([]);
    setSpecial([]);
    setMode('manual');
  };

  const submit = () => {
    if (!isComplete) return;
    onSubmit({
      numbers: [...main],
      specialNumbers: [...special],
      isQuickPick: mode === 'quick',
      options: {},
    });
    clear();
  };

  const missingMain = game.mainNumbersCount - main.length;
  const missingSpecial = hasSpecial ? game.specialNumbersCount - special.length : 0;
  const slotCount = game.mainNumbersCount + game.specialNumbersCount;

  return (
    <div className={cn('flex flex-col gap-space-md', className)}>
      {/* ---- seletor de modo: Manual | Surpresinha ---------------------- */}
      <div
        role="group"
        aria-label="Modo de escolha"
        className="grid grid-cols-2 rounded-full bg-surface-container-lowest p-1 shadow-inner"
      >
        {([
          { key: 'manual', label: 'Manual', icon: 'touch_app' },
          { key: 'quick', label: 'Surpresinha', icon: 'auto_fix_high' },
        ] as const).map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={mode === item.key}
            onClick={() => (item.key === 'quick' ? quickPick() : setMode('manual'))}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-full py-2.5 font-label-md text-label-md uppercase tracking-wider transition-all duration-300',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              mode === item.key
                ? 'bg-surface-container-high font-bold text-secondary shadow-soft'
                : 'font-semibold text-on-surface-variant hover:text-on-surface',
            )}
          >
            <Sym name={item.icon} size={16} />
            {item.label}
          </button>
        ))}
      </div>

      {/* ---- espelho da seleção ----------------------------------------- */}
      <div className="flex flex-col gap-space-sm rounded-xl bg-surface-container/90 p-space-md shadow-card backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="shrink-0 rounded bg-surface-container-highest px-2 py-0.5 font-label-xs text-label-xs font-bold uppercase tracking-wider"
              style={{ color: 'hsl(var(--game-bright, var(--primary)))' }}
            >
              Jogo {lineNumber}
            </span>
            <span className="truncate font-body-sm text-body-sm text-outline">
              {mode === 'quick' ? 'Números sorteados para você' : 'Escolha na cartela abaixo'}
            </span>
          </div>
          <button
            type="button"
            onClick={clear}
            disabled={main.length === 0 && special.length === 0}
            className="-my-1 flex min-h-[24px] shrink-0 items-center gap-1 rounded px-1 py-1 font-label-xs text-label-xs text-outline transition-colors hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:hover:text-outline"
          >
            <Sym name="restart_alt" size={16} />
            Limpar
          </button>
        </div>

        {/* Casas da cartela. Colunas = total de números do jogo, então Pick 3
            mostra 3 casas e Powerball mostra 6, sem nada fixo no código. */}
        <div
          className="grid gap-space-xs pt-space-xs"
          style={{ gridTemplateColumns: `repeat(${Math.min(slotCount, 6)}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: game.mainNumbersCount }).map((_, i) => (
            <Slot key={`m-${i}`} value={main[i]} />
          ))}
          {Array.from({ length: game.specialNumbersCount }).map((_, i) => (
            <Slot key={`s-${i}`} value={special[i]} special />
          ))}
        </div>

        <div className="flex items-center justify-between px-1 font-label-xs text-label-xs text-outline">
          <span>
            {game.mainNumbersCount} número{game.mainNumbersCount > 1 ? 's' : ''} principa
            {game.mainNumbersCount > 1 ? 'is' : 'l'}
          </span>
          {hasSpecial && (
            <span className="font-bold text-secondary">
              {game.specialNumbersCount} {game.specialNumberLabel}
            </span>
          )}
        </div>

        <p aria-live="polite" className="sr-only">
          {isComplete
            ? 'Aposta completa.'
            : `Faltam ${missingMain > 0 ? `${missingMain} número${missingMain > 1 ? 's' : ''}` : ''}` +
              `${missingMain > 0 && missingSpecial > 0 ? ' e ' : ''}` +
              `${missingSpecial > 0 ? `${missingSpecial} ${game.specialNumberLabel}` : ''}.`}
        </p>
      </div>

      {/* ---- cartela principal ------------------------------------------- */}
      <GridCard
        title={`Números principais`}
        hint={`Selecione ${game.mainNumbersCount} número${game.mainNumbersCount > 1 ? 's' : ''} de ${game.mainNumberMin} a ${game.mainNumberMax}:`}
        counter={`${main.length} / ${game.mainNumbersCount}`}
      >
        <NumberGrid
          min={game.mainNumberMin}
          max={game.mainNumberMax}
          selected={main}
          maxSelections={game.mainNumbersCount}
          onToggle={(value) => toggle(value, main, setMain, game.mainNumbersCount)}
          label={`Números principais, escolha ${game.mainNumbersCount} de ${game.mainNumberMin} a ${game.mainNumberMax}`}
        />
      </GridCard>

      {/* ---- cartela do número especial ----------------------------------- */}
      {hasSpecial && (
        <GridCard
          tone="special"
          title={game.specialNumberLabel ?? 'Número especial'}
          hint={`Selecione ${game.specialNumbersCount} de ${game.specialNumberMin} a ${game.specialNumberMax}:`}
          counter={`${special.length} / ${game.specialNumbersCount}`}
        >
          <NumberGrid
            min={game.specialNumberMin}
            max={game.specialNumberMax}
            selected={special}
            maxSelections={game.specialNumbersCount}
            onToggle={(value) => toggle(value, special, setSpecial, game.specialNumbersCount)}
            tone="special"
            label={`${game.specialNumberLabel}, escolha ${game.specialNumbersCount} de ${game.specialNumberMin} a ${game.specialNumberMax}`}
          />
        </GridCard>
      )}

      {/* Botão de envio: fica aqui no fluxo para quem navega por teclado, e é
          espelhado na barra fixa de baixo, que é o alvo no toque. */}
      <button
        type="button"
        onClick={submit}
        disabled={!isComplete}
        className={cn(
          'flex items-center justify-center gap-2 rounded-full px-6 py-3.5 font-label-lg text-label-lg font-bold uppercase tracking-wide transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          isComplete
            ? 'glow-gold bg-secondary text-on-secondary hover:brightness-110 active:scale-95'
            : 'cursor-not-allowed bg-surface-container-high text-outline',
        )}
      >
        Avançar <Sym name="arrow_forward" size={18} />
      </button>
    </div>
  );
}

/** Casa da cartela: vazia mostra "?", preenchida mostra o número com brilho. */
function Slot({ value, special = false }: { value?: number; special?: boolean }) {
  const filled = value !== undefined;
  return (
    <div
      className={cn(
        'flex h-12 items-center justify-center rounded-lg font-display text-headline-sm font-bold transition-all',
        !filled && 'bg-surface-container-lowest shadow-inner',
        !filled && (special ? 'text-secondary/60' : 'text-outline'),
        filled && 'animate-ball-pop',
        filled && (special ? 'glow-ball-gold bg-secondary text-on-secondary' : 'glow-ball-violet bg-primary text-on-primary'),
      )}
    >
      {filled ? padBall(value) : '?'}
    </div>
  );
}

/** Cartão que embrulha uma grade de números. Violeta ou ouro. */
function GridCard({
  title,
  hint,
  counter,
  tone = 'main',
  children,
}: {
  title: string;
  hint: string;
  counter: string;
  tone?: 'main' | 'special';
  children: React.ReactNode;
}) {
  const gold = tone === 'special';
  return (
    <section
      className={cn(
        'relative flex flex-col gap-space-sm rounded-xl bg-surface-container-low p-space-md shadow-card',
        gold && 'overflow-hidden',
      )}
    >
      {gold && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 size-32 rounded-full bg-secondary/10 blur-2xl"
        />
      )}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <h2 className="flex min-w-0 items-center gap-1.5 font-headline-sm text-headline-sm">
          <span
            aria-hidden
            className={cn('h-4 w-1.5 shrink-0 rounded-full', gold ? 'bg-secondary' : 'bg-primary')}
          />
          <span className={cn('truncate', gold ? 'text-secondary' : 'text-on-surface')}>{title}</span>
        </h2>
        <span
          className="shrink-0 rounded-full bg-surface-container-highest px-2 py-0.5 font-label-md text-label-md font-bold tabular-nums"
          style={{ color: gold ? 'hsl(var(--secondary))' : 'hsl(var(--game-bright, var(--primary)))' }}
        >
          {counter}
        </span>
      </div>
      <p className="relative z-10 -mt-1 font-body-sm text-body-sm text-outline">{hint}</p>
      <div className="relative z-10 pt-space-xs">{children}</div>
    </section>
  );
}
