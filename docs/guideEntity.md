# Mini Pay — 엔티티 작성 가이드 (Step 3)

> **목적**: 이 문서 한 장만 보고 `User`, `Transaction`, `TransactionType`, `TransactionStatus` 네 파일을 직접 만들 수 있게 한다.
> **맥락**: Step 3 Phase 4. `Currency`, `Money`, `Account`, `InsufficientBalanceException` 은 이미 있음 (샘플).
> **위치**: `src/main/java/com/minipay/domain/`

---

## 0. 사전 정리 — 우리가 만들고 있는 것

JPA 엔티티 = **DB 테이블의 한 행을 자바 객체로 표현한 것**.

- 어노테이션이 매핑 규칙 (예: `@Table(name="users")` → `users` 테이블)
- DB 스키마는 이미 Flyway(V1+V2)가 만들어둠 → 자바 엔티티는 **그 스키마와 정확히 맞아야** 함
- `ddl-auto: validate` 모드라 부팅 시점에 불일치 있으면 **즉시 부팅 실패** — 이게 우리의 자동 채점관

이 문서를 끝내면:
1. 4개 파일을 컴파일 통과시키고
2. `./gradlew bootRun` 시 Hibernate가 4개 매핑을 검증해줌

> 💡 **쉽게 이해하기 — 엔티티/매핑/JPA가 뭔데?**
>
> - **엔티티 = 엑셀 시트의 한 행을 그대로 옮긴 자바 객체**.
>   엑셀 `users` 시트에 한 행이 "1, hong@ex.com, 홍길동"이라면, 자바에서는 `User` 객체 하나가 그 행을 대표한다.
> - **매핑 = "이 자바 필드 = 이 DB 컬럼"이라고 짝지어 알려주기**.
>   엑셀로 치면 "B열은 email 칸이고 C열은 이름 칸"이라고 표지를 붙이는 작업.
> - **JPA = 자바 객체 ↔ DB 사이를 자동 통역해주는 도구**.
>   `account.charge(money)` 같은 자바 코드를 짜면 JPA가 알아서 `UPDATE accounts SET balance_amount=...` SQL로 번역해 보낸다.
> - **어노테이션 (`@Entity`, `@Column` 등) = 포스트잇 메모**.
>   클래스/필드 위에 "얘는 엔티티야", "얘는 PK야"라고 붙여두면 JPA가 그 메모를 읽고 동작한다.
> - **`ddl-auto: validate` = 자동 채점관**.
>   부팅 시 자바 엔티티와 실제 DB 스키마를 대조해서 어긋나면 부팅 실패시킴. 우리 편이지만 엄격한 선생님.

---

## 1. 이 프로젝트의 엔티티 5룰 (CLAUDE.md 압축본)

| 룰 | 왜 |
|---|---|
| 1. **setter 금지** — 정적 팩토리만 | 무분별 변경 차단. 객체는 "올바른 상태로만" 만들어진다 |
| 2. **`@NoArgsConstructor(access = PROTECTED)`** 필수 | JPA가 리플렉션으로 객체 생성하려면 기본 생성자 필요. 외부에서는 못 쓰게 PROTECTED |
| 3. **enum은 `@Enumerated(EnumType.STRING)`** | ORDINAL은 enum 순서 바뀌면 데이터 손상. STRING은 이름으로 저장 → 안전 |
| 4. **시간은 `OffsetDateTime`** + `@Column(updatable=false)` | `LocalDateTime` 금지 (시차 정보 없음). 생성 시각은 한 번 박히고 끝 |
| 5. **금액은 `Money` VO** | `BigDecimal` 직접 노출 금지. `Money.add/subtract` 같은 메서드만 사용 |

> 💡 **쉽게 이해하기 — 5룰의 일상 비유**
>
> 1. **setter 금지 = 통장 잔액을 매직펜으로 직접 고치지 못하게 함.**
>    "잔액 100만원으로 바꿔!" 안 됨. "10만원 입금해" 같은 **행위(메서드)**를 통해서만 변경 가능.
>    → 잘못된 상태(예: 음수 잔액)가 만들어질 수 없게 입구를 통제.
>
> 2. **`@NoArgsConstructor(PROTECTED)` = "직원 전용" 표지판이 붙은 뒷문.**
>    JPA(직원)는 객체를 만들기 위해 이 뒷문이 필요함. 외부 코드(고객)는 이 문을 못 열고, 정해진 정문(`Account.openFor(...)`)으로만 들어와야 함.
>
> 3. **`@Enumerated(EnumType.STRING)` = 명단을 "1번, 2번" 대신 "홍길동, 김철수"라고 적기.**
>    `ORDINAL`은 enum 순서를 숫자(0,1,2...)로 저장. 누가 enum 사이에 새 값을 끼워 넣으면 "1번이 누구였더라?" 사고 발생. `STRING`은 이름 그대로 저장하니 안전.
>
> 4. **`OffsetDateTime` = 시계 옆에 "한국시간(+09:00)"이라고 시차까지 적어두기.**
>    `LocalDateTime`은 그냥 "오후 3시" — 어느 나라 3시인지 모름. 미국 서버에 배포되거나 사용자가 해외에 있으면 시간이 어그러짐.
>
> 5. **`Money` VO = 5천원짜리 지폐를 봉투에 넣고 "5000 KRW"라고 라벨 붙여 다니기.**
>    그냥 숫자 5000을 들고 다니면 "이게 원화야 달러야?", "소수점 처리는?" 같은 사고가 남. `Money` 봉투로 묶어두면 더하기·빼기·비교가 안전.
>
> 막히면 이 표를 다시 본다. 컨벤션 위반 = 부팅은 되어도 코드 리뷰 탈락.

---

## 2. 샘플 해부 — `Account.java`를 줄별로 읽기

이걸 100% 이해하면 나머지는 응용. 이미 만들어둔 파일을 줄 단위로 풀어보자.

```java
@Entity                                    // (1) 이 클래스는 DB 테이블에 매핑
@Table(name = "accounts")                  // (2) 매핑 대상 테이블 이름
@Getter                                    // (3) 모든 필드에 getter 자동 생성 (Lombok)
@NoArgsConstructor(access = AccessLevel.PROTECTED)  // (4) JPA용 기본 생성자, 외부 차단
public class Account {

    @Id                                    // (5) 이 필드가 PK
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // (6) DB가 ID 자동 생성 (BIGSERIAL)
    private Long id;

    @Column(name = "user_id",              // (7) 컬럼명 (자바 camelCase ↔ DB snake_case)
            nullable = false, unique = true)
    private Long userId;

    @Embedded                              // (8) 값 객체(VO)를 묻어둔다
    @AttributeOverrides({                  // (9) VO 내부 필드명을 실제 컬럼명으로 매핑
        @AttributeOverride(name = "amount",
            column = @Column(name = "balance_amount",
                nullable = false, precision = 19, scale = 4)),
        @AttributeOverride(name = "currency",
            column = @Column(name = "balance_currency",
                nullable = false, length = 3))
    })
    private Money balance;

    @Column(name = "created_at", nullable = false, updatable = false)  // (10) 한 번 박히고 못 바뀜
    private OffsetDateTime createdAt;

    // (11) 정적 팩토리 — 외부는 이 메서드로만 객체 생성
    public static Account openFor(Long userId, Currency currency) {
        if (userId == null) throw new IllegalArgumentException("...");
        Account account = new Account();
        account.userId = userId;
        account.balance = Money.zero(currency);
        account.createdAt = OffsetDateTime.now();
        return account;
    }

    // (12) 도메인 메서드 — 잔액 변경은 여기서만 (Tell, Don't Ask)
    public void charge(Money amount) { ... }
    public void deduct(Money amount) { ... }
}
```

### 핵심 포인트
- **(8)+(9)**: `Money`는 두 컬럼(`amount`, `currency`)으로 펼쳐짐. `@AttributeOverrides`로 실제 컬럼명에 매핑
- **(11)**: 정적 팩토리 이름은 **도메인 동사**. `Account.openFor` (계좌를 연다), `new Account()` 직접 호출 X
- **(12)**: 잔액 검증·변경은 엔티티 안에서. 서비스 레이어에서 `if (account.balance < x)` 절대 금지

> 💡 **쉽게 이해하기 — 번호별 비유**
>
> - **(5) `@Id` = 주민등록번호.** 사람마다 유일하게 식별되는 번호. 테이블에선 PK.
> - **(6) `@GeneratedValue(IDENTITY)` = 마트 번호표 기계.** 손님 올 때마다 1, 2, 3... 자동으로 뽑아줌. DB가 알아서 ID 부여.
> - **(7) `@Column(name="user_id", ...)` = "이 자바 필드는 DB의 user_id 칸에 들어간다"고 못 박기.**
>   자바는 `userId` (camelCase), DB는 `user_id` (snake_case) — 이름이 다르니 매핑 표지가 필요.
> - **(8)+(9) `@Embedded` + `@AttributeOverrides` = "이 봉투를 풀어서 두 칸에 나눠 담아."**
>   `Money` 봉투(`amount + currency`)를 통째로 한 컬럼에 넣을 순 없으니, "amount는 `balance_amount` 칸에, currency는 `balance_currency` 칸에" 라고 분배 지시서를 써둠.
> - **(10) `updatable = false` = "한 번 적으면 못 지우는 펜으로 쓰기."**
>   생성 시각은 만들어진 그 순간 박히고 끝. 누가 실수로라도 변경 못 하게.
> - **(11) 정적 팩토리 = 입구가 정해진 음식점.**
>   `new Account()` 직접 호출은 "주방에 무단 침입"이라 막혀있고, `Account.openFor(...)` 정문으로만 입장 → 직원이 항상 "올바른 상태"로 만들어 내보냄 (userId null 검사 등).
> - **(12) Tell, Don't Ask = "잔돈 얼마 남았어요?" 묻고 직접 빼지 말고, "이거 결제해주세요" 하고 맡겨라.**
>   ❌ `if (account.balance < amount) ...` (밖에서 잔액 캐묻고 판단)
>   ✅ `account.deduct(amount)` (계좌에게 "차감해줘"라고 시키면 알아서 검증·차감·예외 처리)

---

## 3. 어노테이션 cheat sheet

| 어노테이션 | 역할 | 우리 프로젝트에서 |
|---|---|---|
| `@Entity` | "이건 JPA 엔티티" | 모든 도메인 객체에 |
| `@Table(name=)` | DB 테이블명 매핑 | snake_case로 |
| `@Id` | PK 필드 표시 | `Long id` |
| `@GeneratedValue(strategy=IDENTITY)` | DB 자동 생성 PK | BIGSERIAL과 짝 |
| `@Column(name=, nullable=, unique=, length=, updatable=)` | 컬럼 속성 | DB 스키마와 일치시킬 때 |
| `@Enumerated(EnumType.STRING)` | enum을 문자열로 | enum 필드마다 **반드시** |
| `@Embedded` + `@AttributeOverrides` | VO 매핑 | `Money` 박을 때 |
| `@NoArgsConstructor(access=PROTECTED)` | JPA용 기본 생성자 | 모든 엔티티에 필수 |
| `@Getter` | Lombok이 getter 생성 | setter는 안 씀 |

> 💡 **Lombok이 뭔가요?**
> 자바는 원래 필드마다 `getName()`, `setName()` 같은 메서드를 손으로 다 써줘야 함. 너무 귀찮으니 Lombok이라는 라이브러리가 `@Getter` 한 줄만 붙이면 컴파일 시점에 자동으로 그 메서드들을 만들어줌.
> 즉 `@Getter` = "필드마다 getter 자동으로 만들어줘"라는 한 줄 부탁. 우리는 setter는 일부러 안 만든다(룰 1).

### `@Column` 속성 가이드
- `nullable=false` → DB의 `NOT NULL`과 짝
- `unique=true` → DB의 `UNIQUE`와 짝 (단, **DB에 UNIQUE가 이미 있으면 자바 쪽은 생략 가능**, 다만 명시하는 게 의도가 분명함)
- `length=N` → `VARCHAR(N)`. `String` 필드의 기본값은 255
- `updatable=false` → 한 번 INSERT 후 수정 금지 (생성 시각 컬럼)
- `precision=, scale=` → `NUMERIC(p,s)`. 우리는 19,4 고정

---

## 4. 만들 파일 — 쉬운 것부터

### 4-1. `TransactionType.java` (제일 쉬움, 5줄)

**목적**: 거래 유형 enum.

**스키마 단서**: V1의 `transactions.type VARCHAR(20) NOT NULL` — 자바 enum 이름이 그대로 문자열 저장됨.

**가져야 할 값** (도메인 용어집 기준):
- `CHARGE` — 잔액 충전
- `PAYMENT` — 가맹점 결제

**구조**:
```java
package com.minipay.domain;

public enum TransactionType {
    CHARGE, PAYMENT
}
```

> 끝. 어노테이션 없음. `Currency.java`와 같은 형태.

---

### 4-2. `TransactionStatus.java` (5줄)

**목적**: 거래 상태 enum.

**스키마 단서**: `transactions.status VARCHAR(20) NOT NULL`.

**가져야 할 값**:
- `SUCCESS` — 거래 성공
- `FAILED` — 거래 실패 (잔액 부족 등)

> Step 8에서 `PENDING`이 필요하면 그때 enum 확장. 지금은 두 개로 시작.

**구조**: `TransactionType`과 동일한 패턴.

---

### 4-3. `User.java` (≈ 50줄)

**목적**: 회원 엔티티.

**DB 스키마** (V1):
```sql
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    pin_hash      VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**필드 매핑표**:
| 자바 필드 | 타입 | 컬럼 | 어노테이션 힌트 |
|---|---|---|---|
| `id` | `Long` | `id` | `@Id` + `@GeneratedValue(IDENTITY)` |
| `email` | `String` | `email` | `nullable=false, unique=true, length=255` |
| `passwordHash` | `String` | `password_hash` | `nullable=false, length=255` |
| `name` | `String` | `name` | `nullable=false, length=100` |
| `pinHash` | `String` | `pin_hash` | `nullable=false, length=255` |
| `createdAt` | `OffsetDateTime` | `created_at` | `nullable=false, updatable=false` |

**클래스 어노테이션**: `@Entity`, `@Table(name="users")`, `@Getter`, `@NoArgsConstructor(access = PROTECTED)`.

**정적 팩토리 시그니처**:
```java
public static User register(String email, String passwordHash,
                            String name, String pinHash) {
    // null 검증 → 인스턴스 생성 → 필드 세팅 → createdAt = OffsetDateTime.now() → return
}
```

> 이름은 `register` (가입한다) 또는 `signUp`. 단순 변환이면 `of`였겠지만, **가입은 도메인 행위라 동사형**이 맞다.

**주의**:
- 비밀번호/핀의 **해싱은 서비스 레이어**에서 함. 엔티티는 이미 해시된 값을 받는다 → 필드명도 `password`가 아니라 `passwordHash`
- 도메인 메서드는 지금 단계에선 정적 팩토리 하나면 충분. 비밀번호 변경·핀 변경은 Step 4+에서 추가

---

### 4-4. `Transaction.java` (≈ 90줄, 가장 큼)

**목적**: 거래 한 건. 충전/결제 모두 같은 테이블.

**DB 스키마** (V1 + V2 적용 후):
```sql
CREATE TABLE transactions (
    id                       BIGSERIAL PRIMARY KEY,
    account_id               BIGINT NOT NULL REFERENCES accounts(id),
    type                     VARCHAR(20) NOT NULL,
    amount_amount            NUMERIC(19,4) NOT NULL,
    amount_currency          VARCHAR(3)    NOT NULL,
    balance_after_amount     NUMERIC(19,4) NOT NULL,
    balance_after_currency   VARCHAR(3)    NOT NULL,
    merchant_id              VARCHAR(50),
    idempotency_key          VARCHAR(100) UNIQUE,
    status                   VARCHAR(20) NOT NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**필드 매핑표**:
| 자바 필드 | 타입 | 컬럼(들) | 비고 |
|---|---|---|---|
| `id` | `Long` | `id` | PK |
| `accountId` | `Long` | `account_id` | `nullable=false`. (FK 객체 참조 X — 단순 ID) |
| `type` | `TransactionType` | `type` | `@Enumerated(STRING)` + `length=20` |
| `amount` | `Money` | `amount_amount` + `amount_currency` | `@Embedded` + `@AttributeOverrides` |
| `balanceAfter` | `Money` | `balance_after_amount` + `balance_after_currency` | `@Embedded` + `@AttributeOverrides` |
| `merchantId` | `String` | `merchant_id` | `nullable=true, length=50` (PAYMENT만 사용) |
| `idempotencyKey` | `String` | `idempotency_key` | `nullable=true, unique=true, length=100` |
| `status` | `TransactionStatus` | `status` | `@Enumerated(STRING)` + `length=20` |
| `createdAt` | `OffsetDateTime` | `created_at` | `nullable=false, updatable=false` |

**왜 `accountId` (Long)이고 `Account` 객체 참조가 아닌가?**
- 학습 단계에서는 객체 그래프 탐색 대신 **ID 참조**가 단순. lazy loading·N+1 같은 함정 회피
- 서비스 레이어에서 `accountRepository.findById(tx.getAccountId())`로 명시적으로 가져옴
- 이건 의도적 선택 → ADR 후보

**`Money` 두 개 박을 때 주의**:
- `Account`에서 `Money` 한 번 박았으니 그 패턴 그대로 두 번 반복
- 컬럼명만 다름: `amount_amount`/`amount_currency` vs `balance_after_amount`/`balance_after_currency`

**정적 팩토리 두 개**:
```java
public static Transaction charge(Long accountId, Money amount,
                                 Money balanceAfter, String idempotencyKey) {
    // type = CHARGE, status = SUCCESS, merchantId = null
}

public static Transaction payment(Long accountId, Money amount, Money balanceAfter,
                                  String merchantId, String idempotencyKey) {
    // type = PAYMENT, status = SUCCESS
}
```

> 실패 거래(`FAILED`)는 Step 8에서 별도 팩토리(`paymentFailed(...)`)로 추가. 지금은 SUCCESS만.

**금액 검증**:
- 정적 팩토리 안에서 `amount`가 null이거나 `!isPositive()`면 `IllegalArgumentException`
- `accountId == null`도 막기

---

## 5. 작성 순서 (이대로 따라 하기)

순서가 중요. 의존성 작은 것부터.

1. **`TransactionType.java`** — 5줄
2. **`TransactionStatus.java`** — 5줄
3. **`User.java`** — 정적 팩토리 1개
4. **`Transaction.java`** — 정적 팩토리 2개, `Money` 두 번 매핑
5. 컴파일: `./gradlew compileJava`
6. 부팅: `./gradlew bootRun` → Hibernate가 매핑 검증

---

## 6. 검증 체크리스트

### 컴파일 단계
- [ ] 4개 파일 모두 `package com.minipay.domain;`
- [ ] import 누락 없음 (`OffsetDateTime`, `Embedded`, `AttributeOverride(s)` 등)
- [ ] `@NoArgsConstructor(access = AccessLevel.PROTECTED)` — 모든 엔티티에
- [ ] enum 필드마다 `@Enumerated(EnumType.STRING)`
- [ ] `Money` 필드마다 `@Embedded` + `@AttributeOverrides`

### 부팅 단계 (`./gradlew bootRun`)
- [ ] `Successfully validated 2 migrations` — Flyway 통과
- [ ] Hibernate가 매핑 오류 없이 통과 (= `Schema validation: ...` 없이 부팅 완료)
- [ ] 부팅 로그에 "Started MinipayApplication" 보이면 성공

### 자주 터지는 에러 → 원인
| 에러 메시지 일부 | 원인 | 처방 |
|---|---|---|
| `Schema-validation: missing column [xxx]` | 자바 필드는 있는데 DB 컬럼 없음 | 컬럼명 오타 또는 V_n 마이그레이션 누락 |
| `Schema-validation: wrong column type` | 타입/길이 안 맞음 | `length`, `precision`, `scale`, `nullable` 점검 |
| `Schema-validation: missing table [xxx]` | `@Table(name=)` 오타 | `users`/`accounts`/`transactions` 정확히 |
| `No default constructor for entity` | `@NoArgsConstructor` 누락 | 추가 |
| `IllegalArgumentException: Not an embeddable: ...` | `@Embedded` 붙였는데 대상이 `@Embeddable` 아님 | `Money`는 이미 `@Embeddable` — 문제는 import 또는 클래스 위치 |

---

## 7. 자주 막히는 지점

### Q1. `@Column(unique=true)` 써야 하나?
- DB에 이미 `UNIQUE` 제약 있으면 **생략해도 동작은 함**
- 하지만 **명시하는 걸 권장** — JPA가 자동 인덱스/제약 생성 시 의도가 분명. 또한 `ddl-auto: validate` 환경에서는 표시 차이로 인한 차이는 없으나, 코드 가독성을 위해 표시
- 우리 컨벤션: **DB와 1:1로 명시**

### Q2. `name=` 생략 가능?
- `@Column(name=)`을 안 쓰면 자바 필드명이 그대로 컬럼명 (camelCase)
- Hibernate가 기본적으로 snake_case로 변환해주는 설정도 있지만 **우리는 명시**가 안전
- 룰: **모든 `@Column`에 `name=` 명시**

### Q3. `Long` vs `long`?
- 항상 `Long` (래퍼 타입). null 허용 + JPA 호환
- `long` 원시 타입 쓰면 ID 미할당 상태를 표현 못 함

### Q4. 정적 팩토리 안에서 `new User()` 부르는데 생성자가 PROTECTED인데 되는 거 맞아?
- 같은 클래스 내부에서는 protected 생성자 호출 가능 (자바 접근 규칙)
- 외부 코드(서비스, 컨트롤러)에서만 차단됨

### Q5. `Money` 두 번 박을 때 `@AttributeOverrides`를 두 번 써야 하나?
- 그렇다. `Money` 자체는 한 클래스지만, **엔티티의 두 필드는 각각 다른 컬럼명에 매핑**되므로 두 번 다 명시
- 복붙 후 컬럼명만 바꾸면 됨

### Q6. `Transaction`에 `Account` 객체를 안 넣고 `Long accountId`만? 너무 원시적이지 않나?
- JPA `@ManyToOne` 관계 매핑이 정석이긴 함
- 하지만 학습 단계에서는 **ID 참조가 단순하고 함정이 적음** (lazy loading, 영속성 컨텍스트 분리, N+1 등)
- ADR 0009 후보: "왜 객체 참조 대신 ID 참조를 썼나"

---

## 8. 다 만든 후

1. `git status` → 4개 파일 추가됨 확인
2. `./gradlew bootRun` → 부팅 성공 → 스크린샷/로그 들고 Claude에게 검증 요청
3. 검증 통과 시 **ADR 0001~0004 작성** (`docs/adr/0001-numeric-bigdecimal.md` 등)
4. Step 4 (회원가입 API) 진입

---

## 부록 — 패키지 import 빠른 참조

`User.java`에 들어갈 import:
```java
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.OffsetDateTime;
```

`Transaction.java`에 추가로 필요한 import:
```java
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.AttributeOverrides;
import jakarta.persistence.Embedded;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
```

> IDE(IntelliJ)에서 `Alt+Enter`로 자동 import 가능. 위 목록은 막혔을 때 참고용.
