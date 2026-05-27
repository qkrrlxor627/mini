import { describe, it, expect } from 'vitest';
import { formatKRW, won, amountSign } from './format';

describe('formatKRW / won', () => {
  it('천단위 콤마 + 정수 절삭', () => {
    expect(formatKRW(1234567)).toBe('1,234,567');
    expect(formatKRW(8900.4)).toBe('8,900');
    expect(won(1000)).toBe('₩1,000');
  });
});

describe('amountSign', () => {
  it('RECEIVED/충전은 +, SENT/결제는 −', () => {
    expect(amountSign('RECEIVED', 'TRANSFER')).toBe('+');
    expect(amountSign('SENT', 'TRANSFER')).toBe('-');
    expect(amountSign('SELF', 'CHARGE')).toBe('+');
    expect(amountSign('SELF', 'PAYMENT')).toBe('-');
  });
});
