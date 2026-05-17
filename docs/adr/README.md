# Architecture Decision Records

이 디렉토리는 Mini Pay 프로젝트의 주요 결정을 기록한다. 각 결정은 한 페이지(ADR-NNNN)로 박아두고, 코드만 봐서는 답하기 어려운 "왜 이렇게 짰나"의 근거가 된다.

면접 답변지로 그대로 활용 가능. 결정의 근거 + 대안 + 결과까지 박혀 있어야 함.

## 형식

```markdown
# ADR-NNNN: 제목

## Status
Proposed | Accepted | Deprecated | Superseded by ADR-XXXX

(날짜: YYYY-MM-DD)

## Context
어떤 문제·선택지가 있었나. 외부 제약, 가정, 관련 Step 번호.

## Decision
무엇을 선택했나. 한두 문장.

## Rationale
왜 이걸 골랐나. 대안과의 비교. 트레이드오프.

## Consequences
이 결정으로 생긴 결과:
- 좋은 면 (기대 효과)
- 나쁜 면 (감수해야 할 비용)
- 미래 재검토 신호 (어떤 조건이 발생하면 이 결정을 다시 볼지)

## References
- 관련 코드 파일
- 외부 문서 / 블로그 링크
```

## 인덱스

| 번호 | 제목 | Status | Step |
|---|---|---|---|
| [0001](0001-money-value-object.md) | Money Value Object 도입 | Accepted | 3 |
| [0002](0002-enum-string-mapping.md) | Enum + EnumType.STRING 매핑 | Accepted | 3 |
| [0003](0003-static-factory-vs-builder.md) | 정적 팩토리 메서드 vs Builder | Accepted | 3 |
| [0004](0004-flyway-forward-only.md) | Flyway 단방향 마이그레이션 정책 | Accepted | 3 |
| [0005](0005-transaction-account-reference-by-id.md) | Transaction은 Account를 ID로 참조 | Accepted | 3 |
| [0006](0006-transfer-modeling.md) | 이체(TRANSFER) 거래는 단일 행으로 표현 | Accepted | 3 |
| [0007](0007-auth-and-error-foundation.md) | 인증·에러 핸들링 기반 (BCrypt + GlobalExceptionHandler + 임시 SecurityConfig) | Accepted | 4 |
| [0008](0008-jwt-stateless-auth.md) | JWT 기반 stateless 인증 (검증 시 DB 조회 없음) | Accepted | 5 |
| [0009](0009-pessimistic-locking.md) | 잔액 변경은 비관적 락(PESSIMISTIC_WRITE) 디폴트 | Accepted | 7~8 |
| [0010](0010-idempotency-dual-defense.md) | 멱등성은 Redis SETNX(1차) + DB UNIQUE(최후 방어) 이중 방어 | Accepted | 8 |

> ADR은 Step별 코드 작성 후 채움. 코드를 만져보고 나서야 트레이드오프가 진짜로 보이기 때문.
