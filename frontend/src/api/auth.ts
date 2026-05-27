import { useMutation } from '@tanstack/react-query';
import { apiFetch } from './client';
import { useAuthStore } from '@/store/auth';
import type { LoginInput, SignupInput } from '@/lib/validation';

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
}

export interface SignupResponse {
  userId: number;
  email: string;
}

export function useLogin() {
  return useMutation({
    mutationFn: (input: LoginInput) =>
      apiFetch<LoginResponse>('/auth/login', { method: 'POST', body: input, auth: false }),
    onSuccess: (data) => useAuthStore.getState().setAuth(data.accessToken),
  });
}

export function useSignup() {
  return useMutation({
    mutationFn: (input: SignupInput) =>
      apiFetch<SignupResponse>('/auth/signup', { method: 'POST', body: input, auth: false }),
  });
}
