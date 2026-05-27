// 조건부 className 조인 (clsx 대체 — 의존성 없이 충분).
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
