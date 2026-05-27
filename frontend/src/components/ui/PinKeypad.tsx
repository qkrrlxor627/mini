import { cn } from '@/lib/cn';
import { BackspaceIcon } from '../icons';

interface PinKeypadProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const;

// 4자리(기본) PIN 입력 — 점 표시 + 숫자 그리드. 회원가입/결제에서 재사용.
export function PinKeypad({ value, onChange, length = 4 }: PinKeypadProps) {
  function press(k: string) {
    if (k === 'back') onChange(value.slice(0, -1));
    else if (k && value.length < length) onChange(value + k);
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex gap-3">
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'size-3.5 rounded-pill transition-colors duration-150',
              i < value.length ? 'bg-brand-500' : 'bg-border-strong',
            )}
          />
        ))}
      </div>
      <div className="grid w-full grid-cols-3 gap-2">
        {KEYS.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => press(k)}
              aria-label={k === 'back' ? '지우기' : k}
              className="flex h-14 items-center justify-center rounded-2 text-num-md text-fg transition-colors duration-100 active:bg-bg-sunken"
            >
              {k === 'back' ? <BackspaceIcon size={24} /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
