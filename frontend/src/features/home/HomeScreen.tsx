import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Divider, TransactionRow } from '@/components/ui';
import { PlusIcon, WalletIcon, SendIcon } from '@/components/icons';
import { useAccountMe, useTransactions } from '@/api/account';
import { useAuthStore } from '@/store/auth';
import { won } from '@/lib/format';

function QuickAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 rounded-3 border border-border bg-bg-elevated py-4 shadow-1 transition-colors duration-150 active:bg-bg-sunken"
    >
      <span className="text-brand-500">{icon}</span>
      <span className="text-body-sm text-fg">{label}</span>
    </button>
  );
}

// M3 대시보드 — 잔액 + 퀵액션 + 최근 거래 5건.
export function HomeScreen() {
  const navigate = useNavigate();
  const clear = useAuthStore((s) => s.clear);
  const me = useAccountMe();
  const tx = useTransactions(5);

  function logout() {
    clear();
    navigate('/login', { replace: true });
  }

  const recent = tx.data?.content ?? [];

  return (
    <div className="flex flex-col gap-5 px-5 pb-5">
      <header className="flex items-center justify-between pt-4">
        <h1 className="text-h2 text-fg">홈</h1>
        <Button variant="outline" className="h-9 px-3 text-body-sm" onClick={logout}>
          로그아웃
        </Button>
      </header>

      <Card variant="balance">
        <p className="text-overline opacity-80">내 잔액</p>
        {me.isLoading && <p className="num mt-1 text-num-lg opacity-70">불러오는 중…</p>}
        {me.isError && <p className="mt-1 text-body">잔액을 불러오지 못했습니다</p>}
        {me.data && (
          <>
            <p className="num mt-1 text-num-lg">{won(me.data.balance)}</p>
            <p className="mt-1 text-caption opacity-80">계좌 #{me.data.accountId}</p>
          </>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <QuickAction icon={<PlusIcon />} label="충전" onClick={() => navigate('/charge')} />
        <QuickAction icon={<WalletIcon />} label="결제" onClick={() => navigate('/pay')} />
        <QuickAction icon={<SendIcon />} label="송금" onClick={() => navigate('/transfer')} />
      </div>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-h3 text-fg">최근 거래</span>
          <button onClick={() => navigate('/history')} className="text-body-sm text-brand-500">
            전체 보기
          </button>
        </div>

        <Card className="p-0">
          {tx.isLoading && <p className="px-5 py-6 text-center text-body-sm text-fg-muted">불러오는 중…</p>}
          {tx.isError && (
            <p className="px-5 py-6 text-center text-body-sm text-fg-muted">거래를 불러오지 못했습니다</p>
          )}
          {tx.data && recent.length === 0 && (
            <p className="px-5 py-6 text-center text-body-sm text-fg-muted">아직 거래 내역이 없습니다</p>
          )}
          {recent.map((t, i) => (
            <div key={t.transactionId}>
              <TransactionRow tx={t} />
              {i < recent.length - 1 && <Divider />}
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
