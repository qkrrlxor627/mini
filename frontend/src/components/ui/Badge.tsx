import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type BadgeVariant = 'success' | 'failed' | 'neutral' | 'info' | 'warn';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClass: Record<BadgeVariant, string> = {
  success: 'bg-pos-50 text-pos-700',
  failed: 'bg-neg-50 text-neg-700',
  neutral: 'bg-bg-sunken text-fg-muted',
  info: 'bg-info-50 text-info-500',
  warn: 'bg-warn-50 text-warn-700',
};

export function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2.5 py-0.5 text-caption font-semibold',
        variantClass[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
