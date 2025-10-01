import './globals.css';
import Header from '../components/Header';
import { AuthProvider } from '../context/AuthContext';

export const metadata = { title: 'Pulse Commerce', description: 'Personalized shopping with realtime intelligence.' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[var(--bg-base)] text-[var(--text-primary)]">
        <AuthProvider>
          <div className="relative min-h-screen overflow-hidden">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 right-16 h-72 w-72 rounded-full bg-[var(--bg-glow-1)] blur-3xl" />
              <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-[var(--bg-glow-2)] blur-3xl" />
            </div>
            <Header />
            <main className="relative z-10 mx-auto w-full max-w-6xl px-6 py-12 md:px-8 md:py-16">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
