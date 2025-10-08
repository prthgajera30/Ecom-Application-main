import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
    darkMode: ['class'],
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
  			xl: '2.5rem'
  		}
  	},
  	extend: {
  		screens: {
  			xs: '480px'
  		},
  		fontFamily: {
  			sans: [
  				'var(--font-sans)',
                    ...defaultTheme.fontFamily.sans
                ],
  			heading: [
  				'var(--font-heading)',
                    ...defaultTheme.fontFamily.sans
                ]
  		},
  		colors: {
  			brand: {
  				'50': '#f0f7ff',
  				'100': '#e0efff',
  				'200': '#b9dbff',
  				'300': '#8ac2ff',
  				'400': '#5aa7ff',
  				'500': '#2a8bff',
  				'600': '#0f6fe6',
  				'700': '#0a56b4',
  				'800': '#083f82',
  				'900': '#052a57'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			surface: '#0b1020',
  			'surface-muted': '#101a33',
  			'surface-strong': '#111b34',
  			'on-surface': '#e2e8f0',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			xl: '1.4rem',
  			'2xl': '1.75rem',
  			'3xl': '2.25rem',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		boxShadow: {
  			floating: '0 25px 60px -20px rgba(79, 70, 229, 0.35)'
  		},
  		spacing: {
  			'18': '4.5rem'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
