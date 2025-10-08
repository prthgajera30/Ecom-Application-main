'use client';

import { useMemo } from 'react';

import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/cn';
import { Button } from './ui/Button';

const icons = {
  sun: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        fill="currentColor"
        d="M12 6.75a5.25 5.25 0 1 1 0 10.5 5.25 5.25 0 0 1 0-10.5Zm0-4.5a.75.75 0 0 1 .75.75V5a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75Zm0 16.5a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75Zm8.25-7.5a.75.75 0 0 1 .75.75.75.75 0 0 1-.75.75H18a.75.75 0 0 1 0-1.5h2.25ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12Zm13.03-6.78a.75.75 0 0 1 0 1.06l-1.07 1.07a.75.75 0 1 1-1.06-1.06l1.06-1.07a.75.75 0 0 1 1.07 0ZM7.1 16.9a.75.75 0 0 1 0 1.06l-1.06 1.07a.75.75 0 0 1-1.07-1.06l1.07-1.07a.75.75 0 0 1 1.06 0Zm11.22 1.06-1.06-1.07a.75.75 0 1 1 1.06-1.06l1.07 1.06a.75.75 0 0 1-1.07 1.07ZM7.1 7.1 6.03 6.03A.75.75 0 0 1 7.1 4.97l1.06 1.06A.75.75 0 0 1 7.1 7.1Z"
      />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6">
      <path
        fill="currentColor"
        d="M12.75 2a.75.75 0 0 1 .72.52 7.25 7.25 0 0 0 8.01 4.93.75.75 0 0 1 .68 1.14A9.75 9.75 0 1 1 11.4 2.07.75.75 0 0 1 12.75 2Zm-2.96 3.26a8.25 8.25 0 1 0 10.95 10.95 8.75 8.75 0 0 1-10.95-10.95Z"
      />
    </svg>
  ),
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme, isReady } = useTheme();

  const label = useMemo(() => (theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'), [theme]);
  const Icon = theme === 'dark' ? icons.sun : icons.moon;

  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
  className={cn(
  'shrink-0 border border-[color:var(--surface-border)] bg-ghost-5 text-[var(--text-primary)] transition-colors hover:bg-ghost-10 focus-visible:ring-[color:var(--brand)]/70 h-12 w-12 sm:h-11 sm:w-11 rounded-2xl shadow-sm shadow-slate-900/10',
    className
  )}
      aria-label={label}
      title={label}
      onClick={toggleTheme}
      disabled={!isReady}
    >
      <span className="sr-only">{label}</span>
      <span className={cn(!isReady && 'animate-pulse opacity-60')} aria-hidden="true">
        {Icon}
      </span>
    </Button>
  );
}
