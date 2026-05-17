# Mini Pay

> Spring Boot + JPA + PostgreSQL + Redis 기반 **결제 백엔드 학습 프로젝트**.
> 충전·결제·이체·거래내역 + 비관적 락 + 멱등성 + JWT 인증을 한 도메인에 모아 둔 면접 답변지용 포트폴리오.

---

## 🎯 현재 위치 (2026-05-15)

| Step | 상태 | 핵심 |
|---|---|---|
| 0 | ✅ | Docker (postgres 16 + redis 7) + Spring Boot 3.5.14 부팅 |
| 1 | ✅ | 의존성 (Spring Security / JPA / Validation / Flyway / jjwt 0.12.6 / springdoc 2.8.13) + application.yml |
| 2 | ✅ | Flyway V1 (3테이블) + sql.md |
| 3 | ✅ | 엔티티 7종 (User / Account / Transaction / Money / Currency / TransactionType / TransactionStatus) + 도메인 예외 + V2/V3 마이그레이션 (이체) |
| 4 | ✅ | 회원가입 API (`POST /api/v1/auth/signup`) — User+Account 같은 트랜잭션 |
| 5 | ✅ | Spring Security + JWT 필터 (JwtTokenProvider/Filter/EntryPoint + SecurityConfig 본격화) |
| 6 | ✅ | 로그인 API (`POST /api/v1/auth/login`) + 404 핸들러 추가 |
| 7 | ⬅️ 다음 | 잔액 충전 API — `@Lock(PESSIMISTIC_WRITE)` 첫 등장 |
| 8 | ⏳ | 결제 + 이체 API — 비관적 락 + 멱등성 (Redis SETNX + DB UNIQUE) |
| 9 | ⏳ | 거래내역 조회 (송금자/수신자 양쪽 시점) |
| 10 | ⏳ | 동시성 통합 테스트 (`@Transactional` 안 붙임 — 자동 롤백 회피) |
| 11 | ⏳ | Swagger 시나리오 12종 통과 = 종결 조건 |

---

## 🚀 빠른 시작

```powershell
# 1. 인프라
docker compose up -d   # postgres + redis

# 2. 빌드 + 부팅
.\gradlew build                                 # 단위 테스트 포함
.\gradlew bootRun --args='--server.port=8081'   # 8080은 다른 컨테이너 점유 가능, 8081 우회

# 3. Swagger UI
# 브라우저로 http://localhost:8081/swagger
```

> ⚠️ **JWT secret** — `application.yml`의 `${JWT_SECRET}` 디폴트는 학습용. 운영은 32바이트 이상 환경변수.

---

## 📡 완성된 API (Step 4~6)

| Method | Path | 설명 | 상태 |
|---|---|---|---|
| `POST` | `/api/v1/auth/signup` | 회원가입 — User + Account 동시 생성 | 201 / 409 DUPLICATE_EMAIL / 400 VALIDATION_FAILED |
| `POST` | `/api/v1/auth/login` | 로그인 — JWT 발급 (1시간) | 200 / 401 INVALID_CREDENTIALS (이메일·비번 통합) |
| (보호 모든 경로) | — | JWT 필터 + EntryPoint | 401 UNAUTHORIZED (없거나 잘못된 토큰) / 404 NOT_FOUND (매핑 없음) |

응답 포맷 통일:
```json
{ "errorCode": "...", "message": "...", "timestamp": "2026-05-15T..." }
```

---

## 📚 학습 자료 인덱스

| 파일 | 역할 |
|---|---|
| **[`CLAUDE.md`](CLAUDE.md)** | 프로젝트 컨벤션 + 코드 리뷰 체크리스트 (30 항목, ADR 트레이서형) |
| [`docs/progress.md`](docs/progress.md) | 시간순 진행 + 마지막 대화 요약 (한국어) |
| [`docs/ready.md`](docs/ready.md) | 도메인 용어집 + 유스케이스 + ERD + API 명세 + 시나리오 12종 |
| [`docs/uChoice.md`](docs/uChoice.md) | **표준 vs 우리 결정** 인덱스 + 면접 답변 Q1~Q5 |
| [`docs/uShould.md`](docs/uShould.md) | Step 4~11 산출물 매핑 (파일 단위) |
| [`docs/uLearn.md`](docs/uLearn.md) | 완성 시 보유할 학습 자산 인덱스 + 면접 질문 매핑 |
| [`docs/swaggerTroubleShoot0515.md`](docs/swaggerTroubleShoot0515.md) | Swagger 500 트러블슈팅 + 면접 Q1~Q5 |
| [`sql.md`](sql.md) | ERD Cloud용 MySQL DDL |

---

## 🧭 Architecture Decision Records (ADR)

> 표준에서 벗어난 결정만 ADR. 학습 비용 / 도메인 단순성 우선.

| # | 제목 | Step |
|---|---|---|
| [0001](docs/adr/0001-money-value-object.md) | Money Value Object 도입 (scale 4 / HALF_EVEN) | 3 |
| [0002](docs/adr/0002-enum-string-mapping.md) | Enum + `EnumType.STRING` 매핑 | 3 |
| [0003](docs/adr/0003-static-factory-vs-builder.md) | 정적 팩토리 메서드 vs Builder | 3 |
| [0004](docs/adr/0004-flyway-forward-only.md) | Flyway 단방향 마이그레이션 | 3 |
| [0005](docs/adr/0005-transaction-account-reference-by-id.md) | Transaction → Account를 ID로 참조 | 3 |
| [0006](docs/adr/0006-transfer-modeling.md) | 이체(TRANSFER)는 단일 행 + counterparty | 3 |
| [0007](docs/adr/0007-auth-and-error-foundation.md) | 인증·에러 핸들링 기반 (BCrypt + GlobalExceptionHandler + 임시 SecurityConfig) | 4 |
| [0008](docs/adr/0008-jwt-stateless-auth.md) | JWT 기반 stateless 인증 (검증 시 DB 조회 X) | 5 |

전체 인덱스: [`docs/adr/README.md`](docs/adr/README.md)

---

## 🏗 패키지 구조

```
src/main/java/com/minipay
├── domain        — 엔티티(User/Account/Transaction) + VO(Money) + Enum + 도메인 예외
├── repository    — JpaRepository 인터페이스 (UserRepository / AccountRepository)
├── service       — @Service @Transactional (AuthService)
├── controller    — @RestController (AuthController)
├── dto           — record (SignupRequest/Response, LoginRequest/Response, ErrorResponse)
├── security      — JwtTokenProvider / JwtAuthenticationFilter / JwtAuthenticationEntryPoint
├── config        — SecurityConfig
└── exception     — DuplicateEmailException / InvalidCredentialsException / GlobalExceptionHandler
```

```
src/main/resources/db/migration
├── V1__init.sql                  # users / accounts / transactions
├── V2__money_value_object.sql    # Money VO 컬럼 분할 (amount + currency)
└── V3__transfer.sql              # counterparty_account_id + CHECK 2종 + 부분 인덱스
```

---

## 🛠 핵심 컨벤션 (`CLAUDE.md`에서 핵심 발췌)

- **금액**: `Money` VO, scale 4 / HALF_EVEN. `BigDecimal` 직접 노출 금지.
- **시간**: `OffsetDateTime` + `TIMESTAMPTZ`. `LocalDateTime` 금지.
- **엔티티**: setter 금지. 정적 팩토리만. `@NoArgsConstructor(PROTECTED)`.
- **DTO**: Java `record` + jakarta.validation. Lombok `@Builder` 금지.
- **트랜잭션**: 서비스에 `@Transactional`. 트랜잭션 안 외부 I/O 금지.
- **동시성**: 잔액 변경은 `@Lock(PESSIMISTIC_WRITE)`. 이체는 `account_id` 오름차순 락.
- **멱등성**: Redis SETNX + DB UNIQUE 이중 방어, TTL 10분.
- **에러**: 명명 도메인 예외(`RuntimeException` 상속). HTTP 매핑은 `@RestControllerAdvice`.
- **보안**: BCrypt strength 10. 비번/PIN 평문 금지. 로그에 JWT/PIN/세션 출력 금지. 인증 실패는 `INVALID_CREDENTIALS` 통일 (계정 존재 노출 금지).

---

## 🧪 검증된 시나리오 (Step 6 기준)

`bootRun` 후 `curl`로:

1. **가입** → 201 + `{userId, email}` + DB `users` + `accounts` 1행씩
2. **중복 가입** → 409 `DUPLICATE_EMAIL`
3. **가입 검증 실패** → 400 `VALIDATION_FAILED` (한국어 메시지)
4. **로그인** → 200 + `{accessToken, expiresIn: 3600}`
5. **잘못된 비번** → 401 `INVALID_CREDENTIALS`
6. **없는 이메일** → 401 동일 응답 (계정 존재 노출 금지)
7. **토큰 없음 + 보호 경로** → 401 `UNAUTHORIZED`
8. **잘못된 토큰** → 401 동일
9. **유효 토큰 + 매핑 없는 경로** → 404 `NOT_FOUND`
10. **Swagger** `/api-docs` → 200 + OpenAPI 3.1.0 JSON

---

## 🎓 면접 활용

이 프로젝트는 학습뿐 아니라 **면접 답변지**로 설계됨.

- "표준 vs 본인 결정" 질문 → [`docs/uChoice.md`](docs/uChoice.md)
- "왜 이렇게 짰어요?" 질문 → 해당 ADR 펼치기 (Rationale / Consequences / 재검토 신호까지)
- "디버깅 어떻게 했어요?" 질문 → [`docs/swaggerTroubleShoot0515.md`](docs/swaggerTroubleShoot0515.md)
- "동시성/멱등성 어떻게 보장해요?" 질문 → Step 8 + ADR 0006 + Step 10 통합 테스트 (예정)

---

## 📜 라이선스 / 출처

학습용 프로젝트. 가이드 출처는 `docs/` 하위 자료 참조.
