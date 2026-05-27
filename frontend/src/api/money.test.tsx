import type { ReactNode } from 'react';
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useCharge } from './money';
import { retryPolicy } from './queryClient';

const CHARGE_URL = 'http://localhost:8080/api/v1/accounts/charge';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// retryDelay 0 으로 재시도 즉시 — 테스트가 실제 retryPolicy를 쓰도록 구성.
function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: retryPolicy, retryDelay: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe('useCharge 멱등키/재시도', () => {
  it('Idempotency-Key 헤더를 전송한다', async () => {
    const keys: string[] = [];
    server.use(
      http.post(CHARGE_URL, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key') ?? '');
        return HttpResponse.json({
          transactionId: 1,
          amount: 1000,
          balanceAfter: 1000,
          currency: 'KRW',
          createdAt: '2026-05-26T00:00:00Z',
        });
      }),
    );

    const { result } = renderHook(() => useCharge(), { wrapper: makeWrapper() });
    result.current.mutate({ amount: 1000, idempotencyKey: 'key-success' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(keys).toEqual(['key-success']);
  });

  it('4xx(잔액부족)는 재시도하지 않는다 (1회 호출)', async () => {
    let calls = 0;
    server.use(
      http.post(CHARGE_URL, () => {
        calls++;
        return HttpResponse.json(
          { errorCode: 'INSUFFICIENT_BALANCE', message: '잔액이 부족합니다', timestamp: '' },
          { status: 400 },
        );
      }),
    );

    const { result } = renderHook(() => useCharge(), { wrapper: makeWrapper() });
    result.current.mutate({ amount: 999999, idempotencyKey: 'key-4xx' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(calls).toBe(1);
  });

  it('5xx는 재시도하며 매번 같은 멱등키를 보낸다 (replay 안전)', async () => {
    const keys: string[] = [];
    server.use(
      http.post(CHARGE_URL, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key') ?? '');
        return HttpResponse.json(
          { errorCode: 'INTERNAL_ERROR', message: '', timestamp: '' },
          { status: 500 },
        );
      }),
    );

    const { result } = renderHook(() => useCharge(), { wrapper: makeWrapper() });
    result.current.mutate({ amount: 1000, idempotencyKey: 'key-5xx' });

    // retryPolicy: 초기 1 + 재시도 2 = 3회
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
    expect(keys.length).toBe(3);
    expect(new Set(keys)).toEqual(new Set(['key-5xx']));
  });
});
