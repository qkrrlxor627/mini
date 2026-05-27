import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ListRowProps {
  left?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  className?: string;
}

// 누르는 행. onClick 있으면 button, 없으면 div. 테두리 대신 active 배경 강조.
export function ListRow({ left, title, subtitle, right, onClick, className }: ListRowProps) {
  const inner = (
    <>
      {left && <span className="shrink-0">{left}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body text-fg">{title}</span>
        {subtitle && <span className="truncate text-body-sm text-fg-muted">{subtitle}</span>}
      </span>
      {right && <span className="shrink-0 text-right">{right}</span>}
    </>
  );

  const classes = cn(
    'flex w-full items-center gap-3 px-5 py-3.5 text-left',
    onClick && 'transition-colors duration-150 ease-standard active:bg-bg-sunken',
    className,
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {inner}
      </button>
    );
  }
  return <div className={classes}>{inner}</div>;
}
