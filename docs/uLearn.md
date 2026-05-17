# Mini Pay 완성 시 학습 자산

> 가이드(`docs/mini-pay-guide.md`) + 우리 컨벤션(`CLAUDE.md`) + ADR 11장을 종합해, 면접에서 실제로 써먹을 수 있는 단위로 정리.
>
> 마지막 갱신: 2026-05-18 (Step 0~11 종결 시점)

---

## 🎯 1. 동시성 (메인 학습 포인트) — ✅ 확보 완료

- **비관적 락 vs 낙관적 락의 의도적 선택** (ADR 0009)
  - 돈은 재시도 부적절 + 충돌 빈번 + 트랜잭션 짧음 → 비관적 락
  - 낙관적 락(@Version+재시도)이 부적합한 이유 3가지 즉답 가능
- **`SELECT FOR UPDATE` 동작 직접 관찰** (Postgres) — `findByUserIdForUpdate` / `findByIdForUpdate`
- **동시성 통합 테스트 3종 통과** (`ConcurrencyTest.java`)
  - 결제 100건 동시 → 잔액 0, PAYMENT count=100, 누락 0 (1.23s)
  - 같은 멱등키 10건 → PAYMENT 1건, 같은 transactionId (1.31s)
  - A↔B 양방향 200건 → 데드락 0, 잔액 합 보존 (2.49s)
- **JPA 1차 캐시 함정 발견·해결** ⭐⭐⭐ — 정적 분석으로 안 잡히는 락 무력화 버그
- **트랜잭션 안 외부 I/O 금지** 룰 — 락 점유 시간 = 장애 반경

## 🎯 2. 멱등성 (실무 단골) — ✅ 확보 완료

- **Redis SETNX + DB UNIQUE 이중 방어** (ADR 0010)
- **Redis 장애 시에도 결제 살아있어야** → `tryAcquire` true fallback + DB UNIQUE 최종 차단
- **응답 캐시 = DB 재조회 (SSoT)** — Redis에 응답 JSON 안 저장 (Stripe 패턴과 의도적 차이)
- **Idempotency-Key 헤더 표준 패턴** — IETF draft `draft-ietf-httpapi-idempotency-key-header`
- TTL 10분 디폴트 — 더블 클릭/재시도 윈도우 + 키 누적 방지의 균형
- **같은 키 + 다른 본문 → 409 IDEMPOTENCY_KEY_CONFLICT** (악용 차단)
- **DataIntegrityViolationException self-heal** — DB UNIQUE 충돌 시 `findByIdempotencyKey`로 재조회해 동일 응답

## 🎯 3. 데드락 회피 (도메인 패턴) — ✅ 확보 완료

- **두 자원 락은 자원 ID 정렬 후 획득** (ADR 0011) — Coffman conditions 중 circular wait 제거
- `Math.min/max`로 `account_id` 오름차순 정렬 → 모든 트랜잭션이 같은 순서로 락
- A↔B 양방향 동시 이체 200건에서 데드락 0 검증
- PG 데드락 감지(`40P01`)는 safety net으로 두고 정상 경로에서 절대 안 나도록 설계

## 🎯 4. 트랜잭션 설계 — ✅ 확보 완료

- `@Transactional` 경계와 락 획득 순서
- `readOnly = true`로 조회 트랜잭션 분리 (`AuthService.login`, `TransactionQueryService.list`)
- `open-in-view: false` — 커넥션 풀 고갈 회피
- 통합 테스트 메서드에 `@Transactional` 금지 룰 — 롤백 자동화가 동시성 깸 (CLAUDE.md)

---

## 💎 5. 도메인 모델링 (Tell, Don't Ask) — ✅

- **Anemic Domain Model 회피** — `account.deduct(money)` / `account.charge(money)` 도메인 메서드 캡슐화
- **정적 팩토리 메서드 패턴** (ADR 0003) — setter 금지, 도메인 동사 이름(`openFor`, `charge`, `payment`, `transfer`, `register`)
- **Value Object** (ADR 0001) — `Money` VO로 BigDecimal 직접 노출 방지, scale 4 / HALF_EVEN, `requireSameCurrency`
- **애그리거트 경계** (ADR 0005) — Transaction이 Account를 ID로만 참조 (`Long accountId`, `Long counterpartyAccountId`)
- **도메인 예외 명명 클래스** — `InsufficientBalanceException`, `DuplicateEmailException`, `AccountNotFoundException.forUser/forAccount`, `InvalidTransferTargetException`, `MissingIdempotencyKeyException`, `IdempotencyKeyConflictException`
- **이체 모델링** (ADR 0006) — 단일 행 + `counterparty_account_id`. 복식부기 회피 + DB CHECK 2종으로 정합성
- **응답 시점 분기 enum** — `TransactionDirection`(SELF/SENT/RECEIVED). 송금자/수신자 양쪽 시점 통합 응답

## 💎 6. JPA 실전 함정 — ✅

- `ddl-auto: validate`로 엔티티-스키마 정합성 보장
- `@Enumerated(EnumType.STRING)` 강제 (ADR 0002, ORDINAL 데이터 손상 함정)
- `@Embeddable` + `@AttributeOverrides`로 같은 VO 두 번 임베딩 (Transaction의 `amount` + `balanceAfter`)
- `@NoArgsConstructor(PROTECTED)` — JPA 프록시 호환 + 외부 차단
- N+1 함정 인지 + ID 참조로 회피
- `@ManyToOne` 기본 EAGER → 항상 LAZY 명시 (우리는 객체 참조 자체 회피로 더 단순)
- **JPA 1차 캐시가 `PESSIMISTIC_WRITE` 무력화** ⭐⭐⭐ — Step 10 발견. ID projection으로 우회.
- **Spring Data 메서드 이름 파싱** + JPQL projection — `findByAccountIdOrCounterpartyAccountIdOrderByCreatedAtDesc`, `findIdByUserId`

---

## 🛡 7. 보안 — ✅

- **Spring Security 6 + JWT 필터 체인** (ADR 0008)
- BCrypt 해싱 (password + PIN 분리)
- **인증 실패 메시지 통일** — 계정 존재 여부 노출 금지 (`INVALID_CREDENTIALS`)
- CSRF 비활성화 시점 (stateless API)
- **`@AuthenticationPrincipal Long userId`로 컨트롤러에 사용자 ID 주입** — JWT `sub` claim 그대로
- **401 vs 403 의미 분리** — `JwtAuthenticationEntryPoint`로 401 명시
- **`UserDetailsService` 안 만들고 principal `Long`** — 도메인 `User` 엔티티와 분리
- 로그에 JWT/PIN/세션 출력 금지 (CLAUDE.md)

## 🛡 8. 운영 마인드셋 — ✅

- **Flyway 단방향 마이그레이션** (ADR 0004) — V1 절대 수정 금지, V2~V3만 추가
- 학습 중 `down -v`로 회복하지 않기 → 운영 시뮬레이션
- **Flyway V3 checksum mismatch 함정 실전 해결** — `.gitattributes` LF 강제 + DB 체크섬 재계산
- **DB-level 제약(CHECK/UNIQUE/FK)을 자바 검증의 최후 방어선으로** — `idempotency_key UNIQUE` / `counterparty_not_self` CHECK / `counterparty_consistency` CHECK
- 비밀값 `.env` 분리, `${VAR:default}` 패턴
- **fallback 핸들러에 `log.error("Unhandled exception", ex)` 영구 추가** (ADR 0007 보강) — Swagger 500 트러블슈팅의 학습

---

## 🏗 9. 인프라 / 도구 — ✅

- **Docker Compose** — Postgres 16 + Redis 7 멀티 컨테이너 (네트워크/볼륨)
- **Spring Boot 3.5 + Java 17** 프로젝트 구조
- **Gradle 빌드 / 의존성 관리**
- **Flyway 마이그레이션 운영** (V1/V2/V3)
- **PostgreSQL** — `NUMERIC(19,4)`, `TIMESTAMPTZ`, `BIGSERIAL`, 부분 인덱스 (`WHERE counterparty_account_id IS NOT NULL`)
- **OpenAPI/Swagger** — springdoc 2.8.13 + Bearer 인증 통합 (`SwaggerConfig`)
- **JUnit 5 + AssertJ + ExecutorService + CountDownLatch** 동시성 테스트 패턴

## 🏗 10. 디버깅 능력 — ✅

- **스택 트레이스 거꾸로 읽기** (`Caused by` 가장 안쪽)
- **SQLState 5자리 표준** (08xxx 연결 / 23xxx 무결성 / 42xxx 문법 / 40xxx 트랜잭션)
- 통합 테스트로 진짜 동시성 검증 (`@SpringBootTest` + 실제 DB/Redis)
- **함정 4종 실전 해결**:
  - Flyway V3 checksum (Step 5)
  - Swagger 500 + fallback이 stacktrace 삼킴 (Step 4 사후)
  - `NoResourceFoundException` 디폴트 fallback (Step 6)
  - **JPA 1차 캐시가 락 무력화** (Step 10) ⭐

---

## 📝 11. 의사결정 기록 (ADR) — 면접 답변지의 본체 ✅

**보유 ADR 11장** (목표 8~9장 초과 달성):

| # | 제목 | Step |
|---|---|---|
| 0001 | Money Value Object 도입 | 3 |
| 0002 | Enum + EnumType.STRING 매핑 | 3 |
| 0003 | 정적 팩토리 메서드 vs Builder | 3 |
| 0004 | Flyway 단방향 마이그레이션 | 3 |
| 0005 | Transaction은 Account를 ID로 참조 | 3 |
| 0006 | 이체(TRANSFER) 단일 행 + counterparty | 3 |
| 0007 | 인증·에러 핸들링 기반 | 4 |
| 0008 | JWT stateless 인증 (DB 조회 X) | 5 |
| 0009 | 비관적 락(PESSIMISTIC_WRITE) 디폴트 | 7~8 |
| 0010 | 멱등성 Redis SETNX + DB UNIQUE 이중 방어 | 8 |
| 0011 | 두 계좌 락 account_id 오름차순 정렬 | 8 |

각 ADR이 **Status / Context / Decision / Rationale(대안 비교) / Consequences(좋은 면 / 나쁜 면 / 재검토 신호) / References** 6섹션 → 그대로 면접 답변.

---

## 💼 면접 답변 매핑 (질문 → 자산)

| 질문 | 답변 출발점 |
|---|---|
| "프로젝트 한 줄 요약" | 결제·이체 학습 + ADR 11장 + 통합 테스트 3종 + E2E 12종 |
| "동시 결제 어떻게 처리하셨어요?" | Step 8·10, ADR 0009 |
| "이중결제 막아본 적 있어요?" | Step 8·10, ADR 0010 (Redis SETNX + DB UNIQUE) |
| "데드락 회피는?" | ADR 0011 (account_id 오름차순) + Step 10 양방향 200건 동시 검증 |
| "가장 어려웠던 버그는?" | **Step 10 JPA 1차 캐시 함정** ⭐ — 정적 분석으로 안 잡히는 락 무력화 |
| "BigDecimal 그냥 쓰면 안 돼요?" | Money VO, ADR 0001 |
| "JPA 연관관계 어떻게 잡으셨어요?" | ADR 0005 (ID 참조) |
| "스키마 변경 어떻게 운영해요?" | Flyway 단방향, ADR 0004 + V3 checksum 트러블슈팅 경험 |
| "트랜잭션 안에서 외부 호출하면 왜 안 돼요?" | CLAUDE.md 트랜잭션 룰 + ADR 0009 컨텍스트 |
| "락의 비용은 얼마나 들어요?" | Step 10 동시성 테스트 (결제 100건 1.23s, 이체 200건 2.49s) |
| "이체 모델링 왜 그렇게?" | ADR 0006 (단일 행 + counterparty, 복식부기 회피 트레이드오프) |
| "거래내역에서 송수신 시점 어떻게 분기?" | Step 9, `TransactionDirection` enum + `from(tx, myAccountId)` |
| "JWT 즉시 무효화 못 하면 어떻게?" | ADR 0008 재검토 신호 — Redis 블랙리스트 도입 |
| "API 명세는 어디?" | Swagger UI `/swagger` + ready.md + swagger-e2e-0518.md |
| "디버깅 어떻게?" | 4가지 함정 실전 (스택 트레이스 + SQLState + fallback 로깅 + 통합 테스트) |

---

## 📌 요약

**기술 스택 학습은 곁다리.** 진짜 자산은:

1. **돈을 다루는 시스템의 안전 장치 4종**(비관적 락 / 멱등성 이중 방어 / 두 계정 락 정렬 / 트랜잭션 안 외부 I/O 금지)을 직접 구현·검증한 경험
2. **결정마다 "왜"를 ADR 11장으로 박아둔 의사결정 능력** — 대안 비교 + 트레이드오프 + 재검토 신호까지
3. **운영 마인드셋** — 단방향 마이그레이션, 보안 노출 방지, 다층 방어, fallback 로깅
4. **통합 테스트로 함정 발견·해결한 경험** — 특히 JPA 1차 캐시 락 무력화 사고는 정적 분석으로 영영 못 잡는 종류

학습용 프로젝트 중에서는 드물게 **면접 답변지로 그대로 들고 갈 수 있는** 구조라, 신입~주니어 백엔드 면접에서 강력한 무기.
