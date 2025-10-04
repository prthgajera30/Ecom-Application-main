import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.25rem',
        lg: '2rem',
        xl: '2.5rem',
      },
    },
    extend: {
      screens: {
        xs: '480px',
      },
      fontFamily: {
        sans: ['var(--font-sans)', ...defaultTheme.fontFamily.sans],
        heading: ['var(--font-heading)', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0efff',
          200: '#b9dbff',
          300: '#8ac2ff',
          400: '#5aa7ff',
          500: '#2a8bff',
          600: '#0f6fe6',
          700: '#0a56b4',
          800: '#083f82',
          900: '#052a57',
        },
        accent: '#ff6b6b',
        surface: '#0b1020',
        'surface-muted': '#101a33',
        'surface-strong': '#111b34',
        'on-surface': '#e2e8f0',
        card: '#121936',
      },
      borderRadius: {
        xl: '1.4rem',
        '2xl': '1.75rem',
        '3xl': '2.25rem',
      },
      boxShadow: {
        floating: '0 25px 60px -20px rgba(79, 70, 229, 0.35)',
      },
      spacing: {
        18: '4.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
