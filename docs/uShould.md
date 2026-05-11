# 엔티티 이후 채워야 할 것 (Step 4~11)

> 가이드(`docs/mini-pay-guide.md`)와 우리 컨벤션(`CLAUDE.md`)을 비교해 **Step 4~11에서 직접 채워야 할 산출물**을 패키지·파일 단위로 정리.
> 시점: Step 3 엔티티 빈칸(`Transaction.java`) 채우고 머지 직후.

---

## 📦 Step 4 — 회원가입 API (1.5h)

| 패키지 | 파일 | 내용 |
|---|---|---|
| `repository` | `UserRepository.java` | `JpaRepository<User,Long>` + `existsByEmail`, `findByEmail` |
| `repository` | `AccountRepository.java` | 일단 기본 `JpaRepository` (Step 7에서 비관적 락 메서드 추가) |
| `dto` | `SignupRequest.java` | `record` + `@Email/@Size/@NotBlank/@Pattern` |
| `dto` | `SignupResponse.java` | `record(Long userId, String email)` + `from(User)` 정적 팩토리 |
| `service` | `AuthService.java` | `@Transactional signup()` — 중복 검사 → BCrypt → User+Account 같은 트랜잭션 |
| `controller` | `AuthController.java` | `POST /api/auth/signup` |
| `domain` | `DuplicateEmailException.java` | RuntimeException 상속 |
| `exception` | `GlobalExceptionHandler.java` | `@ControllerAdvice` — 도메인 예외 → HTTP 매핑 (409, 400 등) |
| `config` | (필요 시) `PasswordConfig.java` | `BCryptPasswordEncoder` Bean (Step 5에서 SecurityConfig에 합쳐도 됨) |

⚠️ 우리 컨벤션이라 가이드와 다른 점: `User.create` → **`User.register`** (이미 만들어놨음). PIN은 BCrypt로 별도 해싱.

---

## 📦 Step 5 — Spring Security + JWT 필터 (3h, ⚠️ 가장 막힘)

| 패키지 | 파일 | 내용 |
|---|---|---|
| `security` | `JwtTokenProvider.java` | `issue(userId)`, `parse(token)` — jjwt 0.12.6 API |
| `security` | `JwtAuthenticationFilter.java` | `OncePerRequestFilter` — 헤더에서 토큰 추출 → SecurityContext에 등록 |
| `security` | `SecurityConfig.java` | CSRF off, stateless, `/auth/**`·`/swagger`·`/api-docs/**` permit, 나머지 authenticated, 필터 등록 |
| `security` | (옵션) `JwtAuthenticationEntryPoint.java` | 401 응답 커스터마이즈 |

체크포인트: 인증 없이 `/api/accounts/me` → 401, 만료 토큰 → 401.

---

## 📦 Step 6 — 로그인 API (1h)

| 패키지 | 파일 | 내용 |
|---|---|---|
| `dto` | `LoginRequest.java` / `LoginResponse.java` | record |
| `service` | `AuthService.login` | 이메일 없음 / 비번 틀림 → **같은 예외**(`InvalidCredentialsException`) |
| `controller` | `AuthController.login` | `POST /api/auth/login` |
| `domain` | `InvalidCredentialsException.java` | RuntimeException 상속 |

---

## 📦 Step 7 — 잔액 충전 API (1h)

| 패키지 | 파일 | 내용 |
|---|---|---|
| `repository` | `AccountRepository.java` | `findByUserIdForUpdate` 추가 — `@Lock(PESSIMISTIC_WRITE)` + JPQL |
| `repository` | `TransactionRepository.java` | `JpaRepository<Transaction,Long>` |
| `dto` | `ChargeRequest.java` / `ChargeResponse.java` | record. amount 필드는 `BigDecimal` (Service에서 `Money.of`로 감쌈) |
| `service` | `AccountService.java` (또는 `ChargeService`) | `@Transactional charge()` — 락 → `account.charge(money)` → `Transaction.charge` 저장 |
| `controller` | `AccountController.java` | `POST /api/accounts/charge`, `GET /api/accounts/me` |
| `domain` | `AccountNotFoundException.java` | |

⚠️ 가이드는 `long amount`지만 우리는 **`Money` VO**로 받음. 통화는 `KRW` 디폴트.

---

## 📦 Step 8 — 결제 API (3h, ⭐ 메인)

| 패키지 | 파일 | 내용 |
|---|---|---|
| `dto` | `PaymentRequest.java` / `PaymentResponse.java` | record + `from(Transaction)` |
| `service` | `IdempotencyStore.java` | Redis SETNX 래퍼 — `find(key, type)`, `save(key, value, ttl)` |
| `service` | `PaymentService.java` | `@Transactional pay()` — ① Redis 멱등키 검사 ② 비관적 락 ③ `account.deduct(money)` ④ `Transaction.payment` 저장 ⑤ Redis 캐시 |
| `controller` | `PaymentController.java` | `POST /api/payments` + `@RequestHeader("Idempotency-Key")` |
| `config` | `RedisConfig.java` (필요 시) | `StringRedisTemplate`, `ObjectMapper` Bean |

체크리스트 4종(가이드 Step 8): 정상 결제 / 잔액 부족 / 같은 키 두 번 / 다른 키 두 번.

---

## 📦 Step 9 — 거래내역 조회 API (1h)

| 패키지 | 파일 | 내용 |
|---|---|---|
| `repository` | `TransactionRepository` | `findByAccountId(accountId, Pageable)` 또는 `findByAccount_UserId` |
| `dto` | `TransactionResponse.java` | record + `from(Transaction)` |
| `service` | `PaymentService.list()` | `@Transactional(readOnly = true)` |
| `controller` | `PaymentController.list` | `GET /api/payments?page=&size=` |

---

## 📦 Step 10 — 동시성 통합 테스트 (2h, ⭐)

| 위치 | 파일 | 내용 |
|---|---|---|
| `src/test/.../service` | `PaymentConcurrencyTest.java` | `@SpringBootTest` (※ 메서드에 `@Transactional` 금지) |
| 〃 | (옵션) `setupUserWithBalance` 헬퍼 | |

테스트 2개:
1. 잔액 100,000 + 1,000원 결제 100건 동시 → 잔액 0, success=100, tx=100
2. 같은 멱등키 10번 동시 → 1건만 처리, 잔액 99,000

**락 빼고 한 번 깨뜨려보기 → 다시 복구**도 필수 (면접 답변 깊이용).

---

## 📦 Step 11 — Swagger 시연 (30분)

코드 작성은 거의 없음. `application.yml`의 `springdoc.swagger-ui.path: /swagger` 확인 + E2E 시나리오 7단계 수동 검증.

---

## 📊 패키지 트리 (최종)

```
com.minipay
├── domain        ← 이미 거의 완성 (User, Account, Transaction, Money, Currency, *Type, *Status, 도메인예외)
├── repository    ← Step 4·7·9에서 추가
├── service       ← Step 4·6·7·8·9에서 추가
├── controller    ← Step 4·6·7·8·9에서 추가
├── dto           ← Step 4·6·7·8·9에서 추가 (record)
├── security      ← Step 5에서 한 번에 추가
├── config        ← 필요할 때 (Redis, Password 등)
└── exception     ← Step 4에서 ControllerAdvice 한 번 만들고 계속 누적
```

---

## 💭 추가로 채워야 할 "고민의 흔적"

각 Step의 `> _(직접 작성)_` 자리(가이드 13곳). 면접 답변지의 본체. ADR로 승격할 만한 것:

- **ADR 0006** — 비관적 락 선택(낙관적 락 비교) ← Step 8 핵심
- **ADR 0007** — 멱등성 Redis+DB 이중방어 ← Step 8 핵심
- **ADR 0008** — Refresh Token 미도입(스코프 컷) ← Step 5
- (선택) ADR 0009 — AFTER_COMMIT 이벤트 분리

---

## 📌 요약

엔티티 13곳 채운 뒤로 약 **30~40개 파일** 추가 + ADR 3~4장.
시간 합계는 가이드 기준 **약 14시간**, 우리는 Money/OffsetDateTime/ID참조 같은 우리 컨벤션 적용에 약간 더 걸릴 수 있음.
