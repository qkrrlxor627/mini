import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';

// beforeinstallprompt 는 표준 lib.dom 에 없어 최소 타입만 선언.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// 설치 가능 시점(beforeinstallprompt)에만 뜨는 하단 배너. 한 번 닫으면 세션 동안 숨김.
export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // 브라우저 기본 미니인포바 억제 → 우리 UI로 유도
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred) return null;

  const install = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <div className="animate-sheet-up absolute inset-x-3 bottom-20 z-40 flex items-center gap-3 rounded-3 border border-border bg-bg-elevated p-3 shadow-2">
      <div className="flex-1">
        <p className="text-body-sm text-fg">홈 화면에 추가</p>
        <p className="text-caption text-fg-subtle">앱처럼 빠르게 실행해요</p>
      </div>
      <Button className="h-9 px-3 text-body-sm" onClick={install}>
        설치
      </Button>
      <button
        aria-label="닫기"
        className="text-fg-subtle active:text-fg"
        onClick={() => setDeferred(null)}
      >
        ✕
      </button>
    </div>
  );
}
