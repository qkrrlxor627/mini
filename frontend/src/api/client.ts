import { useAuthStore } from '@/store/auth';
import { ApiError, type ApiErrorBody } from './errors';

const BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080') + '/api/v1';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean; // 기본 true — Authorization 헤더 부착
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, auth = true } = opts;

  const h: Record<string, string> = { ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (auth) {
    const token = useAuthStore.getState().token;
    if (token) h.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(BASE + path, {
    method,
    headers: h,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const errBody = (data ?? {}) as Partial<ApiErrorBody>;
    const error = new ApiError(
      res.status,
      errBody.errorCode ?? 'UNKNOWN',
      errBody.message ?? '오류가 발생했습니다',
    );
    // 토큰 자체가 무효(UNAUTHORIZED) → 단일 지점 로그아웃.
    // 로그인 실패(INVALID_CREDENTIALS)도 401이지만 errorCode로 구분하여 리다이렉트 안 함.
    if (res.status === 401 && error.errorCode === 'UNAUTHORIZED') {
      useAuthStore.getState().clear();
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    throw error;
  }

  return data as T;
}
