import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AmountInput, Input, Button } from '@/components/ui';
import { PushScreen } from '@/components/layout/PushScreen';
import { useAccountMe } from '@/api/account';
import { usePayment } from '@/api/money';
import { newIdempotencyKey } from '@/api/idempotency';
import { userMessage } from '@/api/errors';
import { won } from '@/lib/format';
import { ResultSheet } from './ResultSheet';

export function PaymentScreen() {
  const navigate = useNavigate();
  const me = useAccountMe();
  const pay = usePayment();
  const [merchantId, setMerchantId] = useState('');
  const [amount, setAmount] = useState(0);
  const [idempotencyKey] = useState(() => newIdempotencyKey());

  // 사전 체크(UX) — 서버가 비관적 락으로 최종 검증.
  const balance = me.data?.balance ?? 0;
  const overBalance = me.data !== undefined && amount > balance;
  const canSubmit = merchantId.trim().length > 0 && amount >= 1 && !overBalance;

  const submit = () => {
    if (!canSubmit) return;
    pay.mutate({ merchantId: merchantId.trim(), amount, idempotencyKey });
  };

  return (
    <PushScreen title="결제">
      <main className="flex flex-1 flex-col gap-5 px-6 pt-4">
        <Input
          label="가맹점"
          placeholder="가맹점 ID 또는 이름"
          value={merchantId}
          onChange={(e) => setMerchantId(e.target.value)}
        />
        <AmountInput label="결제 금액" value={amount} onChange={setAmount} />

        {me.data && (
          <p className="text-body-sm text-fg-muted">
            사용 가능 잔액 <span className="num text-fg">{won(balance)}</span>
          </p>
        )}
        {overBalance && (
          <p className="rounded-2 bg-neg-50 px-3 py-2 text-body-sm text-neg-700">잔액이 부족합니다</p>
        )}
        {pay.isError && (
          <p className="rounded-2 bg-neg-50 px-3 py-2 text-body-sm text-neg-700">
            {userMessage(pay.error)}
          </p>
        )}
      </main>

      <div className="px-6 pb-8">
        <Button fullWidth loading={pay.isPending} disabled={!canSubmit} onClick={submit}>
          결제하기
        </Button>
      </div>

      <ResultSheet
        open={pay.isSuccess}
        title="결제 완료"
        amount={pay.data?.amount ?? amount}
        balanceAfter={pay.data?.balanceAfter}
        onConfirm={() => navigate('/', { replace: true })}
      />
    </PushScreen>
  );
}
