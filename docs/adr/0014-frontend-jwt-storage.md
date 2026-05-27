# ADR-0014: 프론트 JWT는 인메모리 저장 (localStorage 금지)

## Status
Accepted

(날짜: 2026-05-26)

## Context
프론트(React PWA)는 로그인 응답의 `accessToken`(JWT, HS256, `sub=userId`, 1시간 만료, **refresh 토큰 없음** — ADR-0008)을 어딘가에 보관하고 모든 인증 요청에 `Authorization: Bearer`로 부착해야 한다. 저장 위치 선택지:

- (A) `localStorage` — 영속, 새로고침 유지. 그러나 **JS로 읽혀 XSS 시 토큰 탈취** 위험.
- (B) `sessionStorage` — 탭 한정 영속. 여전히 XSS로 읽힘.
- (C) **인메모리**(JS 변수/zustand) — 새로고침 시 소실. XSS 탈취 표면 최소.
- (D) `httpOnly` 쿠키 — JS 접근 불가(XSS 면역). 그러나 백엔드 변경 필요(현재 Bearer + `Allow-Credentials:false`).

관련: 프론트 M2(인증).

## Decision
**인메모리(zustand `useAuthStore`)를 기본**으로 한다.

1. 토큰은 zustand 스토어의 일반 상태로만 보관. **`localStorage`/`sessionStorage`에 절대 저장 안 함.**
2. 새로고침 시 토큰 소실 → 재로그인. refresh 토큰이 없고 1시간 만료라 영속화 이득이 작다 (재로그인 비용 ≈ 만료 후 재로그인과 동일).
3. 401 응답 중 **`errorCode === 'UNAUTHORIZED'`**(토큰 무효/만료)일 때만 단일 지점(`api/client.ts`)에서 `clear()` + `/login` 이동. `INVALID_CREDENTIALS`(로그인 실패, 같은 401)는 폼 에러로 처리하고 리다이렉트 안 함.
4. SW는 토큰/인증 응답을 캐시하지 않는다(ADR-0015 예정).

## Rationale
- **XSS 탈취 표면 최소화**: 인메모리 토큰은 `localStorage`처럼 임의 스크립트가 동기적으로 긁어갈 수 없다. 핀테크 성격상 토큰 탈취 = 계정 탈취라 가장 보수적인 선택.
- **refresh 없음과의 정합**: 영속 저장의 주 이점은 "새로고침해도 로그인 유지"인데, 어차피 1시간이면 만료되고 refresh로 자동 연장도 안 한다(ADR-0008). 영속화해도 사용자는 곧 재로그인해야 하므로 이득 대비 위험이 크다.
- **단일 로그아웃 지점**: 토큰 무효 처리를 `client.ts` 한 곳에 모아 일관성 확보. 401을 errorCode로 분기해 "인증 만료"와 "로그인 실패"를 구분(후자는 화면이 친절히 처리).
- **쿠키(D) 보류**: 가장 안전하나 백엔드가 Bearer 기반이라 `Set-Cookie`/`Allow-Credentials:true`/CSRF 대비 등 변경 필요. 학습 범위 초과 → 향후 하드닝 후보로 문서화.

## Consequences
### 좋은 면
- 토큰 탈취 벡터(localStorage 접근) 제거.
- 로그아웃/만료 처리가 한 곳에 단순화.

### 나쁜 면
- **새로고침 시 로그아웃** — 개발 중 약간 번거롭고, 사용자가 탭 새로고침하면 재로그인. (1h 만료 + refresh 없음 맥락에선 수용 가능.)
- XSS 자체를 막는 건 아님 — 인메모리도 실행 중 스크립트가 메모리 접근은 가능. 근본 방어는 CSP + `dangerouslySetInnerHTML` 금지 + 의존성 관리.

### 재검토 신호
- "로그인 유지" UX 요구가 강해지면 → (a) 백엔드에 refresh 토큰 + httpOnly 쿠키 도입(ADR-0008 재검토) 또는 (b) 단기 `sessionStorage` 절충.
- 다중 탭 동기화 요구 → BroadcastChannel + 저장 전략 재설계.

## References
- 코드: `frontend/src/store/auth.ts`(인메모리 스토어), `frontend/src/api/client.ts`(401 UNAUTHORIZED 단일 로그아웃), `frontend/src/routes/ProtectedRoute.tsx`
- 선행: `docs/adr/0008-jwt-stateless-auth.md`(refresh 없음, 401 명시화)
- 컨벤션: `frontend/CLAUDE.md` "API 레이어"
