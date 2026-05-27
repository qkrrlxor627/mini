import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmountInput, Button } from '@/components/ui';
import { PushScreen } from '@/components/layout/PushScreen';
import { useCharge } from '@/api/money';
import { newIdempotencyKey } from '@/api/idempotency';
import { userMessage } from '@/api/errors';
import { ResultSheet } from './ResultSheet';

export function ChargeScreen() {
  const navigate = useNavigate();
  const charge = useCharge();
  const [amount, setAmount] = useState(0);
  // intent당 1회 — 더블탭/재시도 모두 같은 키 → 서버 replay.
  const [idempotencyKey] = useState(() => newIdempotencyKey());

  const submit = () => {
    if (amount < 1) return;
    charge.mutate({ amount, idempotencyKey });
  };

  return (
    <PushScreen title="충전">
      <main className="flex flex-1 flex-col gap-6 px-6 pt-4">
        <AmountInput label="충전할 금액" value={amount} onChange={setAmount} />

        {charge.isError && (
          <p className="rounded-2 bg-neg-50 px-3 py-2 text-body-sm text-neg-700">
            {userMessage(charge.error)}
          </p>
        )}
      </main>

      <div className="px-6 pb-8">
        <Button fullWidth loading={charge.isPending} disabled={amount < 1} onClick={submit}>
          {amount > 0 ? `${amount.toLocaleString('ko-KR')}원 충전` : '충전'}
        </Button>
      </div>

      <ResultSheet
        open={charge.isSuccess}
        title="충전 완료"
        amount={charge.data?.amount ?? amount}
        balanceAfter={charge.data?.balanceAfter}
        onConfirm={() => navigate('/', { replace: true })}
      />
    </PushScreen>
  );
}
