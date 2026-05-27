import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AppFrame } from '@/components/ui';
import { TabBar } from '@/components/ui';
import { PwaInstallPrompt } from '@/components/PwaInstallPrompt';
import { HomeIcon, SendIcon, ReceiptIcon, PlusIcon, UserIcon } from '@/components/icons';

const TABS = [
  { key: 'home', label: '홈', path: '/', Icon: HomeIcon },
  { key: 'transfer', label: '송금', path: '/transfer', Icon: SendIcon },
  { key: 'history', label: '내역', path: '/history', Icon: ReceiptIcon },
  { key: 'charge', label: '충전', path: '/charge', Icon: PlusIcon },
  { key: 'profile', label: '내정보', path: '/profile', Icon: UserIcon },
];

// 탭 화면 공유 셸: AppFrame + 스크롤 영역(Outlet) + 하단 TabBar.
// 탭 화면(Home/History/Profile)은 자체 AppFrame 없이 콘텐츠만 반환.
export function TabLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const active = TABS.find((t) => t.path === pathname)?.key ?? '';

  return (
    <AppFrame>
      <div className="flex flex-1 flex-col overflow-y-auto">
        <Outlet />
      </div>
      <PwaInstallPrompt />
      <TabBar
        items={TABS.map(({ key, label, Icon }) => ({ key, label, Icon }))}
        active={active}
        onChange={(key) => {
          const tab = TABS.find((t) => t.key === key);
          if (tab) navigate(tab.path);
        }}
      />
    </AppFrame>
  );
}
