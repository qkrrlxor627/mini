import { create } from 'zustand';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'minipay-theme';

function resolveInitial(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// 다크모드는 클래스/메타만 건드림. 컴포넌트는 테마를 분기하지 않고
// var(--color-*) 토큰만 읽으므로 여기서 한 번만 적용하면 전역 전환된다.
function apply(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0d12' : '#3b63f5');
}

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  toggle: () => get().set(get().theme === 'dark' ? 'light' : 'dark'),
  set: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    apply(theme);
    set({ theme });
  },
}));

// 앱 부팅 시 1회 호출 (main.tsx).
export function initTheme(): void {
  const theme = resolveInitial();
  apply(theme);
  useThemeStore.setState({ theme });
}
