import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmountInput, Input, Button } from '@/components/ui';
import { PushScreen } from '@/components/layout/PushScreen';
import { useAccountMe } from '@/api/account';
import { useTransfer } from '@/api/money';
import { newIdempotencyKey } from '@/api/idempotency';
import { userMessage } from '@/api/errors';
import { won } from '@/lib/format';
import { ResultSheet } from './ResultSheet';

export function TransferScreen() {
  const navigate = useNavigate();
  const me = useAccountMe();
  const transfer = useTransfer();
  const [counterparty, setCounterparty] = useState('');
  const [amount, setAmount] = useState(0);
  const [idempotencyKey] = useState(() => newIdempotencyKey());

  const cpId = Number(counterparty);
  const cpValid = counterparty.trim().length > 0 && Number.isInteger(cpId) && cpId > 0;
  const balance = me.data?.balance ?? 0;
  const isSelf = me.data !== undefined && cpValid && cpId === me.data.accountId;
  const overBalance = me.data !== undefined && amount > balance;
  const canSubmit = cpValid && amount >= 1 && !isSelf && !overBalance;

  const submit = () => {
    if (!canSubmit) return;
    transfer.mutate({ counterpartyAccountId: cpId, amount, idempotencyKey });
  };

  return (
    <PushScreen title="송금">
      <main className="flex flex-1 flex-col gap-5 px-6 pt-4">
        <Input
          label="받는 사람 계좌 번호"
          inputMode="numeric"
          placeholder="예: 9"
          value={counterparty}
          onChange={(e) => setCounterparty(e.target.value.replace(/[^\d]/g, ''))}
          error={isSelf ? '자기 자신에게는 보낼 수 없습니다' : undefined}
        />
        <AmountInput label="보낼 금액" value={amount} onChange={setAmount} />

        {me.data && (
          <p className="text-body-sm text-fg-muted">
            사용 가능 잔액 <span className="num text-fg">{won(balance)}</span>
          </p>
        )}
        {overBalance && (
          <p className="rounded-2 bg-neg-50 px-3 py-2 text-body-sm text-neg-700">잔액이 부족합니다</p>
        )}
        {transfer.isError && (
          <p className="rounded-2 bg-neg-50 px-3 py-2 text-body-sm text-neg-700">
            {userMessage(transfer.error)}
          </p>
        )}
      </main>

      <div className="px-6 pb-8">
        <Button fullWidth loading={transfer.isPending} disabled={!canSubmit} onClick={submit}>
          보내기
        </Button>
      </div>

      <ResultSheet
        open={transfer.isSuccess}
        title="송금 완료"
        amount={transfer.data?.amount ?? amount}
        balanceAfter={transfer.data?.balanceAfter}
        onConfirm={() => navigate('/', { replace: true })}
      />
    </PushScreen>
  );
}
