# ADR-0002: Enum + EnumType.STRING 매핑

## Status
Accepted

(날짜: 2026-05-08)

## Context
`TransactionType` (CHARGE/PAYMENT), `TransactionStatus` (SUCCESS/FAILED) 등 도메인 상수를 자바와 DB에서 어떻게 표현할지 선택.

후보:
- **A**: `String` 컬럼 + 자바도 `String` 상수 (`public static final String CHARGE = "CHARGE"`)
- **B**: 자바 `enum` + `@Enumerated(EnumType.ORDINAL)` (DB에 정수 저장)
- **C**: 자바 `enum` + `@Enumerated(EnumType.STRING)` (DB에 문자열 저장) ✅
- **D**: 별도 코드 테이블 (`transaction_types(id, code, label)`)

관련 Step: 3 (엔티티).

## Decision
**자바 enum + `@Enumerated(EnumType.STRING)` + DB 컬럼 `VARCHAR(20)`**.

```java
@Enumerated(EnumType.STRING)
@Column(nullable = false, length = 20)
private TransactionType type;
```

## Rationale

**A (문자열 상수)를 안 고른 이유:**
- 오타 방지를 컴파일러가 못 해줌 (`"CHRAGE"` 같은 사고).
- switch 망라성 검사 불가.
- 유한 선택지가 코드에 박히지 않음 — 누가 마음대로 새 값 넣어도 컴파일 통과.

**B (ORDINAL)를 안 고른 이유:**
- enum 선언 순서가 DB에 정수로 저장됨 (`CHARGE=0`, `PAYMENT=1`).
- 누군가 `enum { PAYMENT, CHARGE }`로 순서 바꾸면 **기존 데이터 의미가 뒤바뀜** — 결제와 충전이 둔갑.
- DB를 직접 봐도 `0`, `1`로만 보여 디버깅 어려움.
- "절대 금지" 수준의 위험 (CLAUDE.md에도 명시).

**D (코드 테이블)를 안 고른 이유:**
- 운영자가 추가/삭제하는 가변 카테고리가 아님 — 거래 종류는 코드에서 결정.
- 조인 한 단계 늘어나는 비용 대비 이득 없음.
- enum이 주는 **컴파일 타임 망라성**을 잃음 (테이블이라 누가 추가해도 코드는 모름).

**C (enum + STRING)가 주는 보장:**
1. 타입 안전성 — 잘못된 값 컴파일 차단.
2. 유한성 명시 — "거래 종류는 충전/결제 둘뿐"이 코드에 박힘.
3. switch 망라성 — 누락 케이스 컴파일러 경고.
4. 싱글톤 보장 — `==` 비교 가능, `.equals` 신경 안 써도 됨.
5. 가독성 — DB 직접 봐도 `'CHARGE'`, `'SUCCESS'`로 의미 파악 가능.
6. 순서 무관 — enum 선언 순서 바꿔도 안전 (DB에 이름으로 저장).

**저장 공간 차이는 무시:**
- ORDINAL 1바이트 vs STRING ~10바이트 차이는 PostgreSQL VARCHAR에서 의미 없는 수준.
- 거래 1억 건 누적해도 무의미.

## Consequences

**좋은 면:**
- 데이터 안전성 — 순서 변경 사고 원천 차단.
- 운영자가 DB 덤프 봐도 의미 파악 가능 → 장애 디버깅 빠름.
- enum 추가는 코드 + (필요 시) 마이그레이션으로 처리 — 변경 추적 명확.

**나쁜 면:**
- enum **이름 변경**(rename) 시 기존 DB 데이터 일치 깨짐 → 마이그레이션 필요 (UPDATE문).
- enum 값이 수십 개로 폭발하면 자바 코드가 비대.

**재검토 신호:**
- enum 값이 수백 개로 늘거나 운영자가 런타임에 추가/삭제할 필요 생기면 → 별도 테이블(D안)로 전환.
- 다국어 라벨 매핑이 필요해지면 → enum + 별도 i18n 테이블.

## References
- `src/main/java/com/minipay/domain/TransactionType.java`
- `src/main/java/com/minipay/domain/TransactionStatus.java`
- `src/main/java/com/minipay/domain/Currency.java` (동일 패턴 적용)
- CLAUDE.md "Enum 매핑" 섹션
- `docs/progress.md` 학습 메모 (2026-05-04 — enum 순서 변경 안전성 분석)
