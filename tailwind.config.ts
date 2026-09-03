import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * Design system "Jackpot USA".
 * Identidade original: indigo profundo (confianca / fintech) + dourado
 * champanhe (destaque de jackpot). Deliberadamente sem estetica de cassino:
 * sem neon saturado, sem vermelho de alerta como cor de marca.
 *
 * Todas as cores sao expostas como CSS variables em src/index.css para que a
 * marca possa ser trocada sem recompilar componentes.
 */
const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1280px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          soft: 'hsl(var(--primary-soft))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        jackpot: {
          DEFAULT: 'hsl(var(--jackpot))',
          foreground: 'hsl(var(--jackpot-foreground))',
          soft: 'hsl(var(--jackpot-soft))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 4px)',
        sm: 'calc(var(--radius) - 8px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 10px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Sora', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        'display-2xl': ['clamp(2.25rem, 5vw, 3.75rem)', { lineHeight: '1.06', letterSpacing: '-0.03em' }],
        'display-xl': ['clamp(2rem, 4.5vw, 3.25rem)', { lineHeight: '1.06', letterSpacing: '-0.025em' }],
        'display-lg': ['clamp(1.65rem, 3.2vw, 2.35rem)', { lineHeight: '1.12', letterSpacing: '-0.02em' }],
      },
      boxShadow: {
        soft: '0 1px 2px 0 hsl(var(--shadow-color) / 0.05), 0 1px 3px 0 hsl(var(--shadow-color) / 0.04)',
        card: '0 2px 4px -1px hsl(var(--shadow-color) / 0.05), 0 8px 24px -8px hsl(var(--shadow-color) / 0.12)',
        lift: '0 4px 8px -2px hsl(var(--shadow-color) / 0.08), 0 18px 40px -12px hsl(var(--shadow-color) / 0.18)',
        ball: 'inset 0 -2px 5px hsl(var(--shadow-color) / 0.16), 0 1px 2px hsl(var(--shadow-color) / 0.18)',
      },
      keyframes: {
        'ball-pop': {
          '0%': { transform: 'scale(0.86)' },
          '55%': { transform: 'scale(1.09)' },
          '100%': { transform: 'scale(1)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'confetti-fall': {
          '0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(110vh) rotate(720deg)', opacity: '0' },
        },
      },
      animation: {
        'ball-pop': 'ball-pop 220ms cubic-bezier(0.2, 0.9, 0.3, 1.3)',
        'fade-up': 'fade-up 320ms ease-out both',
        shimmer: 'shimmer 1.6s infinite',
        'accordion-down': 'accordion-down 200ms ease-out',
        'accordion-up': 'accordion-up 200ms ease-out',
        'confetti-fall': 'confetti-fall 3s linear forwards',
      },
    },
  },
  plugins: [animate],
};

export default config;
