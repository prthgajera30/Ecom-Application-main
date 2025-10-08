import React from 'react';
import { cn } from '../../../lib/cn';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost';
};

export function Button({ className, variant = 'default', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition';
  const variants: Record<string, string> = {
    default: 'px-3 py-2 bg-[color:var(--surface-strong)] text-[var(--text-primary)] border border-[var(--surface-border)]',
    primary: 'px-3 py-2 btn-primary',
    ghost: 'px-2 py-1 btn-ghost',
  };

  return (
    <button className={cn(base, variants[variant], className)} {...props} />
  );
}

export default Button;
