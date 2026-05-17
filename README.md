# Mini Pay

> Spring Boot + JPA + PostgreSQL + Redis 기반 **결제 백엔드 학습 프로젝트**.
> 충전·결제·이체·거래내역 + 비관적 락 + 멱등성 + JWT 인증을 한 도메인에 모아 둔 면접 답변지용 포트폴리오.

---

## 🎯 현재 위치 (2026-05-18) — 🎉 프로젝트 종결

| Step | 상태 | 핵심 |
|---|---|---|
| 0 | ✅ | Docker (postgres 16 + redis 7) + Spring Boot 3.5.14 부팅 |
| 1 | ✅ | 의존성 (Spring Security / JPA / Validation / Flyway / jjwt 0.12.6 / springdoc 2.8.13) + application.yml |
| 2 | ✅ | Flyway V1 (3테이블) + sql.md |
| 3 | ✅ | 엔티티 7종 (User / Account / Transaction / Money / Currency / TransactionType / TransactionStatus) + 도메인 예외 + V2/V3 마이그레이션 (이체) |
| 4 | ✅ | 회원가입 API (`POST /api/v1/auth/signup`) — User+Account 같은 트랜잭션 |
| 5 | ✅ | Spring Security + JWT 필터 (JwtTokenProvider/Filter/EntryPoint + SecurityConfig 본격화) |
| 6 | ✅ | 로그인 API (`POST /api/v1/auth/login`) + 404 핸들러 |
| 7 | ✅ | 잔액 충전 API — `@Lock(PESSIMISTIC_WRITE)` 첫 등장 + `@AuthenticationPrincipal` 첫 실전 |
| 8 | ✅ | 결제 + 이체 API — 비관적 락 + 멱등성 (Redis SETNX + DB UNIQUE) + 두 계정 락 정렬 |
| 9 | ✅ | 거래내역 조회 — `direction` enum(SELF/SENT/RECEIVED) + `PageResponse<T>` |
| 10 | ✅ | 동시성 통합 테스트 3종 — ADR 0009/0010/0011 실증 + **JPA 1차 캐시 함정** 발견·해결 |
| 11 | ✅ | Swagger E2E 시나리오 12종 통과 (골든 6 + 엣지 6) + SwaggerConfig Bearer 인증 |

**프로젝트 통계**: ADR 11장 / 통합 테스트 3종 / E2E 시나리오 12/12 통과 / 검증된 함정 4종

---

## 🚀 빠른 시작

```powershell
# 1. 인프라
docker compose up -d   # postgres + redis

# 2. 빌드 + 부팅
.\gradlew build         # 단위 + 통합(ConcurrencyTest 3종) 포함, 약 20초
.\gradlew bootRun

# 3. Swagger UI
# 브라우저로 http://localhost:8080/swagger
# 우측 상단 Authorize 🔓 에 로그인 응답의 accessToken을 한 번 붙여넣으면
# 이후 protected API 호출 시 자동으로 Bearer 헤더 부착
```

> ⚠️ **JWT secret** — `application.yml`의 `${JWT_SECRET}` 디폴트는 학습용. 운영은 32바이트 이상 환경변수.

---

## 📡 완성된 API

| Method | Path | 설명 | 응답 코드 |
|---|---|---|---|
| `POST` | `/api/v1/auth/signup` | 회원가입 — User + Account 동시 생성 | 201 / 409 DUPLICATE_EMAIL / 400 VALIDATION_FAILED |
| `POST` | `/api/v1/auth/login` | 로그인 — JWT 발급 (1시간) | 200 / 401 INVALID_CREDENTIALS (이메일·비번 통합) |
| `POST` | `/api/v1/accounts/charge` | 잔액 충전 — 비관적 락 | 200 / 400 / 401 / 404 ACCOUNT_NOT_FOUND |
| `POST` | `/api/v1/payments` | 결제 — 멱등성 + 비관적 락. `Idempotency-Key` 헤더 필수 | 200 / 400 / 401 / 409 IDEMPOTENCY_KEY_CONFLICT / 400 MISSING_IDEMPOTENCY_KEY / 400 INSUFFICIENT_BALANCE |
| `POST` | `/api/v1/transfers` | 이체 — 두 계정 정렬 락 + 멱등성 | 200 / 400 INVALID_TRANSFER_TARGET / 400 INSUFFICIENT_BALANCE / 404 / 409 |
| `GET` | `/api/v1/transactions?page=&size=` | 거래내역 — 송금자/수신자 양쪽 시점 + `direction`(SELF/SENT/RECEIVED) | 200 / 400 / 401 |

응답 포맷 통일:
```json
{ "errorCode": "INSUFFICIENT_BALANCE", "message": "잔액이 부족합니다", "timestamp": "2026-05-18T..." }
```

---

## 📚 학습 자료 인덱스

| 파일 | 역할 |
|---|---|
| **[`CLAUDE.md`](CLAUDE.md)** | 프로젝트 컨벤션 + 코드 리뷰 체크리스트 (ADR 트레이서형, 30+ 항목) |
| [`docs/progress.md`](docs/progress.md) | 시간순 진행 + 마지막 대화 요약 (한국어) |
| [`docs/ready.md`](docs/ready.md) | 도메인 용어집 + 유스케이스 + ERD + API 명세 + 시나리오 12종 |
| [`docs/uChoice.md`](docs/uChoice.md) | **표준 vs 우리 결정** 인덱스 + 면접 답변 Q&A |
| [`docs/uShould.md`](docs/uShould.md) | Step 4~11 산출물 매핑 (파일 단위) |
| [`docs/uLearn.md`](docs/uLearn.md) | 완성 시 보유할 학습 자산 인덱스 + 면접 질문 매핑 |
| [`docs/swaggerTroubleShoot0515.md`](docs/swaggerTroubleShoot0515.md) | Swagger 500 트러블슈팅 (Step 4) |
| [`docs/swagger-e2e-0518.md`](docs/swagger-e2e-0518.md) | **Step 11 E2E 12종 검증 결과 + Swagger UI 가이드 + 면접 답변지 매핑** |
| [`sql.md`](sql.md) | ERD Cloud용 MySQL DDL |

### 🚀 Mini Pay 이후 (afterpjt 시리즈)

| 파일 | 역할 |
|---|---|
| [`docs/afterpjtForFe.md`](docs/afterpjtForFe.md) | **프론트엔드 인수인계 가이드** — Swagger / 인증 흐름 / 클라이언트 책임(Idempotency-Key) / 에러 카탈로그 12종 / 데이터 포맷 함정 / CORS / 화면 시나리오 매핑 |
| [`docs/afterpjtStandard.md`](docs/afterpjtStandard.md) | **다음 백엔드 프로젝트 표준 가이드** — Mini Pay 회고 + 업계 표준(12-Factor App / DDD / ADR / Accelerate / OWASP) 6-Phase 라이프사이클 |
| [`docs/afterpjtLearn.md`](docs/afterpjtLearn.md) | **Mini Pay 이후 심화 학습** — Mini Pay 코드 줄 단위 인용 + 12개 파트(자바 / JVM / IDE / 문서 사고 / Git / 코드 리뷰 / 자료구조 / DB / SOLID / 네트워크 / OWASP / 분산 시스템) |

---

## 🧭 Architecture Decision Records (ADR)

> 표준에서 벗어난 결정 또는 면접 답변지 깊이를 위한 결정을 ADR로 기록.

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
| [0009](docs/adr/0009-pessimistic-locking.md) | 잔액 변경은 비관적 락(PESSIMISTIC_WRITE) 디폴트 | 7~8 |
| [0010](docs/adr/0010-idempotency-dual-defense.md) | 멱등성 Redis SETNX(1차) + DB UNIQUE(최후 방어) 이중 방어 | 8 |
| [0011](docs/adr/0011-transfer-lock-ordering.md) | 이체 시 두 계좌 락은 `account_id` 오름차순 정렬 후 획득 | 8 |

전체 인덱스: [`docs/adr/README.md`](docs/adr/README.md)

---

## 🏗 패키지 구조

```
src/main/java/com/minipay
├── domain        — 엔티티(User/Account/Transaction) + VO(Money) + Enum(*Type/*Status/*Direction/Currency) + 도메인 예외
├── repository    — UserRepository / AccountRepository(락 메서드 3종 포함) / TransactionRepository
├── service       — AuthService / AccountService / PaymentService / TransferService / TransactionQueryService / IdempotencyStore
├── controller    — AuthController / AccountController / PaymentController / TransferController / TransactionController
├── dto           — record (SignupRequest/Response, LoginRequest/Response, ChargeRequest/Response, PaymentRequest/Response, TransferRequest/Response, TransactionResponse, PageResponse<T>, ErrorResponse)
├── security      — JwtTokenProvider / JwtAuthenticationFilter / JwtAuthenticationEntryPoint
├── config        — SecurityConfig / SwaggerConfig
└── exception     — DuplicateEmailException / InvalidCredentialsException / AccountNotFoundException(forUser/forAccount) / MissingIdempotencyKeyException / IdempotencyKeyConflictException / InvalidTransferTargetException / GlobalExceptionHandler

src/test/java/com/minipay
├── MinipayApplicationTests       — contextLoads
├── security/JwtTokenProviderTest — round-trip + 만료
└── service/ConcurrencyTest       — @SpringBootTest 통합 테스트 3종 (결제 100건 / 같은 키 10건 / A↔B 이체 200건)
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
- **동시성**: 잔액 변경은 `@Lock(PESSIMISTIC_WRITE)`. 이체는 `account_id` 오름차순 락. **JPA 1차 캐시 함정 주의** — 같은 트랜잭션 안 비락 조회 후 락 조회 시 캐시 hit으로 `SELECT FOR UPDATE` 미발동. ID projection 사용.
- **멱등성**: Redis SETNX + DB UNIQUE 이중 방어, TTL 10분. 응답 캐시 = DB 재조회(SSoT).
- **에러**: 명명 도메인 예외(`RuntimeException` 상속). HTTP 매핑은 `@RestControllerAdvice`.
- **보안**: BCrypt strength 10. 비번/PIN 평문 금지. 로그에 JWT/PIN/세션 출력 금지. 인증 실패는 `INVALID_CREDENTIALS` 통일 (계정 존재 노출 금지).
- **테스트**: 동시성·멱등성은 `@SpringBootTest` 통합 (실제 DB/Redis). 통합 테스트 메서드에 `@Transactional` 금지(롤백 자동화가 동시성 깸).

---

## 🧪 검증된 시나리오

### Swagger E2E 12종 (Step 11 — `docs/swagger-e2e-0518.md`)

**골든 패스 6**:
1. signup → 201
2. login → 200 + JWT
3. charge 10000 → 200 (잔액 10000)
4. payment 2000 → 200 (잔액 8000)
5. transfer 3000 → Bob → 200 (Alice 5000 / Bob +3000)
6. transactions → Alice 3건 (SENT+SELF+SELF) / Bob 1건 (RECEIVED, balanceAfter=null)

**엣지 6**:
7. payment 잔액 초과 → 400 `INSUFFICIENT_BALANCE`
8. payment 동일 Idempotency-Key 재전송 → 200 + **같은 transactionId** (replay)
9. transfer 자기 자신 → 400 `INVALID_TRANSFER_TARGET`
10. transfer 잔액 초과 → 400 `INSUFFICIENT_BALANCE`
11. payment JWT 누락 → 401 `UNAUTHORIZED`
12. signup 중복 이메일 → 409 `DUPLICATE_EMAIL`

### 동시성 통합 테스트 3종 (Step 10 — `ConcurrencyTest.java`)

| 시나리오 | 검증 ADR | 시간 |
|---|---|---|
| 결제 100건 동시 → 잔액 0, PAYMENT count=100 | **ADR 0009 비관적 락** | 1.23s |
| 같은 멱등키 10번 동시 → PAYMENT 1건, 모두 같은 txId | **ADR 0010 멱등성** | 1.31s |
| A↔B 양방향 이체 각 100건 동시 → 데드락 0, 잔액 합 2,000,000 보존 | **ADR 0011 락 정렬** | 2.49s |

---

## 🎓 면접 활용

이 프로젝트는 학습뿐 아니라 **면접 답변지**로 설계됨.

| 질문 유형 | 답변 출발점 |
|---|---|
| "프로젝트 한 줄 요약" | 결제·이체 학습 + 동시성/멱등성 깊이 + ADR 11장 + 통합 테스트 3종 + E2E 12종 |
| "가장 의미 있던 결정?" | ADR 0011 두 계정 락 정렬 (데드락 회피) + Step 10 JPA 1차 캐시 함정 |
| "가장 어려웠던 버그?" | TransferService 잔액 합 17,000 불일치 — 데드락도 예외도 없는데 일부 deduct 누락. JPA 1차 캐시가 `PESSIMISTIC_WRITE` 무력화. ID projection으로 해결 |
| "표준 vs 본인 결정?" | [`docs/uChoice.md`](docs/uChoice.md) |
| "왜 이렇게 짰어요?" | 해당 ADR 펼치기 (Rationale / Consequences / 재검토 신호까지) |
| "디버깅 어떻게?" | [`docs/swaggerTroubleShoot0515.md`](docs/swaggerTroubleShoot0515.md) + ConcurrencyTest 첫 실행 실패 분석 |
| "동시성/멱등성 어떻게 보장?" | ADR 0009/0010/0011 + Step 10 ConcurrencyTest 실증 |
| "API 명세는?" | Swagger UI(`/swagger`) + `docs/ready.md` + `docs/swagger-e2e-0518.md` |

---

## 📜 라이선스 / 출처

학습용 프로젝트. 가이드 출처는 `docs/` 하위 자료 참조.
