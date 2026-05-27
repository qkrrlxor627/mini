import { useNavigate } from 'react-router-dom';
import { Card, Button, Avatar, Divider } from '@/components/ui';
import { useAccountMe } from '@/api/account';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import { cn } from '@/lib/cn';
import { won } from '@/lib/format';

// M7 내 정보 — 계정 요약 + 다크 모드 토글 + 로그아웃.
export function ProfileScreen() {
  const navigate = useNavigate();
  const me = useAccountMe();
  const userId = useAuthStore((s) => s.userId);
  const clear = useAuthStore((s) => s.clear);
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);

  const logout = () => {
    clear();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 pb-5">
      <header className="pt-4">
        <h1 className="text-h2 text-fg">내 정보</h1>
      </header>

      <Card className="flex items-center gap-3">
        <Avatar name={`U${userId ?? ''}`} />
        <div className="flex flex-col">
          <span className="text-body text-fg">사용자 #{userId ?? '—'}</span>
          {me.data && (
            <span className="text-caption text-fg-subtle">
              계좌 #{me.data.accountId} · {me.data.currency}
            </span>
          )}
        </div>
      </Card>

      <Card className="p-0">
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-body text-fg">잔액</span>
          {me.isLoading && <span className="num text-body text-fg-subtle">…</span>}
          {me.isError && <span className="text-body-sm text-fg-subtle">불러오지 못함</span>}
          {me.data && <span className="num text-body text-fg">{won(me.data.balance)}</span>}
        </div>
        <Divider />
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-body text-fg">다크 모드</span>
          <button
            type="button"
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label="다크 모드"
            onClick={toggle}
            className={cn(
              'flex w-11 items-center rounded-pill p-0.5 transition-colors duration-150',
              theme === 'dark' ? 'bg-brand-500' : 'bg-border-strong',
            )}
          >
            <span
              className={cn(
                'size-5 rounded-pill bg-bg-elevated shadow-1 transition-transform duration-150',
                theme === 'dark' ? 'translate-x-5' : 'translate-x-0',
              )}
            />
          </button>
        </div>
      </Card>

      <Button variant="outline" fullWidth onClick={logout}>
        로그아웃
      </Button>
    </div>
  );
}
