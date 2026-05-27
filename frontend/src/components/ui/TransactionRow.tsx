import { Avatar } from './Avatar';
import { AmountText } from './AmountText';
import { ListRow } from './ListRow';
import { formatDateTime, won } from '@/lib/format';
import type { TransactionItem } from '@/lib/types';

function label(tx: TransactionItem): string {
  switch (tx.type) {
    case 'CHARGE':
      return '충전';
    case 'PAYMENT':
      return tx.merchantId ?? '결제';
    case 'TRANSFER':
      return tx.direction === 'RECEIVED' ? '입금' : '송금';
  }
}

interface TransactionRowProps {
  tx: TransactionItem;
  onClick?: () => void;
}

export function TransactionRow({ tx, onClick }: TransactionRowProps) {
  const name = label(tx);
  return (
    <ListRow
      onClick={onClick}
      left={<Avatar name={name} />}
      title={name}
      subtitle={formatDateTime(tx.createdAt)}
      right={
        <span className="flex flex-col items-end gap-0.5">
          <AmountText amount={tx.amount} direction={tx.direction} type={tx.type} />
          {/* 수신자 시점(RECEIVED)은 잔액이 거래 행에 없음 (ADR-0006) */}
          {tx.balanceAfter !== null && (
            <span className="num text-caption text-fg-subtle">{won(tx.balanceAfter)}</span>
          )}
        </span>
      }
    />
  );
}
