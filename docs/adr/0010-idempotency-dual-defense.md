# ADR-0010: 멱등성은 Redis SETNX(1차) + DB UNIQUE(최후 방어) 이중 방어

## Status
Accepted

(날짜: 2026-05-17)

## Context
Step 8 결제/이체 API에 멱등성 요구사항이 등장한다 — 같은 `Idempotency-Key`로 두 번 요청이 들어와도 거래는 정확히 1건만 생성되고, 두 번째 요청은 첫 응답과 동일한 결과를 받아야 한다 (`docs/ready.md` §4 시나리오 8, §5 Payments/Transfers 명세).

문제는 다음과 같은 동시성·장애 조합 모두를 처리해야 한다는 점:
- 클라이언트 더블 클릭 (수십 밀리초 간격 동시 요청)
- 클라이언트 자동 재시도 (네트워크 타임아웃 후 같은 키로 재요청)
- 우리 서버의 부분 장애 (Redis 다운 / DB 다운)
- 같은 키 + 다른 본문 (클라이언트 버그 또는 공격)

`transactions.idempotency_key UNIQUE` 컬럼은 V1 마이그레이션부터 박혀있고(CLAUDE.md 멱등성 룰의 "최후 방어선" 명시), Redis 데이터소스도 Step 0부터 떠 있다. 둘을 어떻게 조합할지 결정 필요.

관련 Step: 8(결제·이체 첫 실전), 10(동시성 통합 테스트).

## Decision

### 1. **이중 방어**: Redis SETNX(1차 빠른 차단) + DB `UNIQUE(idempotency_key)`(최후 방어)
- 1차: `IdempotencyStore.tryAcquire(key, ttl=10분)` — Redis `SET NX EX` 결과로 신규/중복 판정.
- 2차: 거래 INSERT 시 DB의 UNIQUE 제약이 동시 INSERT 한 건만 허용.
- 두 방어선이 동시에 작동하므로 어느 한쪽이 실패해도 정합성은 깨지지 않음.

### 2. **응답 캐시는 Redis가 아니라 DB 재조회**
- 중복 요청 감지 시 `TransactionRepository.findByIdempotencyKey(key)`로 첫 거래를 다시 읽고 `PaymentResponse.from(tx)`로 동일한 응답을 재생성.
- Redis에는 응답 JSON을 저장하지 않음 — **진실의 단일 출처(SSoT)는 DB**.

### 3. **본문 일치 검증으로 충돌 구분**
- 같은 키 + 같은 본문(같은 `(merchantId, amount, currency, accountId)`) → 첫 응답 그대로 200 반환(idempotent replay).
- 같은 키 + 다른 본문 → `409 IDEMPOTENCY_KEY_CONFLICT` — 클라이언트 측 버그 또는 키 재사용 사고.
- 검증은 `Transaction` 행의 컬럼 비교로 수행(별도 본문 해시 저장 안 함).

### 4. **TTL 10분 디폴트, Redis 장애 시 graceful degradation**
- Redis SETNX TTL = 10분 — 사용자 더블 클릭/재시도 윈도우 충분히 커버 + 키 무한 누적 방지.
- Redis 연결 실패 시 `tryAcquire`는 `true`(통과) 반환 — DB UNIQUE가 최후 방어선이라 결제/이체 자체는 계속 처리. 가용성 우선.
- 단, Redis 장애 동안 동일 키 요청 두 건이 거의 동시에 도착하면 DB UNIQUE 위반 예외가 잡혀 한 건이 실패 — 그 경우 `findByIdempotencyKey`로 재조회해 첫 응답을 돌려준다(자기치유).

### 5. **Idempotency-Key 헤더 누락 → 400 MISSING_IDEMPOTENCY_KEY**
- 결제·이체는 **헤더 필수**. 누락 시 즉시 거절 — 멱등성 보장 없이 결제가 통과되면 가장 위험.
- Spring의 `MissingRequestHeaderException`을 GlobalExceptionHandler에서 잡아 명시 코드로 매핑.

---

## Rationale

### 1. 왜 이중 방어인가
- **Redis만**: TTL 만료 직후 또는 Redis 장애 중에는 동시 요청 두 건이 모두 통과 가능 → 거래 두 건 생성 사고.
- **DB UNIQUE만**: 첫 트랜잭션이 커밋되기 전까지는 동시 트랜잭션이 같은 INSERT를 시도할 수 있고, DB 락 경합 + 예외 catch + 재조회 사이클을 매 요청마다 돈다 — 성능·진단 비용 모두 큼.
- **둘 다**: Redis가 빠른 1차 차단(99%+), DB가 진실의 마지막 방어선. 운영 통계에 "1차에서 걸렸나, 2차에서 걸렸나"를 분리 관측 가능 → 장애 추적 쉬움.

### 2. 응답 캐시를 Redis에 안 두는 이유
- **응답 JSON 캐싱은 자연스럽지만 두 가지 함정**:
  ① Redis 캐시와 DB 거래가 비동기로 어긋날 수 있음(예: 응답 캐시 저장 직전에 락 점유한 다른 트랜잭션이 거래를 추가 변경).
  ② 응답 포맷이 진화하면(필드 추가 등) 캐시 무효화 정책이 별도로 필요.
- **DB 재조회로 단일화**: `findByIdempotencyKey` 한 줄로 첫 거래를 가져와 동일 응답 생성. 진실은 항상 한 곳(transactions 테이블).
- **읽기 한 번 추가 비용**: 응답 시 DB select 1회 추가지만, 멱등 충돌은 전체 요청의 극소수라 무시 가능.

### 3. 같은 키 + 다른 본문 → 409
- 정상 클라이언트면 같은 키 = 같은 요청. 다르면 클라이언트 버그 또는 공격.
- 200으로 첫 응답을 돌려주면 클라이언트가 "두 번째 요청이 처리됐다"고 오해 — 실제로는 무시됨. 이건 자체로 사고.
- 409는 "키 충돌이지 본문 충돌이다"를 클라이언트가 인지하도록 강제.
- RFC 9457 problem detail 미도입 — 우리 `ErrorResponse` 포맷(errorCode + message + timestamp) 그대로 사용.

### 4. TTL 10분의 근거
- 사용자 더블 클릭은 초 단위, 클라이언트 자동 재시도는 분 단위. 10분이면 거의 모든 정상 시나리오 커버.
- 너무 짧으면(예: 30초) 정상 재시도가 1차 방어를 빠져나가 DB까지 도달 → 운영 노이즈.
- 너무 길면(예: 24시간) Redis 키 누적 + 정상 다른 결제 키가 같은 값을 우연히 갖는 충돌 가능성(키가 UUID라 거의 0이긴 함).
- 10분은 결제 PG 업계의 일반적 idempotency window와도 일치.

### 5. Redis 장애 시 fallback 정책
- **결제·이체를 막지 않는다** — Redis는 보조 인프라. 핵심 정합성은 DB UNIQUE가 책임.
- `tryAcquire`가 `RedisConnectionFailureException` 등을 catch 후 `true` 반환 + `log.warn`. 모니터링 알람의 신호로 활용.
- 사고 시나리오: Redis 다운 중 동일 키 동시 요청 두 건 → 둘 다 1차 통과 → DB INSERT에서 한 건이 `DataIntegrityViolationException` → catch 후 `findByIdempotencyKey`로 첫 거래 조회 → 동일 응답. **결과적으로 멱등 보장 유지**.

### 6. Idempotency-Key 누락 = 400 (서버 책임 아님)
- 헤더 필수는 API 계약. 누락은 클라이언트 측 실수 → 400.
- 401(인증)이나 500(서버 오류)로 가지 않도록 명시 핸들러로 분리.
- Spring이 던지는 `MissingRequestHeaderException`을 직접 잡는 것보다 우리 `MissingIdempotencyKeyException`을 컨트롤러에서 명시적으로 던지면 의도가 더 명확 — 둘 중 후자 채택.

---

## Consequences

### 좋은 면
- **정합성 + 가용성 동시 확보** — Redis 장애에도 결제/이체가 계속 처리되고 멱등 보장도 유지.
- **운영 가시성** — 1차/2차 어디서 걸렸는지 로그로 구분 가능. 평소엔 Redis가 99% 처리, DB가 잡히면 알람.
- **단순성** — 응답 캐시 동기화 문제 회피. DB 한 곳이 진실.
- **테스트 용이** — Step 10 통합 테스트에서 "같은 키 10번 동시 → 1건만 처리" 시나리오로 양쪽 방어선 모두 검증.

### 나쁜 면
- **중복 요청마다 DB select 1회 추가** — `findByIdempotencyKey`는 인덱스(`UNIQUE`)라 빠르지만 0은 아님. 멱등 충돌은 전체 요청 대비 극소수라 허용.
- **본문 일치 검증의 한계** — `(merchantId, amount, currency, accountId)`만 비교. 추가 컬럼(예: 메타데이터)이 늘면 비교 로직 갱신 필요.
- **Redis와 DB 사이의 짧은 윈도우** — Redis SETNX 성공 직후 DB INSERT 실패(검증·잔액 부족 등)하면 Redis에는 키만 남고 거래는 없음. 다음 같은 키 요청은 Redis에서 차단되지만 응답 캐시 조회 시 거래 없음 — 이 경우 명시적으로 처리 필요(거래 없으면 첫 요청이 미완이라 가정하고 처리 흐름으로 진행).

### 재검토 신호
- **응답 정합성 사고** — DB 재조회 응답과 첫 응답이 미세하게 다른 사고 발생 시(예: balanceAfter가 다른 거래에 의해 갱신됨) — 즉시 응답 캐시 도입 검토.
- **Redis 의존성 강화 요구** — 더 빠른 멱등 응답(평균 ms 단위 절감) 요구가 들어오면 응답 JSON Redis 캐싱 추가 도입.
- **분산 환경 확장** — 여러 인스턴스 + 여러 Redis 클러스터 + 다중 DB → Redlock / 분산 락 추가.
- **PG 연동** — 외부 PG와의 멱등 키 협상이 필요해지면(이중 결제 방지) — PG 측 멱등 보장과 우리 측 보장을 매핑하는 별도 ADR.

---

## References
- 코드:
  - `src/main/java/com/minipay/service/IdempotencyStore.java` — Redis SETNX 래퍼
  - `src/main/java/com/minipay/service/PaymentService.java` — 1차/2차 흐름 구현
  - `src/main/java/com/minipay/repository/TransactionRepository.java` — `findByIdempotencyKey`
  - `src/main/java/com/minipay/exception/MissingIdempotencyKeyException.java` / `IdempotencyKeyConflictException.java`
- DB:
  - `src/main/resources/db/migration/V1__init.sql` — `transactions.idempotency_key VARCHAR(100) UNIQUE`
- 컨벤션:
  - `CLAUDE.md` "멱등성 (Step 8+)" 섹션 — Redis + DB 이중 방어 / TTL 10분
  - `CLAUDE.md` 코드 리뷰 체크리스트 "멱등성" — Redis만 / DB만 둘 다 거절
- 문서:
  - `docs/ready.md` §4 시나리오 8 / §5 Payments 명세 — 같은 키 + 같은 본문 → 200, 다른 본문 → 409
  - `docs/ready.md` §6-1 결제 시퀀스 다이어그램 — SETNX 성공/실패 분기 + DB 재조회 흐름
  - `docs/uShould.md` Step 10 — "같은 멱등키 10번 동시 → 1건만 처리, 잔액 99,000" 시나리오
- 외부:
  - Stripe API Reference — "Idempotency" (24시간 TTL, 본문 해시 비교)
  - IETF draft-ietf-httpapi-idempotency-key-header — 헤더 표준화 진행 중
