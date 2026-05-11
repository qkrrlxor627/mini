# ADR-0005: Transaction은 Account를 ID로 참조한다

## Status
Accepted

(날짜: 2026-05-08)

## Context
`Transaction` 엔티티가 `Account`를 어떻게 참조할지 선택. DB 스키마는 `transactions.account_id BIGINT REFERENCES accounts(id)`로 고정 — 자바 표현만 결정 사항.

후보:
- **A**: 객체 참조 — `@ManyToOne(fetch = FetchType.LAZY) Account account`
- **B**: ID 참조 — `Long accountId` ✅

관련 Step: 3 (엔티티 작성).

배경 제약:
- `spring.jpa.open-in-view: false` 고정 (CLAUDE.md). LAZY 프록시는 컨트롤러/뷰에서 만지면 즉시 `LazyInitializationException`.
- 기존 `Account` 엔티티가 이미 `Long userId` 패턴으로 User를 참조 중 — 일관성 고려.
- Step 8에서 결제 API에 비관적 락 + 멱등성 도입 예정 — 도메인 그래프가 단순할수록 좋음.

## Decision
**`Long accountId` (ID 참조)** 채택. JPA `@ManyToOne`/`@OneToMany` 연관관계 미사용.

```java
@Column(name = "account_id", nullable = false)
private Long accountId;
```

## Rationale

**A (객체 참조)를 안 고른 이유:**
- **LAZY 프록시 함정 상시 존재** — 서비스 레이어 트랜잭션 밖에서 `tx.getAccount().getBalance()` 호출 시 예외. open-in-view false 환경에선 더 엄격.
- **N+1 함정** — 거래 목록 조회 + 각 거래의 계좌 정보 접근 시 100건이면 101쿼리. `JOIN FETCH` 명시 패턴을 매 쿼리 신경 써야 함.
- **애그리거트 경계 흐림** — Transaction과 Account를 별개 애그리거트로 보는 DDD 시각에서, 객체 참조는 경계를 깨고 강결합 유발.
- **MSA 분리 시 고통** — 미래에 결제 도메인을 별도 서비스로 쪼갤 때 객체 참조는 깨야 함. 처음부터 ID로 참조하면 그 비용 0.

**B (ID 참조)가 주는 보장:**
- **단순 조회** — `findByAccountId(id)` 한 쿼리로 끝, N+1 우려 없음.
- **직렬화 안전** — DTO 변환 시 LAZY 트리거 사고 없음.
- **일관성** — Account가 `Long userId` 쓰는 것과 같은 패턴. 한 프로젝트에 두 방식 섞이지 않음.
- **트랜잭션 단순화** — Step 8 비관적 락에서 객체 그래프가 단순할수록 락 범위/해석이 명확.

**대안 비교:**
| 축 | A (객체 참조) | B (ID 참조) ✅ |
|----|--------------|----------------|
| 조회 단순성 | LAZY/JOIN FETCH 관리 필요 | 단순, N+1 없음 |
| 도메인 표현 | 풍부 (`tx.getAccount().getBalance()`) | 빈약 (`Long`은 식별자뿐) |
| 애그리거트 경계 | 흐림 | 보존 |
| open-in-view false 정합 | 함정 다수 | 안전 |
| MSA 친화 | 낮음 | 높음 |
| JPA 연관관계 학습 | 한다 | 안 함 |

## Consequences

**좋은 면:**
- 결제 도메인의 단순성 보존 — 동시성/멱등성 단계에서 디버깅 비용 ↓.
- 영속성 컨텍스트 함정(LazyInit) 회피.
- 미래에 결제 도메인 분리 시 변경 비용 거의 없음.

**나쁜 면:**
- Account 정보를 자주 같이 쓰는 화면이 생기면 서비스 레이어에서 별도 조회 + DTO 조립 필요.
- 도메인 객체 그래프 표현이 빈약 — `transaction.getAccount().getOwner()` 같은 자연스러운 탐색 불가.
- JPA 연관관계(`@ManyToOne`, `@OneToMany`, `JOIN FETCH`) 학습 기회를 메인 도메인에서 놓침.

**재검토 신호:**
- 거래 + 계좌 + 사용자를 항상 함께 보는 복잡한 조회가 다수 등장하면 → 객체 참조로 전환 또는 읽기 전용 뷰(read model) 별도 설계.
- JPA 연관관계 학습은 Step 9(거래내역 조회)에서 `JOIN FETCH` 패턴을 별도 영역에서 짚는 것으로 보강.

## References
- `src/main/java/com/minipay/domain/Account.java` (선례 — `Long userId` 패턴)
- `src/main/java/com/minipay/domain/Transaction.java` (작성 예정)
- `src/main/resources/db/migration/V1__init.sql` (외래키 정의)
- CLAUDE.md "JPA 설정" 섹션 (`open-in-view: false`)
- Vaughn Vernon, "Implementing Domain-Driven Design" — Aggregate 간 ID 참조 권장
