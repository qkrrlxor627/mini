import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('variant별 토큰 클래스 스냅샷', () => {
    const { container } = render(
      <>
        <Button>기본</Button>
        <Button variant="secondary">보조</Button>
        <Button variant="outline">아웃라인</Button>
      </>,
    );
    expect(container.innerHTML).toMatchSnapshot();
  });

  it('loading 시 비활성', () => {
    const { getByRole } = render(<Button loading>처리 중</Button>);
    expect((getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });
});
