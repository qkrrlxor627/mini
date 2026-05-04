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
| 0001 | Money Value Object 도입 | (작성 예정) | 3 |
| 0002 | Enum + EnumType.STRING 매핑 | (작성 예정) | 3 |
| 0003 | 정적 팩토리 메서드 vs Builder | (작성 예정) | 3 |
| 0004 | Flyway 단방향 마이그레이션 정책 | (작성 예정) | 3 |

> ADR은 Step별 코드 작성 후 채움. 코드를 만져보고 나서야 트레이드오프가 진짜로 보이기 때문.
