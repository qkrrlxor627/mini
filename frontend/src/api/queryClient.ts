import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './errors';

// 4xx 는 절대 재시도 안 함 (INSUFFICIENT_BALANCE 등 재시도 시 사고).
// 네트워크/5xx만 제한적으로 재시도. (mutation 재시도는 같은 멱등키 → 서버 replay 안전)
export function retryPolicy(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    // 돈 데이터는 항상 fresh — staleTime 0.
    queries: { staleTime: 0, retry: retryPolicy },
    mutations: { retry: retryPolicy },
  },
});
