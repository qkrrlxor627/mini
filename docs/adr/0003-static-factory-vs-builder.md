# ADR-0003: 정적 팩토리 메서드 vs Builder

## Status
Accepted

(날짜: 2026-05-08)

## Context
엔티티 생성 방식 선택. JPA가 protected 기본 생성자를 요구하므로 **외부 인스턴스화 경로**를 무엇으로 둘지 결정해야 함.

후보:
- **A**: `public` 생성자 (모든 필드 인자)
- **B**: setter (`@Setter` Lombok)
- **C**: Lombok `@Builder`
- **D**: 정적 팩토리 메서드 (`User.register`, `Account.openFor`, `Transaction.charge/payment`) ✅

관련 Step: 3 (엔티티).

## Decision
**정적 팩토리 메서드만** 외부 인스턴스화 경로로 노출. 기본 생성자는 `protected` (Lombok `@NoArgsConstructor(access = AccessLevel.PROTECTED)` — JPA 프록시용 입구만 열어둠). setter 금지. Builder 미사용.

이름 규칙:
- 도메인 동사 우선: `Account.openFor`, `Transaction.charge`, `Transaction.payment`, `User.register`.
- 단순 변환은 `of`, 외부 입력 매핑은 `from`.

## Rationale

**A (public 생성자)를 안 고른 이유:**
- 인자 순서 의존 — 같은 타입 인자가 여러 개면 순서 실수 위험 (`new User(passwordHash, email, ...)`).
- 이름이 없어 도메인 의도 표현 불가 — `new Transaction(...)`은 충전인지 결제인지 호출 지점에서 알 수 없음.

**B (setter)를 안 고른 이유 — 가장 위험:**
- `user.setEmail(null)` 같은 호출로 객체 불변식이 언제든 깨질 수 있음.
- Anemic Domain Model로 흐름 — 도메인 로직이 서비스로 새어나감.
- 자바 빈즈 관례라 익숙해 보이지만 **결제 도메인에선 독**.

**C (Builder)를 안 고른 이유:**
- 모든 필드를 자유 조립 가능 — **부분적으로 채운 무효 객체 생성 가능** (`User.builder().email("x").build()` — passwordHash 누락).
- 이름이 없어 의도 표현 못 함 (`Transaction.builder()...build()`는 충전인지 결제인지 모름).
- 검증 로직을 `build()`에 박을 수 있긴 하나, 도메인 의미 있는 메서드 이름이 빠짐.
- 인자 8개 미만이면 Builder 가치 없음 — 우리 엔티티는 다 그 미만.

**D (정적 팩토리)가 주는 보장:**
1. **이름이 의도를 표현** — `Transaction.charge(...)` vs `Transaction.payment(...)`이 호출 지점에서 즉시 읽힘.
2. **검증된 인스턴스만 세상에 나옴** — 정적 팩토리 안에서 null/blank/금액 양수 검증 후 반환. 생성 후엔 setter 없으니 다시 깨질 일 없음.
3. **불변식 단일 입구** — 모든 생성 경로가 정적 팩토리 → 검증 누락 위험 한 곳만 점검.
4. **반환 타입 다형성 가능** — 미래에 `Transaction.charge`가 서브타입 반환하도록 바꿀 여지 (지금은 안 씀, 옵션 보존).

## Consequences

**좋은 면:**
- 도메인 의도가 코드에 박힘 — 면접에서 "Tell, Don't Ask 적용 경험" 답변 소재.
- setter 없는 불변에 가까운 객체 → 동시성 코드(Step 7+) 안전성 ↑.
- Builder/setter 자동 생성 어노테이션 누락으로 인한 사고 없음.

**나쁜 면:**
- 필드 많은 엔티티는 인자 길어짐. 우리 Transaction.payment는 5개라 OK지만 8개 넘으면 가독성 저하.
- Lombok 한 줄로 끝나는 게 아니라 정적 팩토리 매번 손으로 작성 → 보일러플레이트 증가.

**재검토 신호:**
- 정적 팩토리 인자가 8개 이상으로 부풀면 → Parameter Object 패턴 (`TransactionPaymentCommand` record) 도입.
- 테스트에서 다양한 조합의 부분 객체가 필요해지면 → 테스트 전용 Builder만 별도 도입 (운영 코드는 정적 팩토리 유지).

## References
- `src/main/java/com/minipay/domain/User.java` (`User.register`)
- `src/main/java/com/minipay/domain/Account.java` (`Account.openFor`)
- `src/main/java/com/minipay/domain/Transaction.java` (`charge`, `payment` — 작성 예정)
- CLAUDE.md "엔티티 (도메인 모델)" 섹션
- Effective Java Item 1: "Consider static factory methods instead of constructors"
