import { useId } from 'react';
import { cn } from '@/lib/cn';
import { formatKRW } from '@/lib/format';

interface AmountInputProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

// 표시는 천단위 콤마(₩), 제출 값은 raw number. inputMode numeric 로 모바일 숫자패드.
export function AmountInput({
  value,
  onChange,
  label,
  placeholder = '0',
  className,
}: AmountInputProps) {
  const id = useId();
  const display = value > 0 ? formatKRW(value) : '';

  function handle(raw: string) {
    const digits = raw.replace(/[^\d]/g, '');
    onChange(digits ? Number(digits) : 0);
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-body-sm text-fg-muted">
          {label}
        </label>
      )}
      <div className="flex items-baseline gap-1.5 border-b-2 border-border pb-2 focus-within:border-brand-500">
        <span className="num text-num-md text-fg-subtle">₩</span>
        <input
          id={id}
          inputMode="numeric"
          value={display}
          placeholder={placeholder}
          onChange={(e) => handle(e.target.value)}
          className="num w-full bg-transparent text-num-lg text-fg outline-none placeholder:text-fg-subtle"
        />
      </div>
    </div>
  );
}
