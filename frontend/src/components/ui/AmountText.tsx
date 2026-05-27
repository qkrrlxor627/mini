import { cn } from '@/lib/cn';
import { formatKRW, amountSign } from '@/lib/format';
import type { TransactionDirection, TransactionType } from '@/lib/types';

interface AmountTextProps {
  amount: number;
  direction: TransactionDirection;
  type: TransactionType;
  className?: string;
}

// 부호+색: 들어오는 돈(+) 녹색, 나가는 돈(−) 적색.
export function AmountText({ amount, direction, type, className }: AmountTextProps) {
  const sign = amountSign(direction, type);
  const positive = sign === '+';
  return (
    <span
      className={cn('num text-body-lg font-semibold', positive ? 'text-pos-500' : 'text-neg-500', className)}
    >
      {sign}₩{formatKRW(amount)}
    </span>
  );
}
