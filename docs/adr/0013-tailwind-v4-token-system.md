# ADR-0013: 프론트 디자인 토큰은 Tailwind v4 `@theme` 단일 진실 소스

## Status
Accepted

(날짜: 2026-05-26)

## Context
`docs/MiniPayPrototype.html` 프로토타입의 디자인을 살려 React PWA를 만든다. 사용자의 명시적 핵심 관심사는 **"디자인 일관성을 위한 세팅"** — 프로토타입의 디자인 토큰(색/타이포/간격/그림자/모션)을 코드의 단일 진실 소스로 만들어, 모든 컴포넌트가 하드코딩 없이 토큰만 소비하게 하는 것.

프로토타입은 Tailwind가 아니라 손코딩 CSS 변수(`:root` + `.dark`)로 토큰을 정의한다. 스타일링 방식 선택지로 (A) CSS 변수 + CSS Modules, (B) Tailwind CSS v4, (C) styled-components 등이 있었고, **사용자가 Tailwind v4를 선택**했다.

관련: 프론트 M0(스캐폴드 + 디자인 시스템).

## Decision
프로토타입의 `:root` 토큰을 **Tailwind v4 `@theme` 블록에 1:1 포팅**한다. 이 블록이 디자인의 단일 진실 소스다.

1. `src/styles/app.css`의 `@theme { --color-brand-500:#3b63f5; ... }` 한 곳에만 토큰 정의. Tailwind v4는 이 토큰으로 **CSS 변수(`var(--color-brand-500)`) + 유틸리티 클래스(`bg-brand-500`, `text-fg-muted`, `rounded-3`, `shadow-2`, `text-num-lg` 등)를 동시에 생성**한다.
2. **타이포 스케일**은 `--text-*` 네임스페이스 + `--text-*--line-height`/`--text-*--font-weight`로 정의 → `text-display-1`/`text-h1`/`text-num-lg` 한 유틸리티가 크기+행간+굵기를 묶어 적용.
3. **다크모드**는 클래스 기반(`@custom-variant dark (&:where(.dark,.dark *))`). brand/ink 원시 스케일은 고정하고, **surface alias(`--color-bg`/`--color-fg`/`--color-border` …)만 `.dark`에서 스왑**. 컴포넌트는 테마를 분기하지 않고 `bg-bg`/`text-fg` 토큰만 쓰면 전역 전환된다.
4. **폰트 self-host** — Pretendard Variable + IBM Plex Mono woff2를 `public/fonts/`에 직접 두고 `@font-face` 선언(`--font-sans`/`--font-mono` 토큰). CDN/인라인이 아니라 self-host (PWA 오프라인 앱셸이 폰트를 소유해야 함).
5. **하드코딩 금지** — 컴포넌트는 `@theme` 토큰/유틸리티만 소비. 임의 hex(`bg-[#fff]`)·임의 색상 리터럴 금지(리뷰 거절 사유, prettier-plugin-tailwindcss + 추후 eslint-plugin-tailwindcss).

## Rationale
- **단일 정의 사이트**: `@theme` 한 곳이 CSS 변수와 유틸리티를 모두 만들어내므로, 토큰 변경이 전 컴포넌트에 자동 전파. 별도 JS 토큰 맵을 손으로 동기화할 필요가 없다.
- **프로토타입 충실도**: 프로토타입 토큰 이름/값을 그대로 옮기므로 디자인이 1:1로 재현된다. (A안 CSS Modules도 충실했지만 사용자가 유틸리티 선호 → Tailwind v4.)
- **다크모드 단순화**: 토큰 스왑 방식이라 컴포넌트에 `dark:` 분기가 거의 없다. 표면 alias만 한 곳에서 바꾸면 끝 — 프로토타입의 `.dark` 메커니즘과 동일.
- **타이포 묶음**: v4의 `--text-*--line-height`/`--font-weight` 기능으로 "크기 따로 행간 따로 굵기 따로" 어긋남을 방지. 디자인 스케일이 코드에서 깨지지 않는다.
- **Tailwind v3 대비 v4 선택 이유**: `@theme` CSS-우선 설정(자바스크립트 `tailwind.config` 없이 CSS만으로 토큰 정의) + `@tailwindcss/vite` 플러그인(PostCSS 설정 불요)이 "CSS 변수 = 토큰" 모델과 가장 자연스럽게 맞는다.

## Consequences
### 좋은 면
- 토큰이 유일 소스 → 디자인 드리프트(하드코딩 색 산재) 원천 차단.
- 다크모드 무료에 가깝게 동작(토큰만 소비하면 자동).
- 빌드 검증으로 토큰→유틸리티 생성 확인 가능(`.bg-bg-elevated`/`.text-num-lg`/`.shadow-brand` 등 실제 생성됨).

### 나쁜 면
- 유틸리티 클래스가 마크업에 길게 붙음(Tailwind 일반 트레이드오프) → prettier 정렬 플러그인으로 완화.
- 간격(spacing) 토큰은 프로토타입 `--s-7..s-11`이 Tailwind 기본 스케일과 선형 일치하지 않아 매핑 인지 필요(`p-8`=32px 등). 별도 토큰 미도입.
- `@theme` 토큰 네임스페이스 규칙(`--color-*`/`--text-*`/`--radius-*`/`--shadow-*`/`--font-*`)을 따라야 유틸리티가 생성됨 — 임의 변수명은 유틸 생성 안 됨(의도된 제약).

### 재검토 신호
- 디자인 시스템이 멀티 브랜드/테마(라이트·다크 외)로 확장 → 토큰 레이어 분리(primitive vs semantic) 재설계.
- 런타임 테마 커스터마이징(사용자 지정 색) 요구 → CSS 변수 동적 주입 전략 추가.
- 컴포넌트 스타일 복잡도가 유틸리티로 감당 안 될 만큼 커지면 일부 CSS Modules 병용 검토.

## References
- 코드: `frontend/src/styles/app.css`(@theme 토큰), `frontend/src/styles/fonts.css`(@font-face), `frontend/src/store/theme.ts`(다크모드 토글), `frontend/src/components/ui/AppFrame.tsx`
- 디자인 소스: `docs/MiniPayPrototype.html`(`:root` 토큰 원본)
- 플랜: `C:\Users\SSAFY\.claude\plans\docs-minipayprototype-html-graceful-globe.md` (Part C)
- 외부: Tailwind CSS v4 `@theme` / `@custom-variant` 문서
