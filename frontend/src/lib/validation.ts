import { z } from 'zod';

// 서버 검증 규칙 미러 (docs/api.md §1). 클라에서 1차 검증, 서버가 최종.
export const loginSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(1, '비밀번호를 입력하세요'),
});

export const signupSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: z
    .string()
    .min(8, '8자 이상이어야 합니다')
    .regex(
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/,
      '영문·숫자·특수문자를 모두 포함해야 합니다',
    ),
  name: z.string().min(1, '이름을 입력하세요').max(100, '100자 이하여야 합니다'),
  pin: z.string().regex(/^\d{4}$/, 'PIN은 숫자 4자리여야 합니다'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
