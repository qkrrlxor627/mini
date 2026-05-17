# ADR-0009: 잔액 변경은 비관적 락(`PESSIMISTIC_WRITE`) 디폴트

## Status
Accepted

(날짜: 2026-05-17)

## Context
Step 7~8에서 잔액에 영향을 주는 API 3종이 등장한다 — 충전(`POST /accounts/charge`), 결제(`POST /payments`), 이체(`POST /transfers`). 같은 계좌에 대해 동시 요청이 들어왔을 때 잔액 정합성을 어떻게 보장할지 결정 필요.

핵심 제약:
- **돈** — 잔액이 음수가 되거나 누락되면 즉시 사고. 재시도/롤백 비용이 사용자에게 보이는 영역.
- **트랜잭션이 짧다** — `SELECT account → 검증 → UPDATE balance → INSERT transaction`. 수십 밀리초 이내.
- **충돌 빈도** — 같은 사용자의 동시 결제는 드물지만 0은 아님(클라이언트 더블 클릭, 자동 재시도 등). 동시 결제·이체에서 한 사용자가 송금자/수신자 양쪽으로 잡힐 가능성 있음.

ADR-0006(이체 모델링)의 §컨텍스트와 CLAUDE.md "동시성" 섹션에는 "비관적 락 디폴트"가 이미 박혀있지만 결정 자체를 단독 ADR로 분리한 적이 없음 — Step 7 첫 실전을 계기로 정식 기록.

관련 Step: 7(충전 — 첫 등장), 8(결제·이체), 10(동시성 통합 테스트).

## Decision

### **잔액 변경은 `@Lock(LockModeType.PESSIMISTIC_WRITE)` 디폴트**

- 충전: `AccountRepository.findByUserIdForUpdate(Long userId)` — `SELECT ... FOR UPDATE`.
- 결제: 동일 메서드 재사용.
- 이체: 송금자/수신자 두 계좌 각각 `PESSIMISTIC_WRITE` 획득. 데드락 회피 규칙은 **ADR-0011에서 별도 분리 예정**.

낙관적 락(`@Version` + 충돌 시 재시도)은 **채택하지 않음**.

---

## Rationale

### 1. 낙관적 락이 부적합한 이유 (금융 도메인 + 재시도 비용)
- **재시도 의미 손상**: 결제 충돌 시 자동 재시도가 일어나면 사용자 화면에선 "결제 실패 → 다시 시도" UX가 사라지고 백엔드가 임의로 다시 긁어버림. 결제·이체에서 가장 보수적이어야 할 의사결정.
- **재시도 한도 정책 부담**: 몇 번 재시도? 지수 백오프? 최종 실패 시 어떤 응답? — 답해야 할 결정이 비관적 락보다 많아진다.
- **충돌이 드물면 낙관적 락이 유리하다는 정석**과 어긋남: 우리 도메인은 같은 계좌에 동시 접근이 충분히 일어남(이체에서 한 계좌가 수신자/송금자 양쪽으로 잡힘). 충돌 가정이 더 현실적.

### 2. 비관적 락이 적합한 이유
- **재시도 부적절 + 트랜잭션 짧음 + 충돌 빈번** 세 조건이 비관적 락의 교과서 케이스(Vlad Mihalcea, Hibernate 가이드).
- **로직이 직관적**: "잔액 잠그고 → 깎고 → 풀기". 코드만 봐도 동시성 처리 흐름이 한 줄로 읽힘.
- **금융 도메인 관례**: 은행·증권 코어 시스템 대부분이 잔액 갱신에 row lock(또는 그 위 표현). 이체·정산이 곧 표준 동시성 시나리오.

### 3. `PESSIMISTIC_READ` 대신 `PESSIMISTIC_WRITE`
- `PESSIMISTIC_READ`(=`FOR SHARE`)는 동시 read는 허용하고 write만 차단. 잔액 변경은 결국 UPDATE라 의미 없음 — 다른 트랜잭션이 같은 행 read 후 update 시도하면 결국 막힘.
- `PESSIMISTIC_WRITE`(=`FOR UPDATE`) 한 종으로 통일 — 의도가 명확하고 코드 단순.

### 4. 트랜잭션 안 외부 I/O 금지
- 락을 잡은 트랜잭션은 외부 HTTP/메일/Redis 호출 금지 — 락 점유 시간 늘면 다른 트랜잭션 대기 + 데드락 가능성 증가.
- 결제 성공 후 알림 발송 같은 부수 작업은 `@TransactionalEventListener(phase = AFTER_COMMIT)`로 분리(Step 8+ 후속).
- CLAUDE.md "트랜잭션" 룰과 정합. 코드 리뷰 체크리스트에 박혀있음.

### 5. 락 획득 위치 = 리포지토리 메서드 분리
- 일반 조회와 락 획득용 조회를 같은 이름으로 두면 호출자 의도가 흐려짐.
- `findByUserId` vs **`findByUserIdForUpdate`** — 메서드 이름에 의도(For Update)를 박아 호출 부주의 차단.

---

## Consequences

### 좋은 면
- **로직이 단순** — 비관적 락 + Tell-Don't-Ask(`account.deduct(money)`) 조합으로 잔액 검증·차감이 도메인 메서드 한 줄.
- **동시 결제·이체 정합성 보장** — Step 10 통합 테스트에서 잔액 100,000 + 1,000원 결제 100건 동시 → 잔액 0, success=100, tx=100 시나리오 통과 가능.
- **데드락이 명시적** — 두 계좌 락(이체)에서만 데드락이 가능하고 회피 규칙(account_id 오름차순)이 명시적. 낙관적 락은 데드락 대신 무한 재시도 루프가 잠재적 사고.

### 나쁜 면
- **처리량 저하** — 같은 계좌 동시 요청은 직렬화. 트래픽 폭증 시 대기 큐 형성. 학습 범위에서는 허용 — 정합성 우선.
- **락 점유 시간이 곧 SLA** — 트랜잭션 안에서 느린 작업(외부 호출, 큰 쿼리)이 들어오면 잔액 변경 전체가 막힘. 트랜잭션 안 외부 I/O 금지 룰로 1차 차단, 코드 리뷰로 2차 차단.
- **읽기 전용 화면도 락 경합 가능성** — 거래내역 조회 등은 일반 `findBy*` 메서드만 쓰면 락에 안 걸리지만, 실수로 락 메서드 호출하면 성능 저하. 메서드 이름 규칙(`*ForUpdate`)으로 회피.

### 재검토 신호
- **처리량이 진짜 병목** — 결제 TPS가 학습 범위(수십 TPS)를 넘어 수백 TPS로 성장 + 같은 계좌 동시 결제가 핫스팟. Sharding 또는 큐잉(메시지 기반 직렬화)으로 전환.
- **재시도 정책이 도메인적으로 자연스러움** — 비결제 도메인(예: 카운터 증가, 통계 집계)이 들어와서 재시도가 UX적으로 무해할 때 낙관적 락 부분 도입.
- **분산 트랜잭션 도입** — 결제가 외부 PG 호출과 강결합되면 비관적 락만으로 정합성 보장 불가 → Saga / 보상 트랜잭션 검토.
- **`PESSIMISTIC_READ` 부분 도입** — 잔액 조회만 따로 떼서 일관성 보장이 필요해질 때.

---

## References
- 코드:
  - `src/main/java/com/minipay/repository/AccountRepository.java` — `@Lock(PESSIMISTIC_WRITE)` + `@Query`
  - `src/main/java/com/minipay/service/AccountService.java` — Step 7 첫 실전 (충전)
  - `src/main/java/com/minipay/service/PaymentService.java` — Step 8 결제
  - `src/main/java/com/minipay/service/TransferService.java` — Step 8-B 이체 (예정, 두 계좌 락)
- 컨벤션:
  - `CLAUDE.md` "동시성 (Step 7+)" 섹션 — 비관적 락 디폴트 + 트랜잭션 안 외부 I/O 금지
  - `CLAUDE.md` 코드 리뷰 체크리스트 "트랜잭션 / 동시성" — 락 누락 / 락 잡고 외부 호출 거절
- 문서:
  - `docs/adr/0006-transfer-modeling.md` — 두 계좌 락의 컨텍스트 (구체 규칙은 ADR-0011로 분리 예정)
  - `docs/ready.md` §6-1 결제 시퀀스 다이어그램 — `FOR UPDATE` 명시
  - `docs/uShould.md` Step 10 — 동시성 통합 테스트 시나리오 3종
- 외부:
  - Vlad Mihalcea, "Optimistic vs. Pessimistic Locking" — 충돌 빈도·재시도 비용 기준 선택
  - Hibernate User Guide §"Pessimistic locking" — `PESSIMISTIC_WRITE` 의미와 SQL 매핑
