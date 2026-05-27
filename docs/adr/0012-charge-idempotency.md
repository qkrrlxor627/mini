# ADR-0012: 충전(CHARGE) API에도 멱등성 적용 (ADR-0010 패턴 확장)

## Status
Accepted

(날짜: 2026-05-26)

## Context
Step 7에서 충전 API(`POST /api/v1/accounts/charge`)를 만들 때 멱등성을 의도적으로 생략했다 — "Step 8 결제·이체와 달리 충전은 멱등성 적용 안 함"(`docs/api.md`, 당시 `progress.md`). 이는 기술적 판단이 아니라 **학습 가이드 진행 순서** 때문이었다. 멱등성 개념 자체가 Step 8에서 처음 등장하므로, Step 7 충전엔 붙이지 않고 넘어갔다.

그러나 충전도 **돈이 들어오는 쓰기 작업**이다. 결제·이체와 정확히 같은 위험을 가진다:
- 클라이언트 더블 클릭 → 잔액 2배 증가
- 네트워크 타임아웃 후 자동 재시도 → 같은 충전이 두 번 반영

즉 "충전엔 왜 멱등키가 없나"는 결함을 짚는 정당한 질문이고, 결제·이체에만 멱등성을 거는 것은 일관성이 없다. Step 11 종료 후 이 비대칭을 해소한다.

관련 Step: 7(충전 첫 구현), 8(멱등성 첫 도입), 12(이 결정).

## Decision

충전 API에 결제·이체와 **동일한 멱등성 이중 방어**를 적용한다 (ADR-0010 패턴 그대로 확장).

1. **`Idempotency-Key` 헤더 필수** — 누락/빈 값이면 `400 MISSING_IDEMPOTENCY_KEY` (결제·이체와 동일).
2. **Redis SETNX(1차) + DB `UNIQUE(idempotency_key)`(최후 방어)** — `IdempotencyStore.tryAcquireCharge`에 prefix `idem:charge:`를 추가해 결제/이체와 Redis 네임스페이스 분리.
3. **응답 캐시는 DB 재조회** — `findByIdempotencyKey`로 첫 거래를 읽어 `ChargeResponse.from(tx)` 재생성 (SSoT는 DB).
4. **본문 일치 검증** — 같은 키 + 같은 본문(`accountId`, `amount`) → 첫 응답 200 replay. 다른 본문 → `409 IDEMPOTENCY_KEY_CONFLICT`. 충전 본문은 `amount`뿐이라 결제의 `merchantId` 비교 단계가 빠진다.
5. **자기치유** — `DataIntegrityViolationException` catch 후 `findByIdempotencyKey` 재조회로 첫 응답 반환.

**마이그레이션 불필요** — `transactions.idempotency_key VARCHAR(100) UNIQUE`는 V1부터 전역으로 박혀 있다(`docs/adr/0010` References). 충전 행은 그동안 이 컬럼에 `NULL`을 넣고 있었을 뿐, 이제 키를 채우면 DB 최후 방어선이 그대로 동작한다. 스키마 변경 없음.

## Rationale

### 1. 왜 이제야 붙이나
- Step 7 시점엔 멱등성 인프라(`IdempotencyStore`, `findByIdempotencyKey`, 두 예외)가 아직 없었다. Step 8에서 결제·이체로 패턴을 확립한 뒤 충전에 회수하는 게 학습 순서상 자연스러웠다.
- 지금은 모든 부품이 준비돼 있어 **추가 비용이 거의 0** — prefix 한 줄, 서비스 흐름 미러링, 컨트롤러 헤더 검증뿐.

### 2. 왜 결제와 같은 패턴을 그대로 쓰나
- 충전·결제·이체는 "돈을 움직이는 쓰기 + 중복 실행이 치명적"이라는 동일 성질을 공유한다. 별도 메커니즘을 만들 이유가 없다.
- `IdempotencyStore.tryAcquire(redisKey)` 헬퍼가 이미 공통화돼 있어 prefix만 추가하면 된다. ADR-0010의 모든 근거(TTL 10분, Redis 장애 fallback, DB 재조회 SSoT)가 그대로 승계된다.

### 3. Redis prefix를 분리하는 이유
- `idem:charge:` / `idem:payment:` / `idem:transfer:`로 나누면 Redis 레벨에서 작업 종류별 멱등키를 독립 관측·운영할 수 있다(결제/이체와 동일 정책).
- 단, **DB UNIQUE는 prefix 없는 원본 키 값**에 걸리므로(컬럼 하나) 키 자체는 세 작업이 전역 공유한다. 키는 UUID 가정이라 작업 간 충돌 확률은 사실상 0 — 이 부분은 결제·이체에 이미 존재하던 특성이고 충전이 새로 만드는 문제가 아니다.

### 4. 대안 비교
- **A안(채택): 결제 패턴 미러링** — 일관성·재사용 최대, 추가 비용 최소.
- **B안: 충전은 멱등키 옵셔널(있으면 적용, 없으면 통과)** — 기각. "있으면 적용"은 클라이언트 실수 시 조용히 중복 충전을 허용 → 결함을 절반만 막음. 헤더 필수가 안전.
- **C안: 충전 전용 멱등 메커니즘 신설** — 기각. 같은 성질의 문제에 메커니즘을 둘로 늘릴 이유 없음(YAGNI).

## Consequences

### 좋은 면
- **API 일관성** — 돈을 움직이는 세 작업(충전·결제·이체)이 모두 동일한 멱등 계약을 따른다. 클라이언트 입장에서 규칙이 하나로 통일됨.
- **중복 충전 차단** — 더블 클릭/재시도로 인한 잔액 2배 증가 사고가 원천 봉쇄됨.
- **추가 비용 최소** — 마이그레이션 0, 신규 클래스 0, 기존 인프라(`IdempotencyStore`/`findByIdempotencyKey`/예외 2종/핸들러 2종) 100% 재사용.

### 나쁜 면
- **클라이언트 계약 변경(Breaking)** — 충전 호출 시 이제 `Idempotency-Key` 헤더가 필수. 기존에 헤더 없이 충전하던 클라이언트는 400을 받는다. 학습 프로젝트라 외부 소비자는 없지만, 운영이라면 버전 협상/공지가 필요한 변경.
- **충전마다 DB select 1회 추가** — `findByIdempotencyKey`(UNIQUE 인덱스라 저렴). 멱등 충돌은 극소수라 무시 가능(ADR-0010과 동일 트레이드오프).
- **전역 키 네임스페이스** — 충전·결제·이체가 DB UNIQUE 컬럼 하나를 공유. UUID 키 가정에선 비충돌이나, 클라이언트가 작업 종류를 가로질러 키를 재사용하면 cross-type 충돌 가능(기존 결제/이체에도 존재하던 특성).

### 재검토 신호
- **작업별 키 격리 요구** — cross-type 키 충돌이 실제 운영 이슈가 되면 `idempotency_key`를 `(type, key)` 복합 UNIQUE로 전환하는 별도 마이그레이션 검토.
- **충전 멱등 윈도우 차별화 요구** — 충전만 TTL을 달리해야 할 비즈니스 요구가 생기면 `IdempotencyStore`에 작업별 TTL 파라미터 도입.

## References
- 코드:
  - `src/main/java/com/minipay/service/IdempotencyStore.java` — `tryAcquireCharge` + `idem:charge:` prefix
  - `src/main/java/com/minipay/service/AccountService.java` — 충전 멱등 흐름(replay/SETNX/self-heal)
  - `src/main/java/com/minipay/controller/AccountController.java` — `Idempotency-Key` 헤더 필수 검증
  - `src/test/java/com/minipay/service/ConcurrencyTest.java` — 헬퍼 charge 호출에 고유 키 부여
- 선행 결정:
  - `docs/adr/0010-idempotency-dual-defense.md` — 본 ADR이 확장하는 멱등성 이중 방어 원본
  - `docs/adr/0009-pessimistic-locking.md` — 충전의 비관적 락(병행 유지)
- DB:
  - `src/main/resources/db/migration/V1__init.sql` — `transactions.idempotency_key VARCHAR(100) UNIQUE`(마이그레이션 추가 불필요 근거)
- 컨벤션:
  - `CLAUDE.md` "멱등성 (Step 8+)" 섹션 — 충전·결제·이체 헤더 필수로 갱신
