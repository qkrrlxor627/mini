import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'balance';
  children: ReactNode;
}

export function Card({ variant = 'info', className, children, style, ...rest }: CardProps) {
  if (variant === 'balance') {
    return (
      <div
        className={cn('rounded-4 px-6 py-7 text-fg-onbrand shadow-brand', className)}
        // 그라데이션은 토큰(var)만 참조 — 하드코딩 hex 아님 (ADR-0013).
        style={{
          background: 'linear-gradient(135deg, var(--color-brand-500), var(--color-brand-700))',
          ...style,
        }}
        {...rest}
      >
        {children}
      </div>
    );
  }
  return (
    <div
      className={cn('rounded-3 border border-border bg-bg-elevated p-4 shadow-1', className)}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}
