import { Sheet, Button } from '@/components/ui';
import { CheckIcon } from '@/components/icons';
import { won } from '@/lib/format';

interface ResultSheetProps {
  open: boolean;
  title: string;
  amount: number;
  balanceAfter?: number | null;
  onConfirm: () => void;
}

// 충전/결제/송금 성공 공용 시트.
export function ResultSheet({ open, title, amount, balanceAfter, onConfirm }: ResultSheetProps) {
  return (
    <Sheet open={open} onClose={onConfirm}>
      <div className="flex flex-col items-center gap-3 py-4">
        <span className="flex size-14 items-center justify-center rounded-pill bg-pos-50 text-pos-500">
          <CheckIcon size={32} />
        </span>
        <p className="text-h3 text-fg">{title}</p>
        <p className="num text-num-lg text-fg">{won(amount)}</p>
        {balanceAfter != null && (
          <p className="text-body-sm text-fg-muted">잔액 {won(balanceAfter)}</p>
        )}
      </div>
      <Button fullWidth onClick={onConfirm}>
        확인
      </Button>
    </Sheet>
  );
}
