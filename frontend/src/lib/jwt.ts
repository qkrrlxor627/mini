export interface JwtPayload {
  sub: string;
  exp: number;
  iat: number;
}

// 서명 검증은 서버 몫. 클라는 sub(userId)/exp 만 읽는다. 신뢰 경계 아님.
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}
