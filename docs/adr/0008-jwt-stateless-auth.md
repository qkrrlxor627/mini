# ADR-0008: JWT 기반 stateless 인증 (검증 시 DB 조회 없음)

## Status
Accepted

(날짜: 2026-05-15)

## Context
Step 4에서 회원가입 API를 만들었지만 인증은 비어있었고, `SecurityConfig`는 임시 버전(ADR-0007 §3)이었음. Step 5에서 본격 인증 인프라가 필요:
- 토큰 발급/검증 컴포넌트
- 매 요청 토큰을 받아 인증 컨텍스트를 채우는 필터
- 인증 실패 시 401 응답
- `SecurityConfig`를 본격 버전으로 확장

설계 결정이 한꺼번에 5개 등장 — 단독 ADR로 분리하기엔 작고, Step 4의 ADR-0007 "인증 기반"의 후속이라 한 ADR로 묶는다.

관련 Step: 5 (인프라), 6 (로그인 — 토큰 발급 호출), 7~9 (보호 API — `@AuthenticationPrincipal Long userId` 사용).

## Decision

### 1. 라이브러리·알고리즘: **jjwt 0.12.6 + HS256**
- `io.jsonwebtoken:jjwt-api/impl/jackson:0.12.6` — Step 1에서 미리 박은 의존성 그대로.
- HS256 대칭키. 단일 서비스라 충분(RS256은 키 페어 운영 부담).
- 시크릿 길이 ≥ 32바이트 강제 (`Keys.hmacShaKeyFor` 자동 검증).

### 2. Claim 구조: **`sub = userId`, `iat`, `exp`만**
- email/name 같은 변경 가능한 값 안 박음.
- 불변 식별자 `userId`(Long)만 `sub` claim에 String으로.
- 추가 claim(예: roles, tenantId)이 필요해질 때 ADR 별도 추가.

### 3. **Refresh token 도입 X**: 1시간 access만, 만료 시 재로그인
- OAuth2 표준은 access+refresh 쌍이지만 학습 범위 단순화.
- 단일 서버 + 웹 기반 → 1시간 만료 후 재로그인이 UX 허용 범위.

### 4. **검증 시 DB 조회 X**: `sub` claim만 신뢰
- `JwtAuthenticationFilter`가 `tokenProvider.parseUserId(token)` 결과를 그대로 principal로 박음.
- DB의 `users` 테이블 조회 없음 — stateless 보존 + 매 요청 DB 1회 회피.
- `UserDetailsService` / `UserDetails` 안 만듦. principal 타입은 `Long`.

### 5. **401 명시화**: `JwtAuthenticationEntryPoint`
- Spring Security 디폴트는 anonymous 인증 후 권한 부족 → 403 fallback.
- 우리는 "인증 자체 없음 = 401" / "리소스 부재 = 404" 의미 명확히.
- 응답 본문은 ADR-0007의 `ErrorResponse` 포맷 그대로 (`UNAUTHORIZED`, `인증이 필요합니다`).

---

## Rationale

### 1. jjwt 0.12.6 채택
- **Spring Security가 JWT 라이브러리 미포함** — 별도 선택 필요. jjwt는 Spring 생태계에서 가장 널리 쓰이고 builder API 자연스러움.
- **Auth0 java-jwt 대비**: jjwt가 Spring 통합 예시 압도적으로 많음(학습 비용↓).
- **Nimbus JOSE+JWT 대비**: Nimbus는 OAuth2 / JOSE 전체 스택 다루는 무거운 라이브러리. JWT만 쓰면 과함.
- **HS256 vs RS256**: 단일 서비스라 대칭키 충분. 마이크로서비스 / 외부 검증자 도입 시 RS256(공개키 검증) 재검토.

### 2. `sub`에 userId만 박는 이유
- **변경 가능한 값 차단** — email 변경 기능이 들어오는 순간 토큰 안 email과 DB email 불일치 가능. `userId`는 BIGSERIAL이라 영구 불변.
- **JWT 페이로드 크기 최소화** — 매 요청 헤더에 실려 다님. 작을수록 좋음.
- **컨트롤러 인자가 단순** — `@AuthenticationPrincipal Long userId`로 받아 그대로 service 호출.

### 3. Refresh token 미도입
- **학습 범위**: refresh token은 별도 저장소(DB/Redis) + 회전 정책 + 탈취 감지 + revoke API까지 따라옴.
- **단일 서버 + 1시간 만료**: 도메인 의도(`docs/ready.md`)와 부합. 사용자가 결제 한 번 하고 다음에 또 결제하러 올 때까지 1시간 이상 걸리면 재로그인이 자연스러움.
- **재검토 신호**: 모바일 앱 도입 / 사용자 정지·강제 로그아웃 정책 필요 / SLA가 "재로그인 빈도 ≤ 일 1회"로 박힐 때.

### 4. DB 조회 없는 stateless 검증
- **장점**: 매 요청 DB 1회 절약 — 인증 미들웨어가 가장 hot한 코드 경로.
- **단점**: 토큰 즉시 무효화 불가 — 사용자가 비번 바꿔도 그 토큰은 만료까지 살아있음.
- **트레이드오프 수용**: 학습 범위에서 보안 우선순위가 낮음. 운영에서 즉시 무효화 필요해지면 토큰 블랙리스트(Redis) 도입.
- **`UserDetails` 안 만든 이유**: 우리 도메인 모델 `User`는 풍부한 도메인 엔티티. Spring Security의 `UserDetails`로 wrapping하면 두 모델이 충돌. principal 타입을 `Long`으로 두면 도메인-인프라 경계 깔끔.

### 5. 401 명시화
- **`AuthenticationEntryPoint`의 의미**: Spring Security가 인증 부재 또는 실패 시 호출하는 진입점.
- **401 vs 403**: HTTP 스펙상 401은 "credential 없음/잘못됨", 403은 "인증은 됐지만 권한 없음". 우리는 ROLE 없으니 403은 의미 없음.
- **`@RestControllerAdvice`가 못 잡는 영역**: 필터 단계 예외는 DispatcherServlet 진입 전 → 어드바이스 범위 밖. 그래서 EntryPoint가 별도 필요.

---

## Consequences

### 좋은 면
- **Step 6~9 컨트롤러가 단순** — `@AuthenticationPrincipal Long userId`로 한 줄에 사용자 ID 확보.
- **stateless 일관성** — `SessionCreationPolicy.STATELESS` + DB 조회 없음 + 토큰만 신뢰 → 매 요청 독립.
- **에러 응답 통일** — ADR-0007의 `ErrorResponse` 포맷을 EntryPoint도 그대로 사용 → 클라이언트 핸들링 한 형식.
- **ADR-0007의 재검토 신호 1건 회수** — "임시 SecurityConfig 본격화"가 이 ADR로 달성. ADR-0007이 살아있는 결정의 기록이 됨.

### 나쁜 면
- **토큰 즉시 무효화 불가** — 비번 변경 / 사용자 정지 직후에도 기존 토큰 만료까지 유효. 학습 프로젝트라 허용.
- **시크릿 운영 부담** — `${JWT_SECRET}` 환경변수가 외부에 노출되면 모든 토큰 위조 가능. `.env` 파일 + `.gitignore` 박혀있어 학습 환경 OK.
- **JWT 크기** — `sub`만 박아도 base64 인코딩으로 200바이트 내외. HTTPS 헤더에 매 요청 실려 다님. 학습 범위 무시.

### 재검토 신호
- **토큰 블랙리스트 도입** — 사용자 정지 / 토큰 탈취 신고 기능 필요 시. Redis 키 `revoked:<jti>` 패턴.
- **Refresh token 도입** — 모바일 앱 / "재로그인 잦음" UX 컴플레인 / 사용자 분석 도구가 세션 유지 시간 요구.
- **RS256 마이그레이션** — 마이크로서비스 분리 / 외부 인증 검증자 도입 시. 공개키 검증으로 시크릿 공유 회피.
- **`UserDetails` 도입** — 권한(ROLE) 체계가 들어와서 `hasRole()` / `@PreAuthorize` 활용 필요해질 때.
- **AccessDeniedHandler** — 위 권한 도입에 따라 403 응답 명시 필요해지면.

---

## References
- 코드:
  - `src/main/java/com/minipay/security/JwtTokenProvider.java` — `issue(Long)`, `parseUserId(String)`
  - `src/main/java/com/minipay/security/JwtAuthenticationFilter.java` — `OncePerRequestFilter`, catch 후 EntryPoint 위임
  - `src/main/java/com/minipay/security/JwtAuthenticationEntryPoint.java` — 401 + `ErrorResponse` JSON
  - `src/main/java/com/minipay/config/SecurityConfig.java` — 필터 등록 + `exceptionHandling`
  - `src/test/java/com/minipay/security/JwtTokenProviderTest.java` — round-trip + 만료 케이스
- 설정:
  - `src/main/resources/application.yml` (`jwt.secret`, `jwt.expiration-ms`)
  - `build.gradle` (jjwt 0.12.6 의존성 3종)
- 문서:
  - `docs/adr/0007-auth-and-error-foundation.md` — 임시 SecurityConfig 결정 / 재검토 신호 / fallback 로깅
  - `docs/ready.md` §5 (API 명세 — `Authorization: Bearer <jwt>` 명시)
  - `CLAUDE.md` "보안" 섹션 (로그 JWT 출력 금지)
- 외부:
  - [jjwt 0.12.x migration guide](https://github.com/jwtk/jjwt#install)
  - [Spring Security 6: How-to JWT](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html)
  - [RFC 7519 — JSON Web Token](https://datatracker.ietf.org/doc/html/rfc7519)
