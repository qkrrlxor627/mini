# Mini Pay 프론트엔드(React PWA) 진행 상황

> **마지막 업데이트**: 2026-05-26
> **플랜**: `C:\Users\SSAFY\.claude\plans\docs-minipayprototype-html-graceful-globe.md`
> **디자인 토큰 소스**: `docs/MiniPayPrototype.html` (프로토타입)
> **백엔드 API**: `docs/api.md` (7종) / 인수인계: `docs/afterpjtForFe.md`
> **컨벤션**: `frontend/CLAUDE.md`
> **ADR**: `docs/adr/` (백엔드와 단일 시퀀스 공유 — 프론트는 0013+)

---

## 🎯 현재 위치

**🎉 프론트엔드 완료 — M0~M7 전부 통과.** 마지막 세션에서 M6(PWA 하드닝) + M7(폴리시)를 끝냄. PWA: 매니페스트 + 192/512/maskable 아이콘(sharp로 SVG→PNG) + Workbox(앱셸 프리캐시 / SPA fallback / **`/api/v1` NetworkOnly** — ADR 0015) + 설치 프롬프트. 폴리시: 푸시 화면 공통 `PushScreen`(슬라이드 전환) + `prefers-reduced-motion` + 헤딩 시맨틱(`h1`) + ProfileScreen(계정 요약·다크모드 토글·로그아웃)으로 5번째 탭 완성. build 973모듈 / 테스트 15 / 전 라우트·PWA 리소스 서빙 200.

> **마일스톤 전부 완료. 남은 건 선택: 시각 QA(다크모드·슬라이드·설치 프롬프트 실기기), 커밋.**

### 확정 결정 (플랜에서)
- 범위: **기반부터 단계적** (M0~M3 우선, M4~M7 후속)
- 언어: **TypeScript**
- 스타일링: **Tailwind CSS v4** (`@theme` = 단일 진실 소스 → CSS 변수 + 유틸리티 동시 생성) → ADR 0013
- JWT 저장: **인메모리 기본** (localStorage 금지) → ADR 0014
- PWA 캐싱: **앱셸 프리캐시 + 인증 GET NetworkOnly** (돈 데이터 fresh) → ADR 0015 (작성 완료)
- 백엔드 갭: **`GET /accounts/me` 추가 완료** (2026-05-26, ADR 불요 — 새 결정 0개)

---

## 🗂 로드맵 (마일스톤)

- [x] **Part A — 백엔드 `GET /accounts/me`** ✅ (2026-05-26)
  - `AccountMeResponse` record + `AccountService.getMe`(readOnly) + `AccountController` GET `/me`
  - curl 검증: 토큰 O → 200 `{accountId,balance,currency}` / 충전 후 잔액 반영 / 토큰 X → 401
  - 문서: `api.md` §7 + `afterpjtForFe.md` §7-1 "구현됨"으로 갱신
- [x] **M0 — 스캐폴드 + 디자인 토큰 시스템** ✅ (2026-05-26)
  - Vite+React19+TS, Tailwind v4 + `@tailwindcss/vite` (PostCSS 불요)
  - `src/styles/app.css` — 프로토타입 `:root` 토큰 전체 `@theme` 포팅(brand/ink/시맨틱/surface alias/타이포 스케일/radius/shadow/motion) + `.dark` 오버라이드 + `@custom-variant dark`
  - 폰트 self-host: PretendardVariable.woff2(2MB) + IBM Plex Mono 400/600 → `public/fonts/` + `@font-face` + index.html preload
  - `store/theme.ts`(zustand) 다크모드 토글 + `AppFrame`(고정 ~402px 모바일 프레임)
  - 검증: `npm run build` 성공(34모듈, CSS 12KB) / 토큰→유틸리티 생성 확인(`.bg-bg-elevated`/`.text-num-lg`/`.shadow-brand`/`.rounded-4`) / `.dark` 오버라이드 빌드 포함 / dev 서버 5173 → 200 + 폰트 서빙 200
  - **함정 + 해결**: ① `tsconfig.node.json` 프로젝트 레퍼런스에 `composite:true` 필요 + `noEmit`/`allowImportingTsExtensions` 제거 ② `@types/node` 설치(vite.config의 `node:path`/`__dirname`) ③ jsdelivr `gh` 경로 404 → `npm/pretendard@1.3.9` 경로로 정정
- [x] **M1 — UI 프리미티브** ✅ (2026-05-26)
  - `components/ui` 15종: AppFrame/Button/Card/Input/AmountInput/AmountText/Badge/Avatar/Divider/ListRow/TransactionRow/Sheet/TabBar/SegmentControl/PinKeypad + `components/icons.tsx`(인라인 SVG 10종)
  - 공용: `lib/cn.ts`, `lib/types.ts`(거래 도메인 타입), `lib/format.ts`(formatKRW/won/formatDateTime/amountSign)
  - `dev/Gallery.tsx` — 전 프리미티브 시각 검증(샘플 거래 4종, 시트/핀패드/세그먼트 인터랙션). App이 현재 Gallery 렌더(M2에서 라우터 /dev로 이동)
  - app.css에 sheetUp/overlayIn/enterRight 키프레임 + animate-* 유틸 추가
  - 검증: `npm run build` 성공(879모듈, CSS 19KB) / dev 서버 root·App·Gallery 변환 200 / HMR 정상
  - **조정**: Vitest 스냅샷은 M2의 멱등성 유닛테스트(Vitest+msw)와 함께 셋업하기로 연기 — 한 번에 테스트 인프라 구성
- [x] **M2 — API 레이어 + 인증** ✅ (2026-05-26)
  - `api/client.ts`(타입드 fetch, Bearer 부착, 401 `UNAUTHORIZED`만 단일 로그아웃·`INVALID_CREDENTIALS`는 폼 처리), `errors.ts`(ApiError + errorCode→UI 맵, 멱등 버그 코드 로깅), `idempotency.ts`, `queryClient.ts`(4xx 무재시도 + staleTime 0)
  - `api/auth.ts`(useLogin/useSignup), `api/account.ts`(useAccountMe/useTransactions)
  - `store/auth.ts`(인메모리 zustand, JWT sub 디코드) + `lib/jwt.ts` + `lib/validation.ts`(zod 서버 규칙 미러)
  - 화면: `LoginScreen`/`SignupScreen`(RHF+zodResolver, DUPLICATE_EMAIL→필드, INVALID_CREDENTIALS→폼) + `HomeScreen`(M2 최소: 잔액+로그아웃) + `ProtectedRoute`
  - 라우터(BrowserRouter): `/login` `/signup` `/dev`(갤러리) + 보호 `/`. `main.tsx`에 QueryClientProvider.
  - **Vitest 셋업**(M1에서 연기분 포함): `vitest.config.ts` 분리(vitest 번들 vite 타입 충돌 회피) + jsdom. 테스트 10종 통과(validation 6 + format 2 + Button 스냅샷 2).
  - **ADR 0014** 작성(JWT 인메모리). 
  - 검증: build 963모듈 / 테스트 10 통과 / **라이브 백엔드 골든패스**(signup 201→login 토큰→/accounts/me 200) + **CORS preflight** 200(Allow-Origin :5173) + SPA 라우팅(/login·/dev 200) + 잘못된 비번 401 INVALID_CREDENTIALS(폼 처리)
  - **트러블슈팅**: `defineConfig`를 'vitest/config'에서 import하니 vitest 번들 vite와 top-level vite@6의 Plugin 타입 충돌 → 테스트 설정을 `vitest.config.ts`로 분리(vite 플러그인 미import)해 해결.
  - **멱등 키 노트**: charge/payment/transfer mutation은 M4에서 키를 **변수에 담아** 생성(재시도 시 같은 키 replay). msw 멱등성 테스트도 M4와 함께.
- [x] **M3 — 대시보드(홈)** ✅ (2026-05-26)
  - `components/layout/TabLayout.tsx` — 공유 AppFrame + Outlet(스크롤) + 하단 TabBar(5탭, useLocation으로 active 분기, 탭 클릭 시 navigate)
  - `HomeScreen` 확장(콘텐츠 전용, AppFrame은 TabLayout이 제공): 잔액 카드(useAccountMe) + 퀵액션 3종(충전/결제/송금 → navigate) + 최근 거래 5건(useTransactions(5) → TransactionRow + 로딩/빈/에러 상태) + 로그아웃
  - 앱 셸 완성: `/`(홈)·`/history`·`/profile`은 TabLayout 하위, `/charge`·`/pay`·`/transfer`는 푸시 플레이스홀더(`PushPlaceholder`, M4 대체). history/profile은 `ComingSoon`(M5/M7).
  - 검증: build 966모듈 / 테스트 10 / 라이브 백엔드 `/accounts/me` 200 + `/transactions?size=5` shape 정합(transactionId/type/direction/amount/balanceAfter/currency/merchantId/counterpartyAccountId/status/createdAt 전부 일치) + PAYMENT(SELF 음수)·CHARGE(양수) 최신순 렌더 확인
  - **노트**: 셸 curl로 한글 merchantId 전송 시 cp949 인코딩으로 결제 실패하는 함정 재확인(백엔드 progress 기록과 동일) — 프론트는 fetch UTF-8이라 무관. 검증은 ASCII 가맹점명으로 진행.
- [x] **M4 — 머니 플로우** ✅ (2026-05-26)
  - `api/money.ts` — useCharge/usePayment/useTransfer. 멱등키를 **mutation 변수**에 담아 retry 시 같은 키 재전송(replay 안전). 성공 시 `['accountMe']`+`['transactions']` 무효화.
  - `features/money/`: ChargeScreen/PaymentScreen/TransferScreen(푸시 화면, 자체 AppFrame+뒤로) + 공용 `ResultSheet`(성공 바텀시트). 키는 화면당 `useState(()=>newIdempotencyKey())` 1회.
  - 사전 체크(UX): 결제·송금 잔액 초과, 송금 자기 자신(accountId 비교) → 버튼 비활성 + 인라인 에러. 서버가 비관적 락으로 최종 검증.
  - `queryClient.retryPolicy` export(테스트 공유). 라우터의 charge/pay/transfer 플레이스홀더를 실제 화면으로 교체.
  - **테스트** — msw 3종: Idempotency-Key 헤더 전송 / 4xx(잔액부족) 무재시도(1회) / 5xx 재시도 3회 모두 같은 키. 총 13 통과.
  - 검증: build 971모듈 / 테스트 13 / **라이브 골든패스**(충전 100000→결제 4500(95500)→송금 30000→Bob(65500)→같은 키 replay 동일 txId·잔액 불변, 최종 65500 정확). 응답 shape(Charge/Payment/Transfer) 타입 일치.
  - **ADR 없음** — 멱등키 변수 패턴은 ADR-0010(이중 방어)+0014 적용, 새 결정 아님.
- [x] **M5 — 내역** ✅ (2026-05-26)
  - `api/account.ts` — `useInfiniteTransactions(size)`: `useInfiniteQuery`, `initialPageParam: 0`, `getNextPageParam: page+1 < totalPages ? page+1 : undefined`. queryKey `['transactions','infinite',{size}]` → 머니 mutation의 `invalidate(['transactions'])`에 함께 걸림.
  - `lib/format.ts` — `formatDateGroup(iso)`: 오늘/어제/`M월 d일 (EEE)`/(타 연도)`yyyy년 M월 d일`. 라벨이 하루를 유일 식별 → 라벨 기준 연속 그룹핑.
  - `features/history/HistoryScreen.tsx` — 탭 콘텐츠(자체 AppFrame 없음). 날짜 섹션마다 `Card`+`Divider`로 `TransactionRow` 묶음. IntersectionObserver 센티넬(rootMargin 160px, `hasNextPage && !isFetchingNextPage`일 때만 `fetchNextPage`). 상태: 초기 로딩 / 에러+다시시도 버튼 / 빈 / "더 불러오는 중…" / "모든 거래를 불러왔어요".
  - `App.tsx` — `/history` ComingSoon → `HistoryScreen`.
  - **테스트** — `api/transactions.test.tsx` msw 2종: page 0→1→2 순서 요청 + 마지막 hasNextPage=false + flat id `[1,21,41]` / 단일 페이지 추가 요청 없음. 총 15 통과.
  - 검증: build 972모듈 / 테스트 15 / **라이브**(25건 충전 → `page=0`: items=20·totalElements=25·totalPages=2 / `page=1`: items=5 / `page=2`: items=0 — getNextPageParam이 page=1에서 멈춰 빈 페이지 미요청) + 응답 shape 10필드 `TransactionItem` 정합.
  - **함정** — 테스트에서 `const URL = '...'`이 전역 `URL` 생성자를 가려 `new URL(request.url)`이 `TS2351 not constructable`. 상수명 `TX_URL`로 회피.
  - **ADR 없음** — ADR 0006(이체 단일행 양쪽 시점)·0002(enum)의 적용. 새 결정 0개.
- [x] **M6 — PWA 하드닝** ✅ (2026-05-26) → **ADR 0015**
  - `vite-plugin-pwa`(Workbox generateSW) — `registerType: autoUpdate`. manifest(name/short_name/theme #3b63f5/standalone/portrait/ko/icons).
  - 아이콘: `scripts/generate-icons.mjs`(sharp) — 브랜드 그라데이션 + 흰 종이비행기(폰트 비의존 SVG path) → `icon-192/512`·`maskable-512`·`apple-touch-icon(180)`·`favicon.svg`. `npm run gen:icons`.
  - Workbox: 앱셸 프리캐시(JS/CSS/HTML/woff2/png/svg, 폰트 2MB 위해 상한 3.5MiB) / `navigateFallback: index.html` + `denylist [/^\/api\//]` / **`registerRoute(/\/api\/v1\//, NetworkOnly, 'GET')`** — 잔액·거래 절대 캐시 금지(ADR 0015).
  - `components/PwaInstallPrompt.tsx` — `beforeinstallprompt` 가로채 하단 배너(설치/닫기). TabLayout에 마운트. `index.html`에 favicon/apple-touch/apple-mobile-web-app 메타.
  - 검증: build → `sw.js`/`manifest.webmanifest`/`registerSW.js` 생성(프리캐시 21개). sw.js에 NavigationRoute(denylist /api) + NetworkOnly(/api/v1, GET) 박힘 확인. preview 서빙 — manifest(content-type `application/manifest+json`)·sw·아이콘·SPA 라우트 전부 200.
  - **ADR 0015** 작성(앱셸 프리캐시 + 인증 GET NetworkOnly. StaleWhileRevalidate/NetworkFirst 기각 — stale 잔액 위험).
  - **버그 픽스**: 설치 배너 애니메이션 클래스 `animate-sheetUp`(미존재) → `animate-sheet-up`(실제 유틸명).
- [x] **M7 — 폴리시** ✅ (2026-05-26)
  - `components/layout/PushScreen.tsx` — 충전/결제/송금 공통 셸(AppFrame + `animate-enter-right` 슬라이드 + 뒤로 헤더 `h1`). 3화면이 중복 헤더 제거하고 채택. (enterRight는 0.32s 1회 → 이후 뜨는 ResultSheet `fixed`에 영향 없음.)
  - `prefers-reduced-motion: reduce` 미디어쿼리 — 모션 민감 사용자에 애니메이션/transition 무력화(a11y).
  - 헤딩 시맨틱: 홈/거래내역/내정보/푸시 제목 `span` → `h1`. (Input/AmountInput은 이미 `useId`+`htmlFor` 라벨 연결, TabBar는 `aria-current` 보유.)
  - `features/profile/ProfileScreen.tsx` — 5번째 탭 완성: 계정 요약(useAccountMe + JWT userId) + **다크모드 토글**(role=switch, theme 스토어, 토큰 기반 translate-x-5 노브) + 로그아웃. `/profile` ComingSoon 대체.
  - 죽은 파일 제거: `features/misc/{ComingSoon,PushPlaceholder}.tsx`(전부 실제 화면으로 대체됨).
  - 검증: build 973모듈 / 테스트 15 / 전 라우트(/·/history·/profile·/charge·/pay·/transfer·/login) + PWA 리소스 서빙 200.
  - **ADR 없음** — 슬라이드/모션/a11y/프로필은 기존 토큰·결정의 적용. 새 결정 0개.

---

## 🔁 진행 사이클 (백엔드와 동일)

1. 마일스톤 목표/주의점 짚기 → 새 결정 N개 식별 (N>0이면 ADR)
2. 코드 작성 + 빌드/타입체크
3. 검증 (dev/preview 서빙, CORS, 골든 패스, 필요 시 Vitest)
4. 마일스톤 종료 시: 이 progress.md 세션 요약 추가, 결정 생기면 ADR

---

## 💬 세션별 요약

### 2026-05-26 (이어서) — M6 + M7: PWA 하드닝 + 폴리시 (프론트 종결 🎉)

1. **"다 해줘"** — 남은 M6/M7 한 세션에 완주. M6는 새 결정 1개(ADR 0015), M7은 0개.
2. **M6 PWA** — `vite-plugin-pwa`(Workbox) + sharp로 아이콘 생성(브랜드 그라데이션 종이비행기, 폰트 비의존 SVG path). 앱셸 프리캐시 + SPA fallback(denylist /api) + **`/api/v1` GET NetworkOnly**(돈 데이터 stale 금지). 설치 프롬프트 배너(beforeinstallprompt). sw.js에 라우트 박힘 확인 + preview 서빙 200.
3. **ADR 0015** — 앱셸 프리캐시 + 인증 GET NetworkOnly. StaleWhileRevalidate/NetworkFirst는 stale 잔액 위험으로 기각. `staleTime:0`(CLAUDE.md)·ADR-0014(인증 응답 비캐시)와 일관.
4. **M7 폴리시** — `PushScreen` 공통 셸(슬라이드 전환 + 뒤로 헤더)로 충전/결제/송금 DRY. `prefers-reduced-motion`. 제목 `h1` 시맨틱. ProfileScreen(계정·다크모드 토글·로그아웃)으로 5탭 완성. 죽은 플레이스홀더 파일 제거.
5. **버그 1건** — 설치 배너에 `animate-sheetUp`(미존재 유틸) 썼다가 실제 명 `animate-sheet-up`으로 픽스.
6. **검증** — build 973모듈 / 테스트 15 / 전 라우트·PWA 리소스 서빙 200. 시각 QA(다크모드 스왑/슬라이드/설치 프롬프트)는 실기기·브라우저에서 사용자 확인 권장.
7. **남은 일(선택)** — 실기기 시각 QA, 프론트 단독 커밋. 백엔드+프론트 통합 프로젝트 종결.

### 2026-05-26 (이어서) — M5: 거래내역 무한 스크롤

1. **진입** — 새 결정 0개(ADR 0006/0002 적용). 바로 코드.
2. **무한 쿼리** — `useInfiniteTransactions`: 0-based, `getNextPageParam`은 `page+1 < totalPages`일 때만 다음 페이지 → 마지막에서 자동 정지(빈 페이지 미요청). queryKey가 `['transactions',...]`라 머니 mutation의 `invalidate(['transactions'])`에 함께 무효화.
3. **화면** — `/history` 탭. IntersectionObserver 센티넬(rootMargin 160px)로 바닥 근처 진입 시 선요청. 날짜 그룹핑(오늘/어제/날짜) + `TransactionRow` 재사용(direction/type + RECEIVED balanceAfter=null). 로딩/빈/에러(재시도)/끝 상태.
4. **테스트** — msw 2종으로 페이지 진행(0→1→2)·정지·flat 순서 검증. 15 통과.
5. **검증** — 라이브 25건 충전 → page0=20/page1=5/page2=빈, totalPages=2, shape 10필드 정합. 함정: 테스트의 `const URL`이 전역 URL 가림 → `TX_URL`로 회피.
6. **남은 일** — M6 PWA(manifest/SW 인증 GET NetworkOnly/설치 프롬프트, ADR 0015), M7 폴리시.

### 2026-05-26 (이어서) — M4: 머니 플로우 (충전/결제/송금)

1. **멱등 키 패턴** — 키를 mutation 변수에 담아(`useState(()=>newIdempotencyKey())` 화면당 1회) React Query 재시도가 같은 키 재전송 → 서버 replay. 4xx는 retryPolicy로 무재시도(중복 결제 방지).
2. **3화면** — Charge/Payment/Transfer(푸시, ResultSheet 성공). 사전 체크(잔액 초과/자기 이체)는 UX용, 서버가 비관적 락으로 최종 검증.
3. **테스트** — msw로 클라 멱등 계약 검증: 헤더 전송 / 4xx 무재시도 / 5xx 3회 동일 키. 13 통과.
4. **검증** — 라이브 골든패스(충전→결제→송금→replay) 잔액 정확(65500), 응답 shape 일치. build 971.
5. **남은 일** — M5 내역(useInfiniteQuery), M6 PWA, M7 폴리시.

### 2026-05-26 (이어서) — M3: 대시보드 + 앱 셸

1. **탭 셸** — `TabLayout`(AppFrame + Outlet + 하단 TabBar 5탭). 탭 화면은 자체 AppFrame 없이 콘텐츠만 반환, 레이아웃이 프레임/탭바 제공. 라우트 중첩: ProtectedRoute > TabLayout > (홈/내역/내정보), 그리고 charge/pay/transfer는 푸시(전체화면).
2. **홈 대시보드** — 잔액 카드(useAccountMe) + 퀵액션(충전/결제/송금) + 최근 거래 5건(useTransactions(5), TransactionRow, 로딩/빈/에러 상태) + 로그아웃.
3. **앱 셸 완성** — 미구현 화면은 ComingSoon(탭)·PushPlaceholder(푸시)로 연결해 전체 네비게이션 동작. M4/M5에서 실제 화면으로 대체.
4. **검증** — build 966 / 테스트 10 / 라이브 백엔드 데이터 shape 정합(결제 음수·충전 양수 최신순). 한글 merchantId 셸 curl 인코딩 함정 재확인(프론트 무관).
5. **남은 일** — M4 머니 플로우(멱등 키를 mutation 변수에 담아 replay 안전 + msw 테스트), M5 내역, M6 PWA, M7 폴리시.

### 2026-05-26 (이어서) — M2: API 레이어 + 인증

1. **API 레이어** — `client.ts`(env BASE + /api/v1, Bearer, `{errorCode,message,timestamp}` 파싱→ApiError, 401 UNAUTHORIZED만 단일 로그아웃). `errors.ts`(errorCode→UI 맵, MISSING/CONFLICT는 프론트 버그라 로깅+일반 메시지). `queryClient`(4xx 무재시도, 돈 staleTime 0). `idempotency`(crypto.randomUUID).
2. **인증** — 인메모리 zustand(ADR-0014), JWT sub 디코드. zod 스키마가 서버 검증 미러(password 정규식/pin 4자리/name≤100). Login/Signup(RHF+zodResolver, 서버 에러를 필드/폼에 매핑), ProtectedRoute, BrowserRouter(갤러리 /dev로 이동).
3. **테스트 인프라** — Vitest+jsdom 셋업(M1 연기분). vitest 번들 vite 타입 충돌은 `vitest.config.ts` 분리로 해결. 10종 통과.
4. **검증** — build 963모듈, 테스트 10, 라이브 백엔드 골든패스+CORS preflight+SPA 라우팅 전부 통과. 잘못된 비번 401 INVALID_CREDENTIALS는 폼이 처리(리다이렉트 안 함)로 확인.
5. **남은 일** — M3 대시보드(잔액+최근거래+퀵액션). 머니 플로우(M4)에서 멱등 키를 mutation 변수에 담아 replay 안전 보장 + msw 테스트.

### 2026-05-26 (이어서) — M1: UI 프리미티브 15종 + 갤러리

1. **프리미티브 15종** — 전부 `@theme` 토큰만 소비(하드코딩 hex 0). Button(primary/secondary/outline + loading), Card(info/balance 그라데이션), Input(forwardRef, RHF 대비), AmountInput(KRW 콤마 표시/raw 제출), AmountText(부호+pos/neg 색), Badge, Avatar(이니셜), Divider, ListRow, TransactionRow(direction/type 분기 + RECEIVED balanceAfter null 처리), Sheet(바텀시트 ESC/오버레이/스크롤락), TabBar, SegmentControl, PinKeypad(4자리).
2. **아이콘** — 인라인 SVG 10종(stroke=currentColor로 토큰 색 상속).
3. **공용 유틸** — cn(clsx 대체), types(거래 도메인), format(formatKRW/won/formatDateTime/amountSign).
4. **갤러리** — `dev/Gallery.tsx`로 전 프리미티브 + 인터랙션 시각 검증. App이 렌더.
5. **검증** — build 879모듈 성공, dev 200, HMR 정상. Vitest는 M2와 함께 셋업으로 연기.
6. **남은 일** — M2 API 레이어 + 로그인/회원가입 + ADR 0014.

### 2026-05-26 — Part A + M0: 백엔드 /accounts/me + 프론트 스캐폴드 & 디자인 토큰

1. **발단** — 프로토타입(`MiniPayPrototype.html`) 디자인으로 React PWA를 만들기로. 플랜 모드에서 Explore 2 + Plan 1 에이전트로 토큰/백엔드 계약/그린필드 확인. 사용자 선택: 기반부터 / TS / **Tailwind v4** / 백엔드 `/accounts/me` 추가.
2. **Part A** — `GET /accounts/me` 추가(읽기 전용, 기존 `findByUserId` 재사용). 새 결정 0개라 ADR/마이그레이션 불요. curl 3종 통과. api.md §7 + afterpjtForFe.md 갱신.
3. **M0** — `frontend/` 스캐폴드. 핵심: 프로토타입 `:root` 토큰을 Tailwind v4 `@theme`로 1:1 포팅 → CSS 변수 + 유틸리티 동시 생성, 다크모드는 surface alias만 `.dark`에서 스왑(컴포넌트는 토큰만 소비, 테마 분기 없음). 폰트 self-host. 빌드/서빙/다크 검증 통과.
4. **트러블슈팅 3종** — tsconfig 프로젝트 레퍼런스(composite) / @types/node / Pretendard CDN 경로. 모두 해결.
5. **문서화 체계 수립** — 사용자 요청대로 백엔드처럼 `docs/frontend/progress.md`(이 파일) + ADR(0013 작성, 0014/0015 예약) + `frontend/CLAUDE.md` 컨벤션. `.claude` 메모리에 워크플로우/프로젝트 기록.
6. **남은 일** — M1 프리미티브 진입.
