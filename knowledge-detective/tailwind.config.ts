import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        canvas: 'hsl(var(--canvas))',
        paper: 'hsl(var(--paper))',
        ink: 'hsl(var(--ink))',
        muted: 'hsl(var(--muted))',
        line: 'hsl(var(--line))',
        brand: {
          DEFAULT: 'hsl(var(--brand))',
          foreground: 'hsl(var(--brand-foreground))',
          soft: 'hsl(var(--brand-soft))',
        },
        clue: {
          DEFAULT: 'hsl(var(--clue))',
          foreground: 'hsl(var(--clue-foreground))',
          soft: 'hsl(var(--clue-soft))',
        },
        amber: {
          DEFAULT: 'hsl(var(--amber))',
          foreground: 'hsl(var(--amber-foreground))',
          soft: 'hsl(var(--amber-soft))',
        },
      },
      fontFamily: {
        display: ['"Noto Serif SC"', '"Songti SC"', 'SimSun', 'serif'],
        body: ['Inter', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        mono: ['"SFMono-Regular"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        paper: '0 18px 50px -28px hsl(var(--ink) / 0.45)',
        lift: '0 24px 70px -34px hsl(var(--ink) / 0.55)',
        inset: 'inset 0 1px 0 hsl(0 0% 100% / 0.65)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'soft-pulse': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both',
        'soft-pulse': 'soft-pulse 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
