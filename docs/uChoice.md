# Mini Pay — 표준(Standard) vs 우리 결정(Decision)

> "이 프로젝트 어디가 일반적이고, 어디가 본인 선택이에요?"에 한 페이지로 답하는 인덱스.
> 결정 근거의 깊이는 `docs/adr/`로 이동. 이 파일은 **분기점만** 박는다.
> 면접 답변지로 그대로 활용 — 마지막 섹션 "면접 답변" 참고.
>
> 마지막 갱신: 2026-05-18 (Mini Pay Step 0~11 종결 시점)

---

## 정의

- **표준(Standard)** = Spring Boot / JPA / Spring Security 공식 가이드 + 일반 백엔드 컨벤션
- **우리 결정(Decision)** = 학습 / 도메인 / 운영 특수성으로 의도적 일탈
- 일탈은 항상 **ADR로 근거 박기** — "왜 표준 안 썼냐"에 즉답 가능해야 함

---

## 1. 표준 그대로 채택 (Step 1~11 통합)

| 항목 | 채택 이유 |
|---|---|
| **패키지 구조** `domain/repository/service/controller/dto/config/exception` | DDD 라이트 표준 — 팀에서 어디에 뭐 둘지 즉시 합의 가능 |
| **Flyway 단방향 + V_n 추가만** | Flyway 공식 권장. CI/협업자 환경 동기화 (ADR-0004) |
| **`@Embedded` + `@AttributeOverrides`로 VO 매핑** | JPA 표준 VO 패턴 |
| **`@Enumerated(EnumType.STRING)`** | JPA 권장 — ORDINAL은 순서 바뀌면 데이터 손상 (ADR-0002) |
| **`@NoArgsConstructor(PROTECTED)` + 정적 팩토리** | JPA 프록시 호환 + 외부 차단 (ADR-0003) |
| **`ddl-auto: validate`** | 운영 권장 — Flyway가 진실, 엔티티는 그걸 따른다 |
| **`OffsetDateTime` + `TIMESTAMPTZ`** | JSR-310 + 글로벌 표준 — 시차 안전 |
| **`NUMERIC(19,4)` + `BigDecimal`** | 금융 시스템 표준 — Float/Double은 정밀도 손실 (ADR-0001) |
| **DTO Java `record` + jakarta.validation** | Java 14+ 표준 + Spring Boot 권장 |
| **`@Transactional` 서비스 레벨** | Spring 권장 — 트랜잭션 경계는 비즈 로직 단위 |
| **`@RestControllerAdvice` 에러 일괄 매핑** | Spring MVC 표준 — 도메인이 HTTP 모르게 |
| **BCrypt `strength=10`** | Spring Security 디폴트 + OWASP 권장 (ADR-0007) |
| **Spring Security 6 lambda DSL** | 6.x 표준 패턴 |
| **`@Lock(LockModeType.PESSIMISTIC_WRITE)` for 잔액 변경** | JPA + Hibernate 권장 (Vlad Mihalcea) — 금융 도메인 (ADR-0009) |
| **Spring Data 메서드 이름 파싱** (`findByAccountIdOrCounterpartyAccountIdOrderByCreatedAtDesc`) | Spring Data JPA 표준 |
| **OpenAPI 3 + springdoc Bearer Security Scheme** | springdoc 표준 — Swagger UI Authorize 통합 |
| **`@SpringBootTest` for 통합 테스트** | Spring 표준 — 메서드에 `@Transactional` 금지(롤백이 동시성 깸) |

> **한 줄 이유**: 표준은 팀 합류 시 학습 비용 0. 면접관/리뷰어도 즉시 이해. 일탈할 명백한 이유 없으면 표준 따른다.

---

## 2. 의도적 일탈 (Step 1~11 통합, ADR 11장)

| # | 항목 | 표준은 무엇이었나 | 왜 일탈했나 | 근거 |
|---|---|---|---|---|
| 1 | **`Money` VO 직접 정의** | JSR 354 `javax.money` 표준 | 의존성 회피 + 학습 가치 | ADR-0001 |
| 2 | **Transaction → Account ID 참조** | JPA `@ManyToOne` 객체 참조 | `open-in-view: false` + N+1 회피 + 애그리거트 경계 | ADR-0005 |
| 3 | **이체 = 단일 행 + `counterparty_account_id`** | 회계 표준은 복식부기(2행 + group_id) | 학습 범위 단순화 + 결제 로직 재사용 | ADR-0006 |
| 4 | **`AuthService` 통합 (signup/login 한 클래스)** | 분리 권장 | 인증 한 도메인 — 응집도 우선 | ADR-0007 |
| 5 | **Step 4용 임시 SecurityConfig** | SecurityConfig 한 번에 완성 | Step 4→5 점진적 학습 동선 | ADR-0007 (Step 5에서 회수) |
| 6 | **인증 실패 응답 통일(`INVALID_CREDENTIALS`)** | UX는 "이메일 없음/비번 틀림" 구분 | 보안 우선 — 계정 존재 노출 금지 | CLAUDE.md "보안" |
| 7 | **PIN을 비번과 같은 BCrypt strength 10** | PIN 짧음 → rate limit + 별도 정책 | 학습 단순화 | ADR-0007 |
| 8 | **단일 통화 `KRW` 고정** | 다중 통화 시스템 | 도메인 의도적 제외 | ADR-0001 |
| 9 | **fallback 핸들러에 `log.error` 명문화** | "남기는 게 좋음" 권고 수준 | 한 번 다쳤음(0515 Swagger 함정) — ADR로 박아 규칙화 | ADR-0007 보강 |
| 10 | **Refresh token 미도입, 1시간 access만** | OAuth2 access + refresh 쌍 | 단일 서버 + 학습 범위 | ADR-0008 |
| 11 | **JWT 검증 시 DB 조회 X — `sub` claim만 신뢰** | 매 요청 사용자 조회 / 즉시 무효화 | stateless 보존 + 매 요청 DB 1회 회피 | ADR-0008 |
| 12 | **401 명시화 (`AuthenticationEntryPoint`)** | Spring Security 디폴트 403 fallback | "인증 자체 없음 = 401" 의미 분리 | ADR-0008 |
| 13 | **`UserDetailsService`/`UserDetails` 안 만듦** | Spring Security 표준 인터페이스 | 도메인 `User`와 충돌, principal `Long` | ADR-0008 |
| 14 | **두 계정 락 `account_id` 오름차순 정렬** | 표준 없음 — 도메인 패턴 | Coffman conditions 중 circular wait 제거 → 데드락 원천 차단 | **ADR-0011** |
| 15 | **멱등성 응답 캐시 = DB 재조회 (Redis에 응답 JSON 안 저장)** | Stripe 같은 곳은 Redis 응답 캐싱 | 진실의 단일 출처(DB) + 캐시-DB 비동기 드리프트 회피 | **ADR-0010** |
| 16 | **Redis 장애 시 `tryAcquire` true fallback** | 표준 없음 — 운영 결정 | 가용성 우선, DB UNIQUE가 최후 방어선 | **ADR-0010** |
| 17 | **`AccountNotFoundException` 의미 분리 (`forUser`/`forAccount`)** | 단일 생성자가 일반적 | 메시지가 의미 충돌하지 않게 정적 팩토리 강제 | Step 8-B 부수 개선 |
| 18 | **`PageResponse<T>` 자체 포맷** | Spring `Page` 직렬화 | `pageable/sort/first/last` 등 18+ 필드 노출 차단 — API 계약 5필드 | Step 9 |
| 19 | **`TransactionDirection` enum (SELF/SENT/RECEIVED)** | String "SENT"/"RECEIVED" 가능 | enum 선호 일관성(ADR 0002) + 응답 JSON 명료성 | Step 9 |
| 20 | **이체 송금자 ID는 `findIdByUserId` projection** | `findByUserId` 후 `.getId()` 자연스러움 | JPA 1차 캐시가 이후 `findByIdForUpdate` 락 무력화 함정 | **Step 10 함정 픽스** ⭐ |
| 21 | **모니터링/메트릭 없음** | Actuator + Prometheus + Grafana | 가이드 외 — 완주 후 확장 후보 | — |
| 22 | **trace ID 없음** | 분산 시스템 표준 | 단일 서버 — 비용 > 가치 | — |

> **한 줄 이유**: 학습 + 도메인 단순성이 우선. 일탈할 때마다 ADR로 근거 박아둠 → 면접에서 "왜 표준 안 썼냐"에 즉답.

---

## 3. 발견한 함정 4종 (면접 답변지 깊이용)

| # | 함정 | Step | 학습 가치 | 해결 |
|---|---|---|---|---|
| 1 | **Flyway V3 checksum mismatch** | 5 | 라인 엔딩 변환 시 체크섬 깨짐 → CI 환경 동기화 실패 | `.gitattributes`로 `*.sql text eol=lf` 강제 + DB `flyway_schema_history` 재계산 |
| 2 | **Swagger 500 INTERNAL_ERROR** | 4 | springdoc 2.6.0 ↔ Spring Boot 3.5(Framework 6.2) 호환성 + fallback 핸들러가 stacktrace 삼킴 | 2.6.0 → 2.8.13 업그레이드 + fallback에 `log.error("Unhandled exception", ex)` 영구 추가 |
| 3 | **`NoResourceFoundException` → 500 fallback** | 6 | 매핑 없는 경로가 디폴트로 fallback handler에 떨어짐 | `@ExceptionHandler(NoResourceFoundException.class) → 404 NOT_FOUND` 명시 추가 |
| 4 | **JPA 1차 캐시가 `PESSIMISTIC_WRITE` 무력화** ⭐⭐⭐ | 10 | 비락 조회 후 락 조회 시 캐시 hit → `SELECT FOR UPDATE` 미발동. 데드락도 예외도 없이 잔액 어긋남. **통합 테스트가 없으면 영영 못 잡음** | `findIdByUserId` JPQL projection으로 엔티티 영속화 회피 |

---

## 4. 검증된 시나리오 (정합성 증거)

### Swagger E2E 12/12 통과 (Step 11 — `docs/swagger-e2e-0518.md`)
- 골든 패스 6: signup → login → charge → payment → transfer → transactions
- 엣지 6: 잔액 초과 / 멱등 replay / 자기 자신 / 잔액 초과 이체 / JWT 누락 / 중복 이메일

### 동시성 통합 테스트 3/3 통과 (Step 10 — `ConcurrencyTest.java`)
| 시나리오 | ADR | 시간 | 핵심 |
|---|---|---|---|
| 결제 100건 동시 | 0009 비관적 락 | 1.23s | 잔액 0, PAYMENT count=100, 누락 0 |
| 같은 멱등키 10번 동시 | 0010 멱등성 | 1.31s | PAYMENT 1건, 모두 같은 transactionId |
| A↔B 양방향 200건 동시 | 0011 락 정렬 | 2.49s | 데드락 0, 잔액 합 2,000,000 보존 |

---

## 5. 면접 답변 (Q&A 8종)

### Q1. "이 프로젝트 어디가 일반적이고 어디가 본인 선택이에요?"

> 표준 따른 건 학습 비용 / 팀 합의 우선이고, 일탈한 건 모두 ADR 11장에 결정 근거·대안·트레이드오프·재검토 신호까지 박았습니다. 가장 큰 일탈 3개만 꼽자면 (1) **이체 단일 행 + counterparty**(복식부기 회피), (2) **두 계정 락 `account_id` 오름차순 정렬**(데드락 원천 차단), (3) **멱등성 응답 캐시 = DB 재조회**(Redis 응답 캐싱 회피)입니다.

### Q2. "왜 표준 안 썼어요?"

> 표준의 이점은 알지만 학습 / 도메인 단순성을 우선했고, 운영 환경에 가까워지면 재검토할 신호도 ADR에 박아뒀습니다. 예: **Money VO**는 다중 통화 도입 시 JSR 354로 마이그레이션, **Transaction의 ID 참조**는 거래내역 화면 복잡도 임계점 넘으면 `@EntityGraph` 도입, **응답 캐시 DB 재조회**는 멱등 응답 SLA 요구가 들어오면 Redis 캐싱 추가.

### Q3. "표준 따른 것 중 가장 의미 있는 결정은?"

> **`@Enumerated(EnumType.STRING)`** 입니다. 디폴트인 ORDINAL은 enum 선언 순서가 DB 정수로 저장되어 순서 한 번 바꾸면 기존 데이터 의미가 통째로 뒤바뀝니다 — 충전이 결제로 둔갑하는 식. 디폴트가 더 위험한 케이스라 명시 채택이 곧 안전망입니다. 우리 프로젝트는 `TransactionType`, `TransactionStatus`, `Currency`, `TransactionDirection` 등 enum 5종 모두 STRING.

### Q4. "표준에서 가장 크게 벗어난 결정 하나를 깊이 설명해주세요"

> **이체를 단일 행 + `counterparty_account_id`로 표현한 것** (ADR-0006). 표준은 복식부기 — 송금자 차변 / 수신자 대변 두 행. 우리는 (1) 기존 `transactions` 단일 행 구조 보존, (2) 결제 로직(비관적 락 + 멱등성) 재사용, (3) DB CHECK 제약 3중 방어로 정합성, (4) 트레이드오프로 수신자 시점 잔액은 행에 없어 응답에 `balanceAfter=null`로 정직 표현. Step 9 거래내역에서 `direction`(SENT/RECEIVED) enum으로 양쪽 시점 모두 보이게 했고, Step 10 통합 테스트로 A↔B 양방향 200건 동시 이체에서 잔액 합 2,000,000 보존 검증.

### Q5. "결정의 진화를 보여주는 사례가 있나요?"

> ADR-0007 (인증·에러 핸들링 기반). 처음엔 fallback 핸들러를 "응답 형식 통일"용으로만 박았는데, Swagger 500 트러블슈팅(`docs/swaggerTroubleShoot0515.md`)에서 stacktrace를 fallback이 삼키면 진단 자체가 불가능한 걸 한 번 겪었습니다. 그래서 ADR-0007에 "fallback은 반드시 `log.error`로 stacktrace 남긴다" 룰을 사후 보강했고, 그 보강이 Step 6에서 즉시 가치 발휘 — `NoResourceFoundException`을 한 줄 로그로 5분 만에 식별했습니다.

### Q6. "가장 어려웠던 버그는?" ⭐

> **JPA 1차 캐시가 `PESSIMISTIC_WRITE`를 무력화한 사고**입니다(Step 10). 양방향 이체 200건 동시 테스트에서 데드락도 예외도 없는데 잔액 합이 17,000원 어긋났습니다. 원인은 `TransferService.transfer()` 첫 줄에서 송금자 ID를 알기 위해 `findByUserId`로 Account를 가져온 게 영속성 컨텍스트에 캐시됐고, 이후 `findByIdForUpdate(senderId)` 호출 시 Hibernate가 1차 캐시 hit으로 **`SELECT FOR UPDATE`를 발동시키지 않은 것**입니다. 락이 안 잡힌 채 deduct → race condition. **정적 분석으로 절대 안 잡히는 버그**라 통합 테스트가 없었으면 영영 못 잡았을 사고입니다. 해결: `AccountRepository`에 `findIdByUserId` JPQL projection(`select a.id from Account a`) 추가해서 엔티티 영속화 없이 ID만 추출. 이 함정은 CLAUDE.md "동시성" 섹션에 한 줄로 박았습니다.

### Q7. "동시성/멱등성 어떻게 보장하나요?" ⭐

> 세 ADR로 답할 수 있습니다.
> - **ADR-0009 (비관적 락)**: 잔액 변경은 `@Lock(PESSIMISTIC_WRITE)` 디폴트. 낙관적 락(@Version+재시도)은 금융 도메인 부적합 — 재시도가 UX를 손상시키고 한도 정책 부담이 생깁니다. Step 10 통합 테스트로 결제 100건 동시 → 잔액 0, 누락 0 검증.
> - **ADR-0010 (멱등성 이중 방어)**: `Idempotency-Key` 헤더 + Redis SETNX(1차) + DB `UNIQUE(idempotency_key)`(최후 방어). Redis 장애 시 `tryAcquire` true fallback으로 결제 자체는 살리고, DB UNIQUE가 최종 차단. 응답 캐시는 DB 재조회로 SSoT 유지. 통합 테스트로 같은 키 10번 동시 → PAYMENT 1건, 모두 같은 transactionId 검증.
> - **ADR-0011 (두 계정 락 정렬)**: 이체에서 송금자/수신자 두 행에 락이 필요한데, A→B와 B→A가 동시 들어오면 데드락 위험. `Math.min/max`로 `account_id` 오름차순 정렬 후 락 획득 → 모든 트랜잭션이 같은 순서로 잡아 circular wait 형성 불가. A↔B 200건 동시 → 데드락 0 검증.

### Q8. "프로젝트 한 줄 요약 + 자랑할 만한 점 3개"

> "결제·이체 백엔드 학습 프로젝트로, 동시성·멱등성·이체 모델링을 한 도메인에 모았습니다."
> - **ADR 11장** — 결정마다 대안 비교 + 트레이드오프 + 재검토 신호까지. 면접 답변지로 그대로 들고 다닐 수 있는 의사결정 기록.
> - **통합 테스트로 진짜 검증** — 락 무력화 함정을 발견·해결한 경험이 가장 큰 자산. 데드락도 예외도 없는데 잔액이 어긋나는 버그는 통합 테스트 없으면 영영 못 잡습니다.
> - **API 12종 Swagger E2E 통과** — `docs/swagger-e2e-0518.md`에 결과 표 + 시각적 시연 가이드. 면접관에게 5분 만에 보여줄 수 있는 형태.

---

## References

- `docs/adr/` (0001~0011) — 각 결정의 전체 근거 / 대안 / 트레이드오프 / 재검토 신호
- `docs/uShould.md` — Step별 산출물 매핑 (전체 완료)
- `docs/uLearn.md` — 보유한 학습 자산 인덱스 (종결 시점)
- `docs/ready.md` — 도메인 / API 명세 / 시나리오 12종
- `docs/swagger-e2e-0518.md` — Step 11 E2E 검증 결과 + 면접 답변지 매핑
- `docs/swaggerTroubleShoot0515.md` — Step 4 Swagger 500 트러블슈팅 (함정 2번)
- `src/test/java/com/minipay/service/ConcurrencyTest.java` — Step 10 통합 테스트
- `CLAUDE.md` — 프로젝트 컨벤션 + 코드 리뷰 체크리스트 (ADR 트레이서형)
