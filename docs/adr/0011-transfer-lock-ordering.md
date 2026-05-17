# ADR-0011: 이체 시 두 계좌 락은 `account_id` 오름차순 정렬 후 획득 (데드락 회피)

## Status
Accepted

(날짜: 2026-05-17)

## Context
ADR-0009로 잔액 변경에 `PESSIMISTIC_WRITE`를 디폴트로 박았다. 단일 계좌 변경(충전·결제)은 한 행에 한 트랜잭션이 락을 잡으면 끝이지만, **이체는 송금자/수신자 두 행에 동시에 락을 잡아야** 한다.

같은 두 계좌(A, B) 사이의 동시 이체 시나리오:
- 트랜잭션 T1: `A → B` 이체. 송금자 A 락 먼저, 수신자 B 락 다음.
- 트랜잭션 T2: `B → A` 이체. 송금자 B 락 먼저, 수신자 A 락 다음.
- **데드락 발생**: T1이 A 잡고 B 기다림, T2가 B 잡고 A 기다림 → 사이클 형성.

DB는 데드락을 감지하면 한쪽을 `ERROR: deadlock detected`로 자동 강제 종료한다(PostgreSQL `40P01`). 사용자 입장에선 "되는 이체와 안 되는 이체가 무작위" — 학습·운영 어느 쪽이든 사고.

ADR-0006(이체 모델링) §컨텍스트에 "ADR 0011 후속 분리 여부 Step 8 진입 시 결정"으로 미뤄둔 결정이 이 ADR이다. 데드락 회피 패턴 자체는 이체 도메인을 넘어선 일반 자산이라 단독 ADR로 분리.

관련 Step: 8-B(이체 첫 실전), 10(동시성 통합 테스트 — A↔B 양방향 이체 데드락 없음 검증).

## Decision

### **두 계좌 락은 `account_id` 오름차순으로 정렬 후 순차적으로 `PESSIMISTIC_WRITE` 획득**

```java
long firstId  = Math.min(senderAccountId, receiverAccountId);
long secondId = Math.max(senderAccountId, receiverAccountId);

Account first  = accountRepository.findByIdForUpdate(firstId);
Account second = accountRepository.findByIdForUpdate(secondId);

// 어느 쪽이 sender인지 둘 중에서 판정해서 deduct/charge 분배
```

- 송금/수신 방향과 무관하게 `account_id`가 작은 쪽을 먼저 잠근다.
- 모든 트랜잭션이 같은 순서로 락을 잡으므로 **사이클이 형성될 수 없음** → 데드락 원천 차단.

---

## Rationale

### 1. 데드락 회피의 일반 원리 — 자원 순서 정렬
- 운영체제·DB·동시성 교과서의 정석. **모든 트랜잭션이 자원을 같은 순서로 획득하면 사이클 그래프가 만들어질 수 없다.**
- `account_id`는 `BIGSERIAL` PK라 두 계좌 사이의 전순서가 자연스럽게 정의됨 — 추가 비교 기준 불필요.
- A↔B 두 계좌만 보면 자명하지만, 세 계좌 이상 트랜잭션이 들어와도 같은 원리로 안전(미래 멀티-홉 이체·정산 도입 시 확장).

### 2. DB 데드락 감지를 신뢰하지 않는 이유
- PostgreSQL은 데드락을 감지해 한쪽을 자동 abort하지만 **사용자에겐 무작위 실패로 보인다.**
- 클라이언트는 같은 요청을 재시도할지 결정해야 하는데, 우리 도메인은 멱등성 보장이 있어 재시도가 안전하지만 "이체 실패 → 다시 시도" UX는 보수적이어야 함.
- 회피 가능한 사고는 사전에 막는 게 비용 ≪ 디버깅 + 사용자 신뢰 회복 비용.
- 데드락 감지는 "혹시 모를 다른 락 경로(예: 트리거)"의 safety net 정도로 두고, 정상 경로에서는 절대 발생하지 않도록 설계.

### 3. `account_id` 정렬 후 락 획득 (vs 다른 기준)
- **A안 (채택)**: `account_id` 오름차순. BIGSERIAL → 비교 즉시. 추가 인덱스 불필요.
- **B안**: `user_id` 정렬. 송금자는 본인 user_id 알지만 수신자는 `counterpartyAccountId`라 한 번 SELECT로 user_id를 조회해야 함 → 부가 쿼리 + 의미 불명확.
- **C안**: 락 획득 실패 시 재시도. 데드락 자체는 사라지지 않고 단지 늦춰질 뿐. 재시도 한도·백오프 정책 부담은 ADR-0009의 낙관적 락 기각 사유와 동일.

### 4. 락 획득 후 송금자/수신자 판정
- 정렬된 두 `Account` 객체에서 ID 비교로 어느 쪽이 sender인지 판정.
- `deduct` / `charge`를 잘못된 쪽에 부르지 않도록 명시적 분기:
  ```java
  Account sender   = first.getId().equals(senderAccountId) ? first : second;
  Account receiver = first.getId().equals(receiverAccountId) ? first : second;
  ```
- 코드 가독성: 두 계좌의 역할이 락 순서와 분리됨을 명시.

### 5. 자기 자신 이체는 사전 거부 (락 단계 진입 전)
- ADR-0006 V3 마이그레이션의 DB CHECK(`counterparty_not_self`)가 최후 방어선이지만, 사용자에게 친절한 메시지(`INVALID_TRANSFER_TARGET`)를 주려면 Service에서 먼저 검증.
- 또한 `firstId == secondId`일 경우 위 알고리즘이 한 행에 두 번 락을 시도하게 됨 — JPA 1차 캐시로 두 번째 `findByIdForUpdate`가 같은 객체 반환되지만, 의미 흐림 + DB CHECK가 어차피 거절 → 사전 차단이 자연스러움.

---

## Consequences

### 좋은 면
- **데드락 절대 발생 불가** (정상 코드 경로 기준). DB 데드락 감지 알람은 곧 다른 락 경로(트리거/시스템 작업)가 끼어든 신호로 해석 가능.
- **Step 10 동시성 테스트가 단순** — A↔B 양방향 100건씩 동시 실행해도 모두 성공. 잔액 정합성·거래 수 검증만 하면 됨.
- **확장성** — 멀티-홉 이체(A→B→C 같은 트랜잭션 안)나 정산(여러 계좌 동시 업데이트)이 들어와도 같은 원리로 안전.

### 나쁜 면
- **코드 가독성 약간 손상** — "송금자 락 → 수신자 락"이 자연스러운데 "최소 ID → 최대 ID" 순서로 한 단계 추상화됨. 주석/명확한 변수명(`firstId`/`secondId`)으로 보완.
- **`account_id` 외 기준 도입 시 재검토** — 미래에 계좌 ID 외의 자원(예: 가맹점, 외부 PG 연결)도 동시 락 필요해지면 정렬 키 통합 필요.

### 재검토 신호
- **세 자원 이상의 동시 락 패턴 등장** — 이체 + 가맹점 정산 + 외부 PG가 한 트랜잭션 안에서 락을 잡는 시나리오. 정렬 키 통합 또는 분산 락(Redis Redlock) 검토.
- **장기 실행 트랜잭션 도입** — 락 점유 시간이 길어지면 정렬해도 처리량 병목. 이체 전부를 큐 기반 직렬 처리(메시지 워커)로 전환 검토.
- **PostgreSQL 외 DB 도입** — MySQL의 `SELECT ... FOR UPDATE`는 인덱스 hit 여부에 따라 락 범위가 다름(gap lock 포함). 이식 시 동작 재검증 필요.
- **데드락 알람 발생** — 운영에서 한 번이라도 PostgreSQL `40P01`이 잡히면, 정상 경로 외에 다른 락 경로(트리거/외부 작업)가 끼어든 신호 → 추적·차단.

---

## References
- 코드:
  - `src/main/java/com/minipay/service/TransferService.java` — `Math.min`/`Math.max`로 정렬 후 `findByIdForUpdate` 순차 호출
  - `src/main/java/com/minipay/repository/AccountRepository.java` — `findByIdForUpdate(Long accountId)` (이체 수신자 락 진입점)
- 컨벤션:
  - `CLAUDE.md` "동시성 (Step 7+)" — 이체는 두 계정 락 + `account_id` 오름차순 명시
  - `CLAUDE.md` 코드 리뷰 체크리스트 "트랜잭션 / 동시성" — 락 순서 미정렬 시 거절
- 문서:
  - `docs/adr/0006-transfer-modeling.md` — 이체 모델링 (이 ADR이 후속 분리)
  - `docs/adr/0009-pessimistic-locking.md` — 비관적 락 선택 (단일 계좌 패턴, 이 ADR이 두 계좌 확장)
  - `docs/ready.md` §5 Transfers — "송금자/수신자 양쪽에 PESSIMISTIC_WRITE, account_id 오름차순"
  - `docs/uShould.md` Step 10 — A↔B 양방향 이체 동시 100건 시나리오
- 외부:
  - PostgreSQL Doc "Concurrency Control" §13.3 Explicit Locking — `SELECT FOR UPDATE` 동작 / 데드락 감지(`40P01`)
  - Coffman conditions for deadlock — 자원 순서 정렬은 "circular wait" 조건 제거로 데드락 회피
