import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { AppFrame, Button, Input } from '@/components/ui';
import { ChevronLeftIcon } from '@/components/icons';
import { signupSchema, type SignupInput } from '@/lib/validation';
import { useSignup } from '@/api/auth';
import { ApiError, userMessage } from '@/api/errors';

export function SignupScreen() {
  const navigate = useNavigate();
  const signup = useSignup();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  const onSubmit = handleSubmit((data) => {
    signup.mutate(data, {
      onSuccess: () => navigate('/login', { replace: true }),
      onError: (err) => {
        // 중복 이메일은 이메일 필드에 직접 표시.
        if (err instanceof ApiError && err.errorCode === 'DUPLICATE_EMAIL') {
          setError('email', { message: '이미 가입된 이메일입니다' });
        }
      },
    });
  });

  const showFormError =
    signup.isError && !(signup.error instanceof ApiError && signup.error.errorCode === 'DUPLICATE_EMAIL');

  return (
    <AppFrame>
      <header className="flex items-center gap-2 px-4 py-4">
        <button onClick={() => navigate(-1)} aria-label="뒤로" className="text-fg-muted active:text-fg">
          <ChevronLeftIcon />
        </button>
        <span className="text-h2 text-fg">회원가입</span>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4 px-6 pt-2" noValidate>
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
          autoComplete="new-password"
          placeholder="8자 이상, 영문+숫자+특수문자"
          error={errors.password?.message}
          {...register('password')}
        />
        <Input label="이름" placeholder="홍길동" error={errors.name?.message} {...register('name')} />
        <Input
          label="결제 PIN (숫자 4자리)"
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder="••••"
          error={errors.pin?.message}
          {...register('pin')}
        />

        {showFormError && (
          <p className="rounded-2 bg-neg-50 px-3 py-2 text-body-sm text-neg-700">
            {userMessage(signup.error)}
          </p>
        )}

        <Button type="submit" fullWidth loading={signup.isPending} className="mt-2">
          가입하기
        </Button>

        <p className="text-center text-body-sm text-fg-muted">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="font-semibold text-brand-500">
            로그인
          </Link>
        </p>
      </form>
    </AppFrame>
  );
}
