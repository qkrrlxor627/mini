# Mini Pay — 프로젝트 컨벤션

> 이 파일은 Claude가 새 대화 시작 시 자동으로 읽음. **`docs/mini-pay-guide.md` 예시 코드와 충돌 시 이 컨벤션이 우선**. 가이드는 학습 출발점, 이 컨벤션이 우리 프로젝트의 진실.
> 결정의 "왜"가 궁금하면 `docs/adr/` 참고.

---

## 데이터베이스 / 마이그레이션

- **Flyway 단방향**. V1 절대 수정 금지. 변경은 V2부터 추가만.
- 학습 중 스키마 꼬여도 `docker compose down -v`로 회복하지 말 것 — 운영 시뮬레이션이 목적. V_n 마이그레이션으로 정공법 복구.
- DB 컬럼 타입: 금액 `NUMERIC(19,4)`, 시간 `TIMESTAMPTZ`, ID `BIGSERIAL/BIGINT`, enum 매핑 `VARCHAR`.
- 통화 컬럼 `VARCHAR(3)` (ISO 4217 코드 길이 가정).
- DB-level 제약(CHECK, UNIQUE, FK)은 자바 검증의 최후 방어선이라 반드시 유지.

## 금액 / 통화

- **`Money` VO 사용**. `BigDecimal`을 엔티티/DTO에 직접 노출 금지.
- `Money` 산술은 메서드만: `add(Money)`, `subtract(Money)`, `isLessThan(Money)`, `isPositive()`, `isZero()`.
- BigDecimal `+`, `-`, `==`, `compareTo` 같은 연산자/원시 API는 `Money` 안에서만 사용.
- 정밀도 통일: scale **4**, 반올림 **`RoundingMode.HALF_EVEN`** (은행가 반올림).
- 통화는 `Currency` enum (`KRW` 디폴트). 신규 통화는 enum 확장 + 마이그레이션.
- 산술 시 통화 다르면 즉시 예외 (`requireSameCurrency`).

## 시간

- **`OffsetDateTime`** + DB `TIMESTAMPTZ`. `LocalDateTime` 금지.
- 생성 시각은 정적 팩토리 안에서 `OffsetDateTime.now()`.
- `@Column(updatable = false)` 명시.

## 엔티티 (도메인 모델)

- **setter 금지**. 정적 팩토리 메서드만 노출.
- `@NoArgsConstructor(access = AccessLevel.PROTECTED)` 필수 (JPA용 입구만 열어두고 외부 차단).
- 정적 팩토리 이름은 도메인 동사 우선: `Account.openFor`, `Transaction.charge`, `Transaction.payment`. 단순 변환은 `of`, 외부 입력 매핑은 `from`.
- 도메인 로직은 메서드로 캡슐화 (Tell, Don't Ask). `account.deduct(amount)` ↔ `if (account.balance < amount) ...` 금지.
- 도메인 메서드 안에서 외부 I/O(HTTP, 메일, Redis 등) 호출 금지 — 영속성 외 책임은 서비스로.
- Anemic Domain Model 안 만들기 — 잔액 검증·상태 전이 같은 규칙은 엔티티 책임.

## Enum 매핑

- `@Enumerated(EnumType.STRING)` **필수**. ORDINAL 절대 금지 (순서 바뀌면 데이터 손상).
- 도메인 상수 enum은 별도 파일 (`TransactionType.java`, `TransactionStatus.java`).

## JPA 설정

- `spring.jpa.hibernate.ddl-auto: validate` 고정 — 엔티티가 스키마를 정의하지 않음.
- `spring.jpa.open-in-view: false` 고정 — 트래픽 늘면 커넥션 풀 고갈 방지.
- `spring.jpa.properties.hibernate.jdbc.time_zone: Asia/Seoul`.

## DTO

- Java `record` 사용. Lombok `@Builder` 금지 (record로 충분).
- 검증은 `jakarta.validation` 어노테이션 (`@Email`, `@Size`, `@NotBlank`, `@Pattern`).
- 엔티티 ↔ DTO 변환은 정적 팩토리(`TransactionResponse.from(tx)`)나 매핑 메서드.

## 트랜잭션

- 서비스 메서드에 `@Transactional` (읽기는 `readOnly = true`).
- 트랜잭션 안에서 외부 I/O 호출 금지 — 락 점유 시간 늘어나고 롤백 어려움.
- 결제 성공 후 알림/포인트 같은 부수 작업은 `@TransactionalEventListener(phase = AFTER_COMMIT)`로 분리 (Step 8+).

## 동시성 (Step 7+)

- 잔액 변경(충전·결제)은 **비관적 락** 디폴트: `@Lock(LockModeType.PESSIMISTIC_WRITE)`.
- 사유: 재시도 부적절한 도메인(돈) + 충돌 빈번 + 트랜잭션 짧음 → 비관적 락이 적합.
- 락 잡고 외부 호출 금지 (위 트랜잭션 룰과 동일).

## 멱등성 (Step 8+)

- 결제 API는 `Idempotency-Key` 헤더 필수.
- **Redis SETNX(빠른 1차) + DB UNIQUE(최후 방어선)** 이중 방어.
- Redis 장애 시 결제는 살아있어야 함 → DB UNIQUE가 최종 차단.
- TTL 10분 디폴트.

## 에러 핸들링

- 도메인 예외는 `RuntimeException` 상속한 도메인 클래스 (`InsufficientBalanceException`, `DuplicateEmailException`, `InvalidCredentialsException` 등).
- HTTP 매핑은 `@ControllerAdvice`에서 일괄 처리. 예외 던지는 곳에서 HTTP 코드 알 필요 없게.
- 인증 실패는 "이메일 없음/비번 틀림" 같은 응답 — 계정 존재 여부 노출 금지.

## 테스트

- 도메인 메서드(잔액 차감 등) → 단위 테스트.
- 동시성·멱등성 → 통합 테스트 (`@SpringBootTest` + 실제 DB/Redis).
- 통합 테스트 메서드에 `@Transactional` 붙이지 말 것 (롤백 자동화 → 동시성 깨짐).
- Mock 대신 가능하면 `@SpringBootTest`로 진짜 동작 검증.

## 패키지 구조

- `com.minipay.domain` — 엔티티, VO, 도메인 예외
- `com.minipay.repository` — JpaRepository 인터페이스
- `com.minipay.service` — 비즈 로직 (`@Service`, `@Transactional`)
- `com.minipay.controller` — 컨트롤러 (`@RestController`)
- `com.minipay.dto` — 요청/응답 record
- `com.minipay.security` — JWT, SecurityConfig
- `com.minipay.config` — 그 외 Spring Configuration
- `com.minipay.exception` — `@ControllerAdvice` 등 횡단 관심사

## 학습 진행 룰

- 진행 상황은 `docs/progress.md`. 새 대화 시작 시 먼저 읽기.
- 매 Step 진입 시: "이번에 새로 등장하는 결정 N개" 짚고 → N=0이면 컨벤션 따라 코드, N>0이면 짧게 토론 후 ADR 추가.
- Step 종료 시: 💭 고민의 흔적 답변 정리 + 필요 시 ADR 작성.
