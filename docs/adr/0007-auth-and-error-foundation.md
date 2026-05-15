# ADR-0007: 인증·에러 핸들링 기반 (BCrypt + GlobalExceptionHandler + 임시 SecurityConfig)

## Status
Accepted

(날짜: 2026-05-15)

## Context
Step 4 회원가입 API 진입 시 한꺼번에 결정해야 할 5가지 기반 항목:

1. **비밀번호/PIN 해싱 알고리즘** — BCrypt vs Argon2 vs scrypt vs PBKDF2.
2. **Service 레이어 분할** — `AuthService` 단일 클래스 vs `SignupService`/`LoginService` 분리.
3. **Spring Security 초기 설정** — 의존성에 `spring-boot-starter-security`가 들어 있어 부팅 즉시 모든 요청 401 차단. 가입 API 테스트조차 막힘.
4. **에러 응답 포맷** — 도메인 예외(`DuplicateEmailException`, `InsufficientBalanceException` 등)와 검증 실패(`MethodArgumentNotValidException`)를 어떻게 HTTP 응답으로 변환할지.
5. **Account 생성 시 통화 디폴트** — 가입 시 자동 개설되는 계좌의 통화.

각 항목은 단독 ADR로 분리하면 너무 작음. Step 4의 "공통 기반"으로 한 ADR에 묶는다. Step 5(JWT 본격 도입) 진입 시 SecurityConfig 부분은 분리 ADR로 승격할 수 있음.

관련 Step: 4 (회원가입), 5 (JWT/Security 본격), 6 (로그인 — 같은 패턴 재사용).

## Decision

### 1. 비밀번호/PIN 해싱: **BCrypt (strength=10)**
Spring Security 디폴트 `BCryptPasswordEncoder()` 사용. 강도는 디폴트 10라운드(=2^10).

### 2. Service 분할: **`AuthService` 단일 클래스**
`signup()` (Step 4) + `login()` (Step 6)을 한 클래스에 둔다.

### 3. SecurityConfig: **Step 4 임시 최소 설정**
- `csrf(disable)` — REST API라 CSRF 토큰 불필요
- `sessionManagement(STATELESS)` — Step 5 JWT 대비, 서버 세션 안 만듦
- `formLogin(disable)`, `httpBasic(disable)` — 기본 로그인 화면 제거
- `authorizeHttpRequests`: `/api/v1/auth/**`, `/swagger`, `/swagger-ui/**`, `/api-docs/**` `permitAll`, 나머지 `authenticated`

### 4. 에러 응답: **`{ errorCode, message, timestamp }` + `@RestControllerAdvice` 일괄**
- `ErrorResponse` record 한 형식으로 통일
- `GlobalExceptionHandler`에 도메인 예외/검증 실패/그 외를 핸들러로 매핑
- 도메인/서비스는 HTTP 코드 모름 — `RuntimeException` 던지기만 함
- **fallback 핸들러(`@ExceptionHandler(Exception.class)`)는 응답을 가공하더라도 stacktrace는 반드시 `log.error`로 남긴다** — 응답에는 안전한 정보만, 로그에는 운영자가 진단 가능한 전체 정보. (사후 보강, 2026-05-15 — `docs/swaggerTroubleShoot0515.md` 참고)

### 5. Account 통화: **`Currency.KRW` 고정**
가입 시 `Account.openFor(userId, Currency.KRW)`로 KRW 계좌 1개 자동 개설.

---

## Rationale

### 1. BCrypt 선택 이유
- **Spring Security 표준** — 별도 의존성 추가 없이 `BCryptPasswordEncoder` 즉시 사용 가능.
- **검증된 안전성** — 1999년 도입, 25년+ 실전 검증. salt 자동 처리, work factor 조정 가능.
- **Argon2 기각** — 2015년 PHC 우승작으로 더 강력하지만 Spring Security 통합이 추가 설정 필요(`Argon2PasswordEncoder` 별도 임포트). 학습 프로젝트라 표준 경로 우선.
- **scrypt 기각** — 메모리 하드라 GPU/ASIC 공격에 더 강하지만 strength 튜닝 어려움. 운영 부담↑.
- **PBKDF2 기각** — NIST 권장이지만 GPU 공격에 BCrypt보다 약함.

> 면접 답변용: "BCrypt는 work factor 조정으로 미래 하드웨어 발전에 대응 가능. strength=10은 1해시 ~100ms로 사용자 체감 무시 가능 + brute force 비용 충분. 더 강한 보안이 필요한 시점이 오면 strength=12로 올리거나 Argon2로 마이그레이션. 마이그레이션 전략은 사용자 다음 로그인 시 재해싱."

### 2. Service 단일 vs 분할
- **응집도 우선** — signup/login은 같은 도메인(인증). 분할하면 `UserRepository`, `PasswordEncoder` 의존성을 두 클래스에서 중복 선언.
- **클래스 폭발 방지** — Step 8에서 `PaymentService`/`TransferService`처럼 복잡한 로직이 들어올 때 분할이 의미 있음. 인증은 한 덩어리.
- **반례 신호** — `AuthService`가 메서드 7개 이상으로 커지거나 OAuth/2FA 같은 다른 인증 방식 추가 시 분할 검토.

### 3. 임시 SecurityConfig가 왜 필요한가
- Spring Security 의존성을 빼면 안 됨 — Step 5에서 어차피 다시 추가.
- 의존성을 둔 채로 SecurityConfig 안 만들면 Spring Boot **자동 설정**이 모든 요청을 401로 막아 가입 API 호출 자체 불가.
- "Step 4에서는 SecurityConfig 안 만들고 Step 5에서 한꺼번에"는 함정 — Step 4 검증 자체가 막힘.
- 그래서 **Step 4에서 최소한의 SecurityConfig를 박고, Step 5에서 JWT 필터를 끼워넣는 방식으로 점진적 확장**.

### 4. 에러 핸들링 패턴
- **도메인-HTTP 분리** — `AuthService.signup()`이 `ResponseEntity` 반환하면 도메인 로직이 HTTP를 알아야 함. 단위 테스트 어렵고, 다른 진입점(배치/메시지 큐)에서 재사용 불가.
- **명명 예외 클래스** — `throw new RuntimeException("이메일 중복")` 대신 `throw new DuplicateEmailException(email)`. 핸들러에서 타입으로 분기 가능, 의도가 코드에 박힘.
- **공용 에러 포맷** — 프론트엔드/모바일 앱이 `errorCode` 한 필드만 보면 분기 가능. `message`는 사용자 표시용, `timestamp`는 디버깅용.

### 5. KRW 고정
- ready.md 도메인 용어집에 "현재 `KRW`만"으로 박혀 있음.
- `Currency` enum은 확장만 열어두고, 신규 통화 도입 시 enum 확장 + 마이그레이션 + ADR 추가 룰(CLAUDE.md).
- 가입 화면에서 통화 선택 UI를 두지 않으므로 서버 디폴트가 곧 정책.

---

## Consequences

### 좋은 면
- **Step 4 코드의 모든 결정에 근거** — 면접 답변 시 "왜 BCrypt? 왜 한 클래스? 왜 임시 SecurityConfig?"에 한 ADR로 답 가능.
- **이후 모든 API의 표준 패턴** — `GlobalExceptionHandler`는 Step 5~9 모든 신규 예외(`InvalidCredentialsException`, `InsufficientBalanceException`, `AccountNotFoundException`, `InvalidTransferTargetException`)에 핸들러 1줄씩만 추가하면 됨.
- **점진적 확장 가능** — Step 5에서 SecurityConfig에 `JwtAuthenticationFilter` `addFilterBefore`만 추가, 나머지 룰 그대로 보존.

### 나쁜 면
- **Step 4 SecurityConfig가 어정쩡** — JWT 검증 안 하므로 `authenticated`로 막은 경로가 사실 모두 무조건 401. Step 5 진입 전까지 보호 효과 없음.
- **에러 메시지 노출 범위 미세 결정 보류** — `DuplicateEmailException` 메시지에 입력 이메일 포함됨. 클라이언트가 자기 입력값을 받는 거라 정보 누출 아님(보안 룰의 "계정 존재 여부 노출 금지"는 로그인에 적용). 하지만 향후 서드파티 통합 시 로그 전송 정책 재검토 필요.
- **PIN과 비밀번호를 같은 BCrypt로 해싱** — PIN은 4자리 숫자(=10000가지)라 BCrypt strength 10이어도 brute force 충분히 가능. 단, PIN은 가맹점 결제 추가 검증 용도라 1차 방어선이 비밀번호인 구조에서는 허용. Step 8 결제 시 PIN 정책 재검토 필요.

### 재검토 신호
- **strength=10 → 12 상향** — 서버 CPU 여유로워지면. 또는 보안 감사 지적 받으면.
- **AuthService 분할** — OAuth2/소셜 로그인 추가 시 `OAuthService` 분리. 메서드 7개 초과 시.
- **SecurityConfig 분리 ADR** — Step 5 JWT 필터 추가 시 SecurityConfig가 복잡해지면 SecurityConfig만 별도 ADR로 승격(`ADR-0008`).
- **에러 응답에 `traceId` 추가** — Step 11+ 모니터링 도입 시 분산 추적용 ID 필요해지면.
- **PIN 해싱 분리** — Argon2/별도 솔트 정책 도입 검토. 또는 PIN을 OTP 같은 다른 메커니즘으로 대체.

---

## References
- 코드:
  - `src/main/java/com/minipay/config/SecurityConfig.java` — 임시 Security 설정
  - `src/main/java/com/minipay/service/AuthService.java` — `signup()`
  - `src/main/java/com/minipay/exception/GlobalExceptionHandler.java` — 핸들러 4종
  - `src/main/java/com/minipay/exception/DuplicateEmailException.java`
  - `src/main/java/com/minipay/dto/ErrorResponse.java`
- 문서:
  - `docs/ready.md` §5 (API 명세 — 에러 코드 정의)
  - `CLAUDE.md` "보안" / "에러 핸들링" 섹션
  - `docs/adr/0003-static-factory-vs-builder.md` (정적 팩토리 룰 — `User.register`, `Account.openFor` 호출)
  - `docs/swaggerTroubleShoot0515.md` (fallback 로깅 부재로 진단 실패한 사례 — Decision §4 보강 근거)
- 외부:
  - [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
  - [Spring Security PasswordEncoder docs](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html)
