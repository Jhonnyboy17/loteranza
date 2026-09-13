/**
 * Conversao de cor e derivacao de paleta a partir da cor de uma modalidade.
 *
 * Cada jogo guarda uma unica cor (`lottery_games.brand_color`). Todo o resto da
 * paleta da pagina daquele jogo e derivado dela, para que cadastrar uma
 * modalidade nova nao exija escolher seis tons a mao nem tocar em codigo.
 */

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** "#E8464F" -> { h, s, l }. Retorna null para entrada invalida. */
export function hexToHsl(hex: string | null | undefined): Hsl | null {
  if (!hex) return null;
  const clean = hex.trim().replace('#', '');
  const full =
    clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / delta) % 6; break;
      case g: h = (b - r) / delta + 2; break;
      default: h = (r - g) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** Formato aceito pelas CSS variables do projeto: "357 78% 58%". */
export function hslToToken({ h, s, l }: Hsl): string {
  return `${h} ${s}% ${l}%`;
}

/** Luminancia relativa, para decidir texto claro ou escuro sobre a cor. */
function relativeLuminance({ h, s, l }: Hsl): number {
  const sat = s / 100;
  const lig = l / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lig - c / 2;

  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] :
    h < 120 ? [x, c, 0] :
    h < 180 ? [0, c, x] :
    h < 240 ? [0, x, c] :
    h < 300 ? [x, 0, c] : [c, 0, x];

  const toLinear = (v: number) => {
    const channel = v + m;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * toLinear(r1) + 0.7152 * toLinear(g1) + 0.0722 * toLinear(b1);
}

/** Contraste WCAG entre duas cores HSL. */
function contrast(a: Hsl, b: Hsl): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Texto de botao e texto normal: o minimo exigido e 4.5. */
const MIN_CONTRAST = 4.5;

/**
 * Escolhe a cor do texto E ajusta a luminosidade do fundo ate atingir o
 * contraste minimo.
 *
 * Cores de marca vivas (vermelho, azul, rosa) caem numa faixa em que NENHUM
 * dos dois extremos — branco ou quase-preto — alcanca 4.5 sozinho. Escolher
 * "o melhor dos dois" deixaria o botao em ~4.0, abaixo do exigido. Entao
 * testamos os dois caminhos e ficamos com o que exige o menor desvio da cor
 * cadastrada: a identidade da modalidade se mantem e o texto fica legivel.
 */
function resolveContrast(base: Hsl): { primary: Hsl; foreground: Hsl } {
  const white: Hsl = { h: base.h, s: 0, l: 100 };
  const ink: Hsl = { h: base.h, s: 45, l: 7 };

  let lighter: Hsl | null = null;
  for (let l = base.l; l >= 34; l -= 1) {
    const candidate = { ...base, l };
    if (contrast(white, candidate) >= MIN_CONTRAST) { lighter = candidate; break; }
  }

  let darker: Hsl | null = null;
  for (let l = base.l; l <= 84; l += 1) {
    const candidate = { ...base, l };
    if (contrast(ink, candidate) >= MIN_CONTRAST) { darker = candidate; break; }
  }

  const deltaWhite = lighter ? Math.abs(lighter.l - base.l) : Number.POSITIVE_INFINITY;
  const deltaInk = darker ? Math.abs(darker.l - base.l) : Number.POSITIVE_INFINITY;

  if (lighter && deltaWhite <= deltaInk) return { primary: lighter, foreground: white };
  if (darker) return { primary: darker, foreground: ink };
  return { primary: base, foreground: white };
}

export interface GamePalette {
  /** Cor principal da modalidade. */
  primary: string;
  /** Texto legivel sobre `primary` — escolhido por luminancia, nao por chute. */
  primaryForeground: string;
  /** Fundo discreto para chips e destaques. */
  primarySoft: string;
  accent: string;
  accentForeground: string;
  /** Versao clara da cor, para texto sobre fundo escuro. */
  bright: string;
}

/**
 * Deriva a paleta da pagina a partir da cor da modalidade.
 *
 * A cor cadastrada pode vir clara ou escura demais para o tema escuro. Em vez
 * de confiar nela como veio, normalizamos a luminosidade para uma faixa que
 * mantem contraste sobre o fundo quase-preto.
 */
export function derivePalette(hex: string | null | undefined): GamePalette | null {
  const base = hexToHsl(hex);
  if (!base) return null;

  // Faixa inicial segura sobre o fundo escuro do tema.
  const s = Math.min(92, Math.max(55, base.s));
  const start: Hsl = { h: base.h, s, l: Math.min(68, Math.max(52, base.l)) };

  const { primary, foreground } = resolveContrast(start);

  return {
    primary: hslToToken(primary),
    primaryForeground: hslToToken(foreground),
    primarySoft: hslToToken({ h: base.h, s: Math.round(s * 0.5), l: 15 }),
    accent: hslToToken({ h: base.h, s: Math.round(s * 0.42), l: 17 }),
    accentForeground: hslToToken({ h: base.h, s: Math.min(88, s), l: 85 }),
    bright: hslToToken({ h: base.h, s: Math.min(92, s + 6), l: 72 }),
  };
}
