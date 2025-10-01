import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
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
        card: '#121936',
      },
    },
  },
  plugins: [],
}
export default config
