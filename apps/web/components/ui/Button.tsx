'use client';

import Link, { type LinkProps } from 'next/link';
import { forwardRef } from 'react';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

import { cn } from '../../lib/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'md' | 'sm' | 'lg' | 'icon';

type ButtonCommon = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

type NativeButtonProps = ButtonCommon & ButtonHTMLAttributes<HTMLButtonElement>;
type AnchorButtonProps = ButtonCommon & AnchorHTMLAttributes<HTMLAnchorElement>;

type ButtonProps = NativeButtonProps & { as?: 'button' };
type ButtonLinkProps = AnchorButtonProps & LinkProps;

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
};

const sizeClasses: Record<ButtonSize, string> = {
  md: '',
  sm: 'btn-sm',
  lg: 'btn-lg',
  icon: 'btn-icon',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn('btn', variantClasses[variant], sizeClasses[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ variant = 'primary', size = 'md', className, children, ...props }, ref) => (
    <Link ref={ref} className={cn('btn', variantClasses[variant], sizeClasses[size], className)} {...props}>
      {children}
    </Link>
  )
);

ButtonLink.displayName = 'ButtonLink';
