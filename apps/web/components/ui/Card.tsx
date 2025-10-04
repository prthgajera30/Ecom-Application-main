import { forwardRef } from 'react';
import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

type CardVariant = 'default' | 'elevated';

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
};

const variantClasses: Record<CardVariant, string> = {
  default: 'card',
  elevated: 'card-elevated',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(({ variant = 'default', className, ...props }, ref) => (
  <div ref={ref} className={cn(variantClasses[variant], className)} {...props} />
));

Card.displayName = 'Card';
