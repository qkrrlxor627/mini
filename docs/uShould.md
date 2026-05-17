# 엔티티 이후 채워야 할 것 (Step 4~11) — 종결 시점 정리

> 가이드(`docs/mini-pay-guide.md`)와 우리 컨벤션(`CLAUDE.md`)을 비교해 **Step 4~11에서 채워야 할 산출물**을 패키지·파일 단위로 정리.
> 시점: Step 3 엔티티 빈칸 채우고 머지 직후 (당시) → **현재는 Step 11 종결 완료**.
>
> 마지막 갱신: 2026-05-18

---

## 📦 Step 4 — 회원가입 API ✅ 완료 (2026-05-15)

| 패키지 | 파일 | 내용 | 상태 |
|---|---|---|---|
| `repository` | `UserRepository.java` | `existsByEmail`, `findByEmail` | ✅ |
| `repository` | `AccountRepository.java` | 기본 JpaRepository (Step 7에서 락 메서드 추가) | ✅ |
| `dto` | `SignupRequest.java` | record + 검증 4종 | ✅ |
| `dto` | `SignupResponse.java` | record(userId, email) + from(User) | ✅ |
| `dto` | `ErrorResponse.java` | record(errorCode, message, timestamp) + of() | ✅ |
| `service` | `AuthService.java` | @Transactional signup() — 중복 검사 → BCrypt → User+Account 같은 트랜잭션 | ✅ |
| `controller` | `AuthController.java` | POST /api/v1/auth/signup | ✅ |
| `exception` | `DuplicateEmailException.java` | RuntimeException 상속 | ✅ |
| `exception` | `GlobalExceptionHandler.java` | @RestControllerAdvice + fallback log.error | ✅ |
| `config` | `SecurityConfig.java` | 임시 (Step 5에서 본격화) | ✅ |

ADR 0007에 결정 5종 박힘. 검증: 정상 가입 / 중복 / 검증 실패 / 토큰 무관 4종 통과.

---

## 📦 Step 5 — Spring Security + JWT 필터 ✅ 완료 (2026-05-15)

| 패키지 | 파일 | 내용 | 상태 |
|---|---|---|---|
| `security` | `JwtTokenProvider.java` | issue(Long userId), parseUserId(String) — jjwt 0.12.6 | ✅ |
| `security` | `JwtAuthenticationFilter.java` | OncePerRequestFilter, catch 후 EntryPoint 위임 | ✅ |
| `security` | `JwtAuthenticationEntryPoint.java` | 401 + ErrorResponse JSON (ObjectMapper Bean 주입) | ✅ |
| `config` | `SecurityConfig.java` | 본격 확장 — addFilterBefore + exceptionHandling | ✅ |
| `test/security` | `JwtTokenProviderTest.java` | round-trip + ExpiredJwtException 2건 | ✅ |

체크포인트 통과: 인증 없이 보호 경로 → 401, 잘못된 토큰 → 401.
ADR 0008에 결정 5종 박힘.
**부수 발견**: Flyway V3 checksum mismatch → `.gitattributes` LF 강제로 해결.

---

## 📦 Step 6 — 로그인 API ✅ 완료 (2026-05-15)

| 패키지 | 파일 | 내용 | 상태 |
|---|---|---|---|
| `dto` | `LoginRequest.java` | record(email, password) + @Email @NotBlank | ✅ |
| `dto` | `LoginResponse.java` | record(accessToken, expiresIn) + of() | ✅ |
| `service` | `AuthService.login` | @Transactional(readOnly=true), 둘 다 같은 InvalidCredentialsException | ✅ |
| `controller` | `AuthController.login` | POST /api/v1/auth/login | ✅ |
| `exception` | `InvalidCredentialsException.java` | 이메일 없음/비번 틀림 통합 | ✅ |
| `exception` | `GlobalExceptionHandler` (수정) | InvalidCredentials 401 + NoResourceFoundException 404 추가 | ✅ |

ADR 새로 안 만듦 (0007/0008 룰 적용). **부수 발견**: fallback `log.error` 보강이 즉시 가치 발휘 — `NoResourceFoundException` 5분 진단.

---

## 📦 Step 7 — 잔액 충전 API ✅ 완료 (2026-05-17)

| 패키지 | 파일 | 내용 | 상태 |
|---|---|---|---|
| `repository` | `AccountRepository.findByUserIdForUpdate` | @Lock(PESSIMISTIC_WRITE) + JPQL **첫 등장** | ✅ |
| `repository` | `TransactionRepository.java` | JpaRepository<Transaction, Long> (Step 8/9에서 메서드 추가) | ✅ |
| `dto` | `ChargeRequest.java` / `ChargeResponse.java` | record. amount BigDecimal (서비스에서 Money.of) | ✅ |
| `service` | `AccountService.charge()` | @Transactional + 비관적 락 + account.charge(money) + Transaction.charge 기록 | ✅ |
| `controller` | `AccountController.java` | POST /api/v1/accounts/charge + `@AuthenticationPrincipal Long userId` **첫 실전** | ✅ |
| `exception` | `AccountNotFoundException.java` | 404 매핑 | ✅ |

⚠️ 가이드는 `long amount`지만 우리는 **`Money` VO**로 받음. 통화 `KRW` 디폴트.
검증 5종 통과: 정상 충전 / 잔액 누적 / 0원 / 토큰없음 / 잘못된 토큰.
**부수 발견**: PowerShell curl이 cp949로 보내는 함정 → fallback `log.error`(ADR-0007)가 5초 진단.

---

## 📦 Step 8 — 결제 + 이체 API ✅ 완료 (2026-05-17, ⭐ 메인)

### Step 8-A 결제

| 패키지 | 파일 | 내용 | 상태 |
|---|---|---|---|
| `dto` | `PaymentRequest.java` / `PaymentResponse.java` | record + from(Transaction) | ✅ |
| `service` | `IdempotencyStore.java` | Redis SETNX 래퍼 (`StringRedisTemplate.setIfAbsent`) + Duration TTL 10분 | ✅ |
| `service` | `PaymentService.java` | 비관적 락 → findByIdempotencyKey(replay or 409) → SETNX → deduct → saveAndFlush + DataIntegrityViolationException self-heal | ✅ |
| `controller` | `PaymentController.java` | POST /api/v1/payments + @RequestHeader("Idempotency-Key") | ✅ |
| `exception` | `MissingIdempotencyKeyException` / `IdempotencyKeyConflictException` | 400 / 409 | ✅ |

ADR 0009 비관적 락 + ADR 0010 멱등성 이중 방어 박힘.
검증 6종 통과: 정상 / replay 같은 키 / 다른 본문 409 / 키 누락 400 / 잔액 부족 / 신규 키.

### Step 8-B 이체

| 패키지 | 파일 | 내용 | 상태 |
|---|---|---|---|
| `repository` | `AccountRepository.findByIdForUpdate(Long)` | 수신자 락 진입점 | ✅ |
| `dto` | `TransferRequest.java` / `TransferResponse.java` | record + from(Transaction) | ✅ |
| `service` | `TransferService.java` | 자기 자신 검증 → 멱등 replay → Math.min/max로 정렬 락 → sender.deduct + receiver.charge + Transaction.transfer + self-heal | ✅ |
| `controller` | `TransferController.java` | POST /api/v1/transfers + @RequestHeader("Idempotency-Key") | ✅ |
| `exception` | `InvalidTransferTargetException.java` | 자기 자신 이체 거부 | ✅ |
| `exception` | `AccountNotFoundException` 의미 분리 | `forUser` / `forAccount` 정적 팩토리 | ✅ |

ADR 0011 두 계정 락 정렬 박힘.
검증 8종 통과: 정상 / replay / 다른 본문 409 / 자기 자신 400 / 잔액 부족 / 키 누락 / 수신자 부재 404 / 신규.

---

## 📦 Step 9 — 거래내역 조회 API ✅ 완료 (2026-05-17)

| 패키지 | 파일 | 내용 | 상태 |
|---|---|---|---|
| `domain` | `TransactionDirection.java` | enum SELF/SENT/RECEIVED | ✅ |
| `repository` | `TransactionRepository.findByAccountIdOrCounterpartyAccountIdOrderByCreatedAtDesc` | Spring Data 메서드 이름 + 부분 인덱스 활용 | ✅ |
| `dto` | `TransactionResponse.java` | record + from(tx, myAccountId). direction 자동 분기, 수신자 시점 balanceAfter=null | ✅ |
| `dto` | `PageResponse<T>.java` | record + of(Page, Function). Spring Page 직렬화 우회 | ✅ |
| `service` | `TransactionQueryService.list()` | @Transactional(readOnly=true) | ✅ |
| `controller` | `TransactionController.java` | GET /api/v1/transactions?page=&size= + page≥0 + size 1~100 검증 | ✅ |

새 ADR 없음 (ADR 0002 enum 선호 + ADR 0006 이체 트레이드오프 첫 실전).
검증 6종 통과: 송금자 3건 / 수신자 RECEIVED 2건 balanceAfter null / 페이지네이션 / page=99 빈 content / size=200 400 / 토큰없음 401.

---

## 📦 Step 10 — 동시성 통합 테스트 ✅ 완료 (2026-05-17, ⭐⭐⭐)

| 위치 | 파일 | 내용 | 상태 |
|---|---|---|---|
| `src/test/.../service` | `ConcurrencyTest.java` | @SpringBootTest (메서드에 @Transactional 금지) | ✅ |
| 〃 | 헬퍼 `setupUserWithBalance(BigDecimal)` | unique timestamp 이메일 + signup + charge | ✅ |

테스트 3개 통과:
1. **결제 100건 동시 (ADR 0009)** — 잔액 0, success=100, PAYMENT count=100 (1.23s)
2. **같은 멱등키 10번 동시 (ADR 0010)** — 1건만 처리, 잔액 99,000, 모두 같은 transactionId (1.31s)
3. **A↔B 양방향 이체 각 100건 동시 (ADR 0011)** — 데드락 없이 모두 성공, 잔액 합 2,000,000 보존 (2.49s)

**함정 발견·해결** ⭐⭐⭐: JPA 1차 캐시가 `PESSIMISTIC_WRITE`를 무력화. 비락 조회 후 락 조회 시 캐시 hit으로 `SELECT FOR UPDATE` 미발동 → 송금자 행 락 안 잡혀 race condition. 픽스: `AccountRepository.findIdByUserId` JPQL projection 추가, `TransferService`에서 송금자 ID만 추출. CLAUDE.md "동시성"에 함정 한 줄 추가.

→ 정적 분석으로 안 잡히는 종류 버그. 통합 테스트의 존재 가치를 직접 입증.

---

## 📦 Step 11 — Swagger E2E 시연 ✅ 완료 (2026-05-18)

| 위치 | 파일 | 내용 | 상태 |
|---|---|---|---|
| `config` | `SwaggerConfig.java` | OpenAPI Bean + SecurityScheme(HTTP/bearer/JWT) + SecurityRequirement 전역 | ✅ |
| `docs` | `swagger-e2e-0518.md` | 12종 결과표 + Swagger UI 수동 가이드 + 면접 답변지 매핑 | ✅ |

`application.yml`의 `springdoc.swagger-ui.path: /swagger` 그대로. Authorize 🔓 버튼에 토큰 한 번 입력으로 protected API 자동 부착.

curl 12/12 통과:
- 골든 6: signup → login → charge(10000) → payment(8000) → transfer(5000) → transactions (Alice 3건 / Bob RECEIVED 1건)
- 엣지 6: 잔액 초과 결제 / replay 같은 txId / 자기 자신 / 잔액 초과 이체 / JWT 누락 / 중복 이메일

새 ADR 없음 (UX 개선이라 ADR 사안 아님).

---

## 📊 패키지 트리 (최종, Step 11 종결 시점)

```
com.minipay
├── domain        ← User, Account, Transaction, Money, Currency, TransactionType, TransactionStatus, TransactionDirection, InsufficientBalanceException
├── repository    ← UserRepository, AccountRepository(락 3종 + findIdByUserId projection), TransactionRepository
├── service       ← AuthService, AccountService, PaymentService, TransferService, TransactionQueryService, IdempotencyStore
├── controller    ← AuthController, AccountController, PaymentController, TransferController, TransactionController
├── dto           ← Signup/Login/Charge/Payment/Transfer Request·Response, TransactionResponse, PageResponse<T>, ErrorResponse
├── security      ← JwtTokenProvider, JwtAuthenticationFilter, JwtAuthenticationEntryPoint
├── config        ← SecurityConfig, SwaggerConfig
└── exception     ← Duplicate/InvalidCredentials/AccountNotFound(forUser/forAccount)/MissingIdempotencyKey/IdempotencyKeyConflict/InvalidTransferTarget/GlobalExceptionHandler

src/test/java/com/minipay
├── MinipayApplicationTests       (contextLoads)
├── security/JwtTokenProviderTest (round-trip + 만료)
└── service/ConcurrencyTest       (동시성 통합 테스트 3종)
```

---

## 💭 작성된 ADR (11장)

작성 완료:
- ✅ 0001 Money VO / 0002 Enum STRING / 0003 정적 팩토리 / 0004 Flyway 단방향 / 0005 ID 참조
- ✅ 0006 이체 모델링 (단일 행 + counterparty)
- ✅ 0007 인증·에러 핸들링 기반 (BCrypt + GlobalExceptionHandler + 임시 SecurityConfig + fallback 로깅)
- ✅ 0008 JWT stateless 인증 (DB 조회 X + Refresh 미도입 + 401 명시화)
- ✅ 0009 비관적 락 선택 (낙관적 락 비교)
- ✅ 0010 멱등성 Redis SETNX + DB UNIQUE 이중 방어
- ✅ 0011 두 계좌 락 account_id 오름차순 정렬 (데드락 회피)

(미작성, 학습 확장 후보):
- 0012 후보 — AFTER_COMMIT 이벤트 분리 (트랜잭션 안 외부 I/O 금지 룰 구현)
- 0013 후보 — 토큰 블랙리스트 (ADR 0008 재검토 신호)
- 0014 후보 — 모니터링 스택 (Actuator + Prometheus + Grafana)

---

## 📌 요약 — 최종 통계

| 항목 | 수 |
|---|---|
| Step | 0~11 전부 ✅ |
| ADR | 11장 |
| 컨트롤러 | 5종 (Auth, Account, Payment, Transfer, Transaction) |
| 서비스 | 6종 (Auth, Account, Payment, Transfer, TransactionQuery, IdempotencyStore) |
| 도메인 예외 | 7종 (Duplicate, InvalidCredentials, AccountNotFound, InsufficientBalance, MissingIdempotencyKey, IdempotencyKeyConflict, InvalidTransferTarget) |
| 통합 테스트 | 3종 (ConcurrencyTest) |
| E2E 시나리오 | 12/12 통과 |
| 마이그레이션 | V1/V2/V3 |
| 발견한 함정 | 4종 (Flyway checksum / Swagger 500 / NoResourceFound / **JPA 1차 캐시 락 무력화** ⭐) |

가이드 기준 약 14시간 예상 → 우리 컨벤션 적용 + 함정 디버깅 포함해 실제로 더 걸렸지만, 면접 답변지로 활용 가능한 깊이 확보.
