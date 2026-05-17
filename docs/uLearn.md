# Mini Pay 완성 시 학습 자산


> 가이드(`docs/mini-pay-guide.md`) + 우리 컨벤션(`CLAUDE.md`) + ADR을 종합해, 면접에서 실제로 써먹을 수 있는 단위로 정리.

---

## 🎯 1. 동시성 (메인 학습 포인트)

- **비관적 락 vs 낙관적 락의 의도적 선택**
  - 돈은 재시도 부적절 + 충돌 빈번 + 트랜잭션 짧음 → 비관적 락
  - "왜 낙관적 락이 아닌가"를 트레이드오프로 설명할 수 있는 경험
- **`SELECT FOR UPDATE` 동작 직접 관찰** (Postgres)
- **락 빼고 깨뜨려보기 → 잔액 음수 race condition 직접 목격** (Step 10)
- **트랜잭션 안에서 외부 I/O 금지 룰** — 락 점유 시간 = 장애 반경

## 🎯 2. 멱등성 (실무 단골 주제)

- **Redis SETNX + DB UNIQUE 이중 방어** (왜 둘 다 필요한가)
- **Redis 장애 시에도 결제는 살아있어야 함** → DB UNIQUE가 최종 차단
- **Idempotency-Key 헤더 표준 패턴** (Stripe/PG사 컨벤션과 동일)
- TTL 설계 (10분 디폴트의 근거)

## 🎯 3. 트랜잭션 설계

- `@Transactional` 경계와 락 획득 순서
- `readOnly = true`로 조회 트랜잭션 분리
- `open-in-view: false` — 커넥션 풀 고갈 회피
- AFTER_COMMIT 이벤트로 부수 작업 분리 (선택 학습)

---

## 💎 4. 도메인 모델링 (Tell, Don't Ask)

- **Anemic Domain Model 회피** — `account.deduct(money)` vs `if (balance < amount)`
- **정적 팩토리 메서드 패턴** — setter 금지, 도메인 동사 이름(`openFor`, `charge`, `payment`, `register`)
- **Value Object** — `Money` VO로 BigDecimal 직접 노출 방지, scale 4 / HALF_EVEN
- **애그리거트 경계** — Transaction이 Account를 ID로만 참조 (ADR 0005)
- **도메인 예외** — `InsufficientBalanceException`, `DuplicateEmailException` 등으로 비즈니스 규칙 표현

## 💎 5. JPA 실전 함정

- `ddl-auto: validate`로 엔티티-스키마 정합성 보장
- `@Enumerated(EnumType.STRING)` 강제 (ORDINAL 데이터 손상 함정)
- `@Embeddable` + `@AttributeOverrides`로 같은 VO 두 번 임베딩
- `@NoArgsConstructor(PROTECTED)` — JPA 프록시 호환 + 외부 차단
- N+1 함정 인지 + ID 참조로 회피
- **`@ManyToOne` 기본 EAGER → 항상 LAZY 명시 룰**

---

## 🛡 6. 보안

- **Spring Security 6 + JWT 필터 체인**
- BCrypt 해싱 (password + PIN 분리)
- **인증 실패 메시지 통일** — 계정 존재 여부 노출 금지
- CSRF 비활성화 시점 (stateless API)
- `@AuthenticationPrincipal`로 컨트롤러에 userId 주입

## 🛡 7. 운영 마인드셋

- **Flyway 단방향 마이그레이션** — V1 절대 수정 금지, V2부터 추가만
- 학습 중 `down -v`로 회복하지 않기 → 운영 시뮬레이션
- **DB-level 제약(CHECK/UNIQUE/FK)을 자바 검증의 최후 방어선으로**
- 비밀값 `.env` 분리, `${VAR:default}` 패턴

---

## 🏗 8. 인프라 / 도구

- **Docker Compose** — Postgres + Redis 멀티 컨테이너 (네트워크/볼륨)
- **Spring Boot 3.5 + Java 17** 프로젝트 구조
- **Gradle 빌드 / 의존성 관리**
- **Flyway 마이그레이션 운영**
- **PostgreSQL** — `NUMERIC(19,4)`, `TIMESTAMPTZ`, `BIGSERIAL` 같은 실무 타입 선택
- **OpenAPI/Swagger** E2E 시연

## 🏗 9. 디버깅 능력

- **스택 트레이스 거꾸로 읽기** (`Caused by` 가장 안쪽)
- **SQLState 5자리 표준** (08xxx 연결 / 23xxx 무결성 / 42xxx 문법 / 40xxx 트랜잭션)
- 통합 테스트로 진짜 동시성 검증 (`@SpringBootTest` + 실제 DB)

---

## 📝 10. 의사결정 기록 (ADR) — 면접 답변지의 본체

완성 시 **ADR 8~9장** 보유:

- 0001 Money VO / 0002 Enum STRING / 0003 정적 팩토리 / 0004 Flyway 단방향 / 0005 ID 참조
- (예정) 0006 비관적 락 / 0007 멱등성 이중방어 / 0008 Refresh Token 미도입 / 0009 AFTER_COMMIT

각 ADR이 **Status / Context / Decision / Rationale(대안 비교) / Consequences / References** 6섹션 → 그대로 면접 답변.

---

## 💼 면접에서 받을 수 있는 질문 → 이 프로젝트로 답 가능

| 질문 | 어디서 답 |
|---|---|
| "동시 결제 어떻게 처리하셨어요?" | Step 8·10, ADR 0006 |
| "이중결제 막아본 적 있어요?" | Step 8, ADR 0007 |
| "BigDecimal 그냥 쓰면 안 돼요?" | Money VO, ADR 0001 |
| "JPA 연관관계 어떻게 잡으셨어요?" | ADR 0005 |
| "스키마 변경 어떻게 운영해요?" | Flyway, ADR 0004 |
| "트랜잭션 안에서 외부 호출하면 왜 안 돼요?" | CLAUDE.md 트랜잭션 룰 |
| "락의 비용은 얼마나 들어요?" | Step 10 동시성 테스트 결과 |

---

## 📌 요약

**기술 스택 학습은 곁다리.** 진짜 자산은:

1. **돈을 다루는 시스템의 안전 장치** 3종(락·멱등성·트랜잭션 원자성)을 직접 구현·검증한 경험
2. **결정마다 "왜"를 ADR로 박아둔 의사결정 능력**
3. **운영 마인드셋** (단방향 마이그레이션, 보안 노출 방지, 다층 방어)

학습용 프로젝트 중에서는 드물게 **면접 답변지로 그대로 들고 갈 수 있는** 구조라, 완주만 하면 신입~주니어 백엔드 면접에서 강력한 무기.
