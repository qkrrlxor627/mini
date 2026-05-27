import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from './client';
import type { TransactionItem } from '@/lib/types';

export interface AccountMe {
  accountId: number;
  balance: number;
  currency: string;
}

export interface TransactionsPage {
  content: TransactionItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export function useAccountMe() {
  return useQuery({
    queryKey: ['accountMe'],
    queryFn: () => apiFetch<AccountMe>('/accounts/me'),
  });
}

export function useTransactions(size = 20) {
  return useQuery({
    queryKey: ['transactions', { size, page: 0 }],
    queryFn: () => apiFetch<TransactionsPage>(`/transactions?page=0&size=${size}`),
  });
}

// 거래내역 무한 스크롤. 0-based 페이지 — 다음 페이지는 PageResponse.page+1 < totalPages 일 때만.
// queryKey 가 ['transactions', ...] 라 머니 mutation 의 invalidate(['transactions']) 에 함께 걸림.
export function useInfiniteTransactions(size = 20) {
  return useInfiniteQuery({
    queryKey: ['transactions', 'infinite', { size }],
    queryFn: ({ pageParam }) =>
      apiFetch<TransactionsPage>(`/transactions?page=${pageParam}&size=${size}`),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.page + 1 < lastPage.totalPages ? lastPage.page + 1 : undefined,
  });
}
