import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'outline';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  loading?: boolean;
  children: ReactNode;
}

const variantClass: Record<Variant, string> = {
  primary: 'bg-brand-500 text-fg-onbrand shadow-brand active:bg-brand-600',
  secondary: 'bg-bg-sunken text-fg active:bg-border',
  outline: 'border border-border-strong text-fg active:bg-bg-sunken',
};

export function Button({
  variant = 'primary',
  fullWidth = false,
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex h-12 items-center justify-center gap-2 rounded-2 px-5 text-body-lg font-semibold',
        'transition duration-200 ease-standard active:scale-[0.99]',
        'disabled:pointer-events-none disabled:opacity-50',
        fullWidth && 'w-full',
        variantClass[variant],
        className,
      )}
      {...rest}
    >
      {loading && (
        <span className="size-4 animate-spin rounded-pill border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
