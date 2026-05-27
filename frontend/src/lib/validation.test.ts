import { describe, it, expect } from 'vitest';
import { loginSchema, signupSchema } from './validation';

describe('signupSchema (서버 규칙 미러)', () => {
  const valid = {
    email: 'alice@example.com',
    password: 'Secret#1234',
    name: 'Alice',
    pin: '1234',
  };

  it('정상 입력 통과', () => {
    expect(signupSchema.safeParse(valid).success).toBe(true);
  });

  it('비밀번호 8자 미만 거절', () => {
    expect(signupSchema.safeParse({ ...valid, password: 'Ab#1' }).success).toBe(false);
  });

  it('특수문자 없는 비밀번호 거절', () => {
    expect(signupSchema.safeParse({ ...valid, password: 'Secret1234' }).success).toBe(false);
  });

  it('PIN 4자리 아니면 거절', () => {
    expect(signupSchema.safeParse({ ...valid, pin: '123' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, pin: '12a4' }).success).toBe(false);
  });

  it('잘못된 이메일 거절', () => {
    expect(signupSchema.safeParse({ ...valid, email: 'nope' }).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('정상 통과 / 빈 비번 거절', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});
