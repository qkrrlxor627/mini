# Mini Pay — 동시성·락 파트 포트폴리오

> 결제 백엔드(Mini Pay)에서 **잔액 정합성**을 책임지는 동시성·락 파트만 발췌한 기술 포트폴리오.
> 모든 주장은 실제 소스(`파일:라인`) / 통합 테스트 / ADR을 근거로 한다. 재구성한 코드는 명시했다.

---

## 0. 범위 (Scope)

- **프로젝트**: Mini Pay — Spring Boot 기반 간편결제 백엔드 (충전·결제·이체·거래내역). 개인 학습 프로젝트, 백엔드 전체 1인 작성.
- **이 문서의 범위**: 돈을 움직이는 3개 쓰기 작업(충전·결제·이체)의 **동시성 제어와 락**. 인증/JWT/Swagger 등은 제외.
- **핵심 자산 4가지**: ① 비관적 락 직렬화 ② 멱등성 이중 방어 ③ 두 계좌 락 순서 정렬(데드락 회피) ④ JPA 1차 캐시가 락을 무력화한 함정 — 4가지 모두 **코드 + 통합 테스트 + ADR**로 입증.

---

## 1. 코드 파악 (근거)

### 1.1 핵심 클래스/함수와 역할

| 위치 | 역할 |
|---|---|
| `repository/AccountRepository.java:18-20` | `findByUserIdForUpdate` — `@Lock(PESSIMISTIC_WRITE)` + JPQL. 충전·결제의 단일 계좌 락(`SELECT … FOR UPDATE`) |
| `repository/AccountRepository.java:22-24` | `findByIdForUpdate` — 이체 수신자 락 진입점(account_id 기준) |
| `repository/AccountRepository.java:15-16` | `findIdByUserId` — ID만 뽑는 projection. **JPA 1차 캐시 함정 회피용** |
| `service/PaymentService.java:28-54` | 결제: 락 조회 → 멱등 replay 검증 → SETNX → `deduct` → `saveAndFlush` → 충돌 self-heal |
| `service/TransferService.java:29-73` | 이체: 송금자 ID 식별(비락) → 자기이체 거부 → 멱등 검증 → **min/max 정렬 후 두 락** → `deduct`/`charge` |
| `service/AccountService.java:36-61` | 충전: 락 조회 + 멱등성(ADR 0012로 확장) |
| `service/IdempotencyStore.java:36-45` | `tryAcquire` — Redis `SETNX(SET NX EX)` 1차 차단 + Redis 장애 시 `true` fallback |
| `domain/Account.java:61-67` | `deduct` — 잔액 부족 시 `InsufficientBalanceException`. Tell-Don't-Ask 도메인 메서드 |
| `test/.../ConcurrencyTest.java` | 동시성 3종 시나리오 (ExecutorService + CountDownLatch + 실제 DB/Redis) |

### 1.2 데이터 흐름 (입력 → 처리 → 출력)

**결제** (`POST /api/v1/payments`, `Idempotency-Key` 헤더 필수):
```
요청 → @Transactional 시작
   → findByUserIdForUpdate(userId)         // SELECT … FOR UPDATE : 같은 계좌 직렬화
   → findByIdempotencyKey(key)             // 이미 있으면 본문 비교 후 replay or 409
   → tryAcquirePayment(key)                // Redis SETNX 1차 차단
   → account.deduct(amount)                // 도메인 검증(잔액 부족 → 예외)
   → saveAndFlush(tx)                       // DB UNIQUE(idempotency_key) 최후 방어
       └ DataIntegrityViolationException → findByIdempotencyKey 재조회(self-heal)
   → 커밋(락 해제) → PaymentResponse
```

**이체** (`POST /api/v1/transfers`):
```
요청 → @Transactional 시작
   → findIdByUserId(userId)                 // 송금자 "ID만" (엔티티 영속화 X — 캐시 함정 회피)
   → senderId == receiverId 면 거부(자기이체)
   → 멱등 replay 검증 → tryAcquireTransfer(key)
   → firstId=min, secondId=max             // account_id 오름차순
   → findByIdForUpdate(firstId)             // 작은 ID 먼저 락
   → findByIdForUpdate(secondId)            // 큰 ID 다음 락  → circular wait 불가
   → sender.deduct / receiver.charge
   → saveAndFlush(Transaction.transfer(…))  // self-heal 동일
   → 커밋 → TransferResponse
```

### 1.3 까다로운 알고리즘 / 엣지 케이스

- **두 계좌 락 정렬**: `Math.min/max(senderId, receiverId)`로 락 순서를 방향과 분리. 락 획득 후 `first.getId() == senderId` 비교로 어느 쪽이 송금자인지 재판정해 `deduct/charge`를 올바른 객체에 분배 (`TransferService.java:48-60`).
- **멱등 replay vs 충돌**: 같은 키라도 본문(accountId·amount·merchantId)이 일치해야 200 replay, 불일치면 409 (`PaymentService.java:56-66`).
- **Redis-DB 사이 윈도우**: SETNX 성공 후 잔액 부족 등으로 INSERT가 안 되면 Redis엔 키만 남고 거래는 없음 → 이중 방어의 의도된 트레이드오프 (ADR-0010 §나쁜 면).
- **자기이체**: 서비스에서 락 진입 *전*에 거부 → Redis 키 누적 방지 + DB CHECK(`counterparty_not_self`)가 최후 방어 (`V3__transfer.sql:18-21`).

---

## 2. 담당 역할

> **간편결제 백엔드 Mini Pay의 동시성·정합성 설계 및 구현 (1인 개발)**

돈을 움직이는 충전·결제·이체 3개 API에서 **동시 요청에도 잔액이 어긋나지 않도록** 락 전략과 멱등성을 설계·구현하고, 통합 테스트로 실증했다.

- **① 비관적 락으로 잔액 정합성 보장** — `PESSIMISTIC_WRITE`(`SELECT … FOR UPDATE`)로 같은 계좌 동시 요청을 직렬화. 낙관적 락 대비 트레이드오프를 분석해 금융 도메인에 맞는 선택을 ADR로 기록.
- **② 멱등성 이중 방어 설계** — Redis SETNX(1차) + DB UNIQUE(최후 방어) 조합으로 더블클릭·재시도·Redis 장애를 모두 커버. 응답은 DB를 단일 출처(SSoT)로 재조회.
- **③ 데드락 원천 차단** — 이체 두 계좌 락을 `account_id` 오름차순으로 정렬(Coffman circular wait 제거).
- **④ 통합 테스트로 동시성 실증** — `ExecutorService` + `CountDownLatch`로 100~200건 동시 요청을 재현하고, 그 과정에서 **JPA 1차 캐시가 락을 무력화하는 함정**을 발견·수정.

### 기술 스택 (실제 의존성/임포트에서 확인된 것만)

- **언어/프레임워크**: Java 17, Spring Boot 3.5.14 (`build.gradle:3,12`)
- **영속성**: Spring Data JPA / Hibernate — `@Lock(LockModeType.PESSIMISTIC_WRITE)` (`AccountRepository.java:4,18`)
- **DB**: PostgreSQL — `SELECT FOR UPDATE`, `UNIQUE`/`CHECK` 제약, 데드락 감지(`40P01`)
- **캐시/락 보조**: Redis — `StringRedisTemplate.setIfAbsent` = `SET NX EX` (`IdempotencyStore.java:6,38`)
- **마이그레이션**: Flyway (`build.gradle:26-27`)
- **테스트**: JUnit 5 + AssertJ + `java.util.concurrent`(ExecutorService/CountDownLatch/AtomicInteger) (`ConcurrencyTest.java`)

### '만든 것' vs '연동/사용만 한 것'

- **직접 설계·구현**: 락 전략, 멱등성 이중 방어 흐름, 두 계좌 락 정렬 알고리즘, self-heal, 동시성 테스트, 도메인 검증(`deduct`).
- **프레임워크 기능을 사용**: JPA 비관적 락 매핑(`@Lock`), Redis SETNX 원자성, PostgreSQL의 row lock/UNIQUE/데드락 감지. → "락 메커니즘 자체"는 DB/JPA가 제공, **"어떤 락을 / 어떤 순서로 / 무엇과 조합할지"를 설계**한 것이 내 기여.

---

## 3. 트러블슈팅 (핵심)

> 각 항목의 `변경 전`이 **재구성**인지 **실제 git 이력**인지 머리에 표시했다.

### TS-1. ⭐ JPA 1차 캐시가 `PESSIMISTIC_WRITE`를 무력화 — 조용한 잔액 누락
**[변경 전: progress.md Step 10에 기록된 실제 버그 코드 재구성 / 변경 후: 실제 코드]**

- **문제(메커니즘)**: 이체 진입부에서 송금자 식별을 위해 `findByUserId(userId)`(비락 조회)를 호출하면 송금자 `Account`가 **영속성 컨텍스트(1차 캐시)** 에 올라간다. 이후 같은 트랜잭션에서 `findByIdForUpdate(senderId)`로 락 조회를 해도, Hibernate는 그 엔티티가 이미 1차 캐시에 있으므로 **DB로 `SELECT … FOR UPDATE`를 보내지 않고 캐시 객체를 그대로 반환**한다. 결과적으로 송금자 행에 row lock이 안 걸린다. A↔B 양방향 동시 이체에서 한쪽 송금자가 락 없이 stale 잔액 위에 덮어쓰며 **lost update** 발생.
- **증상**: 데드락도 예외도 없이 **잔액 합 2,017,000원(기대 2,000,000원)** — net 17건 분의 차감이 사라짐. 정적 분석으로는 잡히지 않는 사고. **동시성 통합 테스트가 없었다면 영영 못 잡았을 함정.**
- **해결 / 왜 이걸 선택했나**: 송금자는 *엔티티 전체가 아니라 ID만* 필요하다. ID만 뽑는 JPQL projection을 추가하면 송금자 `Account`가 1차 캐시에 올라가지 않아, 이어지는 `findByIdForUpdate`가 정상적으로 `SELECT FOR UPDATE`를 발동한다. (락 메서드를 두 번 부르는 대신 캐시 오염원 자체를 제거.)

변경 전:
```java
@Transactional
public TransferResponse transfer(Long userId, String key, TransferRequest req) {
    // 송금자 식별 — 엔티티를 통째로 조회 (← 여기서 1차 캐시에 올라감)
    Account senderProbe = accountRepository.findByUserId(userId)
            .orElseThrow(() -> AccountNotFoundException.forUser(userId));
    long senderId = senderProbe.getId();
    ...
    // 락 조회 — 그러나 senderId 행은 이미 1차 캐시에 있어
    // Hibernate가 SELECT FOR UPDATE 를 보내지 않고 캐시 객체를 반환 → 락 미적용
    Account sender = accountRepository.findByIdForUpdate(senderId).orElseThrow(...);
}
```
변경 후 (`TransferService.java:31`, `AccountRepository.java:15-16`):
```java
// 송금자는 ID만 필요 — projection 으로 엔티티 영속화를 피한다
long senderId = accountRepository.findIdByUserId(userId)
        .orElseThrow(() -> AccountNotFoundException.forUser(userId));
...
Account first = accountRepository.findByIdForUpdate(firstId)   // 이제 정상적으로 SELECT FOR UPDATE 발동
        .orElseThrow(() -> AccountNotFoundException.forAccount(firstId));
```
```java
// AccountRepository
@Query("select a.id from Account a where a.userId = :userId")
Optional<Long> findIdByUserId(Long userId);
```
- **결과**: 재실행 시 **A↔B 양방향 각 100건(총 200건) → 잔액 합 정확히 2,000,000원, 실패 0, 데드락 0, TRANSFER 200건, 2.485s.** CLAUDE.md "동시성" 섹션에 함정으로 영구 기록.

---

### TS-2. 두 계좌 이체 데드락(circular wait) → `account_id` 오름차순 정렬
**[변경 전: 전형적 naive 구현 재구성 / 변경 후: 실제 코드]**

- **문제(메커니즘)**: 이체는 송금자·수신자 두 행에 동시에 락을 잡는다. "송금자 먼저, 수신자 다음"이라는 자연스러운 순서로 짜면 — `A→B` 트랜잭션은 A락 후 B 대기, `B→A` 트랜잭션은 B락 후 A 대기 → **circular wait** → PostgreSQL이 한쪽을 `deadlock detected(40P01)`로 강제 abort. 사용자에겐 "되는 이체와 안 되는 이체가 무작위".
- **해결 / 왜**: 데드락의 4조건(Coffman) 중 **circular wait를 제거** — 모든 트랜잭션이 자원을 *같은 순서*로 획득하면 사이클 그래프가 만들어질 수 없다. `account_id`는 `BIGSERIAL` PK라 두 계좌 사이 전순서가 공짜로 정의됨 → `Math.min/max`로 정렬 후 락. (대안인 "락 실패 시 재시도"는 데드락을 없애지 못하고 미루기만 하므로 기각 — ADR-0011.)

변경 전:
```java
// 자연스러운 순서: 송금자 먼저, 수신자 다음
Account sender   = accountRepository.findByIdForUpdate(senderId).orElseThrow(...);
Account receiver = accountRepository.findByIdForUpdate(receiverId).orElseThrow(...);
// A→B 와 B→A 가 동시에 돌면 락 획득 순서가 교차 → 데드락(40P01)
```
변경 후 (`TransferService.java:48-60`):
```java
long firstId  = Math.min(senderId, receiverId);   // 방향 무관, 작은 ID 먼저
long secondId = Math.max(senderId, receiverId);

Account first  = accountRepository.findByIdForUpdate(firstId).orElseThrow(...);
Account second = accountRepository.findByIdForUpdate(secondId).orElseThrow(...);

Account sender   = first.getId() == senderId   ? first : second;  // 락 순서와 역할 분리
Account receiver = first.getId() == receiverId ? first : second;
sender.deduct(amount);
receiver.charge(amount);
```
- **결과**: A↔B 양방향 각 100건 동시 → **데드락 0, 예외 0, 이체 zero-sum 합 보존.** 정상 경로에서 `40P01`이 발생할 수 없음.

---

### TS-3. 동시 결제 lost update / 잔액 음수 → 비관적 락
**[변경 전: 전형적 naive 구현 재구성 / 변경 후: 실제 코드]**

- **문제(메커니즘)**: 락 없는 read-modify-write. 두 결제 트랜잭션이 같은 잔액을 읽고 각자 검증·차감하면 마지막 UPDATE만 남아(**lost update**) 잔액이 실제보다 덜 깎이거나 음수가 된다. 검증(`balance < amount`)도 stale 값 위에서 통과하므로 무력.
- **해결 / 왜**: `@Lock(PESSIMISTIC_WRITE)` = `SELECT … FOR UPDATE`로 행을 잠가 같은 계좌 요청을 **직렬화**. 금융 도메인은 (a) 재시도가 UX를 손상시키고 (b) 같은 계좌 충돌이 충분히 잦아 — 낙관적 락(@Version+재시도)보다 비관적 락이 교과서적 적합(ADR-0009). 락 메서드 이름에 의도를 박아(`…ForUpdate`) 일반 조회와 구분.

변경 전:
```java
@Transactional
public PaymentResponse pay(Long userId, PaymentRequest req) {
    Account account = accountRepository.findByUserId(userId).orElseThrow(...); // 락 없음
    if (account.getBalance().isLessThan(amount))                               // stale 검증
        throw new InsufficientBalanceException();
    account.deduct(amount);   // 동시 트랜잭션이 같은 잔액을 읽고 각자 깎음 → lost update
    ...
}
```
변경 후 (`PaymentService.java:30`, `AccountRepository.java:18-20`):
```java
Account account = accountRepository.findByUserIdForUpdate(userId)  // SELECT … FOR UPDATE
        .orElseThrow(() -> AccountNotFoundException.forUser(userId));
account.deduct(amount);   // 같은 계좌 동시 요청은 락으로 직렬화됨
```
```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("select a from Account a where a.userId = :userId")
Optional<Account> findByUserIdForUpdate(Long userId);
```
- **결과**: 잔액 100,000원 + 1,000원 결제 **100건 동시 → 잔액 정확히 0, 실패 0, PAYMENT 100건, 1.232s.** 음수·누락 없음. (DB `CHECK (balance_amount >= 0)`가 최후 방어 — `V2:16-17`.)

---

### TS-4. 멱등성: Redis 단독의 빈틈 → SETNX + DB UNIQUE 이중 방어 + self-heal
**[변경 전: ADR-0010에서 기각한 'Redis 단독' 대안 재구성 / 변경 후: 실제 코드]**

- **문제(메커니즘)**: 더블클릭·재시도로 같은 결제가 두 번 들어온다. Redis SETNX만으로 막으면 — (a) TTL 만료 직후, (b) Redis 장애 중에는 동시 두 요청이 모두 통과해 **거래 2건**이 생긴다. Redis는 보조 인프라라 단일 의존이 위험. 또 첫 응답을 Redis에 캐싱하면 DB 거래와 비동기로 어긋날 수 있다.
- **해결 / 왜**: **1차 Redis SETNX**(빠른 차단, 99%+) + **2차 DB `UNIQUE(idempotency_key)`**(최후 방어). Redis 장애 시 `tryAcquire`가 `true`를 반환해 가용성을 지키고, 동시 INSERT가 충돌하면 `DataIntegrityViolationException`을 catch해 `findByIdempotencyKey`로 첫 거래를 재조회해 **동일 응답을 돌려준다(self-heal)**. 응답 캐시는 Redis가 아니라 **DB 재조회(SSoT)** 로 단일화 — 캐시 무효화 문제 회피.

변경 전:
```java
// Redis SETNX 만으로 중복 차단
if (!idempotencyStore.tryAcquirePayment(key)) {
    // 이미 처리됨 — 그런데 첫 응답은 어디서? (캐시 동기화 문제)
    // TTL 만료/Redis 장애 시엔 이 분기 자체가 안 타서 중복 INSERT 무방비
}
account.deduct(amount);
transactionRepository.save(tx);   // DB에 중복 차단 장치 없음
```
변경 후 (`PaymentService.java:35-53`, `IdempotencyStore.java:36-45`, `V1:26`):
```java
Optional<Transaction> existing = transactionRepository.findByIdempotencyKey(key);
if (existing.isPresent())
    return replayIfMatches(existing.get(), account.getId(), req, amount); // 첫 응답 재생성

idempotencyStore.tryAcquirePayment(key);   // Redis SETNX 1차 차단
account.deduct(amount);
try {
    return PaymentResponse.from(transactionRepository.saveAndFlush(tx));   // DB UNIQUE 최후 방어
} catch (DataIntegrityViolationException ex) {                            // 동시 INSERT 충돌
    return transactionRepository.findByIdempotencyKey(key)               // self-heal
            .map(tx -> replayIfMatches(tx, account.getId(), req, amount))
            .orElseThrow(() -> ex);
}
```
```java
// IdempotencyStore — Redis 장애 시 가용성 우선(true) → DB UNIQUE 가 막는다
Boolean acquired = redisTemplate.opsForValue().setIfAbsent(redisKey, IN_PROGRESS, DEFAULT_TTL); // SET NX EX
return acquired == null || acquired;
// catch (DataAccessException) { log.warn(...); return true; }
```
```sql
-- V1__init.sql
idempotency_key VARCHAR(100) UNIQUE   -- 전역 UNIQUE = 최후 방어선
```
- **결과**: 같은 멱등키 **10번 동시 → PAYMENT 1건만 생성, 모든 응답이 동일 transactionId, 잔액 99,000원, 1.305s.** 1차/2차 어디서 걸렸는지 로그로 분리 관측 가능.

---

### TS-5. 같은 키 + 다른 본문 구분 (replay vs 409)
**[변경 전: '무조건 replay' 재구성 / 변경 후: 실제 코드]**

- **문제(메커니즘)**: 멱등키는 같은데 본문(금액·가맹점)이 다른 경우 — 클라이언트 버그 또는 키 재사용. 첫 응답을 그대로 200으로 주면 클라이언트는 "두 번째 요청이 처리됐다"고 오해하지만 실제론 무시된 것 → 그 자체로 사고.
- **해결 / 왜**: 첫 거래 행의 컬럼(`accountId`·`amount`·`merchantId`)과 새 요청을 비교해 **일치하면 200 replay, 불일치하면 `409 IDEMPOTENCY_KEY_CONFLICT`**. 별도 본문 해시를 저장하지 않고 거래 행 자체를 진실로 삼음.

변경 전:
```java
Optional<Transaction> existing = transactionRepository.findByIdempotencyKey(key);
if (existing.isPresent())
    return PaymentResponse.from(existing.get());   // 본문 검증 없이 무조건 첫 응답 반환
```
변경 후 (`PaymentService.java:56-66`):
```java
private PaymentResponse replayIfMatches(Transaction existing, Long accountId,
                                        PaymentRequest req, Money amount) {
    boolean sameAccount  = existing.getAccountId().equals(accountId);
    boolean sameAmount   = existing.getAmount().equals(amount);
    boolean sameMerchant = req.merchantId().equals(existing.getMerchantId());
    if (sameAccount && sameAmount && sameMerchant)
        return PaymentResponse.from(existing);                       // idempotent replay
    throw new IdempotencyKeyConflictException(existing.getIdempotencyKey());  // 409
}
```
- **결과**: E2E에서 같은 키+같은 본문 → 200(동일 txId), 같은 키+다른 금액 → **409 IDEMPOTENCY_KEY_CONFLICT** 확인.

---

### TS-6. 충전 API 멱등성 비대칭 결함 (ADR-0012)
**[변경 전 / 변경 후 모두 실제 git 이력 — commit `8e7491e`]**

- **문제(메커니즘)**: Step 7에서 충전엔 멱등성을 안 붙였다(멱등성 개념이 Step 8에서야 등장하는 가이드 진행 순서 때문). 하지만 충전도 **돈이 들어오는 쓰기** — 더블클릭/재시도 시 잔액이 2배. 결제·이체에만 멱등을 거는 건 일관성 결함.
- **해결 / 왜**: ADR-0010 패턴을 충전에 그대로 확장. `tryAcquireCharge`(prefix `idem:charge:`) + 헤더 필수 + DB 재조회 replay + self-heal. **마이그레이션 0** — `idempotency_key`는 V1부터 전역 UNIQUE라, 그동안 `null`을 넣던 컬럼을 채우기만 하면 DB 최후 방어선이 그대로 작동. (옵셔널 키는 결함을 절반만 막으므로 기각, 전용 메커니즘 신설은 YAGNI로 기각.)

변경 전 (Step 7 — 멱등성 없음):
```java
public ChargeResponse charge(Long userId, ChargeRequest req) {
    Account account = accountRepository.findByUserIdForUpdate(userId).orElseThrow(...);
    account.charge(Money.of(req.amount(), Currency.KRW));
    Transaction tx = Transaction.charge(account.getId(), amount, account.getBalance(), null); // 키 null
    return ChargeResponse.from(transactionRepository.save(tx));
}
```
변경 후 (`AccountService.java:37-61`):
```java
public ChargeResponse charge(Long userId, String idempotencyKey, ChargeRequest req) {
    Account account = accountRepository.findByUserIdForUpdate(userId).orElseThrow(...); // 비관적 락 유지
    Optional<Transaction> existing = transactionRepository.findByIdempotencyKey(idempotencyKey);
    if (existing.isPresent()) return replayIfMatches(existing.get(), account.getId(), amount);
    idempotencyStore.tryAcquireCharge(idempotencyKey);                 // Redis SETNX
    account.charge(amount);
    try {
        return ChargeResponse.from(transactionRepository.saveAndFlush(tx));   // DB UNIQUE
    } catch (DataIntegrityViolationException ex) { /* findByIdempotencyKey self-heal */ }
}
```
- **결과**: 같은 키 재충전 → replay(잔액 그대로), 신규 키 → 잔액 정확히 누적. 돈을 움직이는 3개 작업이 **동일한 멱등 계약**으로 통일.

---

### 부록 — 락 외 운영 함정: Flyway V3 체크섬 불일치 (CRLF/LF)
**[실제 git 이력 — Step 5]**

이체 마이그레이션(`V3__transfer.sql`) 도입 후, 협업/CI 환경에서 **Flyway checksum mismatch**가 발생. 원인은 Windows 체크아웃 시 줄바꿈이 CRLF로 바뀌어 파일 해시가 달라진 것. 해결: `.gitattributes`로 `*.sql`을 LF 강제 + DB의 `flyway_schema_history` 체크섬을 NULL로 비워 재계산. → "마이그레이션 파일은 바이트 단위로 불변"이라는 Flyway 단방향 원칙(ADR-0004)의 실전 함정. *락과 직접 관련은 없으나 동시성 기능을 실은 마이그레이션에서 겪은 운영 이슈라 기록.*

---

## 4. 검증·정직성

### 4.1 코드로 확인된 주장
- 비관적 락 3종 — `AccountRepository.java:18-24` ✅
- ID projection(캐시 함정 픽스) — `AccountRepository.java:15-16`, `TransferService.java:31` ✅
- 두 계좌 정렬 락 — `TransferService.java:48-60` ✅
- 멱등 이중 방어 + self-heal — `PaymentService.java:35-53`, `IdempotencyStore.java:36-45`, `V1:26` ✅
- 충전 멱등 확장 — `AccountService.java:37-61`, commit `8e7491e` ✅
- DB 최후 방어선 — `balance_amount >= 0`(`V2:16-17`), `idempotency_key UNIQUE`(`V1:26`), `counterparty_not_self`(`V3:18-21`) ✅

### 4.2 측정 수치의 출처 (⚠️ 정직 고지)
- 아래 표의 **소요 시간(1.232s 등)과 "잔액 합 2,017,000" 버그 수치는 2026-05-17 기록된 테스트 실행 로그(`docs/progress.md` Step 10)에서 가져온 값**이며, **이번 세션에서 재실행하지는 않았다.** 통과 여부(잔액·거래 수)는 `ConcurrencyTest.java`의 assertion으로 코드에 박혀 있어 재현 가능하나, **타이밍 수치는 머신/부하에 따라 달라진다.** 정확한 최신 수치가 필요하면 `docker compose up` 후 `./gradlew test --tests ConcurrencyTest`로 재측정 가능(원하면 실행해 드린다).

### 4.3 '변경 전' 코드의 성격
| 항목 | 변경 전 출처 |
|---|---|
| TS-1 | progress.md에 기록된 **실제 버그 코드**를 재구성 (현재 트리엔 픽스만 존재) |
| TS-2 | 전형적 naive 구현 **재구성** (프로젝트는 ADR-0011로 처음부터 정렬 구현) |
| TS-3 | 전형적 naive 구현 **재구성** (Step 7부터 락 적용) |
| TS-4 | ADR-0010이 **기각한 'Redis 단독' 대안 재구성** |
| TS-5 | '무조건 replay' **재구성** |
| TS-6 | **실제 git 이력** (Step 7 → ADR-0012, 둘 다 실재) |

### 4.4 문서 vs 구현 불일치 점검
- **문서가 오래되어 보일 수 있는 한 곳**: `docs/api.md`/초기 progress 기록에 "충전은 멱등성 적용 안 함"이라는 서술이 남아 있을 수 있으나, **현재 구현은 ADR-0012로 충전에도 멱등성이 적용돼 있다**(commit `8e7491e`). 즉 *과거 서술 ↔ 현재 코드*가 다르며, **코드가 최신**이다. (이 문서는 코드 기준으로 작성.)
- 그 외 ADR 0009/0010/0011과 실제 코드(`@Lock`, `Math.min/max`, `setIfAbsent`, self-heal)는 일치.

---

## 5. 포맷별 압축본

### 5.1 이력서용 (압축)

> **간편결제 백엔드 동시성·정합성 설계/구현 (개인 프로젝트, Spring Boot·PostgreSQL·Redis)**
> 충전·결제·이체에서 동시 요청에도 잔액이 어긋나지 않도록 비관적 락(`SELECT FOR UPDATE`)으로 같은 계좌를 직렬화하고, Redis SETNX + DB UNIQUE 이중 방어로 멱등성을 보장. 이체 두 계좌 락을 `account_id` 순으로 정렬해 데드락을 원천 차단. `ExecutorService` 기반 동시성 통합 테스트로 100~200건 동시 시나리오를 실증.

- **비관적 락 직렬화**: 1,000원 결제 100건 동시 → 잔액 정확히 0, 실패 0.
- **멱등성 이중 방어 + self-heal**: 같은 키 10건 동시 → 거래 1건만, 모두 동일 응답.
- **JPA 1차 캐시 함정 발견·수정**: 비락 조회가 후속 `FOR UPDATE`를 무력화해 잔액이 조용히 누락되던 버그를 ID projection으로 해결(통합 테스트로만 잡힘).

### 5.2 발표용 — 아키텍처 다이어그램

**(A) 이체: 두 계좌 락 순서 정렬로 데드락 회피**
```
        [T1: A→B 이체]                 [T2: B→A 이체]
              │                              │
   findIdByUserId(A) → senderId    findIdByUserId(B) → senderId
        ID만 추출(캐시 오염 X)            ID만 추출
              │                              │
   firstId = min(A,B), secondId = max(A,B)  ← 양쪽 트랜잭션이 동일 순서
              │                              │
   ┌──────────▼──────────┐      ┌────────────▼─────────┐
   │ LOCK account(min)    │      │ LOCK account(min)    │  같은 행을 먼저 잠그려 경합
   │ SELECT … FOR UPDATE  │      │   → 한쪽은 대기       │  (사이클 형성 불가)
   └──────────┬──────────┘      └────────────┬─────────┘
   │ LOCK account(max)    │      │ LOCK account(max)    │
              │                              │
     deduct/charge → INSERT tx → COMMIT(락 해제) → 다음 트랜잭션 진행
                              ✅ 데드락 0
```

**(B) 멱등성 이중 방어 흐름**
```
요청(Idempotency-Key)
   │
   ▼
findByIdempotencyKey ──존재?──► 본문 일치? ──예─► 200 첫 응답 replay
   │아니오                          └─아니오─► 409 CONFLICT
   ▼
Redis SETNX (1차) ──장애 시 true(가용성) ─┐
   │성공                                  │
   ▼                                      ▼
deduct → saveAndFlush ──► DB UNIQUE(2차/최후 방어)
   │성공                      │위반(동시 INSERT 충돌)
   ▼                          ▼
200 응답              findByIdempotencyKey 재조회 → 동일 응답 (self-heal)
```

**(C) 다층 방어선 요약**
```
애플리케이션 락  : SELECT … FOR UPDATE  (같은 계좌 직렬화)
       +
멱등성 1차       : Redis SETNX (TTL 10분, 빠른 차단)
       +
DB 최후 방어선   : UNIQUE(idempotency_key) / CHECK(balance>=0) / CHECK(not_self)
```

### 5.3 측정 수치 (출처: §4.2 참조)

| 시나리오 | 동시 요청 | 기대 | 실측 결과 | 소요 |
|---|---|---|---|---|
| 비관적 락 직렬화 (ADR-0009) | 1,000원 결제 100건 | 잔액 0, 거래 100 | 잔액 0, 실패 0, PAYMENT 100 | 1.232s |
| 멱등성 replay (ADR-0010) | 같은 키 10건 | 거래 1건 | PAYMENT 1, 동일 txId, 잔액 99,000 | 1.305s |
| 데드락 회피 (ADR-0011) | A↔B 각 100건(총 200) | 합 2,000,000, 데드락 0 | 합 2,000,000, 실패 0, TRANSFER 200 | 2.485s |
| (수정 전 버그) | 위 이체 — JPA 캐시 함정 | — | **잔액 합 2,017,000 (17건 누락)** | — |

---

## 부록 — 관련 ADR 인덱스
- `docs/adr/0009-pessimistic-locking.md` — 비관적 락 vs 낙관적 락 트레이드오프
- `docs/adr/0010-idempotency-dual-defense.md` — Redis SETNX + DB UNIQUE 이중 방어
- `docs/adr/0011-transfer-lock-ordering.md` — account_id 정렬로 circular wait 제거
- `docs/adr/0012-charge-idempotency.md` — 충전 멱등성 확장(비대칭 해소)
