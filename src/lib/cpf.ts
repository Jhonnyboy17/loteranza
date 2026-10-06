/**
 * CPF: normalizacao, validacao e mascara.
 *
 * O PIX do Mercado Pago exige identificacao do pagador, entao o checkout
 * precisa pedir o CPF. Por decisao de projeto ele NAO e armazenado: viaja do
 * formulario ate a chamada do provedor e acaba ali. A validacao local existe
 * para dar resposta imediata e evitar uma ida ao provedor que ja se sabe que
 * vai falhar — nao e controle de seguranca, e conferencia de digitacao.
 */

/** Só os dígitos, no máximo 11. */
export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, '').slice(0, 11);
}

/** 000.000.000-00, preenchendo conforme o usuário digita. */
export function maskCpf(value: string): string {
  const digits = normalizeCpf(value);
  const parts = [
    digits.slice(0, 3),
    digits.slice(3, 6),
    digits.slice(6, 9),
    digits.slice(9, 11),
  ].filter(Boolean);

  if (parts.length <= 3) return parts.join('.');
  return `${parts.slice(0, 3).join('.')}-${parts[3]}`;
}

function checkDigit(digits: string, length: number): number {
  let sum = 0;
  for (let i = 0; i < length; i++) {
    sum += Number(digits[i]) * (length + 1 - i);
  }
  const remainder = (sum * 10) % 11;
  // 10 e 11 valem zero: e a regra da Receita, nao um atalho.
  return remainder >= 10 ? 0 : remainder;
}

export function isValidCpf(value: string): boolean {
  const digits = normalizeCpf(value);
  if (digits.length !== 11) return false;
  // Sequencias repetidas (111.111.111-11) passam no calculo dos digitos
  // verificadores, entao precisam de descarte explicito.
  if (/^(\d)\1{10}$/.test(digits)) return false;

  return (
    checkDigit(digits, 9) === Number(digits[9])
    && checkDigit(digits, 10) === Number(digits[10])
  );
}
