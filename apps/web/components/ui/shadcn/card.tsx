import React from 'react';
import { cn } from '../../../lib/cn';

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
};

export function Card({ className, elevated = false, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-lg p-4 bg-[color:var(--surface)] border border-[var(--surface-border)]',
        elevated ? 'card-elevated' : 'card',
        className)}
      {...props}
    />
  );
}

export default Card;
