import { useEffect, useRef } from 'react';
import { Card, Divider, TransactionRow, Button } from '@/components/ui';
import { useInfiniteTransactions } from '@/api/account';
import { formatDateGroup } from '@/lib/format';
import { userMessage } from '@/api/errors';
import type { TransactionItem } from '@/lib/types';

// 같은 날짜끼리 연속 묶음 (목록이 이미 최신순이라 연속 비교로 충분).
function groupByDay(items: TransactionItem[]): { day: string; items: TransactionItem[] }[] {
  const groups: { day: string; items: TransactionItem[] }[] = [];
  for (const tx of items) {
    const day = formatDateGroup(tx.createdAt);
    const last = groups.at(-1);
    if (last && last.day === day) last.items.push(tx);
    else groups.push({ day, items: [tx] });
  }
  return groups;
}

// M5 거래내역 — useInfiniteTransactions(0-based) + 센티넬 무한 스크롤.
export function HistoryScreen() {
  const q = useInfiniteTransactions(20);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = q;

  // 바닥 근처(rootMargin) 진입 시 다음 페이지 선요청. 스크롤 컨테이너는 TabLayout의 overflow div.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '160px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const items = q.data?.pages.flatMap((p) => p.content) ?? [];
  const groups = groupByDay(items);

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-5 py-4">
        <h1 className="text-h2 text-fg">거래 내역</h1>
      </header>

      <div className="flex flex-col gap-4 px-5 pb-5">
        {q.isPending && (
          <p className="py-10 text-center text-body-sm text-fg-muted">불러오는 중…</p>
        )}

        {q.isError && (
          <div className="flex flex-col items-center gap-3 py-10">
            <p className="text-body-sm text-fg-muted">{userMessage(q.error)}</p>
            <Button
              variant="outline"
              className="h-9 px-4 text-body-sm"
              onClick={() => q.refetch()}
            >
              다시 시도
            </Button>
          </div>
        )}

        {q.isSuccess && items.length === 0 && (
          <p className="py-10 text-center text-body-sm text-fg-muted">아직 거래 내역이 없습니다</p>
        )}

        {groups.map((g) => (
          <section key={g.day} className="flex flex-col gap-2">
            <span className="px-1 text-caption text-fg-subtle">{g.day}</span>
            <Card className="p-0">
              {g.items.map((t, i) => (
                <div key={t.transactionId}>
                  <TransactionRow tx={t} />
                  {i < g.items.length - 1 && <Divider />}
                </div>
              ))}
            </Card>
          </section>
        ))}

        {/* 무한 스크롤 트리거 — 보이지 않는 센티넬 */}
        <div ref={sentinelRef} aria-hidden className="h-1" />

        {isFetchingNextPage && (
          <p className="py-3 text-center text-caption text-fg-muted">더 불러오는 중…</p>
        )}
        {q.isSuccess && !hasNextPage && items.length > 0 && (
          <p className="py-3 text-center text-caption text-fg-subtle">모든 거래를 불러왔어요</p>
        )}
      </div>
    </div>
  );
}
