import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppFrame } from '@/components/ui';
import { ChevronLeftIcon } from '@/components/icons';

interface PushScreenProps {
  title: string;
  children: ReactNode;
}

// 푸시(전체화면) 화면 공통 셸: AppFrame + 우→좌 슬라이드 진입 + 뒤로 헤더.
// 충전/결제/송금이 공유. enterRight는 0.32s 1회뿐이라 이후 뜨는 ResultSheet(fixed)에 영향 없음.
export function PushScreen({ title, children }: PushScreenProps) {
  const navigate = useNavigate();
  return (
    <AppFrame>
      <div className="animate-enter-right flex flex-1 flex-col">
        <header className="flex items-center gap-2 px-4 py-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="뒤로"
            className="rounded-2 text-fg-muted transition-colors active:text-fg"
          >
            <ChevronLeftIcon />
          </button>
          <h1 className="text-h2 text-fg">{title}</h1>
        </header>
        {children}
      </div>
    </AppFrame>
  );
}
