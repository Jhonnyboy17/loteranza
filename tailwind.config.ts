import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * Design system "Nebula Jackpot".
 *
 * Os tokens abaixo reproduzem exatamente o tailwind.config que o Google Stitch
 * gerou (ver design/stitch/<tela>/code.html — o config inline nos HTMLs é a fonte de
 * verdade; o front-matter do DESIGN.md diverge e foi descartado). Manter os
 * mesmos nomes permite colar as classes das telas do Stitch sem tradução.
 *
 * Três papéis de cor foram trocados por motivo de contraste — a paleta em si
 * está intacta, só o uso mudou. Ver design/stitch/CONFORMIDADE.md, seção 10.
 *
 * Aliases legados (card, muted, destructive, jackpot…) continuam existindo e
 * apontam para os tokens M3 correspondentes, para que os componentes já
 * escritos herdem o visual novo sem reescrita.
 *
 * Todas as cores saem de CSS variables em src/index.css: trocar a marca é
 * trocar as variáveis, sem recompilar componente nenhum.
 */

/** `hsl(var(--x) / <alpha-value>)` é o que faz `bg-surface-container-high/80` funcionar. */
const v = (name: string) => `hsl(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1360px' },
    },
    extend: {
      colors: {
        // ---- superfícies (M3 / Stitch) ----------------------------------
        surface: {
          DEFAULT: v('surface'),
          dim: v('surface-dim'),
          bright: v('surface-bright'),
          variant: v('surface-variant'),
          tint: v('surface-tint'),
          container: {
            DEFAULT: v('surface-container'),
            lowest: v('surface-container-lowest'),
            low: v('surface-container-low'),
            high: v('surface-container-high'),
            highest: v('surface-container-highest'),
          },
        },
        'on-surface': { DEFAULT: v('on-surface'), variant: v('on-surface-variant') },
        'on-background': v('on-background'),
        'inverse-surface': v('inverse-surface'),
        'inverse-on-surface': v('inverse-on-surface'),

        // ---- violeta -----------------------------------------------------
        primary: {
          DEFAULT: v('primary'),
          container: v('primary-container'),
          fixed: v('primary-fixed'),
          'fixed-dim': v('primary-fixed-dim'),
          soft: v('primary-soft'),
          foreground: v('on-primary'),
        },
        'on-primary': {
          DEFAULT: v('on-primary'),
          container: v('on-primary-container'),
          fixed: v('on-primary-fixed'),
          'fixed-variant': v('on-primary-fixed-variant'),
        },
        'inverse-primary': v('inverse-primary'),

        // ---- ouro (jackpot) ---------------------------------------------
        secondary: {
          DEFAULT: v('secondary'),
          container: v('secondary-container'),
          fixed: v('secondary-fixed'),
          'fixed-dim': v('secondary-fixed-dim'),
          foreground: v('on-secondary'),
        },
        'on-secondary': {
          DEFAULT: v('on-secondary'),
          container: v('on-secondary-container'),
          fixed: v('on-secondary-fixed'),
          'fixed-variant': v('on-secondary-fixed-variant'),
        },

        // ---- ciano (estados positivos / verificação) ----------------------
        tertiary: {
          DEFAULT: v('tertiary'),
          container: v('tertiary-container'),
          fixed: v('tertiary-fixed'),
          'fixed-dim': v('tertiary-fixed-dim'),
          foreground: v('on-tertiary'),
        },
        'on-tertiary': {
          DEFAULT: v('on-tertiary'),
          container: v('on-tertiary-container'),
          fixed: v('on-tertiary-fixed'),
          'fixed-variant': v('on-tertiary-fixed-variant'),
        },

        // ---- contornos ----------------------------------------------------
        outline: { DEFAULT: v('outline'), variant: v('outline-variant') },

        // ---- erro ---------------------------------------------------------
        error: { DEFAULT: v('error'), container: v('error-container'), foreground: v('on-error') },
        'on-error': { DEFAULT: v('on-error'), container: v('on-error-container') },

        // ---- aliases legados ----------------------------------------------
        // Apontam para os tokens acima; existem só para não reescrever os
        // componentes já prontos (shadcn, admin, formulários).
        background: v('background'),
        foreground: v('foreground'),
        border: v('border'),
        input: v('input'),
        ring: v('ring'),
        card: { DEFAULT: v('card'), foreground: v('card-foreground') },
        popover: { DEFAULT: v('popover'), foreground: v('popover-foreground') },
        muted: { DEFAULT: v('muted'), foreground: v('muted-foreground') },
        accent: { DEFAULT: v('accent'), foreground: v('accent-foreground') },
        destructive: { DEFAULT: v('destructive'), foreground: v('destructive-foreground') },
        success: { DEFAULT: v('success'), foreground: v('success-foreground') },
        warning: { DEFAULT: v('warning'), foreground: v('warning-foreground') },
        jackpot: { DEFAULT: v('jackpot'), foreground: v('jackpot-foreground'), soft: v('jackpot-soft') },
        // Cor viva do jogo em foco, injetada por <GameTheme>.
        'game-bright': v('game-bright'),
      },

      // Escala do Stitch. `rounded-xl` = card, `rounded-lg` = elemento interno.
      borderRadius: {
        none: '0px',
        sm: '0.25rem',
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        full: '9999px',
      },

      // Outfit para display/headline/label/bolas; Inter para corpo de texto.
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        display: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
        'jackpot-display': ['Outfit', 'sans-serif'],
        'jackpot-display-mobile': ['Outfit', 'sans-serif'],
        'headline-xl': ['Outfit', 'sans-serif'],
        'headline-xl-mobile': ['Outfit', 'sans-serif'],
        'headline-lg': ['Outfit', 'sans-serif'],
        'headline-md': ['Outfit', 'sans-serif'],
        'headline-sm': ['Outfit', 'sans-serif'],
        'ball-number': ['Outfit', 'sans-serif'],
        'label-lg': ['Outfit', 'sans-serif'],
        'label-md': ['Outfit', 'sans-serif'],
        'label-xs': ['Outfit', 'sans-serif'],
        'body-lg': ['Inter', 'sans-serif'],
        'body-md': ['Inter', 'sans-serif'],
        'body-sm': ['Inter', 'sans-serif'],
      },

      fontSize: {
        'jackpot-display': ['72px', { lineHeight: '76px', letterSpacing: '-0.04em', fontWeight: '800' }],
        'jackpot-display-mobile': ['44px', { lineHeight: '48px', letterSpacing: '-0.03em', fontWeight: '800' }],
        'headline-xl': ['48px', { lineHeight: '54px', letterSpacing: '-0.03em', fontWeight: '700' }],
        'headline-xl-mobile': ['32px', { lineHeight: '38px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '600' }],
        'headline-md': ['24px', { lineHeight: '32px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-sm': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'ball-number': ['22px', { lineHeight: '22px', fontWeight: '700' }],
        'body-lg': ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body-md': ['15px', { lineHeight: '24px', fontWeight: '400' }],
        'body-sm': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'label-lg': ['14px', { lineHeight: '20px', letterSpacing: '0.04em', fontWeight: '600' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.06em', fontWeight: '600' }],
        'label-xs': ['10px', { lineHeight: '14px', letterSpacing: '0.08em', fontWeight: '700' }],
        // O jackpot precisa encolher sozinho em telas estreitas: a versão
        // fluida evita quebrar "US$ 1.230 MILHÕES" no meio.
        'jackpot-fluid': ['clamp(2.75rem, 13vw, 6.5rem)', { lineHeight: '1.04', letterSpacing: '-0.04em', fontWeight: '800' }],
      },

      spacing: {
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'space-lg': '1.5rem',
        'space-xl': '2.5rem',
        gutter: '1.5rem',
        'gutter-mobile': '0.75rem',
        margin: '3rem',
        'margin-mobile': '1rem',
      },

      boxShadow: {
        soft: '0 1px 2px 0 hsl(var(--shadow-color) / 0.30), 0 1px 3px 0 hsl(var(--shadow-color) / 0.22)',
        card: '0 2px 6px -2px hsl(var(--shadow-color) / 0.45), 0 12px 32px -12px hsl(var(--shadow-color) / 0.55)',
        lift: '0 6px 14px -4px hsl(var(--shadow-color) / 0.55), 0 26px 56px -18px hsl(var(--shadow-color) / 0.70)',
        ball: 'inset 0 1px 0 hsl(0 0% 100% / 0.10), 0 2px 6px -1px hsl(var(--shadow-color) / 0.55)',
        glow: '0 0 0 1px hsl(var(--primary) / 0.25), 0 10px 34px -12px hsl(var(--primary) / 0.70)',
        // Sombras nomeadas do Stitch.
        topbar: '0 4px 24px rgba(0,0,0,0.6)',
        bottombar: '0 -8px 32px rgba(0,0,0,0.7)',
        commitbar: '0 -8px 30px rgba(0,0,0,0.8)',
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
        shimmer: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(200%)' } },
        // Keyframes do Stitch (bloco <style> de design/stitch/<tela>/code.html).
        'aura-pulse': {
          '0%, 100%': { transform: 'scale(1) rotate(0deg)', opacity: '0.75' },
          '50%': { transform: 'scale(1.15) rotate(180deg)', opacity: '0.95' },
        },
        'neon-glow-pulse': {
          '0%, 100%': {
            boxShadow:
              '0 0 25px hsl(var(--secondary) / 0.40), 0 0 50px hsl(var(--primary-container) / 0.25)',
          },
          '50%': {
            boxShadow:
              '0 0 40px hsl(var(--secondary) / 0.65), 0 0 70px hsl(var(--primary-container) / 0.40)',
          },
        },
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'pulse-soft': { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.45' } },
        'confetti-fall': {
          '0%': { transform: 'translateY(-10vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(110vh) rotate(720deg)', opacity: '0' },
        },
      },
      animation: {
        'ball-pop': 'ball-pop 220ms cubic-bezier(0.2, 0.9, 0.3, 1.3)',
        'fade-up': 'fade-up 320ms ease-out both',
        shimmer: 'shimmer 1.6s infinite',
        'aura-pulse': 'aura-pulse 10s ease-in-out infinite alternate',
        'neon-glow-pulse': 'neon-glow-pulse 4s ease-in-out infinite',
        'accordion-down': 'accordion-down 200ms ease-out',
        'accordion-up': 'accordion-up 200ms ease-out',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        'confetti-fall': 'confetti-fall 3s linear forwards',
      },
    },
  },
  plugins: [animate],
};

export default config;
