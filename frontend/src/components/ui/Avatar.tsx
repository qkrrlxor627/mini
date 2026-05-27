import { cn } from '@/lib/cn';

interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
}

function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  // 한글은 첫 글자, 영문은 앞 두 단어 이니셜.
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && /[A-Za-z]/.test(trimmed)) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, /[A-Za-z]/.test(trimmed) ? 2 : 1).toUpperCase();
}

export function Avatar({ name, size = 40, className }: AvatarProps) {
  return (
    <span
      className={cn(
        'num inline-flex shrink-0 items-center justify-center rounded-pill bg-brand-100 text-brand-700',
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials(name)}
    </span>
  );
}
