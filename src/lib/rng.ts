/**
 * Geracao de numeros aleatorios para a Escolha Rapida (Quick Pick).
 *
 * Usa crypto.getRandomValues com rejeicao de amostragem (rejection sampling)
 * para evitar o vies de modulo que `Math.random() * n | 0` introduz.
 *
 * Nota honesta sobre o que isto e e o que nao e: aleatoriedade de qualidade
 * criptografica aqui serve para que a selecao seja imparcial e nao previsivel,
 * nao para "melhorar" nada. Toda combinacao valida tem exatamente a mesma
 * probabilidade de ser sorteada, independentemente de como foi gerada.
 */

function randomUint32(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0];
}

/** Inteiro uniforme em [0, max) sem vies de modulo. */
export function randomBelow(max: number): number {
  if (max <= 0) throw new RangeError('max deve ser maior que zero');
  if (max === 1) return 0;

  const limit = Math.floor(0x1_0000_0000 / max) * max;
  let value = randomUint32();
  while (value >= limit) value = randomUint32();
  return value % max;
}

/** Inteiro uniforme em [min, max], inclusivo dos dois lados. */
export function randomInt(min: number, max: number): number {
  return min + randomBelow(max - min + 1);
}

/**
 * `count` valores distintos sorteados em [min, max], em ordem crescente.
 * Usa embaralhamento parcial de Fisher-Yates sobre o intervalo completo.
 */
export function pickDistinct(count: number, min: number, max: number): number[] {
  const size = max - min + 1;
  if (count > size) {
    throw new RangeError(`Nao e possivel escolher ${count} numeros distintos entre ${min} e ${max}.`);
  }

  const pool = Array.from({ length: size }, (_, i) => min + i);
  for (let i = 0; i < count; i += 1) {
    const j = i + randomBelow(size - i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

/** `count` valores que PODEM se repetir, para modalidades de digitos. */
export function pickWithRepetition(count: number, min: number, max: number): number[] {
  return Array.from({ length: count }, () => randomInt(min, max));
}
