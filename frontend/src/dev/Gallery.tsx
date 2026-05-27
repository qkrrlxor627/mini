import { useState } from 'react';
import {
  AppFrame,
  Button,
  Card,
  Input,
  AmountInput,
  AmountText,
  Badge,
  Avatar,
  Divider,
  ListRow,
  TransactionRow,
  Sheet,
  TabBar,
  SegmentControl,
  PinKeypad,
  type TabItemDef,
} from '@/components/ui';
import { HomeIcon, SendIcon, ReceiptIcon, PlusIcon, UserIcon } from '@/components/icons';
import { useThemeStore } from '@/store/theme';
import { won } from '@/lib/format';
import type { TransactionItem } from '@/lib/types';

const TABS: TabItemDef[] = [
  { key: 'home', label: '홈', Icon: HomeIcon },
  { key: 'transfer', label: '송금', Icon: SendIcon },
  { key: 'history', label: '내역', Icon: ReceiptIcon },
  { key: 'charge', label: '충전', Icon: PlusIcon },
  { key: 'profile', label: '내정보', Icon: UserIcon },
];

const SAMPLE_TX: TransactionItem[] = [
  {
    transactionId: 8,
    type: 'TRANSFER',
    direction: 'SENT',
    amount: 30000,
    balanceAfter: 70000,
    currency: 'KRW',
    merchantId: null,
    counterpartyAccountId: 9,
    status: 'SUCCESS',
    createdAt: '2026-05-26T11:35:00+09:00',
  },
  {
    transactionId: 7,
    type: 'TRANSFER',
    direction: 'RECEIVED',
    amount: 12000,
    balanceAfter: null,
    currency: 'KRW',
    merchantId: null,
    counterpartyAccountId: 4,
    status: 'SUCCESS',
    createdAt: '2026-05-26T11:20:00+09:00',
  },
  {
    transactionId: 4,
    type: 'PAYMENT',
    direction: 'SELF',
    amount: 8900,
    balanceAfter: 100000,
    currency: 'KRW',
    merchantId: '스타벅스 강남점',
    counterpartyAccountId: null,
    status: 'SUCCESS',
    createdAt: '2026-05-25T09:05:00+09:00',
  },
  {
    transactionId: 3,
    type: 'CHARGE',
    direction: 'SELF',
    amount: 100000,
    balanceAfter: 108900,
    currency: 'KRW',
    merchantId: null,
    counterpartyAccountId: null,
    status: 'SUCCESS',
    createdAt: '2026-05-24T18:40:00+09:00',
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <p className="text-overline uppercase tracking-wider text-fg-subtle">{title}</p>
      {children}
    </section>
  );
}

// M1 프리미티브 갤러리 — 시각 검증용. M2에서 라우터의 /dev 경로로 이동.
export function Gallery() {
  const { theme, toggle } = useThemeStore();
  const [tab, setTab] = useState('home');
  const [seg, setSeg] = useState('all');
  const [amount, setAmount] = useState(0);
  const [pin, setPin] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <AppFrame>
      <header className="flex items-center justify-between px-5 py-4">
        <span className="text-h2 text-fg">UI 갤러리</span>
        <Button variant="outline" className="h-9 px-3 text-body-sm" onClick={toggle}>
          {theme === 'dark' ? '☀️ 라이트' : '🌙 다크'}
        </Button>
      </header>

      <main className="flex flex-1 flex-col gap-7 overflow-y-auto px-5 pb-8">
        <Section title="잔액 카드">
          <Card variant="balance">
            <p className="text-overline opacity-80">내 잔액</p>
            <p className="num mt-1 text-num-lg">{won(1234567)}</p>
          </Card>
        </Section>

        <Section title="버튼">
          <div className="flex flex-col gap-2">
            <Button fullWidth>충전하기</Button>
            <Button fullWidth variant="secondary">
              취소
            </Button>
            <Button fullWidth variant="outline">
              더보기
            </Button>
            <Button fullWidth loading>
              처리 중
            </Button>
            <Button fullWidth disabled>
              비활성
            </Button>
          </div>
        </Section>

        <Section title="입력 / 금액">
          <Input label="이메일" placeholder="you@example.com" />
          <Input label="비밀번호" type="password" error="8자 이상, 영문+숫자+특수문자" />
          <AmountInput label="보낼 금액" value={amount} onChange={setAmount} />
        </Section>

        <Section title="세그먼트 / 뱃지 / 아바타">
          <SegmentControl
            options={[
              { value: 'all', label: '전체' },
              { value: 'in', label: '입금' },
              { value: 'out', label: '출금' },
            ]}
            value={seg}
            onChange={setSeg}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success">성공</Badge>
            <Badge variant="failed">실패</Badge>
            <Badge variant="info">정보</Badge>
            <Badge variant="warn">경고</Badge>
            <Avatar name="홍길동" />
            <Avatar name="Alice Kim" />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-body text-fg-muted">금액 텍스트</span>
            <div className="flex flex-col items-end">
              <AmountText amount={30000} direction="SENT" type="TRANSFER" />
              <AmountText amount={12000} direction="RECEIVED" type="TRANSFER" />
            </div>
          </div>
        </Section>

        <Section title="거래 내역 행">
          <Card className="p-0">
            {SAMPLE_TX.map((tx, i) => (
              <div key={tx.transactionId}>
                <TransactionRow tx={tx} />
                {i < SAMPLE_TX.length - 1 && <Divider />}
              </div>
            ))}
          </Card>
        </Section>

        <Section title="리스트 행 / 시트">
          <Card className="p-0">
            <ListRow title="결제 비밀번호 변경" subtitle="PIN 4자리" onClick={() => setSheetOpen(true)} />
            <Divider />
            <ListRow title="로그아웃" onClick={() => setSheetOpen(true)} />
          </Card>
          <Button variant="secondary" fullWidth onClick={() => setSheetOpen(true)}>
            바텀 시트 열기
          </Button>
        </Section>
      </main>

      <TabBar items={TABS} active={tab} onChange={setTab} />

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="PIN 입력">
        <PinKeypad value={pin} onChange={setPin} />
        <Button fullWidth className="mt-6" disabled={pin.length < 4} onClick={() => setSheetOpen(false)}>
          확인
        </Button>
      </Sheet>
    </AppFrame>
  );
}
