// intent당 1회 생성. mutation 변수에 담아 재시도 시 같은 키 재사용 → 서버 replay 안전.
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
