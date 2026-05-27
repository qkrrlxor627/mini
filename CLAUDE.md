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

- 잔액 변경(충전·결제·이체)은 **비관적 락** 디폴트: `@Lock(LockModeType.PESSIMISTIC_WRITE)`.
- 사유: 재시도 부적절한 도메인(돈) + 충돌 빈번 + 트랜잭션 짧음 → 비관적 락이 적합.
- **이체는 두 계정 락** — 송금자/수신자 동시 `PESSIMISTIC_WRITE`. 데드락 회피용으로 `account_id` 오름차순 정렬 후 락 획득 (ADR 0006).
- 락 잡고 외부 호출 금지 (위 트랜잭션 룰과 동일).
- **JPA 1차 캐시 함정** — 같은 트랜잭션 내에서 동일 엔티티를 비락 조회 후 `PESSIMISTIC_WRITE`로 다시 조회하면, Hibernate가 1차 캐시 객체를 반환해 **`SELECT FOR UPDATE`가 발동하지 않음**. 락이 필요한 행을 미리 비락 조회로 영속화 금지. 송금자 ID 식별 같은 경우 엔티티 대신 ID projection 사용 (`findIdByUserId`).

## 멱등성 (Step 8+)

- 충전·결제·이체 API는 `Idempotency-Key` 헤더 필수 (충전은 ADR 0012로 확장 — 돈 들어오는 쓰기라 중복 위험 동일).
- **Redis SETNX(빠른 1차) + DB UNIQUE(최후 방어선)** 이중 방어. Redis prefix는 작업별 분리(`idem:charge:`/`idem:payment:`/`idem:transfer:`).
- Redis 장애 시 충전/결제/이체는 살아있어야 함 → DB UNIQUE가 최종 차단.
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

## 코드 리뷰 체크리스트

> PR/커밋 리뷰 시 "ADR과 컨벤션이 코드에 일관되게 반영됐는지" 검증. 각 항목은 위반 발견 시 거절/수정 사유. 결정 근거가 궁금하면 태그된 ADR로 이동.

### 도메인 모델 / 금액
- `[ADR-0001]` `BigDecimal` 직접 비교(`==`, `equals`)/산술 발견 시 거절 — `Money` 메서드(`isLessThan`, `add`, `subtract`)만 허용. Money 외부에 `BigDecimal` 누출 금지.
- `[ADR-0001]` `Money` 산술 시 `requireSameCurrency` 호출 흐름 확인 — 통화 다르면 즉시 예외.
- `[ADR-0001]` scale 4 / HALF_EVEN 보장 — Money 생성 경로에서 `setScale` + DB `NUMERIC(19,4)` + 엔티티 `precision=19, scale=4` 일관 확인.
- `[ADR-0002]` enum 필드에 `@Enumerated(EnumType.STRING)` 누락 — 기본값 ORDINAL 위험. 무조건 명시.
- `[ADR-0002]` enum 선언 순서 변경 PR — STRING 매핑이라 DB는 안전하지만 `values()` 순회/리포트 정렬 의존성 검토 요구.
- `[ADR-0003]` setter / Lombok `@Builder` / `@AllArgsConstructor` 신설 — 전부 거절. 정적 팩토리 메서드 + `@NoArgsConstructor(PROTECTED)`만.
- `[ADR-0003]` 정적 팩토리 5단계 순서(검증 → `new` → 필드 → 시간 → return) 누락 — 특히 검증 누락 시 부분 채움 객체 누수.
- `[ADR-0003]` 시간 처리에 `LocalDateTime` 사용 — `OffsetDateTime` 강제 (DB `TIMESTAMPTZ` 정합).
- `[ADR-0005]` Transaction/Account가 다른 애그리거트를 `@ManyToOne` 객체 참조 — ID 참조(`Long ...Id`)만. open-in-view false + N+1 회피.
- `[ADR-0006]` 이체 거래에서 송금자/수신자를 별도 행 또는 별도 테이블로 분리 PR — 단일 행 + `counterparty_account_id` 만 허용. 차변/대변 분리 필요 시 ADR 재검토 후 도입.

### JPA / 매핑
- `@Embedded` Money 컬럼명이 V_n 마이그레이션과 미스매치 — `@AttributeOverrides`로 명시. `ddl-auto: validate`라 부팅 시 즉시 터짐.
- `@Column(updatable = false)` 누락 (`createdAt` 등 불변 컬럼) — 사후 UPDATE로 감사 추적 깨짐.
- 도메인 메서드 안에서 외부 I/O(HTTP, 메일, Redis) 호출 — 영속성 외 책임은 서비스로 이전 요구.
- 조회 메서드에 `@Transactional(readOnly = true)` 누락 — 성능·의도 명시.

### 마이그레이션
- `[ADR-0004]` V1 수정 PR — 즉시 거절. 체크섬 깨짐 → CI/협업자 환경 동기화 실패.
- 파일명 `V<숫자>__<설명>.sql` 규칙(더블 언더스코어) 위반.
- DB CHECK / UNIQUE / FK 제약 누락 — 자바 검증의 최후 방어선. 신규 컬럼이면 V_n에 제약 명시.

### 트랜잭션 / 동시성 (Step 7+)
- `@Transactional` 메서드 안 외부 I/O — 락 점유 시간↑, 롤백 어려움. AFTER_COMMIT 이벤트로 분리 요구.
- 잔액 변경(충전/결제/이체)에 `@Lock(PESSIMISTIC_WRITE)` 누락 — 동시 결제 시 잔액 음수.
- 이체에서 송금자/수신자 락 획득 순서 미정렬 — `account_id` 오름차순 강제. 미정렬 시 데드락.
- 락 잡고 외부 호출 — 위 룰과 동일하게 거절.

### 멱등성 (Step 8+)
- 충전·결제·이체 API에 `Idempotency-Key` 헤더 검증 누락 — 중복 충전/결제/이체 (충전 포함은 ADR 0012).
- Redis SETNX만 있고 DB `UNIQUE(idempotency_key)` 없음 — 이중 방어 무력화.
- 멱등 키 TTL 누락 — 키 무한 누적.

### 보안 (Step 5~6+)
- 비밀번호/PIN 평문 저장 또는 평문 비교 — BCrypt 해싱 후 `passwordHash`/`pinHash`에만.
- 인증 실패에서 "이메일 없음" vs "비번 틀림" 구분 응답 — `InvalidCredentialsException`으로 통일, 계정 존재 노출 금지.
- 로그에 JWT 토큰/세션 ID/PIN/평문 비번 출력 — 즉시 거절.

### DTO / API
- 컨트롤러에서 엔티티 직접 리턴 — DTO `record`로 변환 강제. 내부 구조/순환 직렬화/N+1 회피.
- DTO에 Lombok `@Builder` — Java `record`로 충분, 거절.
- 요청 DTO에 `jakarta.validation` 어노테이션(`@Email`, `@NotBlank`, `@Size`, `@Pattern`) 누락.

### 에러
- 도메인 예외가 HTTP 코드를 알고 있음(서비스/도메인에서 `ResponseEntity` 반환 등) — `@ControllerAdvice`에서 일괄 매핑 강제.
- 도메인 예외가 익명 `RuntimeException` 또는 `IllegalStateException` 일반화 — 명명 클래스(`InsufficientBalanceException` 등) 사용.

### 테스트
- 동시성/멱등성 통합 테스트에 `@Transactional` — 롤백 자동화가 동시성 깸. 제거 요구.
- 도메인 핵심 로직(잔액 차감 등)을 mock으로 검증 — 가능하면 실제 동작(`@SpringBootTest`)으로.

### 주석 / 가독성
- WHAT 주석(코드 한국어 번역) — 삭제 권고. 잘 지은 이름이 WHAT을 대신함.
- "issue #N 때문에 추가", "X 호출자용" 같은 호출자/티켓 언급 — PR 설명으로 이전. 코드는 진화에 맡김.
- 좋은 주석만 통과: 도메인 불변식, 숨은 제약, 특정 버그 우회, 독자가 놀랄 동작.

## 학습 진행 룰

- 진행 상황은 `docs/progress.md`. 새 대화 시작 시 먼저 읽기.
- 매 Step 진입 시: "이번에 새로 등장하는 결정 N개" 짚고 → N=0이면 컨벤션 따라 코드, N>0이면 짧게 토론 후 ADR 추가.
- Step 종료 시: 💭 고민의 흔적 답변 정리 + 필요 시 ADR 작성.
