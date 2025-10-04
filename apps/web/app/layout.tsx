import './globals.css';
import Header from '../components/Header';
import ToastShelf from '../components/ToastShelf';
import { AuthProvider } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';
import { CartProvider } from '../context/CartContext';
import { ThemeProvider } from '../context/ThemeContext';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-sans' });

const themeScript = `(() => {
  try {
    const storageKey = 'pulse-theme';
    const root = document.documentElement;
    const stored = window.localStorage.getItem(storageKey);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = stored === 'light' || stored === 'dark' ? stored : prefersDark ? 'dark' : 'light';
    root.dataset.theme = theme;
  } catch (error) {
    document.documentElement.dataset.theme = 'dark';
  }
})();`;

export const metadata = { title: 'Pulse Commerce', description: 'Personalized shopping with realtime intelligence.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans bg-[var(--bg-base)] text-[var(--text-primary)] antialiased">
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <CartProvider>
                <div className="relative min-h-screen overflow-hidden">
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -top-32 right-10 h-80 w-80 rounded-full bg-[var(--bg-glow-1)] blur-3xl" />
                    <div className="absolute bottom-[-6rem] left-[-3rem] h-[22rem] w-[22rem] rounded-full bg-[var(--bg-glow-2)] blur-3xl" />
                  </div>
                  <Header />
                  <main className="relative z-10 container py-12 sm:py-16 lg:py-20">{children}</main>
                  <ToastShelf />
                </div>
              </CartProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
