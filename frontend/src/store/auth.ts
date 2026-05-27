import { create } from 'zustand';
import { decodeJwt } from '@/lib/jwt';

interface AuthState {
  token: string | null;
  userId: number | null;
  setAuth: (token: string) => void;
  clear: () => void;
}

// 토큰은 인메모리만 (ADR-0014). localStorage 금지 — XSS 탈취 면역.
// 새로고침 시 소실 → 재로그인 (refresh 토큰 없음, 1h 만료).
export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userId: null,
  setAuth: (token) => {
    const payload = decodeJwt(token);
    set({ token, userId: payload ? Number(payload.sub) : null });
  },
  clear: () => set({ token: null, userId: null }),
}));
