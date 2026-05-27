import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginScreen } from './features/auth/LoginScreen';
import { SignupScreen } from './features/auth/SignupScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { HistoryScreen } from './features/history/HistoryScreen';
import { ProfileScreen } from './features/profile/ProfileScreen';
import { ChargeScreen } from './features/money/ChargeScreen';
import { PaymentScreen } from './features/money/PaymentScreen';
import { TransferScreen } from './features/money/TransferScreen';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { TabLayout } from './components/layout/TabLayout';
import { Gallery } from './dev/Gallery';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/signup" element={<SignupScreen />} />
        {/* 개발용 프리미티브 갤러리 */}
        <Route path="/dev" element={<Gallery />} />

        <Route element={<ProtectedRoute />}>
          {/* 탭 셸(하단 TabBar) 공유 화면 */}
          <Route element={<TabLayout />}>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/history" element={<HistoryScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
          </Route>
          {/* 푸시(전체화면) 머니 플로우 */}
          <Route path="/charge" element={<ChargeScreen />} />
          <Route path="/pay" element={<PaymentScreen />} />
          <Route path="/transfer" element={<TransferScreen />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
