# Mini Pay — 표준(Standard) vs 우리 결정(Decision)

> "이 프로젝트 어디가 일반적이고, 어디가 본인 선택이에요?"에 한 페이지로 답하는 인덱스.
> 결정 근거의 깊이는 `docs/adr/`로 이동. 이 파일은 **분기점만** 박는다.
> 면접 답변지로 그대로 활용 — 마지막 섹션 "면접 답변" 참고.

---

## 정의

- **표준(Standard)** = Spring Boot / JPA / Spring Security 공식 가이드 + 일반 백엔드 컨벤션
- **우리 결정(Decision)** = 학습 / 도메인 / 운영 특수성으로 의도적 일탈
- 일탈은 항상 **ADR로 근거 박기** — "왜 표준 안 썼냐"에 즉답 가능해야 함

---

## 1. 표준 그대로 채택 (Step 1~4)

| 항목 | 채택 이유 |
|---|---|
| **패키지 구조** `domain/repository/service/controller/dto/config/exception` | DDD 라이트 표준 — 팀에서 어디에 뭐 둘지 즉시 합의 가능 |
| **Flyway 단방향 + V_n 추가만** | Flyway 공식 권장. CI/협업자 환경 동기화 (ADR-0004) |
| **`@Embedded` + `@AttributeOverrides`로 VO 매핑** | JPA 표준 VO 패턴 |
| **`@Enumerated(EnumType.STRING)`** | JPA 권장 — ORDINAL은 순서 바뀌면 데이터 손상 (ADR-0002) |
| **`@NoArgsConstructor(PROTECTED)` + 정적 팩토리** | JPA 프록시 호환 + 외부 차단 동시 — Java 도메인 모델 권장 (ADR-0003) |
| **`ddl-auto: validate`** | 운영 권장 — Flyway가 진실, 엔티티는 그걸 따른다 |
| **`OffsetDateTime` + `TIMESTAMPTZ`** | JSR-310 + 글로벌 표준 — 시차 안전 |
| **`NUMERIC(19,4)` + `BigDecimal`** | 금융 시스템 표준 — Float/Double은 정밀도 손실 (ADR-0001) |
| **DTO Java `record` + jakarta.validation** | Java 14+ 표준 + Spring Boot 권장 — Lombok 없이도 충분 |
| **`@Transactional` 서비스 레벨** | Spring 권장 — 트랜잭션 경계는 비즈 로직 단위 |
| **`@RestControllerAdvice` 에러 일괄 매핑** | Spring MVC 표준 — 도메인이 HTTP 모르게 |
| **BCrypt `strength=10`** | Spring Security 디폴트 + OWASP 권장 (ADR-0007) |
| **Spring Security `SecurityFilterChain` Bean (lambda DSL)** | Spring Security 6 표준 패턴 |

> **한 줄 이유**: 표준은 팀 합류 시 학습 비용 0. 면접관/리뷰어도 즉시 이해. 일탈할 명백한 이유 없으면 표준 따른다.

---

## 2. 의도적 일탈 (Step 1~4)

| 항목 | 표준은 무엇이었나 | 왜 일탈했나 | 근거 |
|---|---|---|---|
| **`Money` VO 직접 정의** | JSR 354 `javax.money` 표준 존재 | 의존성 추가 회피 + 학습 가치(VO 직접 짜보기) | ADR-0001 |
| **Transaction → Account를 ID(`Long`) 참조** | JPA 표준은 `@ManyToOne` 객체 참조 | `open-in-view: false` + N+1 회피 + 애그리거트 경계 | ADR-0005 |
| **이체 = 단일 행 + `counterparty_account_id`** | 회계 표준은 복식부기(2행 + group_id) | 학습 범위 단순화 + 결제 로직 재사용 | ADR-0006 |
| **`AuthService` 통합 (signup/login 한 클래스)** | 표준 권장은 `SignupService`/`LoginService` 분리 | 인증 한 도메인 — 응집도 우선 | ADR-0007 |
| **Step 4용 임시 SecurityConfig** | 표준은 SecurityConfig 한 번에 완성 | Step 4→5 점진적 학습 동선 | ADR-0007 |
| **인증 실패 응답 통일(`INVALID_CREDENTIALS`)** | UX 표준은 "이메일 없음 / 비번 틀림" 구분 | 보안 우선 — 계정 존재 노출 금지 | CLAUDE.md "보안" |
| **PIN을 비밀번호와 같은 BCrypt strength 10** | PIN 짧음 → rate limit + 별도 정책이 표준 | 학습 단순화 (Step 8 결제 시 재검토 신호 박힘) | ADR-0007 |
| **단일 통화 `KRW` 고정** | 다중 통화 시스템 표준 | 도메인 의도적 제외 (`docs/ready.md`) | ADR-0001 |
| **fallback 핸들러에 `log.error` 명문화** | 표준은 "남기는 게 좋음" 권고 | 한 번 다쳤음(0515) — ADR로 박아 규칙화 | ADR-0007 보강 + `docs/swaggerTroubleShoot0515.md` |
| **모니터링/메트릭 없음** | 운영 표준은 Actuator + Prometheus + Grafana | 가이드 Step 0~11에 없음 — 완주 후 확장 후보 | — |
| **trace ID 없음** | 분산 시스템 표준 | 단일 서버 — 도입 가치 < 비용 | — |
| **Refresh token 미도입, 1시간 access만** | OAuth2 표준 (access + refresh 쌍 + 회전) | 단일 서버 + 학습 범위 — 재로그인이 UX 허용 | ADR-0008 |
| **JWT 검증 시 DB 조회 X — `sub` claim만 신뢰** | 일부 표준 (매 요청 사용자 조회 / 즉시 무효화 가능) | stateless 보존 + 매 요청 DB 1회 회피 (트레이드오프: 토큰 즉시 무효화 불가) | ADR-0008 |
| **401 명시화 (`AuthenticationEntryPoint`)** | Spring Security 디폴트는 403 fallback | "인증 자체 없음 = 401" / "권한 부족 = 403" 의미 분리 | ADR-0008 |
| **`UserDetailsService`/`UserDetails` 안 만듦** | Spring Security 표준 인터페이스 | 도메인 `User`와 충돌, principal `Long`으로 두면 경계 깔끔 | ADR-0008 |

> **한 줄 이유**: 학습 + 도메인 단순성이 우선. 일탈할 때마다 ADR로 근거 박아둠 → 면접에서 "왜 표준 안 썼냐"에 즉답.

---

## 3. Step 6~11에서 등장할 일탈 미리보기

| Step | 우리 결정 | 표준은 | 이유 | 예상 ADR |
|---|---|---|---|---|
| **8** | 두 계정 락 `account_id` 오름차순 정렬 | 표준 없음 — 도메인 룰 | 데드락 회피 | 0009 후보 |
| **8** | Idempotency-Key 헤더 + Redis SETNX + DB UNIQUE 이중 방어 | IETF draft 존재 (표준 미만) | Redis 장애에도 결제 살아있어야 | 0010 후보 |
| **8** | 트랜잭션 안 외부 I/O 금지 → `AFTER_COMMIT` 이벤트로 분리 | 일반 코드는 자유 | 락 점유 시간↑ + 롤백 어려움 | — |
| **10** | 동시성 통합 테스트에 `@Transactional` 안 붙임 | Spring Test 디폴트는 거의 다 붙임 | 자동 롤백이 동시성 깸 | — |
| **11** | Swagger 시나리오 12개 수동 통과 = 종결 조건 | 표준은 자동 E2E (Postman / RestAssured) | 면접 / 포트폴리오 시연 우선 | — |

---

## 4. 면접 답변

### Q1. "이 프로젝트 어디가 일반적이고 어디가 본인 선택이에요?"

> 표준 따른 건 학습 비용 / 팀 합의 우선이고, 일탈한 건 모두 ADR에 결정 근거·대안·트레이드오프·재검토 신호까지 박았습니다. 가장 큰 일탈 3개만 꼽자면 (1) **이체 단일 행 + counterparty**(복식부기 회피), (2) **Money VO 직접 정의**(JSR 354 회피), (3) **Transaction의 ID 참조**(JPA `@ManyToOne` 회피)입니다.

### Q2. "왜 표준 안 썼어요?"

> 표준의 이점은 알지만 학습 / 도메인 단순성을 우선했고, 운영 환경에 가까워지면 재검토할 신호도 ADR에 박아뒀습니다. 예: **Money VO**는 다중 통화 / 환전 도입 시 JSR 354로 마이그레이션, **Transaction의 ID 참조**는 거래내역 화면 복잡도가 일정 임계점 넘으면 `@EntityGraph` 같은 페치 전략 도입.

### Q3. "표준 따른 것 중 가장 의미 있는 결정은?"

> **`@Enumerated(EnumType.STRING)`** 입니다. 디폴트인 ORDINAL은 enum 선언 순서가 DB 정수로 저장되어 순서 한 번 바꾸면 기존 데이터 의미가 통째로 뒤바뀝니다 — 충전이 결제로 둔갑하는 식. 디폴트가 더 위험한 케이스라 명시 채택이 곧 안전망입니다.

### Q4. "표준에서 가장 크게 벗어난 결정 하나를 깊이 설명해주세요"

> **이체를 단일 행 + `counterparty_account_id`로 표현한 것** (ADR-0006). 표준은 복식부기 — 송금자 차변 / 수신자 대변 두 행. 우리는 (1) 기존 `transactions` 단일 행 구조 보존, (2) 결제 로직(비관적 락 + 멱등성) 재사용, (3) DB CHECK 제약 3중 방어로 정합성, (4) 트레이드오프로 수신자 시점 잔액은 별도 쿼리. 재검토 신호는 "복식부기 회계 보고서가 필요해질 때".

### Q5. "결정의 진화를 보여주는 사례가 있나요?"

> ADR-0007 (인증·에러 핸들링 기반). 처음엔 fallback 핸들러를 "응답 형식 통일"용으로만 박았는데, Swagger 500 트러블슈팅(`docs/swaggerTroubleShoot0515.md`)에서 stacktrace를 fallback이 삼키면 진단 자체가 불가능한 걸 한 번 겪었습니다. 그래서 ADR-0007에 "fallback은 반드시 `log.error`로 stacktrace 남긴다" 룰을 사후 보강했고, 진화 과정이 ADR에 날짜와 함께 박혀있습니다.

---

## References

- `docs/adr/` (0001~0007) — 각 결정의 전체 근거 / 대안 / 트레이드오프 / 재검토 신호
- `docs/uShould.md` — Step별 산출물 매핑
- `docs/uLearn.md` — 완성 시 보유할 학습 자산 인덱스
- `docs/ready.md` — 도메인 / API 명세 / 시나리오
- `CLAUDE.md` — 프로젝트 컨벤션 + 코드 리뷰 체크리스트
