import type { ReactNode } from 'react';

interface AppFrameProps {
  children: ReactNode;
}

/*
  고정 모바일 프레임(~402px, iPhone 14/15 기준). 데스크톱에서는 중앙 정렬되어
  폰 형태로 보이고, 모바일에서는 화면을 꽉 채운다. safe-area inset 존중.
  화면 전환 슬라이드(enter-right/left)의 호스트가 된다(추후 M7).
*/
export function AppFrame({ children }: AppFrameProps) {
  return (
    <div className="flex min-h-dvh justify-center bg-bg-sunken">
      <div
        className="bg-bg relative flex w-full max-w-[var(--container-mobile)] flex-col shadow-2"
        style={{
          minHeight: '100dvh',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
