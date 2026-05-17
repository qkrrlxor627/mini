# Mini Pay 학습 진행 상황

> **마지막 업데이트**: 2026-05-17
> **가이드**: `docs/mini-pay-guide.md`
> **컨벤션**: `CLAUDE.md` (프로젝트 루트)
> **ADR**: `docs/adr/`
> **플랜**: `C:\Users\SSAFY\.claude\plans\gentle-snuggling-hartmanis.md` (Step 4)

---

## 🎯 현재 위치

**Step 8-A 완료 — 결제 API + 멱등성 이중 방어(Redis SETNX + DB UNIQUE) + ADR 0009/0010. 검증 6종 통과. 다음은 Step 8-B 이체 API (두 계정 락 정렬, ADR 0011 후보).**

### 완료
- 사전 인프라: `CLAUDE.md` + `docs/adr/README.md` 작성
- `application.yml`에 `open-in-view: false` 추가
- `V2__money_value_object.sql` 작성 (Money VO 컬럼 분할 — `amount_amount`/`amount_currency`, `balance_after_amount`/`balance_after_currency`)
- 샘플 자바: `Currency.java`, `Money.java`(VO), `Account.java`, `InsufficientBalanceException.java`
- `TransactionType.java` ✅ (CHARGE/PAYMENT, [주석 목적] 블록 포함)
- `TransactionStatus.java` ✅ (SUCCESS/FAILED, [주석 목적] 블록 포함, PENDING은 동기 처리라 미도입)
- `User.java` ✅ (필드 6개 + 정적 팩토리 `register` 본문 완성, 2차 채점 통과 — 검증 4번 반복은 헬퍼 추출 안 하고 그대로 둠)
- 주석 채점 워크플로우 정착: 본 코드 정리 + 파일 하단 `[주석 목적]` 블록으로 학습 흔적 보존
  (메모리에 feedback으로 저장됨)
- **ADR 0001~0005 작성 완료 (2026-05-08)**:
  - 0001 — Money Value Object 도입
  - 0002 — Enum + EnumType.STRING 매핑
  - 0003 — 정적 팩토리 메서드 vs Builder
  - 0004 — Flyway 단방향 마이그레이션 정책
  - 0005 — Transaction은 Account를 ID로 참조
- **ADR 0006 작성 + 이체 기능 추가 (2026-05-14)**:
  - 0006 — 이체(TRANSFER) 거래는 단일 행으로 표현 (counterparty_account_id 컬럼)
  - V3__transfer.sql (counterparty 컬럼 + CHECK 2종 + 부분 인덱스)
  - TransactionType.TRANSFER + Transaction.transfer() 정적 팩토리
  - 문서 갱신: ready.md (송금 제외 해제 + ERD + 명세 + 테이블 스펙) / sql.md / CLAUDE.md (동시성·멱등성 룰 + 리뷰 체크리스트) / uShould.md (Step 8/9/10 + ADR 번호 0007~0010로 재정렬)
- **학습 자산 문서 2종 추가 (2026-05-11)**:
  - `docs/uLearn.md` — 완성 시 보유할 학습 자산 인덱스(동시성/멱등성/도메인/JPA/보안/운영) + 면접 질문 매핑
  - `docs/uShould.md` — Step 4~11에서 채워야 할 산출물(패키지·파일 단위 30~40개) + ADR 0006~0009 후보

### 진행 중 — `compileJava` + 머지만
- `Transaction.java` ✅ (필드 9개 + `charge`/`payment` 본문 완성, 1차 채점 통과)
  - `@Embedded` Money 컬럼명 V2 마이그레이션과 일치 (`amount_amount`, `balance_after_amount`)
  - `idempotencyKey` / `merchantId` 검증은 엔티티 레벨에서 의도적 생략 — Step 8 결제 API Controller에서 책임
  - 사용자가 `@ManyToOne` 버전을 먼저 시도했었음 → A안(ID 참조)로 재작성됨
  - 채점 흔적: 파일 하단 `[주석 목적]` 블록에 스캐폴드 주석 9종 분석 보존

### 미작성
- 모니터링 스택(Actuator/Prometheus/Grafana) — 가이드에 없음. 완주 후 면접 답변지 보강용 확장 후보.

### 결정 사항 (Step 3, ADR로 모두 기록 완료)
- ADR 0001: Money VO 도입 (`@Embeddable` + `Currency` enum, scale 4 / HALF_EVEN)
- ADR 0002: type/status는 Enum + `@Enumerated(EnumType.STRING)` (ORDINAL 절대 금지)
- ADR 0003: 정적 팩토리 메서드만 노출 (setter/Builder 금지, 도메인 동사 이름)
- ADR 0004: Flyway 단방향 (V1 수정 금지, `down -v` 회복 금지)
- ADR 0005: Transaction → Account는 ID 참조 (`Long accountId`)
- 진행 방식: Claude 샘플 → 사용자 따라 쓰기 + 주석 채점 워크플로우 병행

### 다음 액션 (다음 세션 시작 시)
1. **Step 8-A 커밋** — 메시지 초안: "Step 8-A: 결제 API + 멱등성 이중 방어 + ADR 0009/0010".
2. **Step 8-B 진입 — 이체 API** (`POST /api/v1/transfers`):
   - `TransferService` — IdempotencyStore에 `tryAcquireTransfer` 추가(prefix `idem:transfer:`)
   - 두 계좌 락: `account_id` 오름차순 정렬 후 `PESSIMISTIC_WRITE` 획득 — 데드락 회피
   - `InvalidTransferTargetException` (자기 자신 / 통화 불일치 / 수신자 부재)
   - 응답 = 송금자 차감 후 잔액 + 거래 1건(송금자 시점)
   - ADR 0011 — 두 계정 락 순서 정렬 규칙 분리 (ADR 0006 후속)
3. **Step 9 진입 — 거래내역 조회 API** (Step 8-B 완료 후):
   - `TransactionRepository.findByAccountIdOrCounterpartyAccountId(myAccountId, myAccountId, Pageable)` — 송금자/수신자 양쪽 시점 (ADR 0006). 부분 인덱스 `idx_transactions_counterparty_id_created_at` 활용.
   - `TransactionResponse.from(tx, myAccountId)` — 이체 시 `direction` 필드(SENT/RECEIVED) 계산

---

## 🔁 진행 사이클 (모든 Step 동일)

1. Claude가 Step 목표/주의사항/자주 막히는 지점 안내
2. 사용자가 코드 작성 후 공유
3. Claude 검증 (가이드 일치 여부, 컨벤션, 보안)
4. 💭 고민의 흔적 Q&A로 마무리 (면접 답변 형태로 정리)

---

## 🗂 전체 로드맵

- [x] **Step 0 — 환경 세팅** ✅ 완료
  - [x] 1) `docker-compose.yml` 작성 ✅ (postgres + redis 정상 기동)
  - [x] 2) Spring Boot 프로젝트 생성 ✅ (3.5.14, Java 17, 의존성 8종)
  - [x] 3) `./gradlew bootRun` 부팅 확인 ✅ (3.577초 부팅, postgres/flyway/tomcat 모두 정상)
  - [ ] 💭 고민 답변 (나중에 한꺼번에)
- [x] **Step 1 — 의존성 + 설정 파일** ✅ 완료 (build.gradle에 springdoc/jjwt 추가, application.yml 작성)
- [x] **Step 2 — Flyway 마이그레이션 (3테이블)** ✅ 완료
  - [x] V1__init.sql 작성 (NUMERIC(19,4) + TIMESTAMPTZ)
  - [x] sql.md (ERD Cloud용 MySQL 버전) 동기화
  - [x] `./gradlew bootRun`으로 마이그레이션 통과 확인 (2026-04-29 14:27)
- [ ] **Step 3 — 엔티티 작성** ⬅️ 진행 중 (이체 확장 + 빌드 검증 + 머지만 남음)
  - [x] V2__money_value_object.sql (Money VO 컬럼 분할)
  - [x] Currency / Money(VO) / Account / InsufficientBalanceException (샘플)
  - [x] TransactionType (CHARGE/PAYMENT)
  - [x] TransactionStatus (SUCCESS/FAILED)
  - [x] User.java (필드 6개 + register 본문 ✅)
  - [x] Transaction.java (스캐폴드 + charge/payment 본문 ✅, 1차 채점 통과)
  - [x] ADR 0001~0005 작성
  - [x] uLearn.md / uShould.md 작성
  - [x] `.\gradlew clean compileJava` + `.\gradlew build` 모두 BUILD SUCCESSFUL ✅
  - [x] step-3-entities 커밋 `b5ec888` 푸시 ✅
  - [x] CLAUDE.md `## 코드 리뷰 체크리스트` 섹션 추가 (ADR 트레이서형, 30 항목)
  - [x] **이체 기능 추가 (2026-05-14)** — V3 마이그레이션 + TransactionType.TRANSFER + Transaction.transfer() + ADR 0006
  - [ ] 빌드 검증 (`.\gradlew clean compileJava` + `build`) — V3 적용 + Hibernate validate
  - [ ] step-3-entities → main 머지
- [ ] **Step 4 — 회원가입 API** ⬅️ 진행 중 (코드 완료, 부팅+curl 검증 남음)
  - [x] Repository 2개 (`UserRepository.existsByEmail`/`findByEmail`, `AccountRepository`)
  - [x] DTO 3개 (`SignupRequest` 검증 4종, `SignupResponse.from(user)`, `ErrorResponse.of(code, msg)`)
  - [x] `DuplicateEmailException` (RuntimeException 상속, 명명 클래스)
  - [x] `GlobalExceptionHandler` 핸들러 4종 (Duplicate / Validation / IllegalArgument / fallback)
  - [x] `SecurityConfig` Step 4 임시 (csrf disable + STATELESS + `/api/v1/auth/**` permitAll)
  - [x] `AuthService.signup` (`@Transactional` + BCrypt + User+Account 같은 트랜잭션)
  - [x] `AuthController` POST `/api/v1/auth/signup` (`@Valid` + 201)
  - [x] ADR 0007 작성 + README 인덱스 갱신
  - [x] `.\gradlew clean compileJava` BUILD SUCCESSFUL
  - [ ] `.\gradlew build` (Hibernate validate, docker 떠야 함)
  - [ ] `bootRun` + curl 시나리오 4종
- [x] **Step 5 ⚠️ — Spring Security + JWT 필터** ✅ 완료 (2026-05-15)
  - [x] `JwtTokenProvider` (jjwt 0.12.6 API, HS256, `sub=userId`)
  - [x] `JwtTokenProviderTest` 2건 (round-trip + ExpiredJwtException)
  - [x] `JwtAuthenticationFilter` (`OncePerRequestFilter`, catch 후 EntryPoint 위임)
  - [x] `JwtAuthenticationEntryPoint` (401 + `ErrorResponse` JSON, `ObjectMapper` Bean 주입)
  - [x] `SecurityConfig` 확장 (`addFilterBefore` + `exceptionHandling`)
  - [x] ADR 0008 — JWT stateless 인증 (claim 구조 / refresh 미도입 / DB 조회 없음 / 401 명시화)
  - [x] 검증: build (3 tests pass) + bootRun + curl 4종 (401 토큰없음 / 401 잘못된 토큰 / 201 가입 회귀 / 200 swagger 회귀)
  - [x] **트러블슈팅**: Flyway V3 checksum mismatch 발견 → `.gitattributes`로 LF 강제 + DB 체크섬 NULL → 재계산. 학습 가치 큰 함정.
- [x] **Step 6 — 로그인 API** ✅ 완료 (2026-05-15)
  - [x] `LoginRequest`/`LoginResponse` record DTO
  - [x] `InvalidCredentialsException` (이메일 없음/비번 틀림 통합 — ADR-0007 보안 룰)
  - [x] `AuthService.login()` (`readOnly = true`, BCrypt matches, `JwtTokenProvider.issue`)
  - [x] `AuthController.login()` POST `/api/v1/auth/login`
  - [x] `GlobalExceptionHandler` 핸들러 2종 추가: `InvalidCredentialsException → 401`, `NoResourceFoundException → 404`
  - [x] 검증 5종: 정상 가입+로그인 200 + JWT 발급 / 잘못된 비번 401 / 없는 이메일 401(동일 응답) / 토큰+매핑없는 경로 404 NOT_FOUND / 토큰없음+매핑없는 경로 401(필터가 먼저 잡음)
  - [x] **부수 발견**: ADR-0007 fallback 로깅 보강이 즉각 가치 발휘 — `NoResourceFoundException`을 단 1회 호출로 식별 가능. 진단→픽스 5분 컷.
- [x] **Step 8-A — 결제 API + 멱등성** ✅ 완료 (2026-05-17)
  - [x] ADR 0009 — 비관적 락 선택 (낙관적 락 비교, 면접 답변지 깊이)
  - [x] ADR 0010 — 멱등성 Redis SETNX(1차) + DB UNIQUE(최후 방어) 이중 방어 / TTL 10분 / 응답 캐시 = DB 재조회 / Redis 장애 fallback / 같은 키+다른 본문 → 409
  - [x] `MissingIdempotencyKeyException` (400) + `IdempotencyKeyConflictException` (409)
  - [x] `PaymentRequest` (`@NotBlank merchantId` + `@DecimalMin(1) amount`) / `PaymentResponse.from(tx)`
  - [x] `IdempotencyStore` — `StringRedisTemplate.opsForValue().setIfAbsent` + Duration TTL 10분 + Redis 장애 시 `true` fallback + `log.warn`
  - [x] `TransactionRepository.findByIdempotencyKey` 추가
  - [x] `PaymentService.pay()` — ① 비관적 락 조회 ② findByIdempotencyKey → 본문 일치 검증 (replay or 409) ③ tryAcquirePayment ④ deduct ⑤ saveAndFlush + DataIntegrityViolationException catch → 재조회 self-heal
  - [x] `PaymentController.pay()` POST `/api/v1/payments` + `@RequestHeader("Idempotency-Key", required=false)` + 빈 값 검증 → `MissingIdempotencyKeyException`
  - [x] `GlobalExceptionHandler`: `MissingIdempotencyKey → 400`, `IdempotencyKeyConflict → 409` + `InsufficientBalance` 메시지 명시화("잔액이 부족합니다")
  - [x] 검증 6종 전부 통과:
    - 정상 결제 2000 → 200 (잔액 8000)
    - 같은 키+같은 본문 → 200 첫 응답 그대로 (transactionId=4 동일)
    - 같은 키+다른 본문 → 409 IDEMPOTENCY_KEY_CONFLICT
    - 멱등키 누락 → 400 MISSING_IDEMPOTENCY_KEY
    - 잔액 부족 → 400 INSUFFICIENT_BALANCE
    - 신규 키+정상 결제 1000 → 200 (잔액 7000)
  - [x] DB 검증: accounts.balance=7000, transactions 3건(CHARGE+PAYMENT 2건), 멱등키 정확히 2건 + 부족 시도 1건 Redis만 남음 (ADR-0010 "Redis 키만 남고 거래 없음" 케이스 자체 검증)
- [x] **Step 7 — 잔액 충전 API** ✅ 완료 (2026-05-17)
  - [x] `AccountNotFoundException` (404 매핑, 명명 클래스)
  - [x] `AccountRepository.findByUserIdForUpdate()` — `@Lock(PESSIMISTIC_WRITE)` + `@Query` **첫 등장**
  - [x] `TransactionRepository` 신설
  - [x] `ChargeRequest` (`@NotNull` + `@DecimalMin(1)` + `@Digits(15,4)`) / `ChargeResponse.from(tx)`
  - [x] `AccountService.charge()` (`@Transactional` + 비관적 락 + `account.charge(money)` + `Transaction.charge` 기록, KRW 고정)
  - [x] `AccountController.charge()` POST `/api/v1/accounts/charge` — `@AuthenticationPrincipal Long userId` **첫 실전**
  - [x] `GlobalExceptionHandler`: `AccountNotFoundException → 404`, `InsufficientBalanceException → 400` 추가
  - [x] 검증 5종: 정상 충전 10000 200 / 추가 충전 5000 → 잔액 누적 15000 ✅ / 0원 400 VALIDATION_FAILED / 토큰없음 401 / 잘못된 토큰 401
  - [x] **부수 발견**: PowerShell curl이 한국어 본문을 cp949로 보내 `JSON parse error: Invalid UTF-8 middle byte 0xe6` 발생 → fallback `log.error`(ADR-0007) 한 줄로 5초 진단. 픽스: ASCII 이름으로 우회 (앱은 무관). 면접 답변지 소재.
  - [x] 새 결정 0개 — 비관적 락(ADR 0006 컨텍스트) / KRW 고정(ADR 0007) / 명명 예외(컨벤션) 모두 기존 결정 적용. ADR 추가 없음.
- [ ] **Step 8-B — 이체 API** (두 계정 락 정렬 — ADR 0011 후보)
  - 자기 자신 이체 거부 (`InvalidTransferTargetException`)
  - 송금자/수신자 `account_id` 오름차순 정렬 후 PESSIMISTIC_WRITE 획득 (데드락 회피)
  - `TransferService` — 멱등성 패턴은 `PaymentService`와 공통 (IdempotencyStore 키 prefix만 `idem:transfer:`로 추가 예정)
  - 검증 4종: 정상 이체 / 자기 자신 거부 / 잔액 부족 / 같은 키 두 번
- [ ] Step 9 — 거래내역 조회 API
- [ ] Step 10 ⭐ — 동시성 통합 테스트
- [ ] Step 11 — Swagger 시나리오 검증

---

## 👤 사용자 컨텍스트

- Docker, Spring Boot, Gradle 모두 **처음**
- 선수 학습 자료(Docker 입문 영상 등) 추천했으나 일단 가이드 따라가며 학습 중
- 한국어로 진행
- 목표: 코드 + "💭 고민의 흔적" 답변까지 채워서 **면접 답변지**로 활용

---

## 💬 마지막 대화 요약

### 2026-05-17 (저녁) — Step 8-A: 결제 API + 멱등성 이중 방어

1. **진입 결정** — Step 8은 결제+이체 한 묶음(uShould.md/ready.md)이지만 작업량 큰 만큼 **결제(8-A) → 이체(8-B) 분할 진입**. 새 결정 2개 식별 → ADR 0009/0010 사전 박고 코드.
2. **ADR 0009 — 비관적 락 선택**: CLAUDE.md/Step 7 첫 실전을 정식 ADR로 격상. 낙관적 락(@Version+재시도) 부적합 이유 — 재시도 UX 손상, 한도 정책 부담, 같은 계좌 충돌 가정이 더 현실적. PESSIMISTIC_WRITE 한 종 통일(READ 안 씀, 결국 UPDATE). 락 메서드는 이름에 의도 박음(`findByUserIdForUpdate`). 트랜잭션 안 외부 I/O 금지 룰 재확인. 재검토 신호 4종.
3. **ADR 0010 — 멱등성 Redis SETNX + DB UNIQUE 이중 방어**: Stripe API와 유사한 패턴. 응답 캐시는 **DB 재조회**로 통일(SSoT). TTL 10분(더블 클릭/재시도 윈도우). Redis 장애 시 `true` fallback + log.warn → 가용성 우선, DB UNIQUE가 최후 방어. 같은 키+다른 본문 → 409 IDEMPOTENCY_KEY_CONFLICT. 자기치유 패턴: DataIntegrityViolationException → findByIdempotencyKey 재조회.
4. **파일 11종 작성**:
   - `exception/MissingIdempotencyKeyException` (400) / `IdempotencyKeyConflictException` (409)
   - `dto/PaymentRequest` (`@NotBlank merchantId` + `@DecimalMin(1) amount`) / `PaymentResponse.from(tx)`
   - `service/IdempotencyStore` — Redis 래퍼, `tryAcquirePayment(key)` + `idem:payment:` prefix + Duration TTL 10분 + DataAccessException catch
   - `repository/TransactionRepository` — `findByIdempotencyKey` 추가
   - `service/PaymentService` — 비관적 락 → DB 재조회(replay) → SETNX → deduct → saveAndFlush → DataIntegrityViolationException self-heal
   - `controller/PaymentController` — POST `/api/v1/payments` + `@RequestHeader("Idempotency-Key", required=false)` + 빈 값 검증
   - `exception/GlobalExceptionHandler` — `MissingIdempotencyKey → 400 MISSING_IDEMPOTENCY_KEY`, `IdempotencyKeyConflict → 409 IDEMPOTENCY_KEY_CONFLICT`. `InsufficientBalance` 메시지 명시화("잔액이 부족합니다") — 도메인 예외 자체엔 메시지 없음.
   - `docs/adr/0009-pessimistic-locking.md` + `0010-idempotency-dual-defense.md` + README 갱신
5. **컴파일 + 빌드** — `compileJava` 14s, `build` 16s (3 tests + Hibernate validate). 둘 다 BUILD SUCCESSFUL.
6. **부팅 + 검증 6종 전부 ✅**:
   - 정상 결제 2000 → 200 (transactionId=4, balance=8000)
   - 같은 키+같은 본문 → 200 첫 응답 그대로 (transactionId=4 동일, **replay**)
   - 같은 키+다른 본문(merchantId M-002) → 409 IDEMPOTENCY_KEY_CONFLICT
   - 멱등키 누락 → 400 MISSING_IDEMPOTENCY_KEY
   - 잔액 부족(잔액 8000인데 100000 요청) → 400 INSUFFICIENT_BALANCE
   - 신규 키+정상 결제 1000 → 200 (balance=7000)
7. **DB + Redis 직접 확인** — accounts.balance=7000.0000, transactions 3건(CHARGE 10000 + PAYMENT 2000 + PAYMENT 1000), 멱등키 정확히 2건만 저장(idempotency_key는 PAYMENT만, CHARGE는 NULL). Redis에는 3개 키(`pay-...-1`, `pay-...-2`, `pay-...-3`) — `-2`는 잔액 부족 시도라 거래는 없지만 SETNX 통과 후 deduct에서 거절돼서 Redis 키만 남음. **ADR 0010의 "Redis 키만 남고 거래 없음" 케이스 자체 검증** 성공.
8. **함정 + 우회** — git bash에 `uuidgen` 없음 → 타임스탬프 기반 키(`pay-$(date +%s%N)-N`)로 우회. 면접 답변지 소재 아님(환경 차이일 뿐).
9. **새 결정 2개 → ADR 2장** 박힘. 면접 답변지 깊이용 자료 확보. 다음은 Step 8-B 이체 + ADR 0011(두 계정 락 정렬).

### 2026-05-17 — Step 7: 잔액 충전 API + 비관적 락 첫 등장

1. **진입 결정** — 새 결정 0개 확인(비관적 락 = ADR 0006 컨텍스트, KRW 고정 = ADR 0007, 명명 예외 = 컨벤션). plan mode 안 거치고 컨벤션대로 진행.
2. **파일 8종 일괄 작성**:
   - `exception/AccountNotFoundException.java` (RuntimeException 상속)
   - `repository/AccountRepository.java` — `findByUserIdForUpdate(Long userId)` + `@Lock(LockModeType.PESSIMISTIC_WRITE)` + `@Query("select a from Account a where a.userId = :userId")` (**비관적 락 첫 등장**)
   - `repository/TransactionRepository.java` (베어 JpaRepository, Step 9에서 확장 예정)
   - `dto/ChargeRequest.java` — record + `@NotNull` + `@DecimalMin("1")` + `@Digits(15,4)`
   - `dto/ChargeResponse.java` — record + `from(Transaction tx)` 정적 팩토리 (transactionId/amount/balanceAfter/currency/createdAt)
   - `service/AccountService.java` — `@Transactional` + 비관적 락 조회 + `Money.of(req.amount(), Currency.KRW)` + `account.charge(money)` + `Transaction.charge(account.getId(), amount, account.getBalance(), null)` + `transactionRepository.save(tx)` → `ChargeResponse.from(saved)`
   - `controller/AccountController.java` — POST `/api/v1/accounts/charge` + `@AuthenticationPrincipal Long userId` (**Step 5 인프라 첫 실전**) + `@Valid` + 200
   - `exception/GlobalExceptionHandler.java` 확장: `AccountNotFoundException → 404 ACCOUNT_NOT_FOUND`, `InsufficientBalanceException → 400 INSUFFICIENT_BALANCE` (Step 8 결제에서 즉시 활용 예정)
3. **컴파일 + 빌드** — `.\gradlew clean compileJava` BUILD SUCCESSFUL 15s, `.\gradlew build` BUILD SUCCESSFUL (3 tests pass + Hibernate validate 통과).
4. **부팅 + 검증 5종 전부 ✅**:
   - 정상 10000 → 200, balanceAfter=10000.0000 (Money scale 4)
   - 추가 5000 → 200, balanceAfter=**15000.0000 (잔액 누적)** — 같은 트랜잭션 내 비관적 락 정상 동작
   - 0원 → 400 VALIDATION_FAILED ("amount: 금액은 1 이상이어야 합니다")
   - 토큰 없음 → 401 UNAUTHORIZED (Filter → EntryPoint)
   - 잘못된 토큰 → 401 UNAUTHORIZED (JwtException catch → 인증 미설정 → EntryPoint)
5. **DB 직접 확인** — `accounts.balance_amount=15000.0000` / `transactions` 2건(CHARGE 10000 → balanceAfter 10000 / CHARGE 5000 → balanceAfter 15000) 모두 SUCCESS. `Transaction.charge` 정적 팩토리 + `Money` `@Embedded` 컬럼명 매핑 정합 확인.
6. **함정 발견 + 즉시 진단** — PowerShell `curl.exe`가 한국어 본문(`"name":"충전테스트"`)을 cp949로 인코딩해 전송 → 서버에서 `JSON parse error: Invalid UTF-8 middle byte 0xe6` → HttpMessageNotReadableException → fallback handler가 500 INTERNAL_ERROR 응답. ADR-0007 fallback `log.error` 한 줄로 **진단 5초 컷**. 픽스: 테스트 이름을 ASCII `"ChargeTest"`로 변경 (앱 코드는 정상). 면접 답변지 소재 — "운영에선 PowerShell이 호출 안 하지만 학습 환경에서 클라이언트 인코딩 함정 학습".
7. **새 결정/ADR 없음** — 의도대로 Step 7은 기존 결정의 첫 실전 적용만. ADR 0009는 Step 8 멱등성에서 작성 예정.
8. **남은 일** — Step 7 단독 커밋 → Step 8 결제 API + 멱등성 진입.

### 2026-05-15 (밤) — Step 6: 로그인 API + 404 핸들러 추가

1. **Step 5 커밋 보류 결정** — 사용자 C 선택. Step 5 + Step 6 묶음 커밋으로 갈 예정.
2. **Step 6 plan 텍스트로** — 새 결정 0개라 plan mode 안 거치고 진행 (Step 4/5 패턴 일관성보다 빠른 진행 우선). 산출물: DTO 2 + 예외 1 + 기존 3 수정.
3. **코드 작성**:
   - `dto/LoginRequest` record (`@Email @NotBlank` / `@NotBlank`)
   - `dto/LoginResponse` record (`accessToken`, `expiresIn` 초 단위)
   - `exception/InvalidCredentialsException` (이메일 없음/비번 틀림 통일 — ADR-0007 보안 룰)
   - `AuthService.login()` 추가 (`@Transactional(readOnly = true)` + `findByEmail` + `passwordEncoder.matches` + `jwtTokenProvider.issue` + `expiresIn = jwtExpirationMs / 1000`)
   - `AuthController.login()` 추가
   - `GlobalExceptionHandler`에 `InvalidCredentialsException → 401 INVALID_CREDENTIALS` 핸들러
4. **빌드** — BUILD SUCCESSFUL (3 tests).
5. **검증 5종**:
   - 가입+로그인 → 200 + JWT (sub=4, exp 1시간) ✅
   - 잘못된 비번 → 401 INVALID_CREDENTIALS ✅
   - 없는 이메일 → 401 동일 응답 ✅ (계정 존재 노출 금지)
   - **토큰 + 매핑 없는 경로 → 처음엔 500 INTERNAL_ERROR**
6. **함정 발견 + 즉시 진단**:
   - bootRun 로그(우리 fallback의 `log.error`)에 정확한 예외 즉시 노출: `NoResourceFoundException: No static resource api/v1/accounts/me`
   - **ADR-0007의 fallback 로깅 보강이 실증 가치 발휘** — `swaggerTroubleShoot0515`에서 보강한 한 줄(`log.error`)로 진단이 5분 컷.
   - 픽스: `GlobalExceptionHandler`에 `@ExceptionHandler(NoResourceFoundException.class) → 404 NOT_FOUND` 한 핸들러 추가.
7. **재빌드 + 재검증**:
   - 토큰 + 매핑 없는 경로 → **404 NOT_FOUND** ✅
   - 토큰 없음 + 매핑 없는 경로 → **401 UNAUTHORIZED** ✅ (필터 → EntryPoint가 먼저 처리. 인증 안 된 사용자에게 리소스 존재 여부 자체 노출 안 됨 — 보안 표준 룰 정합)
8. **ADR 추가 없음** — Step 6의 결정은 모두 ADR-0007 / ADR-0008의 룰 적용. 새 결정 0개라 ADR 작성 불요.
9. **남은 일** — Step 5 + Step 6 묶음 커밋 + Step 7 잔액 충전 API.

### 2026-05-15 (저녁) — Step 5: JWT 인프라 일괄 작성

1. **Step 4 커밋 완료** (커밋 `bc5838f`, 25 파일 +1078/-69) — Step 3 이체 확장분도 같이 묶여있어서 한 커밋으로. 메시지에 Step 3 확장 / Step 4 / 사후 픽스 / 학습 자료 4구분 명시.
2. **Plan mode 진입 → Step 5 plan 작성** — `gentle-snuggling-hartmanis.md`를 Step 4 → Step 5로 overwrite. 결정 5종(jjwt 0.12 / sub=userId만 / refresh 미도입 / DB 조회 X / 401 명시화) + 만들 파일 4개(`security/` 패키지 신설).
3. **Plan agent 1회 호출**로 구현 디테일 정밀화 — 핵심 발견 6가지:
   - 예외 처리는 필터 안에서 catch만, EntryPoint가 401 단일 책임 → 관리 포인트 단일화
   - `ObjectMapper`는 Spring Boot Bean 주입 필수 (직접 new 하면 `JavaTimeModule` 누락으로 `OffsetDateTime` 직렬화 실패)
   - `shouldNotFilter()` 비권고 — 미래 `/auth/me` 같은 prefix 위험
   - jjwt 0.11 → 0.12 API 변화 (`setSubject` → `subject`, `parseClaimsJws` → `parseSignedClaims` 등)
   - `@RestControllerAdvice`는 필터 예외 못 잡음 (DispatcherServlet 진입 전 영역)
   - principal 타입 `Long`으로 두면 `@AuthenticationPrincipal Long userId`로 받기 깔끔
4. **코드 4 + 테스트 1 작성** — `security/JwtTokenProvider`, `JwtAuthenticationFilter`, `JwtAuthenticationEntryPoint` + `SecurityConfig` 확장 + `JwtTokenProviderTest` 2건.
5. **빌드 첫 시도 실패 — Flyway V3 checksum mismatch** 발견:
   - `MinipayApplicationTests.contextLoads`만 실패, `JwtTokenProviderTest` 2건은 통과
   - 진단: `Migration checksum mismatch for migration version 3` (test report에서 grep)
   - 가설: line ending 변환 또는 Flyway 버전 변화. V1=CRLF, V2/V3=LF 확인.
   - 해결: `.gitattributes`에 `*.sql / *.java / *.yml / *.md` 등 `text eol=lf` 강제 + DB `UPDATE flyway_schema_history SET checksum = NULL WHERE version = '3';`로 다음 부팅에 재계산
   - 재빌드 → BUILD SUCCESSFUL (3 tests pass)
6. **bootRun + curl 4종 검증** — 토큰없음 401 ✅ / 잘못된 토큰 401 ✅ / 가입 회귀 201 ✅ / swagger 회귀 200 ✅. 응답 본문 한글 인코딩(`인증이 필요합니다`)도 정상.
7. **ADR 0008 작성** — JWT stateless 인증 결정 5종. Rationale에 "왜 jjwt? 왜 sub만? 왜 refresh 안 만듦? 왜 DB 조회 X? 왜 401 명시?" 면접 답변지 활용 가능 깊이로. ADR 0007의 "임시 SecurityConfig 재검토 신호" 회수 명시.
8. **`docs/adr/README.md`** 0008 인덱스 추가.
9. **남은 일**: 커밋 (Step 5 단위로 분리) + Step 6 로그인 API 진입.

### 2026-05-15 (오후) — Swagger 트러블슈팅 + uChoice.md 작성

1. **Swagger 500 트러블슈팅** — `POST /api/v1/auth/signup` curl 4종 통과 후 Swagger UI 접속 시 `/api-docs`가 500.
   - 진단: 응답 본문이 `INTERNAL_ERROR` 형식이라 우리 `GlobalExceptionHandler.handleUnexpected` fallback이 잡은 것 → 진짜 예외 정체 불명.
   - 원인: `springdoc-openapi 2.6.0` + Spring Boot 3.5.14(Spring Framework 6.2) 호환성 깨짐.
   - 픽스: `2.6.0 → 2.8.13` 업그레이드 + `GlobalExceptionHandler` fallback에 `@Slf4j` + `log.error("Unhandled exception", ex)` 영구 추가.
   - 기록: `docs/swaggerTroubleShoot0515.md` 작성 (면접 답변지 Q1~Q5 포함).
   - ADR 0007 사후 보강: Decision §4에 "fallback은 응답 가공해도 stacktrace는 반드시 `log.error`로 남긴다" 한 줄 + References에 트러블슈팅 문서 링크.
2. **uChoice.md 작성** — "표준(Standard) vs 우리 결정(Decision)" 한 페이지 인덱스. Step 1~4 표준 채택 13건 + 의도적 일탈 11건 + Step 5~11 예상 일탈 8건 표로 정리. 면접 답변 Q1~Q5 포함. ADR 1~7의 분기점만 추출한 인덱스 역할.
3. **다음** — Step 4 변경사항 커밋 → Step 5 plan mode 진입.

### 2026-05-15 (오전) — Step 4 회원가입 API 코드 일괄 작성

1. **현재 위치 확인** — 사용자가 "현재 만들어야 할 API 뭐가 있는지" 물음. Step 4~9 7개 API 정리 (signup/login/charge/payment/transfer/transactions). 진행은 Step 단위로 자르기로 합의.
2. **Plan mode 진입** — `gentle-snuggling-hartmanis.md` plan 작성. Step 4만 집중. 결정사항 5종(BCrypt 디폴트 / AuthService 단일 / 임시 SecurityConfig / `{errorCode, message, timestamp}` 포맷 / KRW 고정)을 ADR 0007 한 장에 묶기로.
3. **사용자 합의: API path는 `/api/v1/...`** (ready.md 따라). uShould.md `/api/...`는 차후 일치시키기로.
4. **학습 Q&A 4종** (회원가입으로 만들어지는 것 / accounts.id vs user_id / JVM 역할 / Bean 정의):
   - `users` 1행 + `accounts` 1행이 같은 트랜잭션에서 INSERT, BCrypt 형식 `$2a$10$...`, 응답엔 password/pin/createdAt 누출 X.
   - `accounts.id` = 계좌 정체성, `accounts.user_id` = FK. 1:1 관계지만 책임 분리 + transactions가 account_id 참조해서 분리 필수.
   - JVM = 자바 가상 머신. Spring 앱 1프로세스. Bean은 시작~종료까지 살고, 요청 객체는 GC.
   - Bean = Spring이 관리(생성/보관/주입)하는 무상태 객체. 엔티티/DTO/VO는 Bean 아님.
5. **사용자 승인 후 코드 일괄 작성**:
   - 10 파일: `repository/{UserRepository,AccountRepository}.java`, `exception/{DuplicateEmailException,GlobalExceptionHandler}.java`, `dto/{SignupRequest,SignupResponse,ErrorResponse}.java`, `config/SecurityConfig.java`, `service/AuthService.java`, `controller/AuthController.java`
   - SecurityConfig는 Spring Security 6 lambda DSL (`http.csrf(c -> c.disable())` 스타일)
   - GlobalExceptionHandler는 `IllegalArgumentException`도 핸들링(엔티티 정적 팩토리에서 던짐)
6. **빌드 검증** — `.\gradlew clean compileJava` BUILD SUCCESSFUL (18s). `.\gradlew build`는 Hibernate validate라 docker 인프라 떠 있어야 해서 사용자에게 위임.
7. **ADR 0007 작성** — 5개 결정의 Rationale/Consequences/재검토 신호 정리. 면접 답변지로 활용 가능. README 인덱스 갱신.
8. **남은 일** — `docker compose ps` 확인 → `bootRun` → curl 4종(정상/중복/검증실패/401) → 통과 시 커밋.

### 2026-05-14 — 이체(TRANSFER) 기능 추가

1. **현황 확인** — 사용자가 "이체 기능 들어있나" 물음. `TransactionType.java`는 `CHARGE, PAYMENT`만, `ready.md`에 "❌ 송금(P2P) — 회원 간 이체"가 의도적 제외로 박혀 있어 명시적으로 빠져있다고 답변.
2. **추가 요청** — "이체 기능도 추가해주고, MD 추가해야 하면 추가해줘". Claude가 AskUserQuestion으로 3안(1행+counterparty / 2행+group / 별도 테이블) 비교 제안 → 사용자 거부 → 직접 결정 후 진행 요청.
3. **워크플로우 메모** — 학습 프로젝트에서 기능 추가 시 AskUserQuestion 금지, 합리적 안 직접 골라 ADR로 근거 박는 패턴 메모리 `feedback_decide_and_act.md`로 저장.
4. **A안 채택 (단일 행 + counterparty_account_id)** — 근거:
   - 기존 `transactions` 단일 행 구조(ready.md 결정) 보존, V1/V2 영향 없음.
   - 결제 흐름(Step 8 비관적 락 + 멱등성) 재사용 가능 → 학습 동선 매끄러움.
   - DB CHECK + FK + UNIQUE 3중 방어로 정합성.
   - 트레이드오프: 수신자 시점 잔액은 행에 없음 + 거래내역 OR 조건(BitmapOr 플래너 부담).
5. **변경 사항**:
   - 코드: `V3__transfer.sql` (counterparty 컬럼 + CHECK 2종 + 부분 인덱스), `TransactionType.TRANSFER` 추가, `Transaction.transfer()` 정적 팩토리.
   - 문서: `ADR 0006-transfer-modeling.md` 작성, `ADR README` 인덱스 갱신, `ready.md` (송금 제외 해제 + 용어집 + ERD + API 명세 + 테이블 스펙 + 시나리오 9 → 12개), `sql.md` (MySQL DDL에 counterparty + FK + CHECK), `CLAUDE.md` (동시성/멱등성 룰 + 리뷰 체크리스트에 이체 포함), `uShould.md` (Step 8 결제+이체로 확장, ADR 번호 0007~0010으로 재정렬, Step 10 동시성 테스트에 이체 시나리오 추가).
6. **Step 8 핵심 후속 결정** — 두 계정 동시 PESSIMISTIC_WRITE에서 데드락 회피용 `account_id` 오름차순 정렬 락 규칙. ADR 0011 후속 분리 여부는 Step 8 진입 시 결정.
7. **다음**: 빌드 검증(`.\gradlew clean compileJava` + `build`) → step-3-entities 머지.

### 2026-05-11 — 진행 점검 / Transaction.java 마무리 / 코드 리뷰 섹션 정착

1. **모니터링 구성 질문** — 현재 `docker-compose.yml`에 `postgres:16` + `redis:7` 두 컨테이너만. Actuator/Micrometer/Prometheus/Grafana 모두 없음. 가이드 Step 0~11에도 모니터링 스텝 없음 → **완주 후 면접 답변지 보강용 확장 후보**로 메모.
2. **진행 상황 동기화** — `User.java`는 이미 사용자가 `register` 빈칸 6곳을 채워서 완성한 상태였음(2차 채점 흔적 [주석 목적] 블록 보존). progress.md엔 여전히 "빈칸 6곳"으로 남아있어서 동기 어긋남 → 정정.
3. **새 학습 자료 인지** — `docs/uLearn.md`(완성 시 학습 자산 인덱스)·`docs/uShould.md`(Step 4~11 산출물 매핑)가 새로 추가돼 있어서 진행 체크리스트에 반영.
4. **Transaction.java 1차 채점**:
   - 사용자가 13곳 중 charge의 7곳 먼저 채운 상태에서 채점 요청.
   - 컴파일 에러 2곳 발견 — `tx.type = CHARGE`, `tx.status = SUCCESS` (같은 패키지여도 enum 상수는 `TransactionType.CHARGE`처럼 타입명 한정 필수).
   - 주석 9종 평가: 메서드 헤더 구분선 / "정적 팩토리 1/2" 라벨 / 단계 번호(1.검증~4.반환) / "충전이라 merchantId는 null로 둠" / "CHARGE 또는 PAYMENT 중 어느 것?" / "동기 처리라 SUCCESS / FAILED 중 정상 케이스" — 전부 WHAT 또는 스캐폴드 메모 → 제거.
   - 사용자가 "내가 빈칸 채워올게" 선택 → 힌트만 전달 (정답 X).
5. **Transaction.java 빈칸 완성 + 2차 확인**:
   - 빈칸 9곳 전부 정답, 컴파일 에러도 둘 다 정상화.
   - 채점 워크플로우 마무리: 본 코드 주석 0줄로 정리 + 파일 하단 `[주석 목적]` 블록(스캐폴드 9종 분석 + 코드 자체 평가) 추가.
6. **빌드 검증 + 커밋 + 푸시**:
   - `.\gradlew clean compileJava` ✅ (강제 재컴파일로 캐시 의존 제거).
   - `.\gradlew build` ✅ (Flyway V1+V2 적용 + Hibernate `validate`로 엔티티 ↔ DB 컬럼 매칭 통과).
   - 12 파일 스테이징 후 단일 커밋 `b5ec888` — "Step 3: 엔티티 완성 + ADR 5장 + 학습 자료 인덱스" (도메인 모델 / ADR / 학습 자료 3섹션 메시지).
   - `step-3-entities` 브랜치 푸시 완료 (`e9a8945..b5ec888`).
7. **CLAUDE.md `## 코드 리뷰 체크리스트` 섹션 추가**:
   - 사용자가 본격 코드 리뷰 시작하려고 함 → ADR 0001~0005 + 컨벤션을 리뷰어 관점에서 재해석한 체크리스트 필요.
   - 포맷: **ADR 트레이서형** (각 항목에 `[ADR-XXXX]` 태그 → 결정 근거 추적). 면접 답변지 활용 시 시각적 혁신.
   - 범위: Step 4~8 미래 항목(보안/동시성/멱등성)도 미리 포함 — CLAUDE.md 본문 룰과 정합.
   - 위치: `## 패키지 구조`와 `## 학습 진행 룰` 사이.
   - 분량: 10 카테고리 × 평균 3 항목 ≈ 30개 체크. 기존 컨벤션 그대로 베끼지 않고 "리뷰 시 자주 빠뜨리는 검증 포인트"만.
   - 다음 PR(Step 4 회원가입 API)부터 1회 적용 → 누락 발견 시 보강 예정.
8. **머지 메시지 초안 합의** (`--no-ff` 권장):
   - 제목: `Step 0~3 통합: 인프라 + 도메인 모델 + ADR 5장 + 문서` (50자, 70자 룰 통과).
   - 본문 섹션: 인프라 / 비밀값 관리 / 마이그레이션 / 도메인 모델 / 컨벤션·문서 / 효과 / 검증 / 후속.
   - `Co-Authored-By` 미포함 (머지 = 사용자 통합 결정, 개별 커밋엔 이미 박힘).
9. **남은 일**: main 머지 → Step 4 회원가입 API 진입.

### 2026 이전 흐름

1. 사용자가 nginx + postgres 베이스 `docker-compose.yml`을 가져옴 (Mini Pay와 안 맞음)
2. 점검 결과: nginx 불필요, redis 빠짐, networks/volumes 정의 누락 등 다수 문제
3. 사용자가 빈칸 퀴즈 → "사전 명세 먼저 달라" 요청 → `docs/spec.md` 생성
4. 사용자가 빈칸 채우는 데 막힘 → **Q1~Q7 정답 + 줄별 이유 설명 제공 완료**
5. 사용자가 파일 저장하고 오면 `docker compose up -d` 단계로 진행

### 2026-04-29 — Step 2 (V1__init.sql)
1. 사용자가 ERD Cloud용으로 MySQL 변환 요청 → `C:\mini\sql.md` 생성
2. `idempotency_key` 의미 질문 → 멱등키 개념 설명 (Redis SETNX + DB UNIQUE 이중 방어)
3. V1__init.sql 1차 채점: line 13 `DEFAULT CHECK` syntax error + TIMESTAMP/TIMESTAMPTZ 일관성 깨짐 + NUMERIC vs BIGINT 의문
4. 사용자가 트레이드오프 분석으로 반박 (NUMERIC, TIMESTAMPTZ 합리성) → Claude가 "진짜 버그"와 "다른 합리적 선택"을 분리해서 인정
5. 사용자 선택: **NUMERIC(19,4) + TIMESTAMPTZ** (다중 통화/글로벌 확장 가정. Step 3에서 자바는 `BigDecimal` + `OffsetDateTime`)
6. V1__init.sql 수정 완료 → 9개 항목 모두 통과
7. `sql.md`도 동기화 (DECIMAL(19,4) + TIMESTAMP(6))
8. `./gradlew bootRun` 실행 → Flyway 마이그레이션 정상 적용 확인 → **Step 2 완료**
9. 부팅 경고 2개 인지: OSIV (Step 3에서 끄기), Spring Security 기본 패스워드 (Step 5에서 사라짐)

### 2026-05-08 — Step 3 (ADR 5장 + Transaction 스캐폴드 + 자바 기초 학습)

1. **Spring Boot 부팅 실패** 디버깅 — PostgreSQL 5432 connection refused (`SQLState 08001`)
   - 원인: docker compose가 안 떠 있어서. `docker compose up -d`로 해결.
   - 학습: 스택 트레이스는 **`Caused by`를 거꾸로 읽는다** (가장 안쪽 = 진짜 원인).
   - 학습: SQLState는 ANSI 표준 5자리 (08xxx 연결, 23xxx 무결성, 42xxx 문법, 40xxx 트랜잭션).
2. **자바 기초 Q&A**:
   - `email == null || email.isBlank()` 둘 다 필요한 이유 — null 체크 먼저 안 하면 NPE.
   - NPE는 "false 떠야 해서"가 아니라 **값 자체가 만들어지지 않고 흐름 중단**.
   - 정적 팩토리 패턴 5단계: 검증 → 인스턴스 → 필드 세팅 → 시간/기본값 → 반환.
3. **`AccessLevel.PROTECTED` 종류** — Lombok 6값 (PUBLIC/PROTECTED/PACKAGE/PRIVATE/MODULE/NONE) + 자바 접근 제어자 4종 정리. PROTECTED가 JPA 프록시(LAZY) 호환 + 외부 차단 동시 충족.
4. **`@ManyToOne(fetch = FetchType.LAZY)` 의미** — N:1 관계 + 지연 로딩. JPA 기본값이 EAGER라 명시 필수. N+1 함정 회피.
5. **결정: Transaction → Account 참조 방식** — 객체 참조(`@ManyToOne`) vs ID 참조(`Long`) 비교 후 **A안(ID 참조)** 선택. 근거: 애그리거트 경계 + open-in-view false 정합 + 일관성. → ADR 0005로 기록.
6. **ADR 5장 일괄 작성** (사용자 요청 — Transaction.java 작성 전에 결정 근거 먼저 박아두자):
   - 0001 Money VO / 0002 Enum STRING / 0003 정적 팩토리 / 0004 Flyway 단방향 / 0005 ID 참조
   - 각 ADR은 Status / Context / Decision / Rationale (대안 비교) / Consequences (좋은 면 / 나쁜 면 / 재검토 신호) / References 6섹션. 면접 답변지로 그대로 활용 가능.
   - `docs/adr/README.md` 인덱스 갱신 (Status: Accepted, 링크 추가).
7. **Transaction.java 스캐폴드 작성**:
   - 사용자가 먼저 `@ManyToOne(fetch = LAZY) User user`로 시작했으나 **잘못된 참조 방향** (Transaction은 Account를 가리켜야 함, User 아님) + **A안 결정과 불일치** → 재작성.
   - 필드 9개 + `@AttributeOverrides`로 Money 두 번 임베딩 (`amount`, `balanceAfter`) — Account.java는 Money 하나뿐이라 이 패턴이 첫 적용.
   - V2 마이그레이션 컬럼명과 정확히 일치 확인: `amount_amount`/`amount_currency`, `balance_after_amount`/`balance_after_currency` (`ddl-auto: validate`라 일치 필수).
   - 정적 팩토리 `charge`/`payment` 본문은 `___` 빈칸으로 — 사용자가 채울 차례.
8. 사용자가 업무 마무리 요청 → progress.md 갱신 후 종료.

### 2026-05-04 — Step 3 (TransactionType/Status, User 골격, 워크플로우 정착)
1. 자바 패키지/enum 기초 학습 — `com` 시작 이유(역도메인), enum vs class, enum 값=상수=대문자 관례, STRING 매핑이면 순서 무관 (학습 메모는 본 파일 하단 📚 학습 메모 섹션)
2. `TransactionType.java` 1차 채점 — 주석 3줄 평가:
   - line 3 `// transactionType 충전, 결제` → 불필요 (WHAT 주석)
   - line 4 `// class가 아닌 enum 자율성을 위함` → 의미 거꾸로. 정답은 "타입 안전성 + 유한 선택지 명시"
   - line 5 자바 문법 메모 → 위치 부적절. 학습 노트로 빼는 게 맞음
3. **새 워크플로우 정착** (사용자 요청):
   - 사용자 코드+주석 작성 → Claude 채점 → 본 코드는 주석 제거해 운영 코드처럼 정리 → 파일 **맨 하단**에 `[주석 목적]` 블록 주석 추가 (1. 원문 / 2. 오답 수정 / 3. 좋은 주석 룰)
   - 메모리 `feedback_comment_grading_workflow.md`로 저장 → 향후 자동 적용
4. `TransactionType.java` 정리 — 본 코드 주석 0줄 + 하단 `[주석 목적]` 블록
5. `TransactionStatus.java` 작성 (주석 0개 정답) + 하단에 `[주석 목적]` + 면접 답변 메모(Q1~Q3) 포함
6. `User.java` 가이드 스캐폴드 작성 (스텝 1~4: import / 어노테이션 / 필드 6개 / 정적 팩토리)
7. 사용자가 Step 2(어노테이션)만 채워서 커밋 → ⚠️ **import 누락 상태로 push됨** (현재 `@Entity`, `@Getter` 등 빨간줄, compileJava 실패 예정)
8. 머지 흐름 안내 (PowerShell 기준 git add/commit/push/merge 명령어 + main 직접 머지 vs PR 차이)
9. 머지 설명 갱신 버전 작성 — 인프라/비밀값/컨벤션·문서/도메인 모델/V2 마이그레이션 섹션 분리
10. **머지 보류** — User.java import 보완 + Transaction.java까지 마치고 머지하는 게 깔끔하다고 합의

### 머지 설명 (step-3-entities → main, 다음 작업 시 사용)
인프라(Postgres+Redis docker, application.yml, V1/V2 migration, build.gradle, gradle wrapper) +
비밀값 관리(.env/.env.example/.gitignore, ${VAR:default} 패턴) +
컨벤션·문서(CLAUDE.md, docs/adr/0001~0005, progress.md, architecture/schedule/ready/guideEntity/sql.md, uLearn.md, uShould.md) +
도메인 모델 Step 3(Currency, Money VO, Account, InsufficientBalanceException, TransactionType, TransactionStatus, User 완성, Transaction `charge`/`payment` 본문은 머지 직전에 채움).
효과: 평문 비밀값 제거, 도메인 패턴(VO/정적 팩토리/Enum STRING) 정착, ADR 5장으로 면접 답변지 토대 구축.
테스트: docker compose up -d / ./gradlew bootRun(V1+V2 적용) / contextLoads 통과.
후속: Step 4 회원가입 API.

### Q1~Q7 정답 (참고용)
- **Q1**: `postgres:16`
- **Q2**: `POSTGRES_DB/USER/PASSWORD: minipay` (3종 모두)
- **Q3**: `"5432:5432"`
- **Q4**: `pgdata:/var/lib/postgresql/data`
- **Q5**: `redis:7`
- **Q6**: `"6379:6379"`
- **Q7**: 최상위 `volumes: pgdata:`

---

## ▶️ 사용자가 "다음 진행 상황 알려줘"라고 하면

**현재 단계 기준 다음 액션** (2026-05-11 기준):

### 케이스 A — 바로 이어서 main 머지 (가장 가능성 높음)
1. `git checkout main` → `git pull` → `git merge --no-ff step-3-entities` (메시지 초안은 2026-05-11 요약 항목 8) → `git push`
2. Step 4 회원가입 API 진입

### 케이스 B — "Step 4 회원가입 API 갈래"
1. Step 3 미완 상태 짚기 (main 머지 미실행)
2. 그래도 진행 의지면 Step 4 안내 — 첫 PR에서 CLAUDE.md `## 코드 리뷰 체크리스트` 1회 적용 시뮬레이션 권장

---

## 📝 진행 업데이트 규칙 (Claude용)

- 각 Step 또는 sub-step 완료 시 → 체크박스 업데이트 + "현재 위치" 갱신
- 💭 고민 답변 받을 때마다 → README/ADR 작성용으로 정리해두기
- 큰 결정/막힘 발생 시 → "마지막 대화 요약"에 추가
- **마지막 업데이트** 날짜 매번 갱신

---

## 📚 학습 메모

### 2026-05-08 — 디버깅 / 자바 기초 / JPA 연관관계

#### 스택 트레이스 읽는 법
- **`Caused by`를 거꾸로 읽는다** — 가장 안쪽(마지막)이 진짜 원인.
- 위쪽은 도미노로 무너진 결과 — 보통 진단 가치 낮음.
- 진단 순서: ① 맨 아래 `Caused by` ② 그 위 1~2단계 (어떤 모듈) ③ 맨 위는 무시해도 됨.

#### SQLState 에러 코드 (ANSI 표준 5자리)
- `08xxx` — Connection Exception (연결 문제)
- `23xxx` — Integrity Constraint Violation (UNIQUE/FK 위반)
- `42xxx` — Syntax Error or Access Rule
- `40xxx` — Transaction Rollback (데드락 등)
- DB 종류 무관하게 의미 동일. `Error Code`는 벤더별이라 PostgreSQL은 거의 0.

#### `== null` vs `.isBlank()`
- `== null` — 변수가 객체를 가리키지 않음 (참조 자체 없음).
- `.isBlank()` — 객체는 있지만 내용이 공백뿐 (Java 11+).
- **null이 들어간 변수에 메서드 호출 = NPE**. 단순히 false가 안 나오는 게 아니라 **흐름 자체 중단**.
- `||` 단락 평가로 **null 체크 먼저** 와야 함.

#### `AccessLevel` (Lombok) 6종
- `PUBLIC` / `PROTECTED` / `PACKAGE` / `PRIVATE` / `MODULE` (JPMS) / `NONE` (생성 차단)
- 자바 접근 제어 4종 + Lombok 특수값 2개.
- 우리 프로젝트가 `PROTECTED`를 쓰는 이유:
  - JPA 프록시(LAZY)는 자식 클래스로 동작 → PROTECTED 통과
  - 외부 코드는 `new User()` 차단 → 정적 팩토리 강제
  - PRIVATE은 JPA 프록시도 막혀 부적합, PUBLIC은 외부 차단 못 함.

#### `@ManyToOne(fetch = FetchType.LAZY)` 의미
- **`@ManyToOne`** — N:1 관계 (Transaction 여럿 ↔ Account 하나).
- **`FetchType.LAZY`** — 실제 접근 시에만 추가 쿼리. 안 쓰면 EAGER가 기본.
- 단일(One) 쪽 관계는 **JPA 기본이 EAGER** → 항상 명시적으로 LAZY 박는 게 실무 룰.
- N+1 함정: 거래 100건 + EAGER → 101쿼리. 회피하려면 `JOIN FETCH` 명시.
- 우리는 `open-in-view: false` + 애그리거트 경계 → **ID 참조로 회피** (ADR 0005).

#### 정적 팩토리 패턴 5단계
1. **검증** — null/blank/범위 체크 (불변식 보호)
2. **인스턴스** — `new User()` (protected 기본 생성자, 같은 클래스 내라 호출 가능)
3. **필드 세팅** — setter 없으니 같은 클래스 안에서 `user.email = ...` 직접 대입
4. **시간/기본값** — `OffsetDateTime.now()` (도메인 책임, DB DEFAULT에만 의존하지 않음)
5. **반환** — 검증·세팅 끝난 인스턴스

#### Money VO 두 번 임베딩 (`@AttributeOverrides`)
- 한 엔티티에 Money 필드 두 개 이상이면 컬럼명 충돌 위험.
- `@AttributeOverrides`로 각자 컬럼명 분리: `amount` → `amount_amount`/`amount_currency`, `balanceAfter` → `balance_after_amount`/`balance_after_currency`.
- Account는 Money 하나(balance)뿐이라 이 패턴이 안 보였음. Transaction이 첫 적용.
- V2 마이그레이션의 컬럼명과 정확히 일치 필수 (`ddl-auto: validate`).

---

### 2026-05-04 — 자바 패키지 / enum 기초

#### 패키지명이 `com`으로 시작하는 이유
- **역도메인(reverse domain)** 관례. 회사 도메인을 거꾸로 써서 전 세계 패키지명 충돌 방지.
  - `google.com` → `com.google.*`
  - `apache.org` → `org.apache.*`
- 우리 `com.minipay`는 엄밀히는 도메인 소유 안 함 → 학습 프로젝트라 OK.
- 실제 서비스라면 `io.github.<username>.<project>` 또는 회사 도메인 기반.
- `package com.minipay.domain;` 선언 = 디렉토리 `src/main/java/com/minipay/domain/` 와 1:1 매칭.

#### enum vs class
- **선택지가 고정**되어 있고 **컴파일 타임에 알 수 있는 유한한 값**일 때 enum.
- enum이 주는 보장:
  1. 타입 안전성 — 오타/잘못된 값 컴파일 차단 (`String "CHRAGE"` 같은 사고 방지)
  2. 유한성 명시 — "거래 종류는 충전/결제 둘뿐"이 코드에 박힘
  3. switch 망라성 — 누락 케이스 컴파일러 경고
  4. 싱글톤 보장 — `==` 비교 가능
  5. JPA 매핑 깔끔 (`@Enumerated(EnumType.STRING)` 한 줄)
- enum 부적합 케이스: 운영자가 추가/삭제하는 카테고리 등 런타임 가변 값 → 별도 테이블.

#### enum 값이 "상수"인 이유
- **상수(constant)** = 한 번 정해지면 안 바뀌는 값. 수학의 π 같은 것.
- `TransactionType.CHARGE`는 JVM이 켜져 있는 동안 항상 같은 하나의 객체. 누구도 다른 값으로 못 바꿈.
- → "값이 안 바뀐다"는 상수의 정의에 정확히 맞음 → enum 값 = 상수.

#### 왜 대문자(`UPPER_SNAKE_CASE`)?
- 자바 언어 강제는 아니지만 Oracle Code Conventions / JLS 관례.
- 자바 생태계 3분류 신호:
  - 클래스명 → `PascalCase`
  - 메서드/변수 → `camelCase`
  - 상수 → `UPPER_SNAKE_CASE`
- 코드 훑을 때 대문자 = "변하지 않는 값" 즉시 식별.
- 표준 라이브러리 예: `DayOfWeek.MONDAY`, `RoundingMode.HALF_EVEN`, `TimeUnit.SECONDS`, `HttpMethod.POST`.
- 여러 단어는 언더스코어: `IN_PROGRESS`, `PARTIALLY_REFUNDED` (camelCase 아님!).

#### enum 순서 변경 안전한가?
- **STRING 매핑이면 OK** — DB에 `"CHARGE"`, `"PAYMENT"` 문자열로 저장되므로 자바 코드 순서 무관.
- **ORDINAL 매핑이면 위험** — 선언 순서(0,1,2)가 DB에 정수로 저장돼서 순서 바꾸면 기존 데이터 의미가 뒤바뀜 (충전 ↔ 결제 둔갑).
- → CLAUDE.md "ORDINAL 절대 금지"의 이유.
- 단, `Enum.values()` 순회나 `compareTo()` 등 선언 순서에 의존하는 코드가 있다면 영향 있음.

#### 주석 룰 (이번 채점에서 학습)
- **WHAT 적지 마라** — 이름이 이미 설명함. `// transactionType 충전, 결제` 같은 건 불필요.
- **WHY는 적되, 명백하면 생략** — 일반론(자바 문법 메모)은 주석 X, 학습 노트로.
- 좋은 주석 = 코드만 봐선 알 수 없는 **숨은 제약/이유**.
  - 예: `// 결제 정산 보고서가 enum 순서로 정렬되므로 바꾸면 리포트 깨짐`
