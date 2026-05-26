import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0f0f0f',
          raised: '#1a1a1a',
          overlay: '#242424',
        },
        accent: {
          DEFAULT: '#7c6aff',
          hover: '#6a58ee',
        },
        muted: '#6b7280',
        border: '#2e2e2e',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
