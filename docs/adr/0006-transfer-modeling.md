# ADR-0006: 이체(TRANSFER) 거래는 단일 행으로 표현한다

## Status
Accepted

(날짜: 2026-05-14)

## Context
회원 간 이체(P2P 송금) 기능을 추가하면서 거래를 DB에 어떻게 표현할지 결정 필요. 기존 `transactions` 테이블은 충전(CHARGE)/결제(PAYMENT)를 **단일 행 + `type` enum** 으로 표현하고 있고, ready.md에 "거래 표현: 단일 행 + type enum, 송금 없음 → 복식부기 불필요"로 박혀 있었음.

후보:
- **A**: 단일 행 + `counterparty_account_id` 컬럼 — 송금자 시점 1행만 INSERT, 수신자는 역조회.
- **B**: 2행 + `transfer_group_id` — `TransactionType.TRANSFER_OUT`/`TRANSFER_IN` 두 행, 그룹키로 페어링 (복식부기 스타일).
- **C**: 별도 `transfers` 테이블 — `from_account_id`/`to_account_id` 한 행에 모두 보관, `transactions`와 분리.

관련 Step: 3 (엔티티/마이그레이션), 8 (서비스 — 비관적 락 + 멱등성).

배경 제약:
- **학습 프로젝트 — 도메인 단순성 우선**. 실 정산/회계 시스템 수준의 복식부기는 학습 범위 초과.
- **ADR 0005 일관성** — Transaction → Account는 ID 참조. 어떤 안을 골라도 객체 참조 도입하지 않음.
- **ADR 0004 (Flyway 단방향)** — V1/V2 보존 필수. 가능한 영향 최소화.
- 결제 흐름(Step 8 비관적 락 + 멱등성)을 재사용할 수 있어야 학습 동선이 매끄러움.

## Decision
**A안 채택** — `transactions` 테이블에 `counterparty_account_id BIGINT NULL` 컬럼 추가. `type = 'TRANSFER'` 행만 채워지고, DB CHECK 제약으로 일관성 강제.

```sql
-- V3__transfer.sql
ALTER TABLE transactions
    ADD COLUMN counterparty_account_id BIGINT NULL REFERENCES accounts(id);

ALTER TABLE transactions
    ADD CONSTRAINT transactions_counterparty_consistency
    CHECK (
        (type = 'TRANSFER' AND counterparty_account_id IS NOT NULL)
        OR
        (type <> 'TRANSFER' AND counterparty_account_id IS NULL)
    );

ALTER TABLE transactions
    ADD CONSTRAINT transactions_counterparty_not_self
    CHECK (counterparty_account_id IS NULL OR counterparty_account_id <> account_id);
```

자바:
```java
public static Transaction transfer(Long accountId, Long counterpartyAccountId,
                                   Money amount, Money balanceAfter,
                                   String idempotencyKey) { ... }
```

## Rationale

**B (2행 + group_id)를 안 고른 이유:**
- `TransactionType`이 `TRANSFER_OUT`/`TRANSFER_IN` 두 값으로 분리되어 enum 표현 복잡도 ↑. 기존 CHARGE/PAYMENT의 1-type-1-row 모델과 비대칭.
- **두 행의 정합성을 서비스가 보장해야 함** — 트랜잭션 도중 한 쪽만 INSERT되면 정합성 깨짐. 학습 단계에서 복잡도 ↑, 디버깅 비용 ↑.
- 멱등키도 두 행에 같은 값을 박을지 분리할지 결정 필요 (UNIQUE 제약 충돌). 결제와 다른 패턴 도입 → 학습 동선 분기.
- 복식부기는 실 회계/정산 시스템(차변/대변 분리)에서 가치 큼. Mini Pay 학습 범위에선 과한 추상화.

**C (별도 테이블)를 안 고른 이유:**
- 거래내역 조회(Step 9)에서 `transactions UNION transfers` 또는 두 번 쿼리. 페이지네이션 복잡.
- 멱등키 UNIQUE 제약을 두 테이블에 어떻게 걸지 추가 결정 필요. 결제 흐름과 일관성 깨짐.
- 새 테이블/인덱스/FK 세트가 들어와 ADR 0004 보존 정신과 정면 충돌은 아니지만 마이그레이션 영향 면적이 가장 큼.

**A가 주는 보장:**
- **기존 `transactions` 행 구조 유지** — V1/V2 영향 없음. 컬럼 1개 + CHECK 2개 + 부분 인덱스 1개로 종결.
- **거래내역 조회 단순**: `WHERE account_id = ? OR (type = 'TRANSFER' AND counterparty_account_id = ?)` 한 쿼리.
- **멱등키 UNIQUE 제약 그대로** — 결제와 동일 패턴. Step 8 흐름 재사용 가능.
- **DB CHECK + FK + UNIQUE 3중 방어** — 자바 검증 우회 시에도 정합성 보장.

**대안 비교:**
| 축 | A (단일 행) ✅ | B (2행+group) | C (별도 테이블) |
|----|----------------|----------------|-----------------|
| 스키마 변경 면적 | 컬럼 1 + CHECK 2 + 인덱스 1 | 컬럼 2 + enum 값 2개 분할 | 새 테이블 + 인덱스 + FK |
| 자바 복잡도 | 정적 팩토리 1개 | 정적 팩토리 2개 + 페어링 책임 | 정적 팩토리 1개 + 새 엔티티 |
| 거래내역 조회 | OR 조건 1쿼리 | 단순 (`account_id` 단일 조건) | UNION 또는 2쿼리 |
| 복식부기 정합성 | 약함 (송금자만 행 보유) | 강함 | 강함 |
| 멱등키 모델 | 결제와 동일 | 새 규칙 필요 | 새 규칙 필요 |
| 기존 ADR 일관성 (0005) | 보존 | 보존 | 보존 |
| 학습 동선 (Step 8 재사용) | 매끄러움 | 분기 발생 | 분기 발생 |

## Consequences

**좋은 면:**
- 결제 흐름(Step 8 비관적 락 + 멱등성)을 그대로 재사용 — 새 동시성/멱등성 패턴 학습 부담 없음.
- DB CHECK + FK + UNIQUE 3중 방어로 정합성 보호. 자바 검증 우회 시 최후 차단.
- 거래내역 조회(Step 9) 단일 쿼리로 종결.

**나쁜 면:**
- **수신자 시점 잔액 변화는 행에 명시되지 않음** — `balance_after_amount`는 송금자 차감 후 잔액만 기록. 수신자 잔액 추적은 `accounts` 테이블 직접 조회 또는 별도 쿼리 필요.
- **거래내역 OR 조건** — `account_id = ? OR counterparty_account_id = ?` 형태라 PostgreSQL 옵티마이저가 두 인덱스를 분리 스캔(BitmapOr) 후 병합. 일반 `=` 단일 조건보다 플래너 부담 ↑. 부분 인덱스로 보완.
- **두 계정 동시 락 책임이 서비스로 이동** — 송금자/수신자 양쪽 `PESSIMISTIC_WRITE` 필요. 데드락 회피용 락 순서 규칙(예: account_id 오름차순 정렬 후 락) 결정은 Step 8에서.

**재검토 신호:**
- 정산/회계 보고서가 들어와 **차변/대변 분리**가 필수가 되면 → B안(복식부기) 또는 별도 `ledger` 테이블 분리. 이중 기장(double-entry)은 그때 도입.
- 수신자 시점 거래내역 조회가 **핫패스**가 되어 OR 조건 + BitmapOr 성능 문제 발생 시 → 비정규화(수신자 측에도 행 INSERT, 2행 모델로 전환). 이때 멱등키 모델도 같이 재설계.
- TRANSFER가 환불(REFUND)/취소(VOID) 같은 역연산을 가지게 되면 → `original_transaction_id` 컬럼 추가 검토. 단일 행 모델 확장 가능.

## References
- `src/main/resources/db/migration/V3__transfer.sql`
- `src/main/java/com/minipay/domain/Transaction.java` (`transfer` 정적 팩토리)
- `src/main/java/com/minipay/domain/TransactionType.java` (`TRANSFER` 추가)
- ADR 0004 — Flyway 단방향 마이그레이션 정책 (V1/V2 보존 원칙)
- ADR 0005 — Transaction은 Account를 ID로 참조 (일관성 유지)
- `docs/ready.md` — "거래 표현: 단일 행 + type enum" 결정 갱신
- Vaughn Vernon, "Implementing Domain-Driven Design" — Aggregate 간 ID 참조 권장 (B/C안에서도 동일 적용)
