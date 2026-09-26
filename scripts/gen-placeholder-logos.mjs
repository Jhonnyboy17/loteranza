import fs from 'node:fs';
// Marcas PROVISÓRIAS, desenhadas aqui para teste de layout. Não imitam os
// logotipos oficiais: é um sistema próprio (anel + esfera + nome) aplicado
// igual a todas as modalidades, variando só a cor e o texto.
//
// A cor usada NÃO é a cor de marca crua, e sim a versão clareada pela mesma
// regra do derivePalette (contraste mínimo sobre a superfície mais clara do
// tema). Com a cor crua, Powerball dava 4,06:1 e Mega Millions 4,45:1 sobre o
// card — abaixo do mínimo. O texto vive dentro do SVG, então o auditor de CSS
// não o alcança: a correção tem de estar aqui.
const GAMES = [
  { key: 'powerball',       name: 'POWERBALL',     color: '#E4434B', accent: '#FFFFFF' },
  { key: 'mega-millions',   name: 'MEGA|MILLIONS', color: '#3B82F6', accent: '#FFE083' },
  { key: 'lotto',           name: 'LOTTO',         color: '#22C55E', accent: '#FFFFFF' },
  { key: 'lucky-day-lotto', name: 'LUCKY DAY|LOTTO', color: '#A855F7', accent: '#FFFFFF' },
  { key: 'pick-3',          name: 'PICK 3',        color: '#EC4899', accent: '#FFFFFF' },
  { key: 'pick-4',          name: 'PICK 4',        color: '#14B8A6', accent: '#FFFFFF' },
];
const FONT = "'Outfit','Trebuchet MS',Verdana,sans-serif";
const LIGHTEST = '#323440'; // surface-container-highest

const lum = (h) => {
  const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const toHsl = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s * 100, l * 100];
};
const toHex = (h, s, l) => {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))));
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
};
/** Mesma garantia do derivePalette: clareia até alcançar 4,5:1. */
const readable = (hex) => {
  const [h, s0] = toHsl(hex); const s = Math.min(92, s0 + 6);
  for (let l = 72; l <= 92; l++) { const c = toHex(h, s, l); if (contrast(c, LIGHTEST) >= 4.5) return c; }
  return toHex(h, s, 92);
};

for (const g of GAMES) {
  const color = readable(g.color);
  const lines = g.name.split('|');
  const text = lines.length > 1
    ? `<text x="112" y="44" font-family="${FONT}" font-size="30" font-weight="800" letter-spacing="-0.5" fill="${color}">${lines[0]}</text>
  <text x="112" y="76" font-family="${FONT}" font-size="30" font-weight="800" letter-spacing="-0.5" fill="${color}">${lines[1]}</text>`
    : `<text x="112" y="60" font-family="${FONT}" font-size="34" font-weight="800" letter-spacing="-0.5" fill="${color}">${lines[0]}</text>`;

  fs.writeFileSync(`public/logos/${g.key}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 96" width="400" height="96" role="img" aria-label="${lines.join(' ')}">
  <title>${lines.join(' ')} — marca provisória para teste</title>
  <circle cx="48" cy="48" r="40" fill="none" stroke="${color}" stroke-width="7"/>
  <circle cx="48" cy="48" r="27" fill="${color}"/>
  <circle cx="48" cy="48" r="13" fill="${g.accent}"/>
  ${text}
</svg>
`);
  console.log(`${g.key.padEnd(18)} ${g.color} -> ${color}`);
}
