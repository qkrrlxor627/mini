import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './client';

export interface ChargeResponse {
  transactionId: number;
  amount: number;
  balanceAfter: number;
  currency: string;
  createdAt: string;
}

export interface PaymentResponse {
  transactionId: number;
  merchantId: string;
  amount: number;
  balanceAfter: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface TransferResponse {
  transactionId: number;
  counterpartyAccountId: number;
  amount: number;
  balanceAfter: number;
  currency: string;
  status: string;
  createdAt: string;
}

// 멱등키는 변수에 담아 전달 → React Query 재시도 시 같은 키 재전송 → 서버 replay 안전.
// 키 생성은 호출 화면에서 intent당 1회 (useState 초기화).
interface ChargeVars {
  amount: number;
  idempotencyKey: string;
}
interface PaymentVars {
  merchantId: string;
  amount: number;
  idempotencyKey: string;
}
interface TransferVars {
  counterpartyAccountId: number;
  amount: number;
  idempotencyKey: string;
}

function useInvalidateMoney() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['accountMe'] });
    qc.invalidateQueries({ queryKey: ['transactions'] });
  };
}

export function useCharge() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ amount, idempotencyKey }: ChargeVars) =>
      apiFetch<ChargeResponse>('/accounts/charge', {
        method: 'POST',
        body: { amount },
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    onSuccess: invalidate,
  });
}

export function usePayment() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ merchantId, amount, idempotencyKey }: PaymentVars) =>
      apiFetch<PaymentResponse>('/payments', {
        method: 'POST',
        body: { merchantId, amount },
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    onSuccess: invalidate,
  });
}

export function useTransfer() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ counterpartyAccountId, amount, idempotencyKey }: TransferVars) =>
      apiFetch<TransferResponse>('/transfers', {
        method: 'POST',
        body: { counterpartyAccountId, amount },
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    onSuccess: invalidate,
  });
}
