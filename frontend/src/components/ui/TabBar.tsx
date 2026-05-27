import type { ComponentType } from 'react';
import { cn } from '@/lib/cn';

export interface TabItemDef {
  key: string;
  label: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
}

interface TabBarProps {
  items: TabItemDef[];
  active: string;
  onChange: (key: string) => void;
}

// 하단 고정 탭바 (~5탭). 활성 탭은 brand 색.
export function TabBar({ items, active, onChange }: TabBarProps) {
  return (
    <nav
      className="sticky bottom-0 grid border-t border-divider bg-bg-elevated"
      style={{
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {items.map(({ key, label, Icon }) => {
        const on = key === active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            aria-current={on ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 transition-colors duration-150 ease-standard',
              on ? 'text-brand-500' : 'text-fg-subtle',
            )}
          >
            <Icon size={24} />
            <span className="text-caption">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
