# ADR-0001: Money Value Object 도입

## Status
Accepted

(날짜: 2026-05-08)

## Context
금액 표현을 어떻게 할지 선택해야 했다. 후보:
- **A**: 엔티티/DTO에 `BigDecimal` 직접 노출 (+ 통화는 별도 `String` 필드 또는 enum)
- **B**: `Money` Value Object로 묶기 (`amount` + `currency`)

관련 Step: 3 (엔티티 설계).

배경 제약:
- DB는 NUMERIC(19,4) + VARCHAR(3) 형태 (V1__init.sql / V2__money_value_object.sql).
- 학습 프로젝트지만 **다중 통화 확장 가능성**을 가정 (Currency enum 도입).
- 결제 도메인이라 **반올림/정밀도 정책의 흐트러짐 = 돈 사고**.

## Decision
`Money` Value Object 도입. `BigDecimal amount` + `Currency currency`를 한 객체로 캡슐화. JPA에는 `@Embeddable`로 매핑 (Account.balance, Transaction.amount/balanceAfter 모두 동일 패턴).

## Rationale

**왜 BigDecimal 직접 노출이 위험한가:**
- BigDecimal `==` 비교는 참조 비교 — 의도와 다른 결과. `compareTo` 강제할 방법 없음.
- 통화 다른 두 BigDecimal 더하기를 컴파일러가 못 막음 (`krwBalance + usdAmount` 같은 사고).
- 반올림/scale 정책이 호출 지점마다 흩어지면 미세 오차 누적.

**Money VO가 주는 보장:**
- `add`, `subtract` 메서드 안에서 통화 같지 않으면 즉시 예외 (`requireSameCurrency`).
- scale 4 + `RoundingMode.HALF_EVEN`(은행가 반올림) 한 곳에 고정.
- `isLessThan`, `isPositive`, `isZero`로 도메인 의미를 메서드 이름에 박음.
- `BigDecimal` 원시 API는 `Money` 안에서만 — 외부 코드는 통화 안전한 인터페이스만 본다.

**대안 비교:**
| 축 | A (BigDecimal 직접) | B (Money VO) ✅ |
|----|---------------------|-----------------|
| 통화 안전성 | 컴파일 차단 불가 | 메서드에서 즉시 예외 |
| 반올림 일관성 | 호출자 책임 (흩어짐) | VO에 박혀 있음 |
| 도메인 표현 | 빈약 (`balance.compareTo(zero) > 0`) | 풍부 (`balance.isPositive()`) |
| 코드량 | 적음 | VO 한 클래스 추가 |
| JPA 매핑 | 필드 두 개 직접 | `@Embeddable` 한 줄 |

학습 비용보다 안전 이득이 크다고 판단.

## Consequences

**좋은 면:**
- 통화 혼합 산술이 컴파일 통과는 되지만 **런타임에 즉시 실패** → 빠른 발견.
- 정밀도/반올림 사고가 한 클래스 수정으로 회복.
- 면접에서 "Value Object 패턴 적용 경험" 답변 가능.

**나쁜 면:**
- 객체 한 겹 추가 — 매우 미세한 메모리/GC 부담.
- `@Embedded` + `@AttributeOverrides`로 컬럼명 매핑 매번 명시 필요 (Account, Transaction 모두 반복).
- BigDecimal 직접 다루던 사람에겐 학습 곡선.

**재검토 신호:**
- 다중 통화를 실제로 도입할 때 (KRW↔USD 환전 로직 → `Money` 외부에 환율 서비스 필요).
- 성능 프로파일링에서 Money 객체 생성이 핫스팟으로 잡히면 (현실적으론 거의 없음).

## References
- `src/main/java/com/minipay/domain/Money.java`
- `src/main/java/com/minipay/domain/Currency.java`
- `src/main/java/com/minipay/domain/Account.java` (`@Embedded` 적용 예)
- `src/main/resources/db/migration/V2__money_value_object.sql`
- CLAUDE.md "금액 / 통화" 섹션
