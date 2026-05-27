import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';

// 미인증이면 로그인으로. (토큰 인메모리라 새로고침 시 재로그인 — ADR-0014)
export function ProtectedRoute() {
  const token = useAuthStore((s) => s.token);
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}
