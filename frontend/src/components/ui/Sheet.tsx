import { useEffect, type ReactNode } from 'react';
import { CloseIcon } from '../icons';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

// 바텀 시트. 오버레이 클릭/ESC 로 닫힘. 열릴 때 body 스크롤 잠금.
export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="animate-overlay-in fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(15,17,22,0.45)' }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="animate-sheet-up w-full max-w-[var(--container-mobile)] rounded-t-4 bg-bg-elevated px-5 pb-8 pt-3"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-pill bg-border-strong" />
        {title && (
          <div className="mb-3 flex items-center justify-between">
            <span className="text-h3 text-fg">{title}</span>
            <button onClick={onClose} aria-label="닫기" className="text-fg-subtle active:text-fg">
              <CloseIcon size={22} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
