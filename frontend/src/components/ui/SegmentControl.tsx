import { cn } from '@/lib/cn';

interface SegmentOption {
  value: string;
  label: string;
}

interface SegmentControlProps {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// 활성 세그먼트는 떠 보이는 흰 카드(shadow-1), 트랙은 sunken.
export function SegmentControl({ options, value, onChange, className }: SegmentControlProps) {
  return (
    <div className={cn('flex gap-1 rounded-pill bg-bg-sunken p-1', className)}>
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded-pill px-3 py-1.5 text-body-sm font-semibold transition-all duration-200 ease-standard',
              on ? 'bg-bg-elevated text-fg shadow-1' : 'text-fg-muted',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
