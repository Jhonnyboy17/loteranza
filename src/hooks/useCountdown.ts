import { useEffect, useMemo, useState } from 'react';

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  expired: boolean;
}

function computeParts(targetMs: number, nowMs: number): CountdownParts {
  const totalMs = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
    expired: totalMs <= 0,
  };
}

/**
 * Contagem regressiva real, baseada em um instante alvo.
 *
 * Nunca reinicia sozinha nem inventa urgencia: quando o prazo passa, o estado
 * fica `expired` e a interface deve dizer isso claramente. Contadores falsos
 * sao um dark pattern e nao existem nesta aplicacao.
 */
export function useCountdown(target: string | Date | null | undefined): CountdownParts | null {
  const targetMs = useMemo(() => {
    if (!target) return null;
    const date = typeof target === 'string' ? new Date(target) : target;
    const ms = date.getTime();
    return Number.isNaN(ms) ? null : ms;
  }, [target]);

  const [parts, setParts] = useState<CountdownParts | null>(() =>
    targetMs === null ? null : computeParts(targetMs, Date.now()),
  );

  useEffect(() => {
    if (targetMs === null) {
      setParts(null);
      return;
    }
    setParts(computeParts(targetMs, Date.now()));

    const tick = () => setParts(computeParts(targetMs, Date.now()));
    const interval = setInterval(tick, 1000);
    // Recalcula ao voltar para a aba: timers ficam defasados em background.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [targetMs]);

  return parts;
}
