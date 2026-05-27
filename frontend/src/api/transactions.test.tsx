import type { ReactNode } from 'react';
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useInfiniteTransactions } from './account';
import type { TransactionItem } from '@/lib/types';

const TX_URL = 'http://localhost:8080/api/v1/transactions';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function fakeTx(id: number): TransactionItem {
  return {
    transactionId: id,
    type: 'CHARGE',
    direction: 'SELF',
    amount: 1000,
    balanceAfter: 1000,
    currency: 'KRW',
    merchantId: null,
    counterpartyAccountId: null,
    status: 'SUCCESS',
    createdAt: '2026-05-26T00:00:00+09:00',
  };
}

// page 마다 행 1건(id = page*size+1)을 돌려주는 핸들러. totalPages 로 끝 판단.
function paginatedHandler(totalPages: number, requested: number[]) {
  return http.get(TX_URL, ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page'));
    const size = Number(url.searchParams.get('size'));
    requested.push(page);
    return HttpResponse.json({
      content: [fakeTx(page * size + 1)],
      page,
      size,
      totalElements: totalPages * size,
      totalPages,
    });
  });
}

describe('useInfiniteTransactions 0-based 무한 스크롤', () => {
  it('page 0→1→2 순서로 요청하고 마지막에서 hasNextPage=false', async () => {
    const requested: number[] = [];
    server.use(paginatedHandler(3, requested));

    const { result } = renderHook(() => useInfiniteTransactions(20), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(3));
    expect(result.current.hasNextPage).toBe(false);

    expect(requested).toEqual([0, 1, 2]);
    const flat = result.current.data?.pages.flatMap((p) => p.content) ?? [];
    expect(flat.map((t) => t.transactionId)).toEqual([1, 21, 41]);
  });

  it('단일 페이지면 hasNextPage=false, 추가 요청 없음', async () => {
    const requested: number[] = [];
    server.use(paginatedHandler(1, requested));

    const { result } = renderHook(() => useInfiniteTransactions(20), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
    expect(requested).toEqual([0]);
  });
});
