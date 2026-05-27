# Mini Pay 프론트엔드 — 컨벤션

> React PWA. `frontend/`에서 작업 시 이 파일이 루트 `CLAUDE.md`와 함께 적용됨.
> 진행 상황: `docs/frontend/progress.md`. 결정 근거: `docs/adr/`(0013+). 디자인 원본: `docs/MiniPayPrototype.html`.
> 스택: Vite + React 19 + TypeScript + Tailwind v4 + TanStack Query + zustand + RHF/zod.

---

## 디자인 토큰 (ADR-0013)

- **토큰이 유일한 진실**. 색/타이포/간격/radius/shadow/motion은 `src/styles/app.css`의 `@theme`에만 정의.
- 컴포넌트는 **토큰/유틸리티만 사용** — `bg-bg`, `text-fg-muted`, `rounded-3`, `shadow-2`, `text-num-lg` 등.
- **하드코딩 hex / 임의 색 리터럴 금지** (`bg-[#fff]`, `style={{color:'#000'}}`) — 리뷰 거절. 새 색이 필요하면 먼저 `@theme`에 토큰 추가.
- 다크모드는 **surface alias 스왑**으로만 동작(`.dark`). 컴포넌트에 `dark:` 분기 가급적 금지 — `bg-bg`/`text-fg` 쓰면 자동 전환. brand/ink 원시 스케일은 고정.
- 타이포는 `text-display-1`/`text-h1`/`text-body`/`text-num-lg` 등 스케일 유틸리티만. 임의 `text-[17px]` 금지.
- 돈/숫자는 `num`(tabular-nums), 참조번호/코드는 `mono`.

## 컴포넌트

- `src/components/ui`의 **프리미티브 우선** 재사용. 새 버튼/카드/입력을 화면에서 즉석 제작 금지.
- 프리미티브는 토큰만으로 스타일. props로 변형(variant) 노출, 색은 토큰 매핑.
- 화면은 `src/features/*`. 화면이 프리미티브를 조합하는 구조.
- `AppFrame`이 고정 모바일 프레임(~402px) + safe-area 담당.

## API 레이어 (M2+)

- 모든 호출은 `src/api/client.ts` 경유. 컴포넌트에서 `fetch` 직접 호출 금지.
- 인증 토큰은 **인메모리(zustand)** — localStorage 금지 (ADR-0014). 401 → 단일 지점에서 로그아웃+리다이렉트.
- 서버 상태는 **TanStack Query**. 컴포넌트 `useState`로 서버 데이터 보관 금지.
- 잔액/거래내역 쿼리는 `staleTime: 0`(돈은 항상 fresh).

## 멱등성 (충전/결제/이체)

- `Idempotency-Key`는 **intent당 1회** `crypto.randomUUID()` 생성(`src/api/idempotency.ts`).
- mutation `retry`는 **네트워크/5xx만, 4xx 절대 금지** (INSUFFICIENT_BALANCE 등 재시도 시 사고). 재시도는 같은 키 → 백엔드 replay.
- 성공 후 `invalidateQueries(['transactions'],['accountMe'])`.

## PWA (ADR-0015)

- `vite-plugin-pwa`(Workbox `generateSW`). 매니페스트·SW·아이콘은 빌드 산출.
- **앱셸만 프리캐시**(JS/CSS/HTML/폰트/아이콘). **인증 API(`/api/v1/*`)는 `NetworkOnly`** — 잔액·거래내역은 절대 캐시 금지(돈 데이터 stale 오인 방지, `staleTime:0`·ADR-0014와 일관). StaleWhileRevalidate/NetworkFirst로 돈 응답 캐시 금지.
- SPA 폴백 `navigateFallback: index.html` + `denylist: [/^\/api\//]`.
- 아이콘은 `npm run gen:icons`(`scripts/generate-icons.mjs`, sharp). 색·마크는 토큰 동기화(브랜드 `#3b63f5`).

## 화면 셸 / 전환

- 푸시(전체화면) 화면(충전/결제/송금)은 `components/layout/PushScreen`(AppFrame + 슬라이드 + 뒤로 헤더) 재사용. 화면에서 헤더/뒤로 버튼 즉석 제작 금지.
- 탭 화면(홈/내역/내정보)은 자체 AppFrame 없이 콘텐츠만 — `TabLayout`이 프레임/탭바 제공.
- 애니메이션은 `animate-*` 유틸(`app.css` `@keyframes`). 신규 모션은 토큰 모션(`--ease-*`) 사용. `prefers-reduced-motion`에서 자동 무력화되므로 모션에 기능 의존 금지.

## 접근성

- 화면 제목은 `h1`. 아이콘 전용 버튼은 `aria-label` 필수. 토글은 `role="switch"` + `aria-checked`.
- 입력은 `Input`/`AmountInput` 프리미티브 사용(`useId`로 label↔input 연결됨). 라벨 없는 입력 금지.

## 에러 처리

- 백엔드 응답은 항상 `{errorCode, message, timestamp}`. **`errorCode`로 분기**(message 텍스트 의존 금지).
- `MISSING_IDEMPOTENCY_KEY`/`IDEMPOTENCY_KEY_CONFLICT`는 **프론트 버그** → 로깅, 일반 메시지, 사용자에게 원인 비노출.
- `errorCode → UI` 매핑은 `src/api/errors.ts` 한 곳.

## 폼 / 검증

- `react-hook-form` + `zod`. zod 스키마는 **서버 검증 규칙 미러**(email/password 정규식/pin `^\d{4}$`/name≤100).
- 검증 실패는 필드 단위 표시. 서버 `VALIDATION_FAILED`는 백업.

## 데이터 포맷

- 금액: `Intl.NumberFormat('ko-KR')` (KRW 정수 표시). 모델은 scale 4 number.
- 날짜: `date-fns`, ISO offset 그대로 파싱.
- `direction`: SELF(충전/결제) / SENT(이체 송금, balanceAfter 있음) / RECEIVED(이체 수신, **balanceAfter=null**).

## 코드 리뷰 체크리스트

- `[ADR-0013]` 하드코딩 hex / 임의 색·치수 리터럴 → 거절. `@theme` 토큰만.
- `[ADR-0013]` 컴포넌트에 불필요한 `dark:` 분기 → surface alias 토큰으로 대체.
- `[ADR-0014]` 토큰 localStorage 저장 → 거절. 인메모리.
- mutation `retry`가 4xx 재시도 → 거절(중복 결제 위험).
- `fetch` 직접 호출 / 컴포넌트에 서버 상태 `useState` → API 레이어 + Query로.
- `errorCode` 대신 message 문자열 매칭 → 거절.
- 프리미티브 두고 화면에서 버튼/입력 즉석 제작 → `components/ui`로 추출.
