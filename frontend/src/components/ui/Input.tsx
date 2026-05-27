import { forwardRef, useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

// forwardRef 라 react-hook-form register()와 바로 연결됨 (M2).
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-body-sm text-fg-muted">
          {label}
        </label>
      )}
      <input
        id={inputId}
        ref={ref}
        aria-invalid={error ? true : undefined}
        className={cn(
          'rounded-2 border bg-bg-elevated px-3.5 py-3 text-body text-fg outline-none',
          'placeholder:text-fg-subtle transition-colors duration-200 ease-standard',
          'focus:ring-2',
          error
            ? 'border-neg-500 focus:ring-neg-50'
            : 'border-border focus:border-brand-500 focus:ring-brand-100',
          className,
        )}
        {...rest}
      />
      {error && <span className="text-caption text-neg-500">{error}</span>}
    </div>
  );
});
