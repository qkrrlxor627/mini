import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { AppFrame, Button, Input } from '@/components/ui';
import { loginSchema, type LoginInput } from '@/lib/validation';
import { useLogin } from '@/api/auth';
import { userMessage } from '@/api/errors';

export function LoginScreen() {
  const navigate = useNavigate();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit((data) => {
    login.mutate(data, { onSuccess: () => navigate('/', { replace: true }) });
  });

  return (
    <AppFrame>
      <div className="flex flex-1 flex-col justify-center gap-8 px-6">
        <div className="flex flex-col gap-2">
          <span className="text-display-2 text-brand-500">Mini Pay</span>
          <span className="text-body text-fg-muted">간편하게 충전하고 송금하세요</span>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            label="이메일"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="비밀번호"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />

          {login.isError && (
            <p className="rounded-2 bg-neg-50 px-3 py-2 text-body-sm text-neg-700">
              {userMessage(login.error)}
            </p>
          )}

          <Button type="submit" fullWidth loading={login.isPending} className="mt-2">
            로그인
          </Button>
        </form>

        <p className="text-center text-body-sm text-fg-muted">
          계정이 없으신가요?{' '}
          <Link to="/signup" className="font-semibold text-brand-500">
            회원가입
          </Link>
        </p>
      </div>
    </AppFrame>
  );
}
