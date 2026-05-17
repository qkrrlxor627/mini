# Mini Pay 프로젝트 — Step by Step 구현 가이드

> **스택**: Java 17 · Spring Boot 3.3.x · PostgreSQL · Redis · JPA · Flyway · JWT
> **목적**: 빠른 학습용 (백엔드 + Swagger)
> **예상 기간**: 3~5일

---

## 📌 학습 포인트 (왜 이 프로젝트를 만드는가)

이 미니 프로젝트에서 면접·실무에서 써먹을 핵심 3가지:

1. **잔액 차감의 동시성 처리** — 비관적 락 vs 낙관적 락의 의도적 선택
2. **결제 멱등성(Idempotency)** — Redis SETNX로 이중결제 방지
3. **트랜잭션 원자성** — `@Transactional` + AFTER_COMMIT 이벤트 분리

각 Step의 "💭 고민의 흔적"을 채우는 게 진짜 자산입니다. 코드 자체보다 **왜 그렇게 짰는지**가 면접에서 물어보는 거예요.

---

## 🗂 전체 로드맵

| Step | 내용 | 예상 시간 |
|---|---|---|
| 0 | 환경 세팅 (Docker, 프로젝트 생성) | 30분 |
| 1 | 의존성 + 설정 파일 | 30분 |
| 2 | Flyway 마이그레이션 (3테이블) | 1시간 |
| 3 | 엔티티 작성 | 1.5시간 |
| 4 | 회원가입 API | 1.5시간 |
| 5 | Spring Security + JWT 필터 | 3시간 ⚠️ |
| 6 | 로그인 API | 1시간 |
| 7 | 잔액 충전 API | 1시간 |
| 8 | **결제 API (비관적 락 + 멱등성)** ⭐ | 3시간 |
| 9 | 거래내역 조회 API | 1시간 |
| 10 | 동시성 통합 테스트 ⭐ | 2시간 |
| 11 | Swagger 시나리오 검증 | 30분 |

⭐ 표시는 학습 핵심. ⚠️는 가장 손이 많이 막히는 부분.

---

## Step 0 — 환경 세팅

### 🎯 목표
Postgres + Redis 컨테이너 띄우고 Spring Boot 프로젝트 골격 생성.

### 📝 구현

**1) `docker-compose.yml`** (프로젝트 루트)
```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: minipay
      POSTGRES_USER: minipay
      POSTGRES_PASSWORD: minipay
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
  redis:
    image: redis:7
    ports: ["6379:6379"]
volumes:
  pgdata:
```

**2) Spring Boot 프로젝트 생성** — [start.spring.io](https://start.spring.io)
- Boot 3.3.x, Java 17, Gradle-Groovy
- Dependencies: **Spring Web, Spring Data JPA, Spring Security, Spring Data Redis, Lombok, PostgreSQL Driver, Validation, Flyway Migration**

**3) 컨테이너 기동 + DB 접속 확인**
```bash
docker compose up -d
docker exec -it $(docker ps -qf "ancestor=postgres:16") psql -U minipay -d minipay -c "\dt"
```

### 💭 고민의 흔적
> _(직접 작성)_
> - 왜 H2 대신 Postgres로 시작했나?
> -
>

### 🔗 참고 링크
> _(직접 작성)_
> -
>

### ✅ 완료 체크
- [ ] `docker compose up -d` 정상 기동
- [ ] Postgres 5432, Redis 6379 접속 확인
- [ ] Spring Boot 프로젝트 `./gradlew bootRun` 정상 부팅

---

## Step 1 — 의존성 + 설정 파일

### 🎯 목표
JWT, OpenAPI 의존성 추가하고 `application.yml` 작성.

### 📝 구현

**`build.gradle` 추가**
```gradle
implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.6.0'
implementation 'io.jsonwebtoken:jjwt-api:0.12.6'
runtimeOnly  'io.jsonwebtoken:jjwt-impl:0.12.6'
runtimeOnly  'io.jsonwebtoken:jjwt-jackson:0.12.6'
runtimeOnly  'org.flywaydb:flyway-database-postgresql'

testImplementation 'org.springframework.security:spring-security-test'
```

**`src/main/resources/application.yml`**
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/minipay
    username: minipay
    password: minipay
  jpa:
    hibernate.ddl-auto: validate   # 스키마는 Flyway가 관리
    properties.hibernate:
      format_sql: true
      jdbc.time_zone: Asia/Seoul
    show-sql: true
  data.redis:
    host: localhost
    port: 6379
  flyway.enabled: true

jwt:
  secret: change-me-to-32bytes-or-longer-secret-key!!
  expiration-ms: 3600000   # 1시간

springdoc:
  swagger-ui.path: /swagger
  api-docs.path: /api-docs
```

### 💭 고민의 흔적
> - `ddl-auto: validate`로 한 이유? (운영 사고 방지 = Flyway가 단일 진실의 원천)
> -
>

### 🔗 참고 링크
> -
>

### ✅ 완료 체크
- [ ] `./gradlew build` 성공
- [ ] 부팅 시 Flyway 로그 출력 확인

---

## Step 2 — Flyway 마이그레이션

### 🎯 목표
Postgres에 3테이블 생성. 스키마는 코드보다 Flyway가 먼저.

### 📝 구현

**`src/main/resources/db/migration/V1__init.sql`**
```sql
CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(100) NOT NULL,
  pin_hash      VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT NOT NULL UNIQUE REFERENCES users(id),
  balance    BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE transactions (
  id              BIGSERIAL PRIMARY KEY,
  account_id      BIGINT NOT NULL REFERENCES accounts(id),
  type            VARCHAR(20) NOT NULL,        -- CHARGE | PAYMENT
  amount          BIGINT NOT NULL,
  balance_after   BIGINT NOT NULL,
  merchant_id     VARCHAR(50),
  idempotency_key VARCHAR(100) UNIQUE,
  status          VARCHAR(20) NOT NULL,        -- SUCCESS | FAILED
  created_at      TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_tx_account_created ON transactions(account_id, created_at DESC);
```

### 💭 고민의 흔적
> - 금액을 `BIGINT`(원 단위 정수)로 한 이유? `NUMERIC`/`BigDecimal` 대비?
> - `idempotency_key`에 UNIQUE를 건 이유? (Redis 만료 후 백업 방어선)
> - `CHECK (balance >= 0)` DB 레벨 방어를 둔 의미?
>

### 🔗 참고 링크
> -
>

### ✅ 완료 체크
- [ ] 부팅 시 `flyway_schema_history` 테이블 생성
- [ ] `\dt` 명령으로 3테이블 확인

---

## Step 3 — 엔티티 작성

### 🎯 목표
`User`, `Account`, `Transaction` 엔티티 작성. **잔액 변경은 도메인 메서드로만.**

### 📝 구현

**`Account.java`** — 핵심 엔티티
```java
@Entity
@Table(name = "accounts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Account {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long userId;

    @Column(nullable = false)
    private long balance;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public static Account openFor(Long userId) {
        Account a = new Account();
        a.userId = userId;
        a.balance = 0L;
        a.createdAt = LocalDateTime.now();
        return a;
    }

    public void charge(long amount) {
        validateAmount(amount);
        this.balance += amount;
    }

    public void deduct(long amount) {
        validateAmount(amount);
        if (this.balance < amount) throw new InsufficientBalanceException();
        this.balance -= amount;
    }

    private void validateAmount(long amount) {
        if (amount <= 0) throw new IllegalArgumentException("금액은 0보다 커야 합니다");
    }
}
```

`User`, `Transaction`도 같은 패턴(setter 없음, 정적 팩토리 메서드)으로 작성.

### 💭 고민의 흔적
> - setter를 없애고 도메인 메서드만 노출한 이유?
> - 잔액 검증을 엔티티 안에 넣은 이유 vs 서비스에 넣는 것?
> - `protected` 생성자로 막은 이유? (JPA + 무분별한 생성 방지)
>

### 🔗 참고 링크
> -
>

### ✅ 완료 체크
- [ ] 3개 엔티티 컴파일 성공
- [ ] 부팅 시 `ddl-auto: validate` 통과 (= 마이그레이션과 엔티티 일치)

---

## Step 4 — 회원가입 API

### 🎯 목표
`POST /api/auth/signup` — 이메일/비번/이름/PIN 받아서 User + Account 생성.

### 📝 구현

**요청/응답 DTO** (Java record 권장)
```java
public record SignupRequest(
    @Email String email,
    @Size(min = 8) String password,
    @NotBlank String name,
    @Pattern(regexp = "\\d{6}") String pin
) {}

public record SignupResponse(Long userId, String email) {}
```

**Service 흐름**
1. 이메일 중복 체크
2. password, pin → BCrypt 해시
3. User 저장 → Account 함께 생성 (한 트랜잭션)

```java
@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public SignupResponse signup(SignupRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            throw new DuplicateEmailException();
        }
        User user = User.create(
            req.email(),
            passwordEncoder.encode(req.password()),
            req.name(),
            passwordEncoder.encode(req.pin())
        );
        userRepository.save(user);
        accountRepository.save(Account.openFor(user.getId()));
        return new SignupResponse(user.getId(), user.getEmail());
    }
}
```

### 💭 고민의 흔적
> - User 생성과 Account 생성을 한 트랜잭션에 묶은 이유?
> - PIN을 password와 다른 컬럼으로 분리한 이유?
> - record DTO를 쓴 이유? (불변성)
>

### 🔗 참고 링크
> -
>

### ✅ 완료 체크
- [ ] Postman으로 가입 성공
- [ ] 같은 이메일 재가입 시 409
- [ ] DB에 user + account row 생성 확인

---

## Step 5 — Spring Security + JWT 필터 ⚠️

### 🎯 목표
JWT 기반 인증 필터 + SecurityConfig. **이번 프로젝트에서 가장 손이 많이 막히는 구간.**

### 📝 구현 가이드

**구성 요소 4개**
1. `JwtTokenProvider` — 토큰 생성/검증
2. `JwtAuthenticationFilter extends OncePerRequestFilter` — 헤더에서 JWT 추출
3. `SecurityConfig` — `/auth/**`와 `/swagger`, `/api-docs/**`은 permit, 나머지 authenticated
4. `PasswordEncoder` Bean — `BCryptPasswordEncoder`

**JwtTokenProvider 핵심**
```java
@Component
public class JwtTokenProvider {
    private final SecretKey key;
    private final long expirationMs;

    public JwtTokenProvider(@Value("${jwt.secret}") String secret,
                            @Value("${jwt.expiration-ms}") long expirationMs) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationMs = expirationMs;
    }

    public String issue(Long userId) {
        Date now = new Date();
        return Jwts.builder()
            .subject(String.valueOf(userId))
            .issuedAt(now)
            .expiration(new Date(now.getTime() + expirationMs))
            .signWith(key)
            .compact();
    }

    public Long parse(String token) {
        return Long.valueOf(Jwts.parser().verifyWith(key).build()
            .parseSignedClaims(token).getPayload().getSubject());
    }
}
```

**필터에서는 인증 성공 시** `SecurityContextHolder`에 `UsernamePasswordAuthenticationToken` 등록. principal로 `userId`를 그대로 박으면 컨트롤러에서 `@AuthenticationPrincipal Long userId`로 받기 편함.

### 💭 고민의 흔적
> - Refresh Token을 안 쓴 이유? (학습용 스코프 컷)
> - principal에 User 객체 대신 Long(userId)을 박은 이유?
> - 어디서 막혔나? (가장 흔함: CSRF 비활성화 빠뜨림, FilterChain 순서, BCrypt Bean 미등록)
> -
>

### 🔗 참고 링크
> - JWT 디버깅: https://jwt.io
> -
>

### ✅ 완료 체크
- [ ] 인증 없이 `/api/accounts/me` 호출 시 401
- [ ] 잘못된 토큰 → 401
- [ ] 만료된 토큰 → 401 (시연 위해 잠깐 expiration-ms를 5000으로 줄여 테스트)

---

## Step 6 — 로그인 API

### 🎯 목표
`POST /api/auth/login` — 이메일/비번 검증 → JWT 발급.

### 📝 구현

```java
@Transactional(readOnly = true)
public LoginResponse login(LoginRequest req) {
    User user = userRepository.findByEmail(req.email())
        .orElseThrow(InvalidCredentialsException::new);
    if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
        throw new InvalidCredentialsException();
    }
    return new LoginResponse(jwtTokenProvider.issue(user.getId()));
}
```

> ⚠️ 이메일 없을 때와 비번 틀릴 때 **같은 예외**로 통일 (계정 존재 여부 노출 방지).

### 💭 고민의 흔적
> - 이메일 없음 / 비번 틀림을 같은 응답으로 처리한 이유?
> -
>

### 🔗 참고 링크
> -
>

### ✅ 완료 체크
- [ ] 로그인 성공 시 JWT 반환
- [ ] Swagger Authorize 버튼에 토큰 붙여서 인증 API 호출 가능

---

## Step 7 — 잔액 충전 API

### 🎯 목표
`POST /api/accounts/charge` — 외부 PG는 mock, 그냥 잔액 더하기 + Transaction 기록.

### 📝 구현

```java
@Transactional
public ChargeResponse charge(Long userId, long amount) {
    Account account = accountRepository.findByUserIdForUpdate(userId)
        .orElseThrow(AccountNotFoundException::new);
    account.charge(amount);
    Transaction tx = Transaction.charge(account.getId(), amount, account.getBalance());
    transactionRepository.save(tx);
    return new ChargeResponse(tx.getId(), account.getBalance());
}
```

### 💭 고민의 흔적
> - 충전에도 비관적 락을 쓴 이유? (충전 + 결제가 동시에 들어오는 케이스)
> - 외부 PG 연동을 mock으로 자른 이유?
>

### 🔗 참고 링크
> -
>

### ✅ 완료 체크
- [ ] 충전 후 `/accounts/me` 잔액 반영
- [ ] transactions 테이블에 type=CHARGE 기록

---

## Step 8 — 결제 API (비관적 락 + 멱등성) ⭐

### 🎯 목표
이 프로젝트의 메인. **동시 결제와 재시도에 안전한 결제 API.**

### 📝 구현

**Repository — 비관적 락**
```java
public interface AccountRepository extends JpaRepository<Account, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Account a where a.userId = :userId")
    Optional<Account> findByUserIdForUpdate(@Param("userId") Long userId);
}
```

**IdempotencyStore — Redis SETNX 패턴**
```java
@Component
@RequiredArgsConstructor
public class IdempotencyStore {
    private final StringRedisTemplate redis;
    private final ObjectMapper om;

    public <T> T find(String key, Class<T> type) {
        String json = redis.opsForValue().get("idem:" + key);
        if (json == null) return null;
        try { return om.readValue(json, type); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }

    public void save(String key, Object value, Duration ttl) {
        try {
            redis.opsForValue().set("idem:" + key,
                om.writeValueAsString(value), ttl);
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
}
```

**PaymentService**
```java
@Service
@RequiredArgsConstructor
public class PaymentService {
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final IdempotencyStore idempotencyStore;

    @Transactional
    public PaymentResponse pay(Long userId, PaymentRequest req, String idemKey) {
        // 1) 멱등키 검사
        PaymentResponse cached = idempotencyStore.find(idemKey, PaymentResponse.class);
        if (cached != null) return cached;

        // 2) 비관적 락
        Account account = accountRepository.findByUserIdForUpdate(userId)
            .orElseThrow(AccountNotFoundException::new);

        // 3) 도메인 메서드로 차감
        account.deduct(req.amount());

        // 4) 거래내역 (idempotency_key 같이 저장 → DB UNIQUE가 최후의 방어선)
        Transaction tx = Transaction.payment(
            account.getId(), req.amount(), account.getBalance(),
            req.merchantId(), idemKey);
        transactionRepository.save(tx);

        PaymentResponse res = new PaymentResponse(tx.getId(), account.getBalance());
        idempotencyStore.save(idemKey, res, Duration.ofMinutes(10));
        return res;
    }
}
```

**Controller**
```java
@PostMapping("/api/payments")
public PaymentResponse pay(
        @AuthenticationPrincipal Long userId,
        @RequestHeader("Idempotency-Key") String idemKey,
        @Valid @RequestBody PaymentRequest req) {
    return paymentService.pay(userId, req, idemKey);
}
```

### 💭 고민의 흔적
> - **왜 비관적 락인가?** (재시도 부적절, 충돌 빈번 예상, 트랜잭션 짧음)
> - 낙관적 락이었다면 어떤 UX 문제? (재시도 → 사용자 혼란)
> - 멱등키를 Redis + DB UNIQUE 이중으로 둔 이유?
> - Redis 장애 시 어떻게 되나? (DB UNIQUE가 살림)
> - `@Transactional`과 락 획득 순서 (트랜잭션 시작 → 락 → 커밋 시 락 해제)
>

### 🔗 참고 링크
> - https://docs.spring.io/spring-framework/reference/data-access/transaction.html
> - Postgres `SELECT FOR UPDATE` 동작:
> -
>

### ✅ 완료 체크
- [ ] 결제 성공 시 잔액 차감 + tx 저장
- [ ] 잔액 부족 시 400 + 잔액 변동 없음
- [ ] 같은 `Idempotency-Key`로 두 번 호출 → 같은 응답, tx 1개만 생성
- [ ] 다른 키로 두 번 호출 → tx 2개 생성

---

## Step 9 — 거래내역 조회 API

### 🎯 목표
`GET /api/payments?page=0&size=20` — 본인 계좌 거래내역 페이징.

### 📝 구현

```java
@GetMapping("/api/payments")
public Page<TransactionResponse> list(
        @AuthenticationPrincipal Long userId,
        @PageableDefault(size = 20, sort = "createdAt", direction = DESC) Pageable pageable) {
    return paymentService.list(userId, pageable);
}
```

### 💭 고민의 흔적
> - offset 페이징의 한계? (size 커지면 성능 저하 → 추후 cursor 기반 검토)
> - 응답에 잔액 스냅샷(balance_after)을 포함한 이유?
>

### 🔗 참고 링크
> -
>

### ✅ 완료 체크
- [ ] 본인 계좌 내역만 조회됨
- [ ] 최신순 정렬 확인

---

## Step 10 — 동시성 통합 테스트 ⭐

### 🎯 목표
**이 테스트 한 번 돌려보는 게 면접 답변의 깊이를 만든다.**
잔액 100,000원에 1,000원 결제 100건 동시 요청 → 잔액이 정확히 0이 되어야 함.

### 📝 구현

```java
@SpringBootTest
class PaymentConcurrencyTest {

    @Autowired PaymentService paymentService;
    @Autowired AccountRepository accountRepository;
    @Autowired TransactionRepository transactionRepository;

    @Test
    void 동시_결제_100건_잔액_정확성() throws Exception {
        Long userId = setupUserWithBalance(100_000L);

        int threads = 20, total = 100;
        ExecutorService es = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(total);
        AtomicInteger success = new AtomicInteger();
        AtomicInteger fail = new AtomicInteger();

        for (int i = 0; i < total; i++) {
            final int idx = i;
            es.submit(() -> {
                try {
                    paymentService.pay(userId,
                        new PaymentRequest(1_000L, "M001"),
                        "concurrent-" + idx);   // 각 요청 다른 키
                    success.incrementAndGet();
                } catch (Exception e) {
                    fail.incrementAndGet();
                } finally {
                    latch.countDown();
                }
            });
        }
        latch.await(30, TimeUnit.SECONDS);

        Account account = accountRepository.findById(userId).orElseThrow();
        assertThat(account.getBalance()).isZero();
        assertThat(success.get()).isEqualTo(100);
        assertThat(transactionRepository.count()).isEqualTo(100);
    }

    @Test
    void 같은_멱등키_10번_요청_시_1건만_처리() throws Exception {
        Long userId = setupUserWithBalance(100_000L);
        String idemKey = "duplicate-key";

        ExecutorService es = Executors.newFixedThreadPool(10);
        CountDownLatch latch = new CountDownLatch(10);

        for (int i = 0; i < 10; i++) {
            es.submit(() -> {
                try {
                    paymentService.pay(userId, new PaymentRequest(1_000L, "M001"), idemKey);
                } catch (Exception ignored) {
                } finally { latch.countDown(); }
            });
        }
        latch.await();

        Account account = accountRepository.findById(userId).orElseThrow();
        assertThat(account.getBalance()).isEqualTo(99_000L);  // 1,000원만 차감
    }
}
```

### 💭 고민의 흔적
> - **비관적 락 빼고 돌려본 결과는?** (잔액 음수, race condition 직접 관찰)
> - 락의 비용 (TPS 측정해보면 ~?)
> - 트레이드오프를 어떻게 설명할 것인가?
>

### 🔗 참고 링크
> -
>

### ✅ 완료 체크
- [ ] 100건 동시 결제 후 잔액 0
- [ ] 락 빼고 한 번 돌려서 깨지는 모습 확인 (그리고 다시 복구)
- [ ] 같은 멱등키 동시 10건 → 1건만 처리

---

## Step 11 — Swagger 시나리오 검증

### 🎯 목표
`http://localhost:8080/swagger`에서 E2E 시나리오 한 번 돌려보기.

### 📝 시나리오

1. `POST /api/auth/signup` → 가입
2. `POST /api/auth/login` → JWT 받기
3. Swagger 우상단 **Authorize** 버튼에 `Bearer {토큰}` 입력
4. `POST /api/accounts/charge { amount: 100000 }`
5. `POST /api/payments` 헤더 `Idempotency-Key: test-001`, body `{ amount: 30000, merchantId: "M001" }`
6. **같은 헤더로 한 번 더** → 같은 응답 (멱등성 동작 확인)
7. `GET /api/payments` → 내역 1건만 보임 ✅

### ✅ 완료 체크
- [ ] 위 시나리오 정상 동작
- [ ] README에 캡처 또는 흐름 정리

---

## 🎁 마무리 — README에 꼭 적을 것

학습용이지만 면접에 들고 갈 거라면 README가 곧 면접 답변지입니다. 다음 항목을 반드시 포함:

1. **ADR (Architecture Decision Records)** — Step별 "💭 고민의 흔적"을 ADR-001, ADR-002 형식으로 정리
2. **동시성 테스트 결과** — 락 적용 전후 비교 (잔액 어떻게 깨졌는지)
3. **멱등성 다이어그램** — 정상 / 재시도 / Redis 장애 3가지 시나리오
4. **시연 영상 또는 GIF** — Swagger 시나리오 30초

---

## 🚀 다음 단계 (선택)

학습 분량이 남는다면:
- **AFTER_COMMIT 이벤트** — 결제 성공 후 알림/포인트 적립을 비동기로 분리 (7iTAX 패턴)
- **k6 / JMeter 부하 테스트** — TPS 측정 → 신한 멘토링에서 받았던 피드백 적용
- **장애 시나리오** — Redis 다운 시 결제는 어떻게 되나? (Circuit Breaker)
- **이상 거래 탐지(FDS)** — 짧은 시간 다수 결제 차단

---

## 자주 막히는 지점 모음 (트러블슈팅)

| 증상 | 원인 후보 |
|---|---|
| 401만 계속 뜸 | CSRF 비활성화 / FilterChain 순서 / `permitAll` 경로 누락 |
| Flyway가 실행 안 됨 | migration 파일명 규칙 (`V1__xxx.sql` 더블 언더스코어) |
| `LockTimeoutException` | 트랜잭션 길어짐 → 트랜잭션 안에서 외부 호출 금지 |
| 동시성 테스트가 깨짐 | `@Transactional`이 테스트 메서드에 붙어있나? (붙으면 안 됨) |
| Redis 연결 실패 | `spring.data.redis.host` 오타 / 컨테이너 미기동 |
| `@AuthenticationPrincipal`이 null | 필터에서 SecurityContext에 등록 안 했거나 등록 시점 늦음 |

---

_막히면 Step 번호 + 막힌 지점 알려주세요. 이어서 디버깅 가이드 드릴게요._