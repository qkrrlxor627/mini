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

## 📦 Step 8 — 결제 + 이체 API (3.5h, ⭐ 메인)

| 패키지 | 파일 | 내용 |
|---|---|---|
| `dto` | `PaymentRequest.java` / `PaymentResponse.java` | record + `from(Transaction)` |
| `dto` | `TransferRequest.java` / `TransferResponse.java` | record + `from(Transaction)` |
| `service` | `IdempotencyStore.java` | Redis SETNX 래퍼 — `find(key, type)`, `save(key, value, ttl)`. 결제·이체 공용. |
| `service` | `PaymentService.java` | `@Transactional pay()` — ① Redis 멱등키 검사 ② 비관적 락 ③ `account.deduct(money)` ④ `Transaction.payment` 저장 ⑤ Redis 캐시 |
| `service` | `TransferService.java` | `@Transactional transfer()` — ① 자기 자신 이체 거부 ② Redis 멱등키 검사 ③ **두 계정 `account_id` 오름차순 정렬 후 PESSIMISTIC_WRITE** ④ `sender.deduct` + `receiver.charge` ⑤ `Transaction.transfer` 저장 ⑥ Redis 캐시 |
| `controller` | `PaymentController.java` | `POST /api/payments` + `@RequestHeader("Idempotency-Key")` |
| `controller` | `TransferController.java` | `POST /api/transfers` + `@RequestHeader("Idempotency-Key")` |
| `config` | `RedisConfig.java` (필요 시) | `StringRedisTemplate`, `ObjectMapper` Bean |
| `domain` | `InvalidTransferTargetException.java` | 자기 자신 이체 / 통화 불일치 |

체크리스트 7종: 정상 결제 / 잔액 부족 / 같은 키 두 번 / 다른 키 두 번 / 정상 이체 / 자기 자신 이체 거부 / 두 결제 + 두 이체 동시 시 데드락 없음 확인.

---

## 📦 Step 9 — 거래내역 조회 API (1h)

| 패키지 | 파일 | 내용 |
|---|---|---|
| `repository` | `TransactionRepository` | `findByAccountIdOrCounterpartyAccountId(myAccountId, myAccountId, Pageable)` — 송금자/수신자 양쪽 시점 (ADR 0006). 부분 인덱스 `idx_transactions_counterparty_id_created_at` 활용. |
| `dto` | `TransactionResponse.java` | record + `from(Transaction)`. 이체 시 `direction` 필드(SENT/RECEIVED)를 호출자 시점에서 계산해 응답 |
| `service` | `TransactionQueryService.list()` | `@Transactional(readOnly = true)` |
| `controller` | `TransactionController.list` | `GET /api/transactions?page=&size=` |

---

## 📦 Step 10 — 동시성 통합 테스트 (2h, ⭐)

| 위치 | 파일 | 내용 |
|---|---|---|
| `src/test/.../service` | `PaymentConcurrencyTest.java` | `@SpringBootTest` (※ 메서드에 `@Transactional` 금지) |
| 〃 | (옵션) `setupUserWithBalance` 헬퍼 | |

테스트 3개:
1. 잔액 100,000 + 1,000원 결제 100건 동시 → 잔액 0, success=100, tx=100
2. 같은 멱등키 10번 동시 → 1건만 처리, 잔액 99,000
3. 계좌 A↔B 양방향 이체 동시 (각 100건) → 데드락 없이 모두 성공, 양쪽 잔액 보존. 락 순서 정렬 규칙 검증.

**락 빼고 한 번 깨뜨려보기 → 다시 복구**도 필수 (면접 답변 깊이용). 이체에서는 락 순서 정렬 제거 시 데드락 재현도 별도 시연.

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

- ~~ADR 0006~~ → ✅ 작성됨: 이체 모델링 (단일 행 + counterparty) — 2026-05-14
- **ADR 0007** — 비관적 락 선택(낙관적 락 비교) ← Step 8 핵심
- **ADR 0008** — 멱등성 Redis+DB 이중방어 ← Step 8 핵심
- **ADR 0009** — Refresh Token 미도입(스코프 컷) ← Step 5
- (선택) ADR 0010 — AFTER_COMMIT 이벤트 분리
- (선택) ADR 0011 — 이체 시 두 계정 락 순서 정렬(데드락 회피) — Step 8 구현 시 ADR 0006의 후속으로 분리할지 결정

---

## 📌 요약

엔티티 13곳 채운 뒤로 약 **30~40개 파일** 추가 + ADR 3~4장.
시간 합계는 가이드 기준 **약 14시간**, 우리는 Money/OffsetDateTime/ID참조 같은 우리 컨벤션 적용에 약간 더 걸릴 수 있음.
