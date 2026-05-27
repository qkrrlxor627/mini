import { format, isToday, isYesterday, isThisYear } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { TransactionDirection, TransactionType } from './types';

// KRW: 정수 표시 (scale 4 number지만 원화는 정수 단위로 노출).
const krw = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });

export function formatKRW(amount: number): string {
  return krw.format(Math.floor(amount));
}

// "₩1,234,567"
export function won(amount: number): string {
  return `₩${formatKRW(amount)}`;
}

export function formatDateTime(iso: string): string {
  return format(new Date(iso), 'M.d HH:mm', { locale: ko });
}

// 거래내역 날짜 섹션 헤더용. 오늘/어제는 상대 표기, 그 외는 날짜.
// (각 라벨이 하루를 유일하게 식별하므로 라벨 기준 그룹핑이 안전.)
export function formatDateGroup(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return '오늘';
  if (isYesterday(d)) return '어제';
  return format(d, isThisYear(d) ? 'M월 d일 (EEE)' : 'yyyy년 M월 d일', { locale: ko });
}

// 거래 방향/종류로 부호 결정. RECEIVED·CHARGE → +, SENT·PAYMENT → −.
export function amountSign(direction: TransactionDirection, type: TransactionType): '+' | '-' {
  if (direction === 'RECEIVED') return '+';
  if (direction === 'SENT') return '-';
  // SELF: 충전은 +, 결제는 −
  return type === 'CHARGE' ? '+' : '-';
}
