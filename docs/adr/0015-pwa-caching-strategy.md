# ADR-0015: PWA 캐싱 — 앱셸 프리캐시 + 인증 GET NetworkOnly

## Status
Accepted

(날짜: 2026-05-26)

## Context
프론트(React PWA)에 Service Worker를 도입해 설치형 앱 경험(홈 화면 추가, 빠른 재방문, 오프라인 셸)을 제공한다. 단, 이 앱은 **돈을 다룬다** — 잔액·거래내역을 캐시했다가 **오래된(stale) 값을 보여주면 사용자가 잔액을 오인**할 수 있다(예: 송금 직후 줄어든 잔액 대신 캐시된 옛 잔액 노출).

Service Worker 캐싱 대상은 크게 둘:
- **앱셸**(정적 자산: JS/CSS/HTML/폰트/아이콘) — 거의 안 변하고, 빌드 해시로 버전 관리됨.
- **API 응답**(`/api/v1/*`, Bearer 인증, 잔액/거래/계정) — 사용자별·시점별로 달라지는 동적 데이터.

API 응답 캐싱 전략 선택지:
- (A) **NetworkOnly** — 항상 네트워크. 캐시 안 함.
- (B) StaleWhileRevalidate — 캐시 즉시 반환 후 백그라운드 갱신. 빠르지만 **첫 화면이 stale**.
- (C) NetworkFirst(fallback cache) — 네트워크 우선, 실패 시 캐시. 오프라인 시 옛 잔액 노출.

선행: ADR-0014(토큰 인메모리, "SW는 토큰/인증 응답을 캐시 안 함"), `frontend/CLAUDE.md`("잔액/거래내역 쿼리 `staleTime:0`"). 관련: 프론트 M6.

## Decision
**앱셸은 프리캐시(precache), 인증 API(`/api/v1/*`)는 NetworkOnly**로 한다. (`vite-plugin-pwa` + Workbox `generateSW`)

1. **앱셸 프리캐시** — 빌드 산출물(JS/CSS/HTML/woff2/png/svg)을 SW 설치 시 프리캐시. 해시 파일명 + `registerType: 'autoUpdate'`로 새 배포 시 자동 갱신.
2. **SPA 네비게이션 폴백** — `navigateFallback: 'index.html'`, 단 `navigateFallbackDenylist: [/^\/api\//]` (API는 폴백 대상 아님).
3. **인증 GET = NetworkOnly** — `registerRoute(/\/api\/v1\//, NetworkOnly, 'GET')`. 잔액/거래내역/계정은 **절대 캐시하지 않는다**. 오프라인이면 그냥 실패(에러 상태 UI가 받음).
4. **토큰/응답 비캐시** — ADR-0014와 정합. 어떤 인증 응답도 캐시 스토리지에 남지 않는다.

## Rationale
- **돈 데이터의 정확성 > 속도**: StaleWhileRevalidate(B)는 빠르지만 첫 페인트가 옛 잔액이라 핀테크에서 위험. 우리는 이미 React Query `staleTime:0`으로 "항상 fresh"를 약속했고, SW가 그걸 우회해 stale을 끼워넣으면 계약 위반. NetworkOnly가 이 약속과 일관.
- **앱셸만 캐시해도 체감 이득 충분**: 재방문 시 JS/CSS/폰트(2MB Pretendard 포함)를 네트워크 없이 즉시 로드 → 빠른 부팅. 동적 데이터는 어차피 매번 새로 받아야 정확하므로 캐시 이득이 없다.
- **오프라인 정책의 정직함**: 잔액을 오프라인에서 보여주는 것보다 "지금 연결 안 됨"이 정직하다. 옛 잔액으로 결제 시도 → 서버 거절이면 UX가 더 나쁨. 셸은 뜨되 데이터는 에러 상태로.
- **NetworkOnly 라우트의 의미**: API는 사실 cross-origin(`:8080`)이라 기본적으로 프리캐시 대상이 아니지만, **명시적 NetworkOnly 라우트로 "이건 의도적으로 캐시 안 함"을 코드에 박아** 누가 동일 출처 프록시를 붙여도 캐시되지 않게 한다.

## Consequences
### 좋은 면
- 재방문 부팅 빠름(앱셸 프리캐시), 홈 화면 설치 가능(매니페스트 + 192/512 + maskable 아이콘).
- 잔액/거래는 항상 서버 최신값 — stale 잔액 오인 위험 0. ADR-0014/`staleTime:0`과 일관.

### 나쁜 면
- **오프라인에서 데이터 화면은 동작 안 함**(셸만 뜨고 잔액/내역은 에러). 진짜 오프라인 지원이 목표였다면 부족 — 그러나 돈 앱에서 오프라인 잔액은 비목표.
- 프리캐시에 폰트 2MB 포함 → 첫 설치 시 캐시 용량·다운로드 큼(`maximumFileSizeToCacheInBytes` 상향 필요했음).

### 재검토 신호
- 거래내역처럼 "오래돼도 보이는 게 나은" 데이터가 늘면 → 해당 엔드포인트만 NetworkFirst/SWR로 선별 완화(잔액은 NetworkOnly 유지).
- 오프라인 조회 요구가 생기면 → IndexedDB에 마지막 동기화 시각과 함께 저장 + "N분 전 기준" 명시 UI(절대 "현재 잔액"으로 표기 금지).
- 백엔드가 refresh/쿠키 인증으로 가면(ADR-0008/0014 재검토) → SW의 인증 응답 처리 재점검.

## References
- 코드: `frontend/vite.config.ts`(`VitePWA` 설정 — manifest/workbox/runtimeCaching), `frontend/src/components/PwaInstallPrompt.tsx`(설치 프롬프트), `frontend/scripts/generate-icons.mjs`(아이콘 생성)
- 선행: `docs/adr/0014-frontend-jwt-storage.md`(토큰·인증 응답 비캐시), `docs/adr/0013-tailwind-v4-token-system.md`
- 컨벤션: `frontend/CLAUDE.md` "API 레이어"(돈 staleTime:0)
- 외부: Workbox `NetworkOnly` / `vite-plugin-pwa` generateSW
