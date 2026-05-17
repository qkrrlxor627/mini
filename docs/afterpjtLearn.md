# Mini Pay 이후 학습 — 자바 기초·JVM·IDE·문서 사고

> 비전공자가 Mini Pay 코드를 **줄 단위로 정확히 읽고**, 모르는 게 나왔을 때 **혼자 답을 찾을 수 있는** 사람이 되기 위한 심화 가이드.
> Mini Pay 실제 파일·줄을 인용하며 진행. "이게 뭔지"는 짧게, "왜 이렇게 생겼는지·언제 데이는지"는 길게.

목차
- Part 1. 자바 기초 — 코드 줄 단위 독해
- Part 2. JVM / 메모리 / 스레드
- Part 3. IDE / 디버거 활용
- Part 4. 공식 문서 / 검색 사고
- Part 5. Git / 협업 워크플로우
- Part 6. 코드 리뷰 방법론
- Part 7. 자료구조 / Big-O 입문
- Part 8. DB 깊이 — 정규화·인덱스·MVCC·N+1
- Part 9. SOLID + 디자인 패턴
- Part 10. 네트워크 깊이 — TCP·HTTPS·DNS·커넥션 풀
- Part 11. 보안 — OWASP Top 10
- Part 12. 분산 시스템 입문 — CAP·메시지 큐·Saga

---

# Part 1. 자바 기초 — 코드 줄 단위 독해

Mini Pay 코드를 펼치면 매 줄에 `final`, `static`, `@어노테이션`, `Optional<...>`, `record`, `<T>` 같은 게 박혀 있습니다. 이 챕터의 목표는 **그 줄들을 자동으로 머리에 들어오게** 만드는 것입니다.

---

## 1.1 `final` 키워드

### 개념
`final`이 붙은 변수·필드는 **한 번 할당하면 다시 못 바꿈**. 메서드에 붙이면 **자식 클래스가 오버라이드 못 함**. 클래스에 붙이면 **상속 불가**.

### 왜 있나
1. **불변성(immutability)** — 한 번 정해진 값이 안 바뀐다는 보장 = 버그 표면적 감소.
2. **동시성 안전** — 여러 스레드가 final 필드를 동시에 읽어도 안전. JVM이 보장.
3. **DI 패턴 안정성** — 생성자에서 주입받은 의존성을 외부에서 못 바꾸게 막음.
4. **컴파일러 도움** — 람다 안에서 외부 변수는 effectively final이어야 함.

### Mini Pay 어디
`PaymentService.java:24-26`
```java
private final AccountRepository accountRepository;
private final TransactionRepository transactionRepository;
private final IdempotencyStore idempotencyStore;
```
이 세 줄에서 `final`이 의미하는 것:
- 생성자에서 한 번 주입받은 뒤로는 절대 바뀌지 않음.
- 누가 실수로 `this.accountRepository = null` 같은 코드를 써도 **컴파일 단계에서 거절**.
- 스레드 안전: 톰캣이 요청마다 다른 스레드로 `pay()`를 호출해도 이 필드는 안전하게 공유됨.

`Money.java:21-22`
```java
private static final int SCALE = 4;
private static final RoundingMode ROUNDING = RoundingMode.HALF_EVEN;
```
- `static final` 조합 = **상수**. 자바에서 상수 선언의 관용구. 보통 대문자 + 언더스코어로 명명.

### 비전공자 함정
- `final`은 **참조**를 못 바꾸게 할 뿐, **객체 내부 상태**까지 못 바꾸게 하는 건 아님.
```java
final List<String> list = new ArrayList<>();
list = new ArrayList<>();  // ❌ 컴파일 에러 (참조 변경)
list.add("hello");         // ✅ 가능 (내부 상태 변경)
```
- 진짜 불변을 원하면 `List.of(...)`, `Collections.unmodifiableList(...)`, 또는 record 사용.

### 실습
모든 `final` 키워드를 손으로 짚어가며 의도를 말해보기:
- `Money` 클래스의 두 `static final` → 왜 상수인가?
- `PaymentService`의 세 `private final` → 누가 주입하나? (답: `@RequiredArgsConstructor`가 생성하는 생성자)

---

## 1.2 `static`의 의미

### 개념
`static`은 "**클래스에 속함, 인스턴스에 속하지 않음**"이라는 뜻.
- `static` 필드 = 클래스당 1개 (모든 인스턴스가 공유).
- `static` 메서드 = 인스턴스 없이 호출 가능. `클래스명.메서드명()`.
- `static` 블록 = 클래스가 처음 로드될 때 한 번 실행.

### 왜 있나
1. **유틸리티** — `Math.max(a,b)` 같은 건 인스턴스 만들 이유 없음.
2. **상수** — `Math.PI`처럼 클래스 전체에서 공유되는 값.
3. **팩토리 메서드** — 생성자를 감춰두고 `Account.openFor(...)` 같은 이름 있는 생성 통로 제공.
4. **카운터/캐시** — 인스턴스 수 카운트, 인스턴스 간 공유 캐시.

### Mini Pay 어디
`Money.java:36-38`
```java
public static Money of(BigDecimal amount, Currency currency) {
    if (amount == null) {
        throw new IllegalArgumentException("금액은 null일 수 없습니다");
    }
    ...
}
```
- `static`이라 `new Money(...)` 대신 `Money.of(...)`로 호출.
- 우리 컨벤션의 **정적 팩토리 메서드** 패턴: 생성자는 `private`로 닫고, `static` 메서드로만 객체 생성을 허용.

`Account.java:45`
```java
public static Account openFor(Long userId, Currency currency) { ... }
```
- 이름이 의도를 드러냄. `new Account(userId, currency)`는 "Account를 만든다"만 말하지만 `Account.openFor(userId, currency)`는 "사용자를 위해 계좌를 **개설**한다"는 도메인 동사를 드러냄.

### static 메서드의 결정적 제약
**static 메서드 안에서는 `this`가 없음**. 인스턴스 필드/메서드에 접근 못 함.
```java
public class Account {
    private Money balance;

    public static void doSomething() {
        this.balance = ...;     // ❌ 컴파일 에러
        balance = ...;          // ❌ 컴파일 에러
    }
}
```
이게 헷갈리는 비전공자가 가장 많이 만나는 자바 컴파일 에러 중 하나입니다.

### 비전공자 함정
- **상태 공유 함정**: `private static int counter = 0;` 같은 걸 두면 모든 인스턴스가 같은 카운터를 공유. 동시성 환경에선 위험 (race condition).
- **테스트 어려움**: static 메서드는 mock 하기 어려움. 그래서 도메인 로직은 인스턴스 메서드로 두는 게 정석.

### 실습
`Money` 클래스의 메서드를 분류해보기:
- 정적: `of`, `zero` — 객체를 만들거나 상수성.
- 인스턴스: `add`, `subtract`, `isLessThan`, `isPositive`, `isZero` — 자기 자신의 상태(`this.amount`)를 다룸.

왜 `add`는 static이 아닐까? → 자기 자신의 amount와 다른 Money의 amount를 더하는 행위라 **자기 자신을 표현**해야 자연스러움.

---

## 1.3 `record` — DTO의 정체

### 개념
Java 14에서 preview, Java 16부터 정식. **불변 데이터 운반체**를 한 줄로 선언.
```java
public record PaymentRequest(String merchantId, BigDecimal amount) {}
```
이 한 줄이 자동으로 생성하는 것:
- `private final String merchantId;` `private final BigDecimal amount;` 두 필드
- 두 인자를 받는 생성자
- `merchantId()`, `amount()` 접근자 (보통 클래스의 `getXxx()`가 아니라 필드명 그대로)
- `equals()`, `hashCode()`, `toString()` 자동 구현

### 왜 있나
1. **보일러플레이트 제거** — Lombok `@Data` 없이도 깔끔.
2. **불변 보장** — 모든 필드가 final.
3. **의미 명확** — "이건 데이터 운반용이지 도메인 객체 아니다"는 신호.
4. **표준 API** — Lombok과 달리 자바 표준이라 의존성 없음.

### Mini Pay 어디
`PaymentRequest.java:11-22`
```java
public record PaymentRequest(

        @NotBlank(message = "merchantId는 필수입니다")
        @Size(max = 50, message = "merchantId는 50자 이하여야 합니다")
        String merchantId,

        @NotNull(message = "금액은 필수입니다")
        @DecimalMin(value = "1", message = "금액은 1 이상이어야 합니다")
        @Digits(integer = 15, fraction = 4, message = "금액 형식이 올바르지 않습니다")
        BigDecimal amount
) {
}
```
- 검증 어노테이션을 필드(파라미터)에 직접 부착.
- `req.merchantId()`, `req.amount()`로 접근. **`req.getMerchantId()` 아님** — getter는 자동 생성되지만 이름이 필드명 그대로.

### 비교: 옛날 자바 DTO
```java
public class PaymentRequest {
    private final String merchantId;
    private final BigDecimal amount;

    public PaymentRequest(String merchantId, BigDecimal amount) {
        this.merchantId = merchantId;
        this.amount = amount;
    }

    public String getMerchantId() { return merchantId; }
    public BigDecimal getAmount() { return amount; }

    @Override public boolean equals(Object o) { ... 10줄 ... }
    @Override public int hashCode() { ... 5줄 ... }
    @Override public String toString() { ... }
}
```
record 한 줄이 이 30줄을 대체.

### 비전공자 함정
- **record는 불변이라 상속 불가**. 자식 클래스 못 만듦. 부모로 인터페이스만 implements 가능.
- **JPA 엔티티에는 record 사용 불가** — JPA가 기본 생성자 + 필드 변경(dirty checking)을 요구하기 때문. DTO에만 사용.
- **검증 메시지에서 필드 접근자 호출 시 괄호 필수**: `req.amount()`이지 `req.amount`가 아님.

### 실습
`SignupRequest`, `LoginRequest`, `TransferRequest`, `PaymentResponse`, `TransferResponse` 모두 record. 한 번씩 열어보고 "이 record가 자동으로 갖는 것"을 머리로 떠올려보기.

---

## 1.4 `Optional<T>` — null의 대안

### 개념
"있을 수도, 없을 수도 있는 값"을 명시적으로 표현하는 컨테이너.
```java
Optional<User> userOpt = userRepository.findByEmail(email);
```
이 반환 타입을 보는 순간 호출자는 **"없을 수도 있다"는 사실을 인지하도록 강제**됨.

### 왜 있나
- 자바에서 가장 흔한 버그 1위: **NullPointerException (NPE)**.
- `user.getName()`을 호출했는데 `user`가 null이면 런타임 폭발.
- Optional은 **타입 시스템 안에서** "없을 수 있음"을 표시 → 컴파일러가 안전한 처리를 유도.

### Mini Pay 어디
`AccountRepository.java:13-16`
```java
Optional<Account> findByUserId(Long userId);

@Query("select a.id from Account a where a.userId = :userId")
Optional<Long> findIdByUserId(Long userId);
```

`TransferService.java:31-32`
```java
long senderId = accountRepository.findIdByUserId(userId)
        .orElseThrow(() -> AccountNotFoundException.forUser(userId));
```

이 두 줄에서 일어나는 일:
1. `findIdByUserId(userId)` → `Optional<Long>` 반환.
2. `.orElseThrow(() -> ...)` → 값이 있으면 꺼내고, 없으면 람다가 만든 예외를 던짐.

### Optional의 핵심 메서드
| 메서드 | 동작 |
|---|---|
| `isPresent()` | 값 있나? boolean. |
| `isEmpty()` | 비었나? boolean. |
| `get()` | 값을 꺼냄. **빈 Optional에 호출하면 예외** — 안티패턴. |
| `orElse(default)` | 있으면 값, 없으면 default. |
| `orElseGet(() -> ...)` | 있으면 값, 없으면 람다 결과. |
| `orElseThrow(() -> new ...)` | 있으면 값, 없으면 람다가 만든 예외. |
| `map(fn)` | 있으면 변환, 없으면 빈 Optional. |
| `ifPresent(fn)` | 있을 때만 실행. |

### Mini Pay 더 보기
`PaymentService.java:35-38`
```java
Optional<Transaction> existing = transactionRepository.findByIdempotencyKey(idempotencyKey);
if (existing.isPresent()) {
    return replayIfMatches(existing.get(), account.getId(), req, amount);
}
```
- `isPresent()` 체크 후 `get()`은 안전한 사용. 다만 더 우아한 패턴은 `existing.map(...).orElse(...)` 또는 `existing.ifPresentOrElse(...)`.

`PaymentService.java:50-52`
```java
return transactionRepository.findByIdempotencyKey(idempotencyKey)
        .map(existingTx -> replayIfMatches(existingTx, account.getId(), req, amount))
        .orElseThrow(() -> ex);
```
- `map`으로 Optional<Transaction>을 Optional<PaymentResponse>로 변환.
- 빈 Optional이면 `orElseThrow`로 예외 던짐.
- **이 한 줄이 "값 있으면 처리, 없으면 던지기" 패턴의 정석**.

### 비전공자 함정
- **Optional 필드 만들지 말 것**. `private Optional<String> name;` 같은 건 안티패턴. 메서드 반환 타입에만 쓰는 게 관례.
- **Optional을 다시 null 체크하지 말 것**. `if (opt != null)`는 무의미 — `findByXxx`는 절대 null을 반환하지 않고 항상 Optional 객체를 반환함.
- **`.get()` 호출 전 `isPresent()` 체크 없으면** 빈 Optional에서 `NoSuchElementException` 폭발.

### 실습
모든 repository 메서드의 반환 타입을 훑어보고, 호출하는 service 코드에서 어떻게 풀어내는지 매핑하기. 안티패턴(맨얼굴 `.get()`)이 없는지도 확인.

---

## 1.5 Collection — List, Map, Set

### 개념
**여러 개의 값을 담는 자료구조 컨테이너**. 자바에서 3대 인터페이스:

| 인터페이스 | 의미 | 대표 구현 | 특징 |
|---|---|---|---|
| `List<T>` | 순서 있음, 중복 허용 | `ArrayList`, `LinkedList` | 인덱스 접근 |
| `Set<T>` | 순서 없음, 중복 X | `HashSet`, `TreeSet`, `LinkedHashSet` | 중복 자동 제거 |
| `Map<K,V>` | 키-값 쌍 | `HashMap`, `TreeMap`, `LinkedHashMap` | 키로 값 조회 |

### 왜 인터페이스가 따로 있나
- 코드를 구현체가 아닌 **인터페이스에 의존**시키면, 나중에 구현체를 바꿔도 호출 코드는 안 바뀜.
- 예: `List<String> names = new ArrayList<>();` ← 선언은 List, 실제 객체는 ArrayList.
- 나중에 `LinkedList`로 바꾸려면 `new LinkedList<>()`로만 바꾸면 끝.

### 주요 구현체 비교

**List**
- `ArrayList`: 내부적으로 배열. 인덱스 조회 O(1), 중간 삽입 O(n). **거의 항상 ArrayList**.
- `LinkedList`: 양방향 연결 리스트. 인덱스 조회 O(n), 양 끝 삽입/삭제 O(1).

**Set**
- `HashSet`: 해시 기반. 추가/조회 O(1) 평균. 순서 없음.
- `TreeSet`: 이진 탐색 트리 기반. 추가/조회 O(log n). **정렬된 순서**.
- `LinkedHashSet`: HashSet + 삽입 순서 유지.

**Map**
- `HashMap`: 해시 기반. put/get O(1) 평균. **거의 항상 HashMap**.
- `TreeMap`: 키 정렬.
- `LinkedHashMap`: 삽입 순서 유지. LRU 캐시 구현에 유용.

### Mini Pay에서
직접적으로 많이 안 보이지만 Spring 내부 어디에나:
- `PageResponse<T>`의 `content`는 `List<T>`.
- HTTP 헤더는 `Map<String, String>`.
- JPA 쿼리 결과가 여러 건이면 `List<...>`.

### 비전공자 함정
- **불변 컬렉션 vs 가변 컬렉션**:
```java
List<String> a = List.of("a", "b");      // 불변. a.add("c") → 예외.
List<String> b = new ArrayList<>(a);     // 가변. b.add("c") → OK.
```
- **HashMap의 key는 `equals`/`hashCode`를 제대로 구현해야 함**. 직접 만든 클래스를 key로 쓰면 함정 1번 (1.7 참조).
- **순회 중 수정 금지**: `for (String s : list) { list.add(...); }` → `ConcurrentModificationException`. 안전하게는 `Iterator.remove()` 또는 `removeIf()`.

### 실습
다음을 머리로 구현 결정 해보기:
- "유저 ID로 빠르게 이름 찾기" → `Map<Long, String>` (HashMap).
- "방문한 IP 중복 제거" → `Set<String>` (HashSet).
- "최근 거래 50건 순서대로" → `List<Transaction>` (ArrayList).
- "사전 순으로 정렬된 이메일 목록" → `Set<String>` (TreeSet).

---

## 1.6 Stream / 람다

### 개념
Java 8부터 도입된 **함수형 스타일** 컬렉션 처리.
```java
// 명령형 (옛날)
List<String> names = new ArrayList<>();
for (User u : users) {
    if (u.getAge() > 18) {
        names.add(u.getName());
    }
}

// 선언형 (Stream)
List<String> names = users.stream()
        .filter(u -> u.getAge() > 18)
        .map(User::getName)
        .toList();
```

### 람다 표현식
- `(인자) -> 표현식` 또는 `(인자) -> { 블록; return ...; }`.
- 인자 하나면 괄호 생략 가능: `x -> x * 2`.
- 인자 없으면 빈 괄호: `() -> "hello"`.

### 메서드 참조 `::`
- 람다의 단축 표기.
- `User::getName` = `(u) -> u.getName()`.
- `System.out::println` = `(x) -> System.out.println(x)`.

### Stream의 3단계
1. **생성**: `list.stream()`, `Stream.of(...)`, `Arrays.stream(...)`.
2. **중간 연산** (lazy, 새 Stream 반환): `filter`, `map`, `sorted`, `distinct`, `limit`, `skip`.
3. **종단 연산** (값/컬렉션 반환, Stream 소비): `toList()`, `collect(...)`, `count()`, `findFirst()`, `forEach()`, `reduce()`.

### Mini Pay 어디
직접적으로 Stream 체인이 많이는 안 나오지만, Optional의 `map` 같은 것도 같은 함수형 사고:

`PaymentService.java:50-52`
```java
return transactionRepository.findByIdempotencyKey(idempotencyKey)
        .map(existingTx -> replayIfMatches(existingTx, account.getId(), req, amount))
        .orElseThrow(() -> ex);
```

`PageResponse.of(...)` 같은 곳에서도 `page.getContent().stream().map(mapper).toList()` 패턴이 들어감.

### 비전공자 함정
- **Stream은 일회용**. 한 번 종단 연산 호출하면 끝. 다시 쓰려면 다시 생성.
- **중간 연산은 lazy** — 종단 연산 호출 전까지 아무 일도 안 함. `filter`만 줄줄 호출해도 실행 안 됨.
- **부작용 금지** — `forEach` 안에서 외부 리스트에 add 하는 코드는 안티패턴. 대신 `collect` 사용.
- **병렬 스트림(`parallelStream`)은 함정 많음**. 작은 컬렉션엔 오히려 느림, 스레드 안전 문제 발생 가능. 일반적으론 쓰지 말 것.

### 실습
명령형 for 루프 코드를 Stream으로 바꿔 써보기:
```java
// 유저 리스트에서 활성 사용자의 이메일을 대문자로
List<String> result = new ArrayList<>();
for (User u : users) {
    if (u.isActive()) {
        result.add(u.getEmail().toUpperCase());
    }
}

// → users.stream()
//        .filter(User::isActive)
//        .map(u -> u.getEmail().toUpperCase())
//        .toList();
```

---

## 1.7 String 불변성, `equals` vs `==`

### 개념
- **`String`은 불변(immutable)**. 한 번 만든 문자열은 못 바꿈. `s.toUpperCase()`는 **새 문자열**을 반환할 뿐 `s`를 안 바꿈.
- **`==`은 참조 비교** (메모리 주소가 같은가).
- **`equals()`는 값 비교** (내용이 같은가).

### 자바에서 가장 흔한 실수
```java
String a = "hello";
String b = "hello";
String c = new String("hello");

a == b          // true  (String pool로 같은 객체)
a == c          // false (new로 다른 객체)
a.equals(c)     // true  (값이 같음)
```

규칙: **값 비교는 무조건 `.equals()`**. 특히 사용자 입력은 항상.

### Mini Pay 어디
`PaymentService.java:58-60`
```java
boolean sameAccount = existing.getAccountId().equals(accountId);
boolean sameAmount = existing.getAmount().equals(amount);
boolean sameMerchant = req.merchantId().equals(existing.getMerchantId());
```
- `getAccountId()`는 `Long`. `Long`도 객체라 `==`로 비교하면 함정 (캐시 범위인 -128~127만 같고 그 밖은 다름).
- `getAmount()`는 `Money` (우리가 만든 클래스). `@EqualsAndHashCode`로 equals 자동 구현 → 값 비교됨.
- `merchantId()`는 `String`. 무조건 `.equals()`.

`TransferService.java:35`
```java
if (senderId == receiverId) {
    throw new InvalidTransferTargetException(...);
}
```
- 이건 `==` 사용. `senderId`/`receiverId`가 **primitive `long`** (소문자 L) 이라서. primitive는 `==`이 값 비교.

### primitive vs Wrapper 클래스
| primitive | wrapper |
|---|---|
| `int` | `Integer` |
| `long` | `Long` |
| `boolean` | `Boolean` |
| `double` | `Double` |
| `char` | `Character` |

- primitive는 **값 자체**, wrapper는 **객체**.
- primitive는 null 불가, wrapper는 null 가능.
- primitive끼리 `==`은 안전, wrapper끼리 `==`은 위험.

### Mini Pay 코드의 신중함
`TransferService.java`에서 자세히 보면:
```java
long senderId = accountRepository.findIdByUserId(userId)
        .orElseThrow(() -> ...);
long receiverId = req.counterpartyAccountId();
```
- 의도적으로 `Long`이 아니라 `long`(primitive)으로 받음.
- 그래서 `senderId == receiverId` (라인 35), `first.getId() == senderId` (라인 56-57)도 안전.

### 비전공자 함정
- **`String literal pool` 함정**: `"hello" == "hello"`가 우연히 true 나와도 절대 의존하면 안 됨.
- **Long/Integer 캐시 범위**: -128~127만 같은 객체 재사용. `Long a = 200L; Long b = 200L; a == b` → false (놀라움).
- **null과 equals**: `s.equals(null)` → false. `null.equals(s)` → NPE. 안전 패턴: `"target".equals(s)` (상수가 앞).
- **String 연결 성능**: 루프 안에서 `s = s + "x"`는 매번 새 String 생성. 많이 합치면 `StringBuilder`.

### 실습
- `PaymentService.java`의 `replayIfMatches` 비교 3줄을 `==`로 바꿔보고 어떤 게 우연히 통과하고 어떤 게 실패할지 예측.

---

## 1.8 Generic `<T>`

### 개념
타입을 **사용 시점에 결정**하게 만드는 메커니즘.
```java
List<String> a = new ArrayList<>();   // String 전용 리스트
List<Integer> b = new ArrayList<>();  // Integer 전용 리스트
```
컴파일러는 `a.add(42)`를 막아주고, `a.get(0)`을 자동으로 String으로 다뤄줌.

### 왜 있나
**Generic 도입 전 (Java 5 이전)**:
```java
List list = new ArrayList();
list.add("hello");
list.add(42);                  // 컴파일 통과 (타입 무관)
String s = (String) list.get(1);  // 런타임 ClassCastException 폭발
```
**Generic 도입 후**: 컴파일 단계에서 타입 안전성 확보.

### 핵심 기호
- `<T>` — 타입 파라미터 (Type). 보통 한 글자 대문자.
- `<E>` — Element. 컬렉션에서.
- `<K, V>` — Key, Value.
- `<R>` — Return.
- `<?>` — 와일드카드 ("어떤 타입이든").
- `<? extends T>` — T의 자식 (상한).
- `<? super T>` — T의 부모 (하한).

### Mini Pay 어디
`AccountRepository.java:11`
```java
public interface AccountRepository extends JpaRepository<Account, Long> {
```
- `JpaRepository<Entity, ID>` — Account 엔티티를 다루고, 식별자 타입은 Long.
- Spring이 이 제네릭 정보를 보고 `save(Account)`, `findById(Long)` 같은 메서드 시그니처를 자동 결정.

`PageResponse.java`
```java
public record PageResponse<T>(
    List<T> content,
    int page,
    ...
) {
    public static <T, R> PageResponse<R> of(Page<T> page, Function<T, R> mapper) { ... }
}
```
- `T`는 엔티티 타입(Transaction), `R`은 응답 DTO 타입(TransactionResponse).
- `<T, R>`을 메서드 앞에 선언 = "이 메서드 안에서 사용할 타입 파라미터를 도입".

`Optional<T>`, `List<T>`, `Map<K, V>` 모두 같은 메커니즘.

### 비전공자 함정
- **타입 소거(Type Erasure)**: 자바 generic은 컴파일 후 정보가 사라짐. 런타임에 `List<String>`인지 `List<Integer>`인지 구분 불가.
```java
if (list instanceof List<String>) { ... }  // ❌ 컴파일 에러
if (list instanceof List<?>) { ... }       // ✅ 가능
```
- **primitive는 제네릭 불가**: `List<int>` 불가. `List<Integer>` 사용 (autoboxing).
- **배열과 제네릭은 안 맞음**: `new T[10]` 불가. 우회법은 `(T[]) new Object[10]` (안전하지 않은 캐스트).

### 실습
- `Optional<Long>`, `Optional<Account>`, `Optional<Transaction>` 차이를 머리로 그리기.
- `List<User>`에서 꺼낸 원소가 자동으로 `User` 타입인 이유 = 컴파일러가 generic 정보로 캐스트 삽입.

---

## 1.9 패키지 / import / 접근 제어자

### 패키지
- 클래스를 묶는 폴더 구조 + 네임스페이스.
- `com.minipay.domain` = 도메인 클래스 묶음.
- 같은 클래스 이름이 다른 패키지에 있으면 충돌 없음.

### Mini Pay 패키지 구조 (CLAUDE.md 정의)
```
com.minipay
├── domain       엔티티, VO, 도메인 예외
├── repository   JpaRepository 인터페이스
├── service      비즈 로직
├── controller   HTTP 진입점
├── dto          요청/응답 record
├── security     JWT, SecurityConfig
├── config       그 외 Spring Configuration
└── exception    @ControllerAdvice 등
```
- 폴더 = 패키지. 자바 파일 첫 줄 `package com.minipay.domain;`은 "이 클래스는 어디 소속" 선언.

### import
- 다른 패키지 클래스를 짧은 이름으로 쓰기 위함.
- `import java.util.Optional;` 후엔 `Optional<T>`만 써도 됨.
- `import com.minipay.domain.*;` 와일드카드도 가능하지만 명시적이 좋음.
- **같은 패키지 안의 클래스는 import 불필요**.
- `java.lang.*`은 자동 import (`String`, `Integer`, `Object`, `Exception`).

### 접근 제어자 4단계
| 제어자 | 같은 클래스 | 같은 패키지 | 자식 클래스 | 어디서나 |
|---|:-:|:-:|:-:|:-:|
| `private` | O | X | X | X |
| (없음) = package-private | O | O | X | X |
| `protected` | O | O | O | X |
| `public` | O | O | O | O |

### Mini Pay 어디
`Account.java:21`
```java
@NoArgsConstructor(access = AccessLevel.PROTECTED)
```
- 기본 생성자를 `protected`로 막음. JPA(같은 패키지나 프록시)는 사용 가능, 외부 코드는 불가.
- → 외부에선 무조건 `Account.openFor(...)` 정적 팩토리만 사용하도록 강제.

`Money.java:31`
```java
private Money(BigDecimal amount, Currency currency) { ... }
```
- 생성자를 `private`로 닫음. `Money.of(...)` 정적 팩토리만 진입 가능.

`AccountRepository.java:11`
```java
public interface AccountRepository extends JpaRepository<Account, Long> {
```
- `public` 인터페이스 = 어디서든 주입받아 사용 가능.

### 비전공자 함정
- **package-private이 생각보다 강함**: 같은 패키지면 `private` 빼고 다 보임. 패키지를 의도 단위로 짜야 함.
- **`protected`는 자식 + 같은 패키지**. "자식만 보임"이 아님 (헷갈리는 포인트).
- **하나의 .java 파일에 public 클래스는 1개만**, 그것의 이름이 파일명과 동일해야 함.

### 실습
- `Money` 클래스의 모든 메서드 접근 제어자를 보고, 외부에서 호출 가능한 것 vs 불가능한 것 분류.
- `Account.validateAmount`는 왜 `private`인가? → 도메인 일관성: 외부에서 호출되면 검증 로직이 우회될 수 있음.

---

## 1.10 어노테이션의 정체

### 개념
**코드에 다는 메타데이터**. 그 자체는 아무 일도 안 함.

```java
@Override
public String toString() { ... }
```
`@Override`는 "이 메서드는 부모 클래스 메서드를 오버라이드한다"는 표시일 뿐. 컴파일러가 그걸 보고 "진짜 부모에 그런 메서드 있나?" 검증.

### 어노테이션이 작동하는 3가지 방식
1. **컴파일러가 읽음**: `@Override`, `@SuppressWarnings`, `@FunctionalInterface`. 컴파일 단계에 검증/경고.
2. **런타임 리플렉션으로 누군가 읽음**: `@Transactional`, `@RequestMapping`, `@Autowired`. **Spring 같은 프레임워크가 클래스 스캔 → 어노테이션 발견 → 동작 추가**.
3. **컴파일 시 코드 생성**: Lombok의 `@Getter`, `@NoArgsConstructor` 등. annotation processor가 .class 파일에 getter/setter를 박아넣음.

### Mini Pay에서 종류별 정리

**JPA 어노테이션** — Hibernate가 부팅 시 읽어서 SQL 매핑 생성
- `@Entity`, `@Table`, `@Id`, `@GeneratedValue`
- `@Column`, `@Embedded`, `@AttributeOverride`
- `@Enumerated`, `@Lock`

**Spring 어노테이션** — Spring 컨테이너가 부팅 시 읽어서 Bean 등록/DI/AOP 적용
- `@Service`, `@Repository`, `@Controller`, `@RestController`, `@Component`, `@Configuration`
- `@Bean`, `@Autowired` (생성자 주입에선 생략 가능)
- `@Transactional`, `@RequestMapping`, `@PostMapping`, `@GetMapping`
- `@Valid`, `@RequestBody`, `@PathVariable`, `@RequestParam`, `@RequestHeader`

**Validation 어노테이션** — Hibernate Validator가 `@Valid` 만나면 읽음
- `@NotBlank`, `@NotNull`, `@Email`, `@Size`, `@Pattern`, `@DecimalMin`, `@Digits`

**Lombok** — 컴파일 시점에 코드 생성
- `@Getter`, `@Setter`, `@NoArgsConstructor`, `@RequiredArgsConstructor`, `@EqualsAndHashCode`

### 가장 중요한 깨달음
**"어노테이션은 마법이 아니다."** 어딘가에 "이 어노테이션을 읽고 처리하는 코드"가 반드시 있음.

- `@Transactional` → Spring이 클래스 스캔 → 발견 시 **프록시 객체**로 감싸서 메서드 호출 앞뒤에 트랜잭션 코드 삽입.
- `@RequestMapping` → Spring MVC가 부팅 시 모든 컨트롤러 스캔 → URL→메서드 매핑 테이블 구축.
- `@Entity` → Hibernate가 부팅 시 발견 → 메타데이터 등록 → DB 테이블과 매핑.

비전공자가 이걸 모르면 "왜 @Transactional이 안 먹지?" 같은 문제를 영영 못 풉니다. 답은 "Spring AOP 프록시가 그 호출을 안 거쳤기 때문" (self-invocation 함정 등).

### Mini Pay 핵심 사례
`PaymentService.java:28`
```java
@Transactional
public PaymentResponse pay(Long userId, String idempotencyKey, PaymentRequest req) {
```
- Spring이 PaymentService를 Bean으로 만들 때 **이 메서드 호출 앞에 트랜잭션 시작, 뒤에 커밋/롤백 코드를 끼워넣은 프록시**를 만듦.
- 실제 호출 흐름: 컨트롤러 → 프록시.pay() [트랜잭션 시작] → 진짜 PaymentService.pay() → 프록시.pay() [커밋].

### 비전공자 함정
- **어노테이션을 단다고 자동으로 되지 않음**. 누가 그걸 읽고 처리하는지를 알아야 함.
- **Spring 안에서만 작동**: `@Transactional` 달린 클래스를 `new`로 직접 만들면 트랜잭션 안 걸림 (프록시를 안 거침).
- **self-invocation 무효**: 같은 클래스 메서드 안에서 `this.otherTransactionalMethod()` 호출은 프록시 안 거치므로 `@Transactional` 무효.

### 실습
`PaymentService.java`의 모든 어노테이션을 분류:
- `@Service` — Spring이 읽고 Bean 등록
- `@RequiredArgsConstructor` — Lombok이 컴파일 시점에 생성자 생성
- `@Transactional` — Spring AOP가 읽고 프록시 생성

이 셋이 다 다른 시점·방식으로 작동한다는 사실을 인식.

---
---

# Part 2. JVM / 메모리 / 스레드

자바 코드는 결국 JVM이라는 **가상 기계** 위에서 실행됩니다. "왜 그 에러가 났지?"의 답은 거의 다 JVM 메모리·스레드 모델 안에 있습니다.

---

## 2.1 스택(Stack) vs 힙(Heap)

### 개념
JVM이 자바 프로그램에 할당하는 메모리는 크게 두 영역.

| 영역 | 저장되는 것 | 수명 | 크기 |
|---|---|---|---|
| **Stack** | 메서드 호출 프레임, 지역변수, primitive 값, 객체 **참조** | 메서드 호출 동안 | 작음 (기본 512KB~1MB) |
| **Heap** | 모든 **객체** 본체 | GC가 회수할 때까지 | 큼 (기본 ~수GB) |

### 그림으로
```java
void pay() {
    long userId = 42;                  // primitive, Stack에 직접
    Account account = new Account();   // 객체는 Heap에, 참조만 Stack에
    String name = "alice";             // 참조만 Stack, "alice"는 Heap (String pool)
}
```

```
Stack (pay 프레임)              Heap
+----------------+              +----------+
| userId   = 42  |              | Account  |
| account  -----+--------------→| { ... }  |
| name     -----+----+         +----------+
+----------------+    |         +----------+
                      +-------→ | "alice"  |
                                +----------+
```

### 왜 두 영역이 분리됐나
1. **속도**: Stack은 마지막 들어온 게 먼저 나가는 단순 구조 → 매우 빠름. push/pop만.
2. **수명 관리**: 메서드가 끝나면 그 메서드의 Stack 프레임은 통째로 회수. GC 필요 없음.
3. **공유**: Heap의 객체는 여러 스레드/메서드가 참조 가능. Stack은 그 스레드의 그 메서드만 접근.

### 핵심: primitive vs 객체
```java
long a = 100L;          // Stack에 값 100이 직접
Long b = 100L;          // Heap에 Long(100) 객체, Stack에 참조 b
```
- primitive 비교 `a == 100L` → 값 비교, 안전.
- 객체 참조 비교 `b == anotherB` → 메모리 주소 비교, 위험.
- 1.7 챕터의 `==` 함정의 근본 원인이 이것.

### 스레드별 Stack
- **각 스레드는 자기만의 Stack을 가짐**.
- Heap은 모든 스레드가 공유.
- 그래서 지역변수는 스레드 안전(다른 스레드가 못 봄), 공유 객체 필드는 위험(여러 스레드가 동시 접근).

### 비전공자 함정
- **StackOverflowError**: 메서드가 끝없이 재귀 호출 → Stack 프레임 쌓여서 한계 초과.
- **OutOfMemoryError: Java heap space**: Heap에 객체 너무 많이 만들고 GC가 회수 못 함 (메모리 누수).
- **이 두 에러는 서로 다른 영역의 문제**. 진단 시 어디서 났는지 구분이 중요.

### Mini Pay에서
- `pay()` 호출 시 `userId`, `idempotencyKey`, `req` 참조 모두 Stack 프레임.
- `new Money(...)`로 만든 Money 객체는 Heap에.
- 톰캣이 동시 요청 100건을 처리하면 → 100개 스레드 × 각자 Stack. 같은 Heap을 공유.

---

## 2.2 GC (Garbage Collection)

### 개념
**더 이상 참조되지 않는 객체를 자동으로 회수**.
C/C++은 `malloc/free` 수동 → 메모리 누수, dangling pointer.
자바는 GC가 자동으로 처리 → 개발자가 메모리 해제 신경 안 씀.

### 어떻게 "참조되지 않음"을 판단하나
**Reachability 분석**: GC Root(Stack의 지역변수, static 필드 등)에서 출발해 도달 가능한 객체를 표시 → 표시 안 된 객체는 회수.

```java
Account a = new Account();   // a를 통해 도달 가능
a = null;                    // 더 이상 도달 불가 → 다음 GC에서 회수
```

### Young / Old 세대
JVM은 객체를 두 영역으로 나눠 관리 (대부분 객체가 짧게 살다 죽는다는 가설).
- **Young Generation**: 새로 생긴 객체. Minor GC가 자주, 빠르게.
- **Old Generation**: 살아남은 객체. Major GC가 가끔, 길게 (Stop-The-World).

대표 GC 알고리즘: G1GC (Java 9+ 디폴트), ZGC (Java 11+, 저지연), Shenandoah.

### Stop-The-World (STW)
GC가 진행되는 동안 **모든 애플리케이션 스레드 일시 정지**. 짧으면 ms 단위지만 길어지면 응답 지연. 운영 환경에서 GC 튜닝이 필요한 이유.

### 비전공자 함정
- **"GC가 있으니 메모리 신경 안 써도 된다"는 환상**: GC가 못 회수하는 누수가 있음.
  - 정적 컬렉션에 계속 add: `static List<Object> cache = new ArrayList<>();`
  - 닫지 않은 리소스: 파일 핸들, DB 커넥션, 스레드.
  - 캐시 무한 증가.
- **`System.gc()` 호출은 거의 의미 없음**: 힌트일 뿐, GC가 무시 가능. 운영 코드에 쓰지 말 것.

### Mini Pay에서 신경 쓸 부분
- **DB 커넥션 풀**: HikariCP가 관리. 우리는 자동.
- **Redis 커넥션**: Spring Data Redis가 관리.
- **JPA 영속성 컨텍스트**: 트랜잭션 끝나면 비워짐.
- → 우리 코드 레벨에선 GC 직접 신경 쓸 일 거의 없음. 다만 큰 컬렉션 만들면 의식할 것.

---

## 2.3 스레드 — 톰캣이 요청을 어떻게 처리하나

### 개념
- **프로세스**: OS가 실행 중인 프로그램. 자기만의 메모리 공간.
- **스레드**: 한 프로세스 안의 실행 흐름. **같은 Heap을 공유**, 각자 Stack 보유.

JVM은 멀티 스레드 환경. main 스레드 + GC 스레드 + 톰캣 워커 스레드 + …

### 톰캣의 요청 처리 모델
```
[클라이언트 요청] → 톰캣 (디폴트 200개 워커 스레드 풀)
                    ↓
                    유휴 스레드 1개 할당
                    ↓
                    Servlet 처리 (Spring DispatcherServlet)
                    ↓
                    @RestController.method() 실행
                    ↓
                    응답 반환 → 스레드 풀로 복귀
```

**핵심**: 톰캣은 **요청마다 새 스레드를 만들지 않음**. 풀(pool)에서 빌려쓰고 반환.

### 동시성 함정의 출발점
- `PaymentService`는 **싱글톤** (Spring Bean). 인스턴스 1개를 모든 요청 스레드가 공유.
- 만약 PaymentService에 가변 인스턴스 필드(`private int counter`)를 두면 → 동시 요청들이 같은 필드를 동시 수정 → race condition.

### 그래서 우리 코드가 이렇게 생겼다
`PaymentService.java:23-26`
```java
@Service
@RequiredArgsConstructor
public class PaymentService {
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final IdempotencyStore idempotencyStore;
```
- 모든 필드 `final` + 의존성만 보관, 가변 상태 없음.
- 200개 스레드가 동시에 `pay()` 호출해도 안전 (요청마다 인자 다르고, 지역변수만 사용).

### 진짜 동시성 문제는 DB에서
- 잔액 같은 **공유 상태는 DB**에 있음 → DB 락(`PESSIMISTIC_WRITE`)으로 해결.
- 우리 Step 10 시나리오: 잔액 10만원에 1천원 결제 100건 동시 → 비관적 락이 직렬화 → 잔액 정확히 0.

### Mini Pay 스레드 흐름 그림
```
요청 1 (스레드 A) ──→ PaymentService.pay()
요청 2 (스레드 B) ──→ PaymentService.pay()    같은 인스턴스, 다른 스레드
요청 3 (스레드 C) ──→ PaymentService.pay()
                      ↓
                      각자 자기 Stack에 매개변수 보관
                      각자 자기 트랜잭션, 자기 영속성 컨텍스트
                      ↓ DB 락 (PESSIMISTIC_WRITE)
                      한 번에 1개만 잔액 행 잠금
```

### 비전공자 함정
- **싱글톤 Bean에 가변 필드 두는 짓 금지**.
- **`ThreadLocal`**: 스레드별 저장소. Spring Security의 `SecurityContextHolder`가 ThreadLocal로 인증 정보 보관 → 요청 끝나면 비워야 누수 안 남.
- **스레드 안전 컬렉션**: `ArrayList`는 스레드 안전 아님. 멀티스레드 공유는 `ConcurrentHashMap`, `CopyOnWriteArrayList` 등.
- **synchronized**: 자바 키워드. 한 번에 한 스레드만 블록 진입. 우리 코드엔 없음 (분산 환경에선 무력하므로 DB 락 선호).

### 실습
부팅 후 톰캣 스레드 수 확인:
```
application.yml 에 server.tomcat.threads.max: 200 (디폴트)
```
- 100개 동시 요청이면 100개 스레드 동시 실행.
- 250개 동시 요청이면 50개는 대기 큐.

---

## 2.4 NPE (NullPointerException)의 본질

### 개념
**null인 참조로 메서드/필드 접근 시 발생.**
```java
String s = null;
s.length();   // NullPointerException
```

자바 개발자가 평생 만나는 1번 에러. Tony Hoare가 1965년에 null 도입을 "the billion-dollar mistake"라 부른 이유.

### 왜 발생하나
- 메서드가 null 반환했는데 안 체크함.
- 필드 초기화 누락.
- DI 실패 (Spring이 Bean 주입을 못 함).
- 외부 입력이 null인데 검증 안 함.

### Mini Pay에서 NPE 방어 전략
1. **`final` 필드 + 생성자 주입** → Spring이 부팅 시 모두 주입 보장.
2. **`Optional<T>` 반환** → 호출자가 명시적으로 처리하도록 강제.
3. **`@NotBlank`, `@NotNull` 검증** → 컨트롤러 진입 시점에 차단.
4. **정적 팩토리 내 null 체크** → `Money.of`, `Account.openFor`에서 `IllegalArgumentException`.

`Money.java:36-42`
```java
public static Money of(BigDecimal amount, Currency currency) {
    if (amount == null) {
        throw new IllegalArgumentException("금액은 null일 수 없습니다");
    }
    if (currency == null) {
        throw new IllegalArgumentException("통화는 null일 수 없습니다");
    }
    return new Money(amount, currency);
}
```
- "null이면 의미 있는 예외", "도메인 깊이 들어가서 NPE로 폭발하지 않게" — 경계에서의 방어.

### NPE 디버깅
Java 14+는 **Helpful NullPointerException** — 어떤 변수가 null이었는지 알려줌.
```
Cannot invoke "String.length()" because "<local1> s" is null
```
이전 자바는 "null이다"만 알려주고 누가 null인지 안 알려줘서 디버깅 지옥. Java 17 쓰는 우리는 운이 좋음.

### 비전공자 함정
- **체이닝 함정**:
```java
user.getAccount().getBalance().getAmount()
```
중간 하나라도 null이면 NPE. 어디서 났는지 헷갈림.
- **Boolean autounboxing**: `Boolean b = null; if (b) {...}` → NPE.
- **컬렉션 null 원소**: `list.contains(null)` 자체는 안전하지만, `list.forEach(s -> s.toUpperCase())`는 null 원소에서 NPE.

### 실습
- 코드에서 `.get()` 호출을 모두 찾기 → 호출 대상이 null일 수 있는지 검토.
- `Optional`을 반환하는 메서드의 결과를 `null` 체크하면 안 됨 (Optional 자체는 null 아님).

---

## 2.5 스택 트레이스 읽는 법

### 개념
예외 발생 시 출력되는 **호출 경로 역추적**. 비전공자가 가장 두려워하지만 사실 가장 친절한 디버깅 도구.

### Mini Pay의 가상 예시
```
java.lang.NullPointerException: Cannot invoke "Money.add(...)" because "this.balance" is null
    at com.minipay.domain.Account.charge(Account.java:58)
    at com.minipay.service.AccountService.charge(AccountService.java:34)
    at com.minipay.service.AccountService$$SpringCGLIB$$0.charge(<generated>)
    at com.minipay.controller.AccountController.charge(AccountController.java:25)
    at java.base/jdk.internal.reflect.DirectMethodHandleAccessor.invoke(...)
    at org.springframework.web.method.support.InvocableHandlerMethod.doInvoke(...)
    ... 78 more
Caused by: ...
```

### 읽는 순서
1. **첫 줄** — 예외 타입과 메시지. `NullPointerException` + "this.balance is null".
2. **두 번째 줄** — 실제 터진 곳. `Account.java:58`. 여기가 진짜 범인.
3. **그 아래** — 누가 호출했는지. 위로 갈수록 깊은 곳, 아래로 갈수록 진입점.
4. **`Caused by:`** — 원인 예외. wrap된 경우 진짜 원인은 이쪽.

### 핵심 팁
- **내 패키지(`com.minipay`)부터 본다**. 프레임워크 스택은 대부분 노이즈.
- **`...SpringCGLIB...`이 보이면 프록시 통과 표시** → @Transactional, @Async 등이 작동했다는 증거.
- **`<generated>`** — 동적 프록시. 코드 가서 봐도 없음.
- **"... N more"**: 같은 호출 경로 생략. 보통 무시.

### 자주 보는 패턴
**1) DataIntegrityViolationException**
```
Caused by: org.postgresql.util.PSQLException: ERROR: duplicate key value violates unique constraint "transactions_idempotency_key_key"
```
→ DB UNIQUE 위반. 멱등키 중복.

**2) LazyInitializationException**
```
org.hibernate.LazyInitializationException: could not initialize proxy - no Session
```
→ open-in-view: false 인 환경에서 트랜잭션 밖에서 lazy 필드 접근. 컨트롤러나 뷰에서 엔티티의 lazy 컬렉션 만지면 나옴.

**3) HttpMessageNotReadableException**
```
JSON parse error: ...
```
→ 요청 본문 JSON 파싱 실패.

**4) MethodArgumentNotValidException**
```
Field error in object 'paymentRequest' on field 'amount': rejected value [null]
```
→ `@Valid` 검증 실패. 우리 GlobalExceptionHandler가 400으로 변환.

### 비전공자 함정
- **첫 줄만 보고 검색**: 메시지가 너무 일반적이면 검색 결과 안 나옴. **터진 줄 + 메시지 핵심 단어 조합**으로 검색.
- **Caused by 무시**: 진짜 원인은 거기 있는데 첫 줄만 보고 우왕좌왕.
- **"내 잘못 아닌 거 같다"는 착각**: 프레임워크 코드 줄이 길게 나와도 99% 내 코드 입력이 원인.

### 실습
- 부팅 후 일부러 잘못된 요청 보내서 다양한 예외 만들어보기:
  - 잘못된 JSON → HttpMessageNotReadableException
  - 검증 실패 → MethodArgumentNotValidException
  - 인증 누락 → AuthenticationException (필터에서 잡혀 401)
  - 존재하지 않는 경로 → NoResourceFoundException

각각의 스택트레이스를 응시하면서 내 코드의 어느 줄이 호출됐는지 추적.

---
---

# Part 3. IDE / 디버거 활용

`System.out.println`만 박으면 평생 못 자랍니다. IDE의 진짜 가치는 **디버거**와 **코드 탐색**입니다.

---

## 3.1 IntelliJ 단축키 — 머슬 메모리로 박을 것

### 탐색 (가장 자주 씀)
| 단축키 (Windows) | 동작 |
|---|---|
| `Shift Shift` (두 번) | **Search Everywhere** — 클래스/파일/심볼/액션 다 검색 |
| `Ctrl + N` | 클래스 검색 |
| `Ctrl + Shift + N` | 파일 검색 |
| `Ctrl + Alt + Shift + N` | 심볼(메서드/필드) 검색 |
| `Ctrl + E` | 최근 연 파일 |
| `Ctrl + Tab` | 열린 탭 전환 |
| `Ctrl + B` 또는 `Ctrl + Click` | **정의로 이동** (메서드/클래스) |
| `Ctrl + Alt + B` | **구현체로 이동** (인터페이스 → 구현 클래스) |
| `Alt + F7` | **사용처 찾기** (이 메서드를 누가 호출하나) |
| `Ctrl + F12` | 현재 파일의 구조 (메서드 목록) |
| `Ctrl + G` (또는 `Ctrl + L`) | 지정한 줄로 이동 |

### 편집
| 단축키 | 동작 |
|---|---|
| `Ctrl + D` | 줄 복제 |
| `Ctrl + Y` | 줄 삭제 |
| `Alt + Shift + ↑/↓` | 줄 이동 |
| `Ctrl + /` | 한 줄 주석 토글 |
| `Ctrl + Shift + /` | 블록 주석 |
| `Ctrl + W` | 점진적 선택 확장 (단어 → 표현식 → 블록) |
| `Ctrl + Alt + L` | 코드 포맷팅 |
| `Ctrl + Alt + O` | 사용 안 하는 import 제거 |

### 리팩토링
| 단축키 | 동작 |
|---|---|
| `Shift + F6` | **이름 변경** (모든 사용처 동시) |
| `Ctrl + Alt + M` | 메서드 추출 |
| `Ctrl + Alt + V` | 지역변수 추출 |
| `Ctrl + Alt + F` | 필드 추출 |
| `F6` | 다른 클래스로 이동 |

### 실행 / 디버그
| 단축키 | 동작 |
|---|---|
| `Shift + F10` | 최근 설정 실행 |
| `Shift + F9` | 디버그 모드 실행 |
| `F8` | Step Over (다음 줄) |
| `F7` | Step Into (메서드 내부로) |
| `Shift + F8` | Step Out (현재 메서드 빠져나옴) |
| `F9` | 다음 브레이크포인트까지 진행 |
| `Ctrl + F8` | 브레이크포인트 토글 |
| `Ctrl + Shift + F8` | 브레이크포인트 관리 (조건부 등) |

### 가장 가치 있는 5개 (강제 암기)
1. `Shift Shift` — 무엇이든 찾기.
2. `Ctrl + B` — 정의로 점프.
3. `Alt + F7` — 사용처 찾기.
4. `Shift + F6` — 안전한 이름 변경.
5. `F8` / `F7` / `Shift + F9` — 디버거 3종.

이 5개만 머슬 메모리로 박혀도 생산성 5배.

---

## 3.2 디버거 사용법 — println의 1000배

### 기본 흐름
1. **브레이크포인트 찍기**: 줄 번호 옆 거터 클릭. 빨간 점 표시.
2. **디버그 실행**: `Shift + F9` 또는 벌레 아이콘.
3. **그 줄 도달 시 자동 정지**: IntelliJ 디버거 창이 활성화.
4. **현재 상태 관찰**: 변수 패널에 모든 지역변수/필드 값 표시.
5. **조작**:
   - `F8` Step Over — 다음 줄로.
   - `F7` Step Into — 메서드 내부로 들어감.
   - `Shift + F8` Step Out — 메서드 빠져나옴.
   - `F9` Resume — 다음 브레이크포인트까지 진행.

### Mini Pay 실습 시나리오
1. `PaymentService.pay()`의 첫 줄(`Account account = accountRepository.findByUserIdForUpdate(userId)...`)에 브레이크포인트.
2. 디버그로 부팅.
3. curl로 결제 요청 한 번.
4. 디버거가 멈춤. 변수 패널에 `userId`, `idempotencyKey`, `req` 값 보임.
5. `F8`로 한 줄씩 진행하며 `account.balance` 변화 관찰.
6. `F7`로 `account.deduct(amount)` 내부로 들어가서 도메인 로직 추적.

### 강력한 기능

**조건부 브레이크포인트**
- 브레이크포인트 우클릭 → Condition 입력.
- 예: `userId == 5L` — userId가 5일 때만 멈춤.
- 동시 요청 디버깅 시 필수.

**예외 브레이크포인트**
- "이 예외가 던져지는 순간 멈춤".
- `Ctrl + Shift + F8` → `+` → Java Exception Breakpoints → 예외 클래스 지정.
- 어디서 NPE/특정 예외가 발생하는지 추적할 때.

**Evaluate Expression** (`Alt + F8`)
- 정지된 상태에서 임의 자바 표현식 실행.
- `account.getBalance().getAmount().compareTo(BigDecimal.valueOf(1000))` 같은 거 즉석 평가.

**Drop Frame**
- 현재 메서드 호출 직전으로 되돌아감 (호출을 취소).
- 잘못 진입한 경우 다시 해볼 수 있음.

### 비전공자 함정
- **운영 환경에선 디버거 못 씀**. 로그/모니터링이 답. 그래서 좋은 로그를 남기는 습관도 필요.
- **lazy 평가 함정**: 디버거가 변수 패널을 보여주려고 메서드를 평가하면 lazy 컬렉션이 강제 로드됨 → 코드 동작이 디버거 유무에 따라 달라 보일 수 있음.
- **멀티스레드 디버깅**: 디버거가 멈춘 스레드 외 다른 스레드는 계속 돌 수도/멈출 수도 있음. 설정 확인.

### 실습
- `TransferService.transfer()`에 브레이크포인트 6개:
  1. `senderId` 추출 후
  2. 자기 자신 체크 통과 후
  3. 기존 트랜잭션 조회 후
  4. SETNX 통과 후
  5. 두 계정 락 획득 후
  6. saveAndFlush 직전
- 정상 이체와 자기 자신 이체 두 시나리오를 디버거로 따라가며 흐름 차이 관찰.

---

## 3.3 코드 탐색 — 모르는 코드 빠르게 이해하기

### 시나리오: 처음 보는 프로젝트
1. **`Ctrl + Shift + Alt + S`** → Project Structure → 모듈/의존성 구조 파악.
2. **`Alt + 1`** → 프로젝트 뷰. 패키지 구조 훑기.
3. **`Ctrl + N`** → 진입점 찾기 (보통 `*Application.java`).
4. **`Ctrl + B`** 연쇄: main 메서드 → SpringApplication.run → ... 흐름 따라가기.

### "이 메서드는 누가 호출하지?" (역추적)
- 메서드 위에서 `Alt + F7`.
- 모든 호출 위치 목록 표시.
- 더블클릭으로 이동.

### "이 인터페이스의 진짜 구현은?"
- 인터페이스 메서드에서 `Ctrl + Alt + B`.
- 모든 구현 클래스 목록.
- 예: `JpaRepository.save()` → Spring Data가 런타임에 만든 구현 (코드 안 보임, 메서드명 파싱 기반).

### "이 변수 어디서 왔지?"
- 변수 이름에 커서 → `Ctrl + B`.
- 선언 위치로 점프.

### 코드 구조 보기
- `Ctrl + F12` — 현재 파일의 모든 메서드 목록 (네비게이션 가능).
- `Ctrl + Shift + F12` — 에디터 최대화.

### Diagrams
- 클래스 우클릭 → Diagrams → Show Diagram.
- 상속/구현 관계 시각화. 도메인 모델 전체 보기에 좋음.

### 비전공자 함정
- **`Ctrl + F`(현재 파일 검색)와 `Ctrl + Shift + F`(전체 프로젝트 검색) 구분**.
- **Find in Files vs Search Everywhere**: 전자는 텍스트, 후자는 의미 단위 검색. 적절한 거 사용.
- **숨겨진 자동 생성 코드**: Lombok이 생성한 getter는 .java 파일엔 안 보이지만 IntelliJ는 인식. Delombok 옵션으로 실제 코드 확인 가능.

### 실습
- `pay()` 메서드 호출 흐름 거꾸로 추적:
  - `PaymentController.pay()` 위에서 `Alt + F7` → 누가 호출? → Spring MVC가 HTTP 요청 받아 호출 (코드로는 안 보이지만 매핑 테이블에 등록됨).
  - `PaymentService.pay()` 위에서 `Alt + F7` → 컨트롤러가 호출.
  - `account.deduct()` 위에서 `Alt + F7` → PaymentService, TransferService 등이 호출.

이 추적으로 **3-tier가 진짜로 어떻게 연결되는지** 머리에 그림 그려짐.

---
---

# Part 4. 공식 문서 / 검색 사고

비전공자가 가장 안 하는 것 = **공식 문서 읽기**. 가장 잘하는 것 = 스택오버플로우 답변 복붙. 이걸 뒤집어야 자립합니다.

---

## 4.1 javadoc 읽는 법

### 자바 표준 API
- 공식 위치: <https://docs.oracle.com/en/java/javase/17/docs/api/index.html>
- 핵심 페이지:
  - `java.lang` — String, Object, Integer, Exception
  - `java.util` — Collection, Optional, Map
  - `java.util.stream` — Stream API
  - `java.time` — LocalDate, OffsetDateTime
  - `java.math` — BigDecimal

### 클래스 javadoc 구조
1. **클래스 설명** — 무엇인지, 언제 쓰는지.
2. **Type Parameters** — 제네릭 설명.
3. **All Implemented Interfaces** — 어떤 계약을 구현하는지.
4. **Direct Known Subclasses** — 어떤 자식이 있는지.
5. **Field Summary / Method Summary** — 빠른 훑기.
6. **Method Detail** — 메서드별 상세 (인자, 반환, 예외, 예시).

### 좋은 예: Optional
<https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/Optional.html>

여기서 알 수 있는 것:
- "A container object which may or may not contain a non-null value."
- 정적 팩토리: `of`, `ofNullable`, `empty`.
- 핵심 메서드: `isPresent`, `get`, `orElse`, `orElseGet`, `orElseThrow`, `map`, `flatMap`, `filter`, `ifPresent`.
- API note: "Optional is primarily intended for use as a method return type" — 필드/파라미터에 쓰지 말라는 공식 권고.

### Spring 공식 javadoc
- <https://docs.spring.io/spring-framework/docs/current/javadoc-api/>
- <https://docs.spring.io/spring-boot/docs/current/api/>
- <https://docs.spring.io/spring-data/jpa/docs/current/api/>

**예시 — `@Transactional`**:
<https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/Transactional.html>

여기에 적힌 핵심:
- "When this annotation is declared at the class level, it applies as a default to all methods of the declaring class and its subclasses."
- 속성: propagation, isolation, timeout, readOnly, rollbackFor, noRollbackFor.
- `propagation` 디폴트 = REQUIRED.
- `rollbackFor` 디폴트 = RuntimeException + Error.

이 한 페이지가 우리가 트랜잭션 챕터에서 알아야 할 것의 99%.

### Mini Pay 실습
다음 5개 javadoc을 직접 열어 5분씩 정독:
1. `java.util.Optional`
2. `java.math.BigDecimal` (특히 `compareTo`, `setScale`, RoundingMode)
3. `java.time.OffsetDateTime` (`now`, `plus`, `format`)
4. `org.springframework.data.jpa.repository.JpaRepository`
5. `org.springframework.transaction.annotation.Transactional`

이 5개만 정확히 알아도 Mini Pay 코드 70%가 자력 독해 가능.

---

## 4.2 Spring 공식 가이드 / 레퍼런스 / 가이드 구분

### 3개의 공식 자원

**1) Reference Documentation** — 가장 신뢰
- <https://docs.spring.io/spring-boot/docs/current/reference/htmlsingle/>
- <https://docs.spring.io/spring-framework/reference/>
- 가장 정확. 길지만 검색해서 필요한 섹션만.

**2) Getting Started Guides** — 짧은 튜토리얼
- <https://spring.io/guides>
- 30분 안에 따라하는 예제. 처음 접하는 기능 익힐 때.

**3) API Javadoc** — 메서드 단위 사실 확인
- 위 4.1 참조.

### 우선순위
"Spring에서 X 하는 법" 검색 결과:
1. 공식 reference에 있다 → **그걸 본다**.
2. spring.io/guides에 있다 → 따라한다.
3. 공식 javadoc만 있다 → API 시그니처 확인.
4. 스택오버플로우 답변 → **마지막 수단**. 그것도 답변 날짜 확인 (Spring 5와 Spring 6은 달라짐).

### 비전공자 함정
- **블로그 글 신뢰 함정**: "최신 Spring Boot 3 트랜잭션 정리!" 같은 글 — 작성자가 잘못 알고 있을 확률 30%. 공식이 무조건 우선.
- **버전 차이**: Spring 4, 5, 6 / Boot 2, 3 사이 API가 미묘하게 다름. 검색 결과의 작성 시점 확인 필수.

### 실습
- 다음 질문을 공식 문서로 답해보기:
  - "Spring Boot 3에서 SecurityFilterChain Bean 등록 방법?" → Spring Security reference의 "HttpSecurity" 섹션.
  - "JPA에서 @Query JPQL과 native query 차이?" → Spring Data JPA reference의 "Using @Query" 섹션.
  - "@Transactional propagation REQUIRES_NEW vs REQUIRED?" → Spring Framework reference의 "Declarative transaction management" 섹션.

---

## 4.3 에러 메시지 검색하는 법

### 원칙: 메시지에서 노이즈 제거
원본 에러:
```
org.hibernate.LazyInitializationException: could not initialize proxy [com.minipay.domain.Account#42] - no Session
```

**나쁜 검색어**: `could not initialize proxy [com.minipay.domain.Account#42] - no Session`
- ID(`42`)와 우리 패키지명(`com.minipay`)이 노이즈. 검색 결과 0건.

**좋은 검색어**: `LazyInitializationException could not initialize proxy no Session`
- 예외 클래스명 + 메시지 핵심 단어만.

### 4단계 검색 전략
1. **예외 클래스명**으로 검색 → 일반적 원인 학습.
2. **메시지 핵심 단어** + 라이브러리명 → 구체 사례.
3. 안 나오면 **재현 코드 + 환경** 명시: `LazyInitializationException Spring Boot 3 open-in-view false`.
4. 그래도 안 풀리면 **공식 GitHub Issues** 검색: `site:github.com/spring-projects ...`.

### 결과 평가 우선순위
1. **공식 문서** (docs.spring.io, docs.oracle.com).
2. **공식 GitHub issues** (spring-projects, hibernate).
3. **Baeldung, Reflectoring** 같은 신뢰 블로그 (다만 버전 확인).
4. **Stack Overflow** (답변 날짜, 추천 수, accept 여부 확인).

### Mini Pay 실전 예시 — Step 5 Flyway 함정
증상: `Flyway checksum mismatch`

좋은 검색어: `Flyway checksum mismatch` (단순)
→ 첫 결과에 공식 docs + 원인 (파일 변경 / 인코딩 / 줄바꿈).

나쁜 검색어: `My Flyway is broken help` (구체성 없음).

### 비전공자 함정
- **그대로 복사**: 우리 프로젝트 고유 ID나 경로를 그대로 검색 → 0건.
- **메시지 너무 길게**: 검색 엔진은 짧은 핵심어를 좋아함.
- **첫 결과 무비판 적용**: 작성자 환경이 내 환경과 다를 수 있음. 항상 "내 상황에 맞나?" 검증.

### 실습
일부러 다음 에러를 만들고 검색해서 해결:
- `application.yml`에서 `datasource.url`을 잘못된 값으로.
- entity에 `@Column(nullable = false)` 추가하고 마이그레이션 안 함.
- service에 `@Transactional` 빼고 `lazy` 필드 접근.

각각의 스택트레이스를 적절한 검색어로 5분 안에 해결책 찾기.

---

## 4.4 스택오버플로우 함정과 학습 사고

### 스택오버플로우(SO)의 가치
- **빠르다**. 비슷한 문제를 누군가 이미 해결.
- **다양한 시각**: 답변자 여러 명 → 트레이드오프 노출.

### 함정
1. **정답이 아니라 흔한 답**. 인기 답변이 항상 정답은 아님. 특히 오래된 답변.
2. **버전 차이**: Java 7 시절 답이 Java 17엔 안 맞음. Spring 3 답이 Spring 6엔 안 맞음.
3. **컨텍스트 차이**: 답변자 프로젝트 구조가 내 프로젝트와 다름.
4. **카피-페이스트 함정**: 코드 복사 후 "왜 안 되지?" → 의존성, 임포트, 어노테이션 누락.

### 좋은 SO 답변 식별법
- **공식 문서 인용** 포함.
- **버전 명시** (Spring Boot 3.x, Java 17 등).
- **트레이드오프 설명** ("이 방법은 X 경우에 안 됨").
- **댓글에 검증** ("저도 이렇게 했더니 작동" 댓글 다수).

### 학습 사고
**답이 아니라 원리를 가져온다.**

나쁜 사용:
- 코드 복사 → 컴파일 됨 → 끝.

좋은 사용:
- 답변 읽기 → 왜 그게 답인지 이해 → 공식 문서로 교차 검증 → 내 코드에 적용 → 결과 검증 → 메모리에 남김.

### Mini Pay 학습 시 권장
- 코드 작성 중 막히면:
  1. **에러 메시지** 또는 **궁금증의 키워드** 정확히 정리.
  2. **공식 reference**부터 검색.
  3. 못 찾으면 SO 검색 → 상위 3개 답변 비교.
  4. **이해한 다음 코드 변경**.
  5. ADR에 남길 만한 결정이면 ADR 추가.

### 자립의 지표
- "이거 어떻게 하지?" → 가장 먼저 떠오르는 것이 **공식 문서**.
- 에러 났을 때 가장 먼저 보는 것이 **스택 트레이스의 내 코드 줄**.
- 답을 찾으면 **왜 그게 답인지**를 동시에 이해.

이 셋이 자리 잡으면 비전공자 딱지를 떼고 자립한 개발자입니다.

---
---

# Part 5. Git / 협업 워크플로우

Git을 `add → commit → push` 3단계로만 쓰면 1인 학습은 가능하지만 팀 협업에선 즉시 문제 생깁니다. 이 챕터는 **실무에서 매일 쓰는 패턴**과 **사고를 피하는 방어선**을 다룹니다.

---

## 5.1 Git 멘탈 모델 — 4영역 정확히

### 영역과 흐름
```
[Working Directory]  → git add →  [Staging Area]  → git commit →  [Local Repository]  → git push →  [Remote Repository]
   (파일 편집)                       (커밋 후보)                        (.git/objects)                     (GitHub)
```

| 영역 | 무엇 | 이동 명령 |
|---|---|---|
| **Working Directory** | 실제 파일. 편집기로 수정하는 곳 | `git add` → Staging |
| **Staging Area** (Index) | 다음 커밋에 포함될 변경 후보 | `git commit` → Local Repo |
| **Local Repository** | 내 컴퓨터의 커밋 히스토리 | `git push` → Remote |
| **Remote Repository** | GitHub 등 원격 서버 | `git pull/fetch` → Local |

### 핵심 깨달음
- **커밋은 "스테이징된 것의 스냅샷"**. Working Directory의 모든 변경이 자동 커밋되는 게 아님.
- **`git add`가 별도 단계인 이유**: 변경을 "이번 커밋에 포함할 것"과 "다음에 따로 커밋할 것"으로 분리할 수 있게 함. **Atomic commit의 토대**.

### Mini Pay 시나리오
- `Money.java` + `Account.java` + `progress.md` 셋 다 수정한 상태.
- `Money.java`만 의도한 커밋 1, 나머지는 별도 커밋으로 가고 싶음.
```bash
git add src/main/java/com/minipay/domain/Money.java
git commit -m "..."
git add src/main/java/com/minipay/domain/Account.java
git commit -m "..."
git add docs/progress.md
git commit -m "..."
```
→ 3개의 atomic 커밋. 나중에 무엇이 깨졌을 때 어느 커밋 때문인지 정확히 식별 가능.

### 비전공자 함정
- `git add .` (전부 추가): 빠르지만 의도치 않은 파일(`.env`, IDE 설정, 빌드 산출물) 포함 위험.
- `git commit -am "..."` (변경된 파일 모두 자동 추가 + 커밋): 새 파일은 안 잡힘. 의존하면 실수.

---

## 5.2 일상 명령어 흐름

### 매일 쓰는 7개 명령
```bash
git status                  # 지금 상태 (제일 자주)
git diff                    # 변경 내용 (unstaged)
git diff --staged           # 변경 내용 (staged)
git log --oneline           # 히스토리 한 줄씩
git add <file>              # 스테이징
git commit -m "..."         # 커밋
git push                    # 원격 푸시
```

### 원격 동기화
```bash
git fetch                   # 원격 변경 가져오기만 (병합 X)
git pull                    # fetch + merge (또는 rebase)
git pull --rebase           # fetch + rebase (히스토리 깔끔)
```

### 권장 일과 흐름
```
1. 작업 시작 전:  git pull --rebase
2. 작업 중:       편집 → git status / git diff 자주
3. 단위 작업 완료: git add (선택적) → git commit
4. 작업 종료 시:  git push
```

### `git status` 출력 해석
```
On branch step-12-something
Your branch is up to date with 'origin/step-12-something'.

Changes to be committed:           ← Staging Area
        modified:   src/.../Money.java

Changes not staged for commit:     ← Working Directory (modified)
        modified:   src/.../Account.java

Untracked files:                   ← Working Directory (new)
        docs/new-doc.md
```
이 출력을 읽을 줄 알면 70%는 이해.

---

## 5.3 Atomic Commit 원칙

### 정의
**한 커밋 = 하나의 논리적 변경**. 되돌릴 때(revert) 단위가 되고, 검색할 때(log/blame) 단서가 됨.

### 좋은 커밋 예
- `feat: Money VO 도입` — Money.java 추가, Account/Transaction이 BigDecimal 대신 Money 사용.
- `fix: PESSIMISTIC_WRITE가 1차 캐시로 무력화되는 함정 픽스` — findIdByUserId projection 추가, TransferService 호출 변경.

### 나쁜 커밋 예
- `WIP` — 무엇이 변경됐는지 모름.
- `여러 가지 변경` — 검색·revert 불가.
- `Money VO 도입 + Account/Transaction 수정 + 테스트 추가 + 오타 수정 + 의존성 업데이트` — 너무 큼.

### 적당한 크기 판단
- **하나의 PR/commit이 한 문장으로 설명 가능**한가?
- **revert 했을 때 의미 있는 단위**로 되돌아가는가?
- **리뷰어가 30분 안에 이해 가능**한가?

### Mini Pay 실제 사례
Mini Pay의 최근 커밋들 (`git log --oneline`):
```
160ec28 docs: README를 Step 11 프로젝트 종결 시점으로 갱신
c2e4b51 Merge pull request #2 from qkrrlxor627/step-11-swagger
7cad815 Step 11: Swagger E2E 시나리오 12종 + SwaggerConfig Bearer 인증
d4b6844 Step 10 머지: 동시성 통합 테스트 3종 + JPA 1차 캐시 함정 픽스
```
- 각 커밋이 한 문장으로 의도 설명됨.
- Step별로 분리 → "Step 10 함정 픽스만 보고 싶다" 가능.

### 비전공자 함정
- **하루치 작업을 한 커밋에 몰아넣기**: 리뷰 불가능, revert 불가능.
- **"커밋은 나중에 정리하면 되겠지"**: 정리 안 함. 첫 커밋부터 atomic 사고.

---

## 5.4 커밋 메시지 컨벤션

### Conventional Commits (업계 표준)
```
<type>(<scope>): <subject>

<body>

<footer>
```

**type 종류**
- `feat` — 새 기능
- `fix` — 버그 픽스
- `refactor` — 동작 변경 없는 구조 개선
- `docs` — 문서만
- `test` — 테스트만
- `chore` — 빌드/도구/의존성
- `perf` — 성능 개선
- `style` — 포매팅 (코드 동작 X)

**예시**
```
feat(payment): 멱등성 처리 추가 (Redis SETNX + DB UNIQUE)

- IdempotencyStore Bean 추가 (StringRedisTemplate 기반)
- PaymentService.pay() 멱등 흐름: 조회 → SETNX → 실행 → catch
- 같은 키+다른 본문 → 409 IdempotencyKeyConflict

ADR 0010 참조
```

### Mini Pay 스타일 (한국어)
Mini Pay는 단계 기반 학습이라 `Step N: 무엇` 패턴을 씀:
```
Step 10: 동시성 통합 테스트 3종 + JPA 1차 캐시 함정 픽스
```
- 영문 type 안 붙이지만 핵심 의도가 한 줄에 명확.
- 본문이 필요하면 추가, 단순 변경은 한 줄로.

### 좋은 커밋 메시지의 3가지 원칙
1. **"왜"를 적어라.** "무엇"은 diff가 말해줌. 의도/배경/제약이 메시지에 들어가야 6개월 뒤의 나에게 도움.
2. **명령형 현재 시제**: "추가했다" 보다 "추가" 또는 "추가한다". (영어 컨벤션 영향)
3. **본문 한 줄 길이 72자 이내**: 터미널/diff 도구 정렬.

### 비전공자 함정
- `update`, `fix`, `change` 같은 일반 동사만: 검색 불가.
- 본문에 사담 ("드디어 됨!!", "이거 때문에 3시간"): 정보 가치 0.
- 영어 어색하게 쓰지 말고 차라리 한국어로 명확하게.

---

## 5.5 브랜치 전략

### 3대 전략

**1) Git Flow** (Vincent Driessen, 2010)
- main, develop, feature/*, release/*, hotfix/*
- 5가지 브랜치 종류. 복잡.
- 정기 릴리즈가 있는 패키지 소프트웨어에 적합.

**2) GitHub Flow** (GitHub, 2011)
- main + feature 브랜치만.
- feature가 main에서 분기 → PR → main 머지 → 즉시 배포.
- 웹 서비스 / SaaS에 적합. **가장 많이 쓰임**.

**3) Trunk-Based Development** (Google, FB 등 대기업)
- main 하나에 모두 직접 커밋 (또는 단명 브랜치).
- 강력한 CI + feature flag로 미완성 코드도 main에.
- 매우 빈번한 배포 환경.

### Mini Pay 현재 방식 (GitHub Flow 변형)
- `main` 안정.
- 작업 단위로 브랜치 (`step-3-entities`, `step-11-swagger`).
- PR로 머지 (`Merge pull request #2`).
- 단순하고 학습 목적엔 적합.

### 브랜치 명명 컨벤션
- `feat/<짧은-설명>` — 기능 추가
- `fix/<이슈번호>-<짧은-설명>` — 버그 픽스
- `refactor/<영역>` — 리팩토링
- `step-<번호>-<주제>` — Mini Pay 학습용

소문자, 하이픈, 한글 피하고 영어 위주.

### 자주 쓰는 브랜치 명령
```bash
git branch                          # 현재 브랜치 목록
git branch -a                       # 원격까지
git checkout -b feat/new-thing      # 새 브랜치 + 이동 (구식)
git switch -c feat/new-thing        # 새 브랜치 + 이동 (Git 2.23+)
git switch main                     # 다른 브랜치로 이동
git branch -d feat/new-thing        # 머지된 브랜치 삭제 (안전)
git branch -D feat/new-thing        # 강제 삭제 (위험)
```

---

## 5.6 Rebase vs Merge

### 그림으로

**main에 B, C가 추가된 사이 내 브랜치(feature)에 X, Y를 만들었다고 가정.**

**Merge**
```
main:    A → B → C ─────────→ M
                  \           ↗
feature:           X → Y ─────
```
- M = 머지 커밋. **둘의 히스토리가 그대로 보존**.
- 장점: 정직한 히스토리.
- 단점: 브랜치가 많으면 그래프가 복잡.

**Rebase**
```
main:    A → B → C
                 \
feature:          X' → Y'   (X, Y를 C 위에 새로 적용)
```
- feature의 X, Y를 main의 끝(C) 위에 **재적용**.
- 장점: 일직선 히스토리.
- 단점: 커밋 해시가 변함 (X → X').

### 언제 어떤 걸
- **개인 작업 브랜치는 rebase로 main을 따라가기**: `git pull --rebase` 또는 `git rebase main`. 깔끔.
- **공유된 브랜치(이미 push된 브랜치, 다른 사람이 보고 있는 브랜치)는 절대 rebase 금지**: 협업자 히스토리 파괴.
- **PR을 main에 머지할 때**: 팀 컨벤션 따름. "Squash and merge"가 일반적 (PR의 여러 커밋을 한 커밋으로).

### 황금 규칙
> **이미 push된 커밋을 rebase하지 마라.**
> (단독 작업 브랜치라 본인만 쓰는 게 확실하면 OK)

### 실전 패턴

**A) 작업 중 main이 진행되어 따라잡고 싶음**
```bash
git switch main
git pull
git switch feat/my-branch
git rebase main          # main 위로 내 커밋 이동
# conflict 해결...
git push --force-with-lease   # 내 브랜치만이라 안전
```

**B) PR 머지 (GitHub UI)**
- "Squash and merge": PR의 모든 커밋 → main에 1개 커밋. 가장 깔끔.
- "Rebase and merge": PR 커밋 그대로 main 끝에 일렬로. 커밋 단위 보존하고 싶을 때.
- "Create merge commit": 머지 커밋 생성. 브랜치 흔적 보존.

### 비전공자 함정
- **`git push --force`**: 무조건 덮어씀. 다른 사람 커밋 날아갈 수 있음. **`--force-with-lease` 사용** (내가 마지막으로 본 상태와 원격이 같을 때만 push).
- **rebase 도중 conflict**: 일반 merge conflict와 처리 다름. `git rebase --continue` / `--abort` 명령 숙지.

---

## 5.7 Conflict 해결

### 발생 시점
- `merge` 또는 `rebase` 또는 `pull` 시 같은 줄을 양쪽이 다르게 수정.

### Git이 마킹
```java
public Money add(Money other) {
<<<<<<< HEAD
    requireSameCurrency(other);
    return new Money(this.amount.add(other.amount), this.currency);
=======
    validateCurrency(other);
    BigDecimal sum = this.amount.add(other.amount);
    return new Money(sum, this.currency);
>>>>>>> feat/refactor-money
}
```
- `<<<<<<< HEAD` ~ `=======` — 현재 브랜치 (main) 버전.
- `=======` ~ `>>>>>>> feat/refactor-money` — 들어오는 브랜치 버전.

### 해결 절차
1. 충돌 파일 열기. 마커를 보고 **어떤 버전을 유지할지** 결정.
2. 마커(`<<<<<<<`, `=======`, `>>>>>>>`) 모두 제거. 의도한 최종 코드만 남김.
3. 컴파일/테스트로 검증.
4. `git add <파일>`로 해결 표시.
5. `git commit` (merge 시) 또는 `git rebase --continue` (rebase 시).

### IntelliJ가 더 쉬움
- IntelliJ가 `Resolve Conflicts` 다이얼로그 제공. 3-way merge UI (왼쪽 내 버전, 가운데 합치는 결과, 오른쪽 들어오는 버전).
- 단축키 또는 메뉴 `Git → Resolve Conflicts`.

### 비전공자 함정
- **마커 그대로 커밋**: 컴파일 안 됨. 항상 빌드/실행으로 검증.
- **그냥 한쪽 통째로 채택**: 의도가 섞인 변경을 놓침. 라인 단위로 봐야.
- **포기하고 abort**: `git merge --abort` / `git rebase --abort`로 처음 상태로. 다시 침착하게.

---

## 5.8 Reset / Revert / Amend — 되돌리기 3종

### 셋의 차이

| 명령 | 동작 | 히스토리 변경? | 안전성 |
|---|---|---|---|
| `git commit --amend` | 직전 커밋을 새 커밋으로 교체 | O (해시 변함) | 단독 브랜치만 |
| `git reset` | 현재 브랜치를 과거 커밋으로 이동 | O (커밋 사라짐) | 단독 브랜치만 |
| `git revert` | 과거 커밋을 **취소하는 새 커밋** 생성 | X (히스토리 보존) | **공유 브랜치도 안전** |

### `--amend`
```bash
# 직전 커밋 메시지 수정
git commit --amend -m "새 메시지"

# 직전 커밋에 파일 추가 (메시지 유지)
git add forgotten-file
git commit --amend --no-edit
```
주의: 이미 push된 커밋이면 force-push 필요.

### `reset` 3가지 모드
```bash
git reset --soft  HEAD~1   # 커밋만 취소, 변경은 Staging에 유지
git reset --mixed HEAD~1   # 커밋 + Staging 취소, Working Dir 유지 (기본)
git reset --hard  HEAD~1   # 모두 폐기, Working Dir도 초기화 (위험)
```
- `--hard`는 작업 통째로 날림. **`reflog`로 복구 가능**하지만 30일 한정.

### `revert`
```bash
git revert <commit-hash>
# → 그 커밋의 변경을 되돌리는 새 커밋 생성
```
- 히스토리 보존. 안전.
- main 등 공유 브랜치에서 잘못된 커밋 취소할 때 **유일하게 안전한 방법**.

### 황금 규칙 다시
> 공유 브랜치(push된 main, 다른 사람도 보는 브랜치)는 **revert만 사용**.
> 단독 브랜치(나만 쓰는 feature)는 amend/reset 자유롭게.

### `reflog` — 최후의 안전망
```bash
git reflog
# HEAD 이동 기록. reset --hard로 날린 것도 여기 있음
git reset --hard HEAD@{2}   # 2번 전 상태로 복구
```
정말 망했을 때 이걸로 살려냄. 단 30일 기한.

### 비전공자 함정
- **`git reset --hard`를 가볍게 사용**: 작업 한 시간 날아가도 모름.
- **공유 브랜치에 amend/reset 후 force-push**: 다른 사람 커밋 파괴.
- **revert 후 같은 변경 다시 시도**: revert가 다시 revert 되도록. revert를 또 revert해서 푸는 게 깔끔.

---

## 5.9 Stash — 임시 보관

### 시나리오
- 작업 중인데 급한 hotfix 요청. 지금 변경은 커밋하긴 어정쩡함.

### 사용법
```bash
git stash                          # 현재 변경 임시 보관
git stash list                     # 보관 목록
git stash pop                      # 가장 최근 stash 적용 + 제거
git stash apply                    # 적용만 (제거 안 함)
git stash drop                     # 제거
git stash push -m "메시지"         # 메시지 붙여 보관
git stash push -- <file>           # 특정 파일만
```

### 권장 사용 패턴
- **30분 이상 보관할 stash는 만들지 말 것** — 잊어버리고 영영 안 적용함. 차라리 임시 WIP 커밋이 안전.
- 새 브랜치에 stash 적용:
```bash
git stash
git switch -c temp/hotfix
git stash pop
```

### 비전공자 함정
- stash는 **브랜치 무관**. 어디서 stash 했든 어디서든 pop 가능 → 의도치 않은 곳에 적용 가능.
- `git stash drop` 없이 stash가 누적되면 디스크 낭비 + 혼란.

---

## 5.10 진단·탐색 명령

### `git log` 활용
```bash
git log --oneline                       # 한 줄씩
git log --oneline --graph --all         # 그래프 (모든 브랜치)
git log -p <file>                       # 파일의 변경 히스토리
git log --author="pkt"                  # 작성자 필터
git log --since="2026-05-01"            # 날짜 필터
git log --grep="JPA 1차 캐시"           # 메시지 검색
git log -S "findIdByUserId"             # 그 단어가 추가/삭제된 커밋
```

### `git blame` — 줄별 마지막 변경자
```bash
git blame src/main/java/com/minipay/service/TransferService.java
```
각 줄 옆에 마지막 수정한 커밋 + 작성자 + 날짜. **"왜 이 코드가 이렇지?"의 출발점**.
IntelliJ는 우클릭 → Annotate가 더 편함.

### `git diff` 모드들
```bash
git diff                       # Working Dir vs Staging
git diff --staged              # Staging vs HEAD
git diff HEAD~3                # 3커밋 전 vs 현재
git diff main..feat/foo        # 두 브랜치 차이
git diff main...feat/foo       # feat/foo가 main에서 분기 후 변경분만
```

### `git show <commit>` — 커밋 1개 상세
```bash
git show 7cad815                # Step 11 커밋이 무엇을 바꿨는지
```

### Mini Pay 학습 활용 예
- **"Step 10 함정 픽스가 정확히 무엇이었지?"**
```bash
git log --grep="1차 캐시"
git show <해당-커밋>
```
- **"AccountRepository의 findIdByUserId는 언제 어떻게 추가됐지?"**
```bash
git log -S "findIdByUserId" --oneline
```

---
---

# Part 6. 코드 리뷰 방법론

코드 리뷰는 "버그 잡기"가 1차지만 진짜 가치는 **팀의 코드 일관성 + 학습 + 컨벤션 정착**입니다. 비전공자가 가장 빨리 성장하는 통로이기도 함.

---

## 6.1 PR 저자로서 — PR 위생 (Hygiene)

### 작은 PR이 모든 것의 시작
연구 결과(Google, Microsoft 다수): **PR 규모가 200줄을 넘어가면 리뷰 품질이 급락**. 400줄 넘으면 사실상 "LGTM" (Looks Good To Me, 대충 승인).

**목표**: 한 PR = 한 논리적 변경 = 200줄 이내.

### Mini Pay 실제 사례
- Step 10 PR: 동시성 테스트 3종 + JPA 1차 캐시 함정 픽스. → 사실 두 PR로 쪼개는 게 정석 ("테스트 추가" + "함정 픽스").
- Step 11 PR: Swagger E2E 시나리오 12종 + Bearer 인증. → 비교적 응집된 단위.

### 좋은 PR 제목
- `Step 10: 동시성 통합 테스트 3종 + JPA 1차 캐시 함정 픽스`
- `feat(payment): 멱등성 처리 — Redis SETNX + DB UNIQUE 이중 방어`
- `fix: PESSIMISTIC_WRITE가 1차 캐시로 무력화되는 함정`

### 좋은 PR 본문 템플릿
```markdown
## 변경 요약
- (1~3줄로 의도/결과)

## 왜
- (배경, ADR 참조, 기존 문제)

## 어떻게
- (핵심 구현 결정)

## 검증
- [ ] 빌드 통과
- [ ] 단위 테스트 추가/통과
- [ ] curl 시나리오 N종 통과
- [ ] (수동 검증) ...

## 참고
- ADR 0010, 0011
- 관련 이슈 #N
```

### 셀프 리뷰 — 가장 효과 큰 습관
PR 올리기 **전에 본인이 먼저 diff를 처음 보는 사람처럼 읽는 것**.
- 오타, 디버그 코드(`System.out.println`), 주석 처리된 코드 제거.
- 변수명/메서드명이 의도를 드러내는지.
- 너무 큰 변경은 쪼갤 수 있는지.

GitHub UI에서 PR의 "Files changed" 탭을 본인이 한 번 훑기. **이거 하나로 리뷰 코멘트의 30%가 줄어듦**.

### 비전공자 함정
- **"일단 올리고 보자"**: 동료 시간 낭비. 본인이 먼저 검증.
- **PR 제목에 정보 없음** (`update`, `fix bug`): 검색 안 됨.
- **테스트 플랜 누락**: 리뷰어가 "어떻게 검증했나" 물어보면 작업 두 번.
- **하나의 PR에 무관한 변경 섞기** ("이왕 만진 김에 이것도..."): 리뷰 어려움.

---

## 6.2 리뷰어로서 — 무엇을 보는가

### 우선순위 5단계
**1) 정확성 (Correctness) — 가장 중요**
- 이 코드가 의도한 동작을 하는가?
- 엣지 케이스 처리: null, 빈 컬렉션, 동시 호출, 예외 경로.
- 테스트로 검증 가능한가?

**2) 보안 (Security)**
- 외부 입력 검증? (SQL Injection, XSS, path traversal)
- 비밀 정보 노출? (로그에 토큰, 평문 비번)
- 인증/인가 우회 가능?

**3) 동시성 / 성능 (Concurrency / Performance)**
- 멀티스레드 안전한가? (싱글톤 Bean의 가변 필드, race condition)
- N+1 쿼리?
- 락 점유 시간이 긴가?
- 트랜잭션 안에서 외부 I/O?

**4) 가독성 / 명명 (Readability / Naming)**
- 변수/메서드 이름이 의도를 드러내는가?
- 메서드가 너무 길지 않은가? (50줄 넘으면 의심)
- 주석이 "왜"를 설명하는가? (WHAT 주석은 불필요)

**5) 컨벤션 / 일관성 (Conventions)**
- 프로젝트 컨벤션(CLAUDE.md) 준수?
- ADR 위반 없음?
- 기존 패턴과 일관?

### Mini Pay 리뷰 시 첫 5분 체크
1. CLAUDE.md "코드 리뷰 체크리스트" 섹션 펼치기.
2. 변경 종류별 해당 항목 빠르게 매칭:
   - 도메인 모델 변경 → `[ADR-0001~0003]` 항목
   - JPA/매핑 변경 → JPA 섹션
   - 트랜잭션/동시성 → Step 7+ 섹션
   - 멱등성 → Step 8+ 섹션
3. 위반 발견 시 ADR 번호와 함께 코멘트.

### 리뷰 모드 — 안 보는 것도 결정
- **typo / formatting**: IDE/CI가 잡으면 사람이 안 봐도 됨.
- **import 순서**: 컨벤션 도구가 잡아야지 리뷰어가 잡지 말 것.
- 사람은 사람만 할 수 있는 걸 봐야 (의도, 설계, 트레이드오프).

---

## 6.3 리뷰 코멘트 에티켓

### 기본 원칙: **사람이 아닌 코드를 비판**
- 나쁨: "왜 이렇게 짰어요?"
- 좋음: "이 부분이 동시성 환경에서 race condition을 만들 수 있을 것 같아요. 어떻게 보시나요?"

### 코멘트 등급 표시 (관용)
- **[blocking]** 또는 **[must]** — 머지 전 반드시 해결.
- **[suggestion]** — 권장이지만 작성자 선택.
- **[nit]** — nitpick. 작은 지적, 통과해도 됨.
- **[question]** — 진짜 모르거나 확인 필요.
- **[praise]** — 잘한 부분 칭찬.

### 명령형 X, 질문형 / 제안형 ○
- 나쁨: "이걸 X로 바꿔라"
- 좋음: "X로 하면 Y 이유로 더 안전할 것 같은데 어떠세요?"

### 이유 설명
- 나쁨: "여기 락 빠졌어요"
- 좋음: "여기 `@Lock(PESSIMISTIC_WRITE)` 빠진 것 같은데, Step 10 함정처럼 1차 캐시 hit으로 무력화될 수 있어요 (ADR 0009)."

### GitHub 코멘트 활용
- **Suggestion 블록**으로 코드 제안:
```
\`\`\`suggestion
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("...")
Optional<Account> findByIdForUpdate(Long id);
\`\`\`
```
작성자가 한 클릭으로 적용 가능.

### 칭찬도 의식적으로
- "이 부분 동시성 테스트 케이스 잘 짰어요 — 1차 캐시 함정까지 잡힐 듯."
- 모든 리뷰가 지적만이면 협업 분위기 망가짐.

### 비전공자 함정 (리뷰 받을 때)
- **방어적 반응 금지**: "그건 의도된 거예요"부터 말하지 말 것. 일단 들어보고 결정.
- **모든 코멘트에 동의할 필요 없음**: 이유 있으면 반박. 토론 후 결정.
- **수정 후 응답 남기기**: "반영했습니다", "이렇게 처리했어요" — 리뷰어가 다시 확인하기 쉬움.

### 비전공자 함정 (리뷰 할 때)
- **모든 지적을 [blocking]으로**: 작성자가 압도됨. 핵심만 blocking.
- **개인 취향 강요**: 컨벤션에 없는 자기 스타일 요구 X.
- **무비판 LGTM**: 사실상 리뷰 안 한 거. 책임 회피.

---

## 6.4 Mini Pay 리뷰 체크리스트 활용

CLAUDE.md의 `## 코드 리뷰 체크리스트` 섹션이 이미 30개 항목으로 잘 정리되어 있음. 활용 방법:

### 리뷰 시 사용
PR 종류 식별 → 해당 카테고리만 펼침:
- **도메인 모델 변경** → 도메인 모델/금액 섹션 (ADR 0001~0006)
- **JPA / Repository** → JPA / 매핑 섹션
- **SQL 마이그레이션** → 마이그레이션 섹션 (ADR 0004)
- **트랜잭션 / 동시성 코드** → 동시성 섹션 (ADR 0009, 0011)
- **결제 / 이체 API** → 멱등성 섹션 (ADR 0010)
- **보안 관련** → 보안 섹션
- **DTO / API 응답** → DTO/API 섹션
- **예외 처리** → 에러 섹션
- **테스트 코드** → 테스트 섹션

### 가장 자주 거절되는 항목 (Mini Pay 기준)
1. `BigDecimal` 직접 사용 — Money VO 우회 (ADR 0001).
2. `@Enumerated` 빠짐 — 디폴트 ORDINAL 위험 (ADR 0002).
3. setter / Lombok `@Builder` — 정적 팩토리만 (ADR 0003).
4. `@Transactional` 안에서 외부 I/O.
5. 잔액 변경에 `@Lock(PESSIMISTIC_WRITE)` 누락.
6. WHAT 주석 (코드를 한국어로 번역).

### 리뷰 코멘트 템플릿 (Mini Pay)
```
[blocking] ADR-0001 위반.

`BigDecimal.compareTo`를 직접 사용했는데, 우리 컨벤션상 `Money.isLessThan()` 같은
Money 메서드를 사용해야 합니다. 통화 검증(`requireSameCurrency`)이 우회되면
다른 통화 비교가 발견 안 될 수 있어요.

ADR: docs/adr/0001-money-value-object.md
```

---

## 6.5 코드 리뷰 안티패턴 (피해야 할 것)

### "Rubber Stamp" 리뷰
- 1분 만에 LGTM. 사실 안 본 거.
- 책임 회피 + 학습 기회 박탈.

### "Bikeshedding"
- 본질적인 설계 문제 놔두고 변수명/공백/포매팅에만 매달림.
- 영국 옛 발전소 회의에서 "원자로 설계는 어렵지만 옆 자전거 거치소(bike shed) 색깔은 누구나 안다"에서 유래.

### "Power Trip"
- 리뷰어가 자기 취향을 강요. 컨벤션에 없는 변경 요구.
- 작성자가 위축 → 협업 망가짐.

### "Bystander"
- 다 같이 리뷰 책임. → 아무도 안 함.
- **명시적으로 1명의 reviewer 지정**.

### "Late Review"
- PR 올린 지 3일 후 첫 코멘트.
- 작성자 컨텍스트 사라짐. 리뷰 효율 폭락.
- 룰: PR 올라온 그 날 안에 첫 응답 (못 하면 못 한다고 알리기).

### "Ego Hostage"
- 작성자가 자기 코드를 너무 동일시. 모든 지적을 인신공격으로 받아들임.
- 코드는 코드. 비판은 코드로.

### Mini Pay에서 가능한 안티패턴
- 단계 학습이라 PR이 크기 쉬움 → Step을 더 잘게 쪼개거나 PR 안에서 커밋이라도 atomic.
- 혼자 작업이라 셀프 리뷰가 사실상 유일 → 24시간 묵혀두기 (Pull request에서 자기 자신을 리뷰).

---

## 6.6 ADR과 코드 리뷰의 관계

### ADR (Architecture Decision Record)
- 중요한 결정의 **배경 / 대안 / 선택 이유**를 문서화한 것.
- Mini Pay에는 11개 ADR (`docs/adr/0001~0011`).

### 코드 리뷰의 ADR 활용
1. **트레이서**: 코드가 어떤 ADR을 따르는지 확인.
2. **거절 근거**: ADR 위반 발견 시 ADR 번호로 거절.
3. **재논의 신호**: "ADR과 맞지 않지만 이게 더 합리적"이라는 PR이 오면 **새 ADR 작성 후 머지** (기존 ADR을 Superseded 상태로).

### 좋은 리뷰 흐름
```
1. PR 제목 / 본문에서 어떤 ADR과 관련된 변경인지 파악.
2. 해당 ADR 다시 읽음.
3. 코드가 ADR의 핵심 원칙을 지키는지 검증.
4. 어긋나면 [blocking] + ADR 인용.
5. ADR 자체를 바꿔야 한다면 별도 PR로 ADR 갱신 후 코드 머지.
```

### Mini Pay 실제 활용
CLAUDE.md의 체크리스트 항목들이 ADR 번호를 태그로 달고 있는 게 정확히 이 사상:
> `[ADR-0001]` `BigDecimal` 직접 비교(`==`, `equals`)/산술 발견 시 거절 — `Money` 메서드(`isLessThan`, `add`, `subtract`)만 허용.

ADR 번호 → 결정 근거 1초 점프. 리뷰 시 인용 효율 극대.

### 비전공자 함정
- **ADR을 "오래된 문서"로 취급**: 결정이 바뀌면 ADR도 업데이트 또는 새 ADR로. 무시하지 말 것.
- **ADR 없이 큰 결정 하기**: 6개월 후 본인도 왜 그렇게 했는지 모름.

---
---

# Part 7. 자료구조 / Big-O 입문

성능 얘기의 공통 어휘. "왜 HashMap이 빠른가" "왜 인덱스가 빠른가"의 답이 여기 있습니다. CS 전공자가 학부 1~2학년에 깔아두는 직관을 압축본으로.

---

## 7.1 Big-O 표기법 — 시간 복잡도 직관

### 개념
**입력 크기 n이 커질 때 연산 횟수가 어떻게 늘어나는가**를 나타내는 표기.
"이 코드가 몇 초 걸린다"가 아니라 "데이터가 10배 커지면 시간이 몇 배 되는가".

### 주요 복잡도와 직관

| 표기 | 이름 | 의미 | 예 |
|---|---|---|---|
| O(1) | 상수 | n과 무관 | 배열 인덱스 접근, HashMap get |
| O(log n) | 로그 | n이 2배 되면 +1 | 이진 탐색, B-Tree 인덱스 |
| O(n) | 선형 | n에 비례 | List 순회, 전체 스캔 |
| O(n log n) | 선형 로그 | 효율적 정렬 | quicksort, mergesort |
| O(n²) | 제곱 | 중첩 루프 | 단순 정렬, 모든 쌍 비교 |
| O(2ⁿ) | 지수 | 끔찍 | 재귀 분기 (피보나치 단순) |

### 숫자로 느끼기
n = 1,000,000일 때 연산 횟수:
- O(1) → 1
- O(log n) → 20
- O(n) → 1,000,000
- O(n log n) → 20,000,000
- O(n²) → 1,000,000,000,000 (1조)
- O(2ⁿ) → 우주의 원자 수보다 많음

### 의미
- "DB가 100만 행"이라고 했을 때, **O(log n)으로 검색(인덱스 hit)이면 20회 비교**, **O(n) 풀스캔이면 100만 회 비교**. 5만 배 차이.
- 우리 거래내역 조회가 인덱스 hit으로 빠른 이유.

### 비전공자 함정
- "내 데이터는 작으니 O(n²)도 괜찮아" → 데이터가 커지는 순간 즉사. 처음부터 O(n log n) 이하로.
- 상수 무시: O(n)과 O(100n) 모두 O(n). 다만 실측 성능은 다를 수 있음.
- 최악 vs 평균: HashMap get은 평균 O(1)이지만 최악 O(n) (해시 충돌 폭주). 보통 평균으로 얘기.

### 실습
다음 코드의 복잡도를 분류:
```java
// A
list.get(5);                                            // O(?)

// B
for (User u : users) { if (u.getId() == id) return u; } // O(?)

// C
map.get(id);                                            // O(?)

// D
for (User a : users) for (User b : users) ...           // O(?)
```
답: A=O(1), B=O(n), C=O(1), D=O(n²).

---

## 7.2 Array vs LinkedList — 같은 List, 다른 성능

### 메모리 배치
**Array (ArrayList)**:
```
연속 메모리: [A][B][C][D][E]
인덱스 i 접근 → 시작 주소 + i × 원소크기 = O(1)
```

**LinkedList**:
```
흩어진 메모리: [A|→] ... [B|→] ... [C|→] ... null
인덱스 i 접근 → 처음부터 i번 따라가야 = O(n)
```

### 연산별 복잡도

| 연산 | ArrayList | LinkedList |
|---|---|---|
| 인덱스 접근 `get(i)` | O(1) | O(n) |
| 끝에 추가 `add(e)` | O(1) amortized | O(1) |
| 중간 삽입 `add(i, e)` | O(n) (뒤 이동) | O(n) (i까지 가야) |
| 끝 삭제 | O(1) | O(1) |
| 중간 삭제 | O(n) | O(n) |
| 포함 검사 `contains(e)` | O(n) | O(n) |

### 결론
**ArrayList가 거의 항상 더 빠름** (캐시 친화성 포함). LinkedList는 양 끝 삽입/삭제가 빈번하고 인덱스 접근이 적을 때만.

실무에서: **거의 100% ArrayList**.

---

## 7.3 HashMap — O(1)의 비밀

### 어떻게 O(1)인가
1. **해시 함수**: key → 정수(hash code).
2. **버킷 배열**: 큰 배열을 두고, `hash % 배열크기`로 위치 결정.
3. **삽입/조회**: 해당 위치로 바로 점프 → O(1).

```
key="alice" → hash=12345678 → 12345678 % 16 = 14 → 14번 버킷
```

### 해시 충돌
다른 key가 같은 버킷에 들어가는 일. 처리법:
- **체이닝**: 같은 버킷에 LinkedList로 매달기. 자바의 HashMap이 이 방식 + Java 8부터 충돌 많으면 Tree로 자동 전환.
- **개방 주소법**: 다음 빈 버킷 찾기.

### 좋은 해시 함수의 조건
- 고른 분포: 입력이 비슷해도 hash는 흩어져야.
- 빠른 계산: 매 호출마다 부담 적어야.
- 같은 key → 같은 hash (결정적).

### 자바에서
- `Object.hashCode()`를 오버라이드.
- **`equals`를 오버라이드하면 `hashCode`도 반드시 같이** — 안 하면 HashMap이 망가짐.
- Lombok `@EqualsAndHashCode`가 둘을 자동 생성. `Money` 클래스가 이 패턴.

### Mini Pay 어디
- Redis SETNX = 분산 HashMap. 키 충돌 없는 unique key로 멱등성 보장.
- 자바 Spring 내부에서 Bean 이름 → Bean 객체 매핑이 HashMap.
- HTTP 헤더 파싱이 Map.

### 비전공자 함정
- **mutable key 함정**: HashMap의 key를 넣은 뒤 그 객체를 수정하면 → hash 값 변함 → 영영 못 찾음. **String, Long, 불변 객체만 key로 쓸 것**.
- **`equals` 깨진 객체**: equals 오버라이드 안 한 클래스로 contains 검사하면 항상 false (참조 비교).

---

## 7.4 Tree — DB 인덱스의 기반

### 이진 탐색 트리 (BST)
각 노드: 왼쪽 자식 < 자기 < 오른쪽 자식.
```
        10
       /  \
      5    15
     / \   / \
    3   7 12  20
```
- 검색: 루트부터 비교 → 작으면 왼쪽, 크면 오른쪽. O(log n) (균형 잡혔을 때).

### 균형 깨짐 문제
오름차순으로 1,2,3,...,n을 삽입하면:
```
1 → 2 → 3 → 4 → ... (한 쪽으로 늘어선 LinkedList)
```
이러면 O(n)으로 퇴화.

### 자가 균형 트리
삽입 후 자동으로 균형 잡음.
- **AVL Tree**: 엄격한 균형.
- **Red-Black Tree**: 느슨하지만 빠른 균형. 자바 TreeMap/TreeSet 내부.

### B-Tree — DB 인덱스
디스크 친화적 트리. 한 노드에 여러 key + 여러 자식.
```
        [10 | 20]
       /    |    \
   [3,5,7] [12,15] [25,30]
```
- 한 노드가 디스크 페이지 1개 (4KB~16KB).
- 트리 높이 낮음 (100만 행도 3~4단계).
- **PostgreSQL/MySQL의 기본 인덱스가 B-Tree (정확히는 B+Tree)**.

### Mini Pay 인덱스
V3 마이그레이션의 부분 인덱스:
```sql
CREATE INDEX idx_transactions_counterparty_id_created_at
    ON transactions (counterparty_account_id, created_at DESC)
    WHERE counterparty_account_id IS NOT NULL;
```
- `(counterparty_account_id, created_at)` 복합 인덱스 = B-Tree.
- `WHERE` 절 = 부분 인덱스 (TRANSFER 거래만 포함, 디스크 절약).
- 거래내역 조회 시 수신자 시점 정렬도 인덱스로 O(log n) 정렬됨.

### 인덱스의 트레이드오프
- **읽기 빠름** (O(log n)).
- **쓰기 느림** (INSERT/UPDATE 시 인덱스도 갱신).
- **디스크 차지** (테이블 + 인덱스 따로).
- → 자주 검색하는 컬럼에만 만들기.

---

## 7.5 Stack / Queue — 호출의 본질

### Stack (LIFO)
Last-In, First-Out. 마지막 들어온 게 먼저 나감.
- **메서드 호출이 Stack**: 한 함수가 다른 함수 호출 → 새 프레임 push, return 시 pop.
- 자바 `Deque<T>` 또는 `ArrayDeque` (deprecated `java.util.Stack` 대신).

### Queue (FIFO)
First-In, First-Out. 먼저 들어온 게 먼저 나감.
- **메시지 큐**, **스레드 풀의 작업 대기열**.
- 자바 `Queue<T>`, `ArrayDeque`, `LinkedList`.

### Mini Pay 흔적
- 톰캣 요청 처리: 들어온 순서대로 스레드 풀로 분배 = Queue.
- 스택 트레이스: 메서드 호출이 쌓인 stack의 덤프.

### Priority Queue
우선순위 큐. 가장 작은(또는 큰) 원소가 먼저 나감.
- 자바 `PriorityQueue<T>`.
- 내부적으로 **힙(Heap)** 자료구조 (Binary Heap). 삽입/추출 O(log n).
- "JVM Heap"과 다른 의미 — 헷갈리지 말 것.

---

## 7.6 정렬 기초

### 자주 보는 정렬 알고리즘

| 이름 | 평균 | 최악 | 안정성 | 특징 |
|---|---|---|---|---|
| Bubble Sort | O(n²) | O(n²) | 안정 | 교육용. 실무 X |
| Insertion Sort | O(n²) | O(n²) | 안정 | 작은 데이터엔 빠름 |
| Quick Sort | O(n log n) | O(n²) | 불안정 | 평균적으로 가장 빠름 |
| Merge Sort | O(n log n) | O(n log n) | 안정 | 안정 + 보장 |
| Heap Sort | O(n log n) | O(n log n) | 불안정 | in-place |

### 자바의 정렬
- `Collections.sort()`, `List.sort()`, `Arrays.sort(Object[])` → **Tim Sort** (Merge + Insertion 혼합).
- `Arrays.sort(int[])` → **Dual-Pivot Quick Sort**.

실무에선 직접 정렬 알고리즘 안 짬. **표준 라이브러리 호출**.

### 비전공자가 알아야 할 것
- O(n log n)이 비교 기반 정렬의 이론적 하한.
- 안정 정렬 = 같은 key 순서 유지. DB ORDER BY 여러 컬럼할 때 중요.
- 거의 모든 실무: `list.sort(Comparator.comparing(...))` 한 줄.

### Mini Pay에서
```java
.findByAccountIdOrCounterpartyAccountIdOrderByCreatedAtDesc(...)
```
- `OrderByCreatedAtDesc` → DB가 인덱스를 활용해 정렬 (B-Tree가 이미 정렬된 상태).
- 자바 정렬 안 함. **정렬은 DB에 맡기는 게 정석**.

---
---

# Part 8. DB 깊이 — 정규화·인덱스·MVCC·N+1

DB는 절반의 백엔드입니다. Spring 잘 알아도 DB 모르면 결국 막힘.

---

## 8.1 정규화 — 왜 테이블이 쪼개졌나

### 1NF (제1정규형)
- 각 컬럼은 **원자값**만. 한 셀에 콤마 분리된 리스트 금지.
- 예: `tags = "java, spring"` ❌. 별도 테이블 또는 PG의 배열 타입.

### 2NF (제2정규형)
- 1NF + **부분 함수 종속 제거**.
- 복합 PK의 일부에만 종속된 컬럼은 분리.

### 3NF (제3정규형) — **실무 목표**
- 2NF + **이행 종속 제거**.
- 비-key 컬럼이 다른 비-key 컬럼에 의존하면 분리.
- 예: `users` 테이블에 `email`, `email_domain`. `email_domain`은 `email`에 종속 → 컬럼 빼거나 별도 테이블.

### Mini Pay의 3-테이블 구조
```
users        accounts            transactions
-----        --------            ------------
id           id                  id
email        user_id (FK)        account_id (FK)
...          balance_amount      counterparty_account_id (이체용)
             balance_currency    amount_amount
             created_at          amount_currency
                                 type, status, ...
```
**왜 분리됐나**:
- `users.email`은 사람 정보, `accounts.balance`는 돈 정보, `transactions.amount`는 거래 정보 → **서로 다른 변화 주기, 서로 다른 책임**.
- 한 테이블에 다 박으면 사용자가 거래 1000건 하면 사용자 정보가 1000번 중복 저장됨 (저장 + 일관성 모두 손해).

### 비정규화 (Denormalization)
역으로 의도적으로 중복을 두기:
- 성능 위해 (조인 회피).
- 예: `transactions.balance_after_amount` — 잔액을 매번 다시 계산 안 하려고 거래 시점 잔액 스냅샷.
- 우리 ADR 0006 트레이드오프의 한 측면.

### 비전공자 함정
- 과도한 정규화: 모든 걸 분리하면 조인 폭주 → 성능 저하.
- 무정규화: 중복으로 인한 일관성 깨짐 (같은 정보를 두 곳에 저장하다 한쪽만 업데이트되는 사고).
- 실무 균형: **3NF까지 정규화 + 필요시 의식적 비정규화**.

---

## 8.2 JOIN — 테이블 합치기

### 종류
**INNER JOIN** — 양쪽에 모두 있는 행만.
```sql
SELECT u.email, a.balance_amount
FROM users u INNER JOIN accounts a ON u.id = a.user_id;
```

**LEFT (OUTER) JOIN** — 왼쪽 모두 + 오른쪽 일치하는 것.
```sql
SELECT u.email, a.balance_amount
FROM users u LEFT JOIN accounts a ON u.id = a.user_id;
-- 계좌 없는 사용자도 포함, a 컬럼은 NULL
```

**RIGHT JOIN** — 오른쪽 모두. (LEFT의 좌우 바꾼 것, 실무에선 거의 안 씀)

**FULL OUTER JOIN** — 양쪽 모두.

**CROSS JOIN** — 카르테시안 곱. 조건 X. 거의 안 씀.

### Mini Pay는 왜 JOIN이 적나
ADR 0005: **Transaction은 Account를 ID로 참조**. JPA `@ManyToOne` 객체 참조 안 함.
- 이유: open-in-view false + N+1 회피 + 도메인 경계.
- 단점: 표시할 때 사용자 정보가 필요하면 별도 조회 필요.
- 균형: 결제/이체 도메인은 ID 참조로 충분, 화면이 복잡한 도메인이면 다를 수 있음.

### JOIN 성능
- 양쪽 컬럼에 인덱스 있어야 빠름.
- FK 컬럼은 자동 인덱스 X (PostgreSQL/MySQL 둘 다). **명시적으로 INDEX 만들어야**.
- 큰 테이블끼리 JOIN은 메모리/디스크 모두 비쌈.

---

## 8.3 N+1 문제 — JPA의 가장 큰 함정

### 시나리오
사용자 100명을 가져오고, 각자의 계좌 잔액을 표시.
```java
List<User> users = userRepository.findAll();         // 쿼리 1번
for (User u : users) {
    Account a = u.getAccount();                       // 쿼리 N번 (lazy fetch)
    System.out.println(a.getBalance());
}
```
- 1번의 user 조회 + N번의 account 조회 = **N+1 쿼리**.
- 사용자 100명이면 101번. 1000명이면 1001번. 데이터 늘수록 폭발.

### 발견 방법
- 부팅 시 `spring.jpa.show-sql: true`로 쿼리 로깅.
- p6spy 등 SQL 로깅 라이브러리.
- 모니터링에 쿼리 카운트.

### 해결법
1. **Fetch Join**:
```java
@Query("SELECT u FROM User u JOIN FETCH u.account")
List<User> findAllWithAccount();
```
한 쿼리로 JOIN해서 가져옴.

2. **EntityGraph**:
```java
@EntityGraph(attributePaths = {"account"})
List<User> findAll();
```

3. **ID 참조로 회피**:
- Mini Pay 방식. 객체 참조 자체를 안 둠 → N+1 발생 자체가 불가.
- 필요할 때 명시적으로 별도 쿼리.

### Mini Pay에서 왜 안 나오나
`Transaction`이 `Account`를 객체로 참조 안 함 (`Long accountId`만 보유).
- JPA가 lazy fetch 할 거리가 없음.
- N+1 원천 차단.
- 대신 거래 표시할 때 계좌 정보 필요하면 명시적으로 조회.

### 비전공자 함정
- "lazy니까 안전"이라는 착각: lazy는 N+1 함정의 원인 그 자체.
- `toString()` / 로그에 엔티티 통째로 출력 → lazy 컬렉션 강제 로드 → N+1.
- 디버거가 변수 보여주려고 lazy 평가 → 의도치 않은 쿼리.

---

## 8.4 인덱스 깊이

### B-Tree 인덱스 (PostgreSQL/MySQL 디폴트)
이미 7.4에서 다룸. 핵심 재정리:
- O(log n) 검색.
- 정렬된 상태 유지 → ORDER BY 무료.
- 범위 검색 가능 (`BETWEEN`, `<`, `>`).

### 복합 인덱스
```sql
CREATE INDEX idx_tx_account_created ON transactions (account_id, created_at);
```
- `WHERE account_id = ? AND created_at > ?` → 인덱스 hit.
- `WHERE account_id = ?` → 인덱스 hit (왼쪽 prefix).
- `WHERE created_at > ?` → **인덱스 미사용** (왼쪽 prefix 없음).
- 규칙: **왼쪽부터 사용 가능**. 컬럼 순서가 성능 결정.

### 부분 인덱스 (PostgreSQL)
조건 만족하는 행만 인덱스에 포함.
```sql
CREATE INDEX idx_transactions_counterparty_id_created_at
    ON transactions (counterparty_account_id, created_at DESC)
    WHERE counterparty_account_id IS NOT NULL;
```
- TRANSFER 거래만 인덱스 (CHARGE/PAYMENT는 counterparty = NULL).
- 인덱스 크기 절감.
- Mini Pay V3 마이그레이션의 실전 예.

### 다른 인덱스 유형 (얕게)
- **Hash Index** — equality만 빠름. PG에선 거의 안 씀.
- **GiST / GIN** — 텍스트 검색, 지리정보.
- **BRIN** — 매우 큰 시계열 데이터.

### 인덱스가 안 먹는 경우
- `WHERE LOWER(email) = ?` → 함수 결과에 인덱스 없음. → 함수 인덱스 필요.
- `WHERE email LIKE '%@gmail.com'` → 앞이 와일드카드 → 인덱스 무용.
- `WHERE column != ?` → 부정 조건 → 보통 인덱스 무용.
- 데이터가 작을 때 → 옵티마이저가 풀스캔 선택.

### EXPLAIN 활용
```sql
EXPLAIN ANALYZE SELECT ... FROM transactions WHERE account_id = 5;
```
- 옵티마이저 실행 계획.
- `Seq Scan` (풀스캔) vs `Index Scan` (인덱스 사용) 확인.
- 인덱스 효과 검증의 표준 도구.

---

## 8.5 MVCC — PostgreSQL의 동시성 처리

### 개념
**Multi-Version Concurrency Control**. 같은 행을 동시에 읽고 쓰는 환경에서 락 없이 일관성 유지.

### 어떻게
- UPDATE 시 **새 버전을 추가**. 옛 버전은 그대로 두고 표시만 변경.
- 각 트랜잭션은 시작 시점의 스냅샷을 봄.
- 다른 트랜잭션이 동시에 수정해도 내 스냅샷은 안전.

### 그림
```
시각  트랜잭션 A           트랜잭션 B            row
T1   BEGIN                                     v1 (balance=1000)
T2   SELECT balance → 1000
T3                       BEGIN
T4                       UPDATE balance=900
                         (새 버전 v2 생성)
T5                       COMMIT                v1 (보임 to A), v2 (보임 to others)
T6   SELECT balance → ?
```
T6에서 A는 여전히 1000을 봄 (REPEATABLE READ 격리 수준) 또는 900을 봄 (READ COMMITTED).

### 격리 수준과의 관계
- **READ COMMITTED** (PG 기본): 각 SELECT마다 새 스냅샷 → 같은 트랜잭션에서 두 번 읽으면 값 다를 수 있음 (non-repeatable read).
- **REPEATABLE READ**: 트랜잭션 시작 시점 스냅샷 고정 → 두 번 읽어도 같은 값.
- **SERIALIZABLE**: REPEATABLE READ + 직렬화 가능성 검증. 충돌 시 재시도 강제.

### 비관적 락과의 협력
`SELECT ... FOR UPDATE`:
- MVCC와 별개로 **명시적 락**.
- 락 잡은 트랜잭션이 COMMIT/ROLLBACK 전까지 다른 트랜잭션은 그 행을 못 잡음.
- 우리 PaymentService/TransferService가 이걸로 잔액 변경 직렬화.

### MVCC의 비용
- 옛 버전 누적 → 디스크 부풀음 (bloat).
- PostgreSQL의 `VACUUM`이 주기적으로 정리. AUTOVACUUM이 자동.
- 운영 환경에선 VACUUM 모니터링 필요.

### 비전공자 함정
- "락 안 잡았는데 왜 데이터 일관됨?" → MVCC.
- "MVCC 있으니 락 불필요?" → 잔액 변경 같은 race는 여전히 락 필요. MVCC는 읽기 일관성용.

---

## 8.6 격리 수준 함정

### 4가지 격리 수준과 가능한 이상 현상

| 수준 | Dirty Read | Non-Repeatable Read | Phantom Read |
|---|---|---|---|
| READ UNCOMMITTED | 가능 | 가능 | 가능 |
| READ COMMITTED (PG 기본) | 차단 | 가능 | 가능 |
| REPEATABLE READ | 차단 | 차단 | 가능 (PG는 차단) |
| SERIALIZABLE | 차단 | 차단 | 차단 |

### 각 이상 현상
**Dirty Read**: 커밋 안 된 변경을 다른 트랜잭션이 읽음. 거의 모든 DB에서 차단.

**Non-Repeatable Read**:
```
T1: SELECT balance → 1000
T2: UPDATE balance=500; COMMIT
T1: SELECT balance → 500  (같은 트랜잭션 안인데 값 바뀜)
```
READ COMMITTED에선 발생.

**Phantom Read**:
```
T1: SELECT COUNT(*) WHERE amount > 100 → 5
T2: INSERT ... amount=200; COMMIT
T1: SELECT COUNT(*) WHERE amount > 100 → 6  (행 수가 바뀜)
```
REPEATABLE READ에서 일반적으론 발생, PostgreSQL은 차단 (스냅샷 격리).

### 우리 Mini Pay는?
- PG 기본 READ COMMITTED 사용.
- 잔액 변경은 `SELECT FOR UPDATE`로 명시적 락 → 격리 수준과 별개로 안전.
- 거래 조회는 readOnly 트랜잭션 → 동시 변경 영향 안 받음 (스냅샷 격리).

### 비전공자 함정
- 격리 수준 올린다고 성능 X 항상 손해 (충돌 빈도 증가).
- SERIALIZABLE은 강력하지만 충돌 → 재시도 폭증. 돈 도메인엔 부적합.
- 격리 수준 + 락은 별개 메커니즘. 둘 다 이해 필요.

---

## 8.7 트랜잭션 ACID 재정리

### 다시 정리
- **Atomicity (원자성)**: BEGIN ~ COMMIT 사이 모두 성공 or 모두 실패. ROLLBACK 시 부분 변경 없음.
- **Consistency (일관성)**: 트랜잭션 전후로 무결성 제약(NOT NULL, UNIQUE, FK, CHECK) 유지.
- **Isolation (격리성)**: 8.6 참조.
- **Durability (지속성)**: COMMIT 후엔 디스크에 영구 기록 (WAL = Write-Ahead Logging).

### WAL (Write-Ahead Logging)
PostgreSQL의 durability 구현:
1. 변경 사항을 먼저 WAL 로그에 append.
2. WAL이 디스크 fsync 완료되면 COMMIT 응답.
3. 실제 테이블 데이터 페이지는 나중에 비동기로 디스크에 반영.
- 크래시 시 WAL을 재생(replay)해서 복구.
- 백업/복제도 WAL 기반.

### 비전공자 함정
- "ACID는 RDB만"이라는 생각: NoSQL도 ACID 지원하는 게 많음 (MongoDB 4+, etc.).
- "트랜잭션은 무료" 아님: 락 점유, WAL 쓰기, 인덱스 갱신 비용. 짧고 빠르게.

---

## 8.8 Hibernate 내부 — 영속성 컨텍스트 다시

### 다시 살펴보기
이미 1.10, Part 1에서 다뤘지만 더 깊게.

### 4가지 상태
- **Transient (비영속)**: `new`로 만들었지만 EntityManager가 모름.
- **Persistent (영속)**: EntityManager가 관리 중. 1차 캐시에 있음. 변경 감지됨.
- **Detached (준영속)**: 한 번 영속이었으나 트랜잭션 끝나서 분리됨.
- **Removed (삭제)**: `remove()` 호출됨. COMMIT 시 DELETE.

### 더티 체킹 메커니즘
1. 트랜잭션 시작.
2. 엔티티 조회 → 1차 캐시 + **스냅샷 보관** (조회 시점 상태).
3. `account.deduct(...)` 호출 → 엔티티 필드 변경.
4. COMMIT 직전, Hibernate가 모든 영속 엔티티를 스냅샷과 비교.
5. 변경된 필드만 UPDATE 쿼리 생성.

```java
@Transactional
public void pay() {
    Account a = accountRepository.findByIdForUpdate(id);  // 영속
    a.deduct(Money.of(1000));                              // 단지 자바 필드 변경
    // 명시적 save() 호출 없음
}
// COMMIT 직전: UPDATE accounts SET balance_amount=... WHERE id=...
```
**`save()` 명시 안 해도 UPDATE 됨**. 이게 더티 체킹.

### 1차 캐시의 함정 (Step 10에서 발견한 그것)
같은 트랜잭션에서 두 번째 조회는 DB 안 감.
```java
Account a1 = repo.findById(5);          // DB 쿼리, 영속
Account a2 = repo.findByIdForUpdate(5); // DB 안 감, 1차 캐시 hit, FOR UPDATE 미발동
```
- PESSIMISTIC_WRITE가 무력화됨.
- 우리 픽스: ID projection으로 영속화 회피.

### `flush()` 와 `saveAndFlush()`
- `flush()`: 영속성 컨텍스트의 변경을 DB에 즉시 반영 (트랜잭션은 안 끝남).
- `saveAndFlush()`: save + 즉시 flush. UNIQUE 위반 같은 제약 조건을 **즉시 확인**.
- 우리 PaymentService/TransferService가 멱등키 UNIQUE 검증 위해 사용.

### 비전공자 함정
- "Repository에서 save 호출 안 하면 저장 안 됨"이라는 착각: 영속 엔티티는 더티 체킹으로 자동.
- "save() 호출하면 즉시 INSERT" 착각: 트랜잭션 끝(COMMIT) 또는 flush 호출 시점에 실제 SQL 발행.

---

---

# Part 9. SOLID + 디자인 패턴

객체지향 설계의 "왜 이렇게 짜는가"에 답하는 챕터. Mini Pay가 SOLID를 자연스럽게 따르는 코드라서 매핑이 쉬움.

---

## 9.1 SOLID 5원칙

### S — Single Responsibility (단일 책임)
**클래스는 하나의 변경 이유만 가져야**.

Mini Pay 3-tier:
- `PaymentController` — HTTP 처리만. 비즈니스 X.
- `PaymentService` — 비즈니스 + 트랜잭션. DB SQL X.
- `AccountRepository` — DB 입출력만. 비즈니스 판단 X.

각 클래스의 "변경 이유":
- Controller 변경: API 스펙 바뀜.
- Service 변경: 비즈 규칙 바뀜.
- Repository 변경: 데이터 모델/쿼리 바뀜.

서로 다른 이유로 변경 → 서로 다른 클래스.

### O — Open/Closed (개방-폐쇄)
**확장엔 열려있고 수정엔 닫혀있어야**.

Mini Pay 사례:
- 새 거래 종류(REFUND) 추가 시:
  - `TransactionType` enum에 REFUND 추가.
  - `Transaction.refund(...)` 정적 팩토리 추가.
  - 기존 `Transaction.charge`, `payment`, `transfer`는 수정 안 함.
- 기존 코드 닫고, 새 메서드로 확장.

### L — Liskov Substitution (리스코프 치환)
**자식은 부모를 대체 가능해야**. 자식이 부모의 계약을 깨면 안 됨.

Mini Pay 사례:
- 모든 `*Repository`는 `JpaRepository`의 자식.
- `AccountRepository`가 `JpaRepository.save()`의 의미를 깨면 안 됨 (예: save인데 사실 delete).

추상적 원칙이라 코드에 자주 노출되지 않음.

### I — Interface Segregation (인터페이스 분리)
**큰 인터페이스보다 작은 인터페이스 여러 개**. 클라이언트가 안 쓰는 메서드에 의존하지 말 것.

Mini Pay에서 자연스럽게 따름:
- `AccountRepository`, `UserRepository`, `TransactionRepository` 분리.
- 만약 하나의 `MegaRepository`였다면 PaymentService가 안 쓰는 user 메서드에도 의존.

### D — Dependency Inversion (의존성 역전)
**구체가 아닌 추상에 의존**. 고수준 모듈이 저수준 모듈에 의존하면 안 됨.

Mini Pay 사례:
```java
public class PaymentService {
    private final AccountRepository accountRepository;  // 인터페이스
    private final IdempotencyStore idempotencyStore;    // 인터페이스 또는 추상
    ...
}
```
- PaymentService는 `AccountRepository` 인터페이스에만 의존.
- 구현체는 Spring Data JPA가 런타임에 주입.
- 나중에 구현체를 mock으로 바꿔도 PaymentService는 무변.

**DI = Dependency Injection (주입), DIP = Dependency Inversion Principle (방향)**. 둘 다 같은 결과(추상 의존)를 만들지만 다른 측면.

---

## 9.2 정적 팩토리 패턴 (Factory)

이미 Part 1에서 다룸. 재요약:
- 생성자 private, 정적 메서드로만 인스턴스 생성.
- 이름이 의도를 드러냄 (`Account.openFor`, `Money.of`, `Money.zero`, `Transaction.charge`).
- 검증을 정적 메서드 안에서 일괄 처리.
- ADR 0003 — Builder 거절의 사상적 근거.

### Effective Java Item 1
"생성자 대신 정적 팩토리 메서드를 고려하라" — Joshua Bloch.

장점:
1. 이름이 있음.
2. 호출마다 새 객체 안 만들어도 됨 (캐싱).
3. 반환 타입의 자식을 반환 가능.
4. 입력에 따라 다른 클래스 반환 가능.
5. 작성 시점에 반환 클래스가 존재 안 해도 됨.

---

## 9.3 Repository 패턴

### 개념
도메인 객체의 **수집(collection)을 흉내내는 추상**. "저장 매체와 무관하게 객체를 다룰 수 있는 인터페이스".

```java
accountRepository.save(account);            // collection.add()처럼
accountRepository.findById(id);             // collection.findBy(...)처럼
accountRepository.delete(account);          // collection.remove()처럼
```

### Spring Data가 한 것
Repository 패턴을 인터페이스 선언만으로 자동 구현해줌:
- `JpaRepository<Account, Long>` 상속 → 표준 CRUD 자동.
- 메서드 이름 파싱으로 커스텀 쿼리.
- `@Query`로 JPQL/SQL.

### 비전공자 함정
- Repository를 단순 DAO로 오해: Repository는 **도메인 컬렉션 추상**, DAO는 **데이터 접근 객체**. 사상이 살짝 다름.
- Service에서 Repository 우회해서 EntityManager 직접 사용: 피할 것.

---

## 9.4 Strategy 패턴

### 개념
같은 인터페이스의 여러 구현 중 런타임에 선택.
```java
interface PaymentStrategy { void pay(Account a, Money m); }
class CardPayment implements PaymentStrategy { ... }
class TransferPayment implements PaymentStrategy { ... }
```

### Mini Pay에서
직접적으로 안 씀. 거래 종류는 enum + 정적 팩토리로 충분.
- 거래마다 동작이 크게 다르지 않음.
- Strategy 도입은 오버엔지니어링.

### 언제 도입할 가치
- 알고리즘이 다양하고 자주 추가됨 (할인 정책, 환율 계산, 알림 채널).
- 런타임에 동적 선택 필요.

---

## 9.5 Template Method 패턴

### 개념
부모 클래스가 알고리즘의 뼈대를 정하고, 일부 단계를 자식이 채움.

### Spring 내부의 예
- `OncePerRequestFilter` — `doFilter` 뼈대는 부모가, `doFilterInternal`만 자식이 구현.
- 우리 `JwtAuthenticationFilter`가 정확히 이 패턴.

```java
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(...) { ... }   // 자식이 채움
    // doFilter (부모, 한 번만 호출 보장 로직 포함)
}
```

---

## 9.6 Observer 패턴 / 이벤트 사상

### 개념
객체 상태 변경 시 등록된 관찰자들에게 자동 통지.

### Spring의 ApplicationEventPublisher
```java
publisher.publishEvent(new PaymentCompletedEvent(...));

@TransactionalEventListener(phase = AFTER_COMMIT)
void handle(PaymentCompletedEvent event) { ... }
```
- 결제 성공 후 알림/포인트는 이벤트로 분리.
- 트랜잭션 안에서 외부 I/O 호출 금지(컨벤션) 의 해결책.

### Mini Pay에서
- 컨벤션에 박혀 있지만 미도입 (Step 11에서 종결).
- 향후 알림 도입 시 도입 예정.

---

## 9.7 Singleton 패턴

### 개념
클래스 인스턴스가 단 1개. 글로벌 접근.

### Spring Bean = 사실상 Singleton (기본 스코프)
Spring 컨테이너가 Bean마다 인스턴스 1개 유지 → 직접 Singleton 패턴 구현 불필요.

### 직접 구현 시 함정
- 멀티스레드 race condition.
- 테스트 어려움 (전역 상태).
- 종속성 명시적이지 않음.

→ Spring 쓰면 직접 안 만드는 게 답.

---

## 9.8 Builder 패턴 — 우리는 왜 거절했나

### Builder 패턴
인자 많은 객체 생성을 가독성 있게:
```java
User user = User.builder()
        .email("a@b.com")
        .name("Alice")
        .age(30)
        .build();
```

### Lombok `@Builder`
한 줄로 Builder 자동 생성.

### Mini Pay가 거절한 이유 (ADR 0003)
- **검증 시점 불명확**: build() 시점인가, 각 setter인가?
- **불변 보장 약함**: build 후에 또 다른 builder 만들어 변형 가능.
- **도메인 동사 부재**: `User.builder().build()`보다 `User.register(...)`가 의도 명확.
- 결론: **정적 팩토리 메서드만 사용**.

### Builder가 더 좋은 경우
- 인자 10개 이상.
- 일부 인자가 선택적.
- 점진적 구성이 자연스러움.
- 우리 도메인은 검증이 강해서 부적합.

---

## 9.9 디자인 패턴 사용 사고

### Gang of Four (GoF) 23개 패턴
1994년 책. 지금도 영향력 큼.
- **Creational**: Factory, Abstract Factory, Builder, Prototype, Singleton.
- **Structural**: Adapter, Bridge, Composite, Decorator, Facade, Flyweight, Proxy.
- **Behavioral**: Chain of Responsibility, Command, Iterator, Mediator, Memento, Observer, State, Strategy, Template Method, Visitor.

### 실무에서 정말 자주 보는 것
- Factory (정적 팩토리 포함)
- Repository (DDD 패턴, GoF 아님)
- Strategy
- Template Method
- Observer (이벤트)
- Decorator (Spring AOP의 본질)
- Proxy (Spring AOP가 만드는 것)
- Adapter (라이브러리 통합)

### 안티패턴: "패턴을 위한 패턴"
- 단순한 코드에 억지로 패턴 적용 → 복잡도 폭증.
- "이건 어떤 패턴인가" 식별이 목적이지, "이 패턴을 어디 끼울까"가 목적이면 안 됨.
- **YAGNI** (You Aren't Gonna Need It) — 필요할 때 도입.

---

---

# Part 10. 네트워크 깊이 — TCP·HTTPS·DNS·커넥션 풀

"HTTP 요청이 오면 컨트롤러가 받아요" 이상의 깊이.

---

## 10.1 OSI 7계층 (얕게)

| 계층 | 이름 | 단위 | 예 |
|---|---|---|---|
| 7 | Application | 메시지 | HTTP, FTP, SMTP, DNS |
| 6 | Presentation | - | TLS, 압축, 인코딩 |
| 5 | Session | - | 세션 관리 |
| 4 | Transport | 세그먼트 | **TCP**, UDP |
| 3 | Network | 패킷 | **IP**, ICMP, 라우팅 |
| 2 | Data Link | 프레임 | Ethernet, Wi-Fi |
| 1 | Physical | 비트 | 케이블, 전파 |

### 실무 단순화: TCP/IP 4계층
- Application (HTTP, DNS)
- Transport (TCP, UDP)
- Internet (IP)
- Link (Ethernet, Wi-Fi)

요청 흐름: HTTP 메시지 → TCP 세그먼트로 분할 → IP 패킷으로 라우팅 → 물리 신호.

---

## 10.2 TCP vs UDP

### TCP (Transmission Control Protocol)
- **연결 지향** (3-way handshake로 시작, 4-way로 종료).
- **순서 보장**.
- **신뢰성** (재전송, 흐름 제어, 혼잡 제어).
- HTTP, HTTPS, SSH, DB 연결 모두 TCP.

### UDP (User Datagram Protocol)
- **비연결**. 그냥 보냄.
- **순서 X**, **유실 가능**.
- 빠름, 가벼움.
- DNS, 비디오 스트리밍, 게임, VoIP.

### 3-way Handshake
```
Client → Server: SYN
Client ← Server: SYN-ACK
Client → Server: ACK
(이제 데이터 통신 시작)
```
- 매 연결마다 왕복 3번.
- 그래서 **커넥션 재사용**(connection pool, HTTP keep-alive)이 중요.

### HTTP/1.1 keep-alive
한 TCP 연결로 여러 HTTP 요청. 매 요청마다 handshake 안 해도 됨.

### Mini Pay에서
- Tomcat이 keep-alive 처리.
- HikariCP가 DB 연결을 풀로 유지 (매 쿼리마다 handshake 안 함).
- Spring Data Redis가 Redis 연결 풀.

---

## 10.3 HTTP 버전 진화

### HTTP/1.0
- 매 요청마다 새 TCP 연결.
- 매우 느림.

### HTTP/1.1 (1999, 지금도 주력)
- **keep-alive** 디폴트.
- **pipelining** (이론상 가능, 실제 거의 X).
- **호스트 헤더** 필수 (가상 호스팅).
- 우리 Mini Pay가 사용.

### HTTP/2 (2015)
- **멀티플렉싱** — 한 TCP 연결로 여러 요청 동시.
- **헤더 압축** (HPACK).
- **서버 푸시** (거의 안 씀, deprecated 방향).
- 바이너리 프로토콜.

### HTTP/3 (2022, RFC 9114)
- **QUIC** 기반 (UDP 위에서 직접).
- TCP head-of-line blocking 해결.
- 점진적 채택 중.

### Mini Pay 현재
- Tomcat 디폴트는 HTTP/1.1.
- HTTP/2는 별도 설정 (h2 활성화).
- 학습 단계엔 1.1로 충분.

---

## 10.4 HTTPS / TLS — 비번 전송이 안전한 이유

### 위협
평문 HTTP로 비번 전송 → 중간자(예: 공용 Wi-Fi 운영자)가 패킷 캡처 → 비번 노출.

### TLS (Transport Layer Security)
- TCP 위에 암호화 계층 추가.
- 옛 이름: SSL (지금은 사용 안 함, deprecated).
- 1.2 (2008), 1.3 (2018) — 1.3이 주력.

### TLS Handshake (1.3 기준, 단순화)
```
Client → Server: ClientHello (지원 암호 알고리즘 목록 + 클라이언트 난수)
Client ← Server: ServerHello (선택된 알고리즘 + 서버 난수)
                 Certificate (서버 인증서)
                 Finished
Client → Server: Finished
(이후 모든 통신 암호화)
```

### 인증서
- 서버가 "내가 진짜 example.com이다" 증명.
- CA (Certificate Authority, 예: Let's Encrypt)가 서명.
- 브라우저/클라이언트는 신뢰하는 CA 목록 보유.

### 비밀번호 안전성
- TLS 위에서 비번이 평문 같지만 실제로는 전 구간 암호화.
- **그 다음 단계**: 서버 도착 후 비번을 **BCrypt 해시**로 변환 → DB에 평문 저장 안 함.
- 이중 보호.

### Mini Pay 현재
- 학습 환경: HTTP만 사용 (localhost). 운영에선 HTTPS 필수.
- 운영 도입: 보통 Nginx/Caddy를 리버스 프록시로 TLS termination.

---

## 10.5 DNS — 이름을 IP로

### 흐름
```
브라우저: "example.com이 뭐야?"
       ↓
로컬 DNS 캐시 → 없음
       ↓
설정된 DNS 서버 (보통 라우터/ISP)
       ↓
루트 DNS → .com TLD DNS → example.com 권한 DNS
       ↓
"93.184.216.34"
```

### docker-compose 내부 DNS
```yaml
services:
  app:
    ...
  db:
    image: postgres
```
- 컨테이너 안에서 `db`를 호스트명으로 사용 가능.
- Docker가 내장 DNS로 `db` → 컨테이너 IP 변환.
- Mini Pay의 `jdbc:postgresql://db:5432/...` 같은 설정의 배경.

### `/etc/hosts`
DNS 조회 전에 먼저 보는 로컬 파일.
- `127.0.0.1 localhost`가 여기에.
- 개발 시 가짜 도메인 매핑할 때 활용.

### 비전공자 함정
- DNS 캐시 함정: 변경 후 즉시 반영 안 됨 (TTL). `nslookup`, `dig`로 확인.
- 로컬 DNS와 컨테이너 DNS 차이: 호스트에서 `db`라고 못 부름, 컨테이너 안에서만.

---

## 10.6 커넥션 풀

### 왜 필요한가
- TCP 연결 = 3-way handshake + TLS handshake → 매번 비쌈.
- DB 연결 = TCP + 인증 + 세션 초기화 → 더 비쌈.
- 요청마다 새로 만들면 응답 시간의 대부분이 연결.

### 풀의 동작
1. 부팅 시 N개 연결 미리 만들기.
2. 요청 들어옴 → 풀에서 빌림.
3. 사용 후 반환.
4. 풀이 부족하면 대기 또는 새 연결.

### HikariCP
- Spring Boot 디폴트 DB 커넥션 풀.
- 빠르고 안정적.
- 설정:
```yaml
spring.datasource.hikari:
  maximum-pool-size: 10   # 풀 크기
  connection-timeout: 30000
  idle-timeout: 600000
```

### 풀 크기 결정
- 너무 작음 → 대기, 처리량 하락.
- 너무 큼 → DB 부담, 컨텍스트 스위치 오버헤드.
- HikariCP 가이드: `connections = ((core_count × 2) + effective_spindle_count)`.
- 실무: 모니터링 보며 튜닝.

### 비전공자 함정
- "풀 크기를 크게 하면 좋다" 착각: DB가 받쳐줘야 함. 보통 DB max_connections와 균형.
- 커넥션 누수: 사용 후 반환 안 하면 풀 고갈. JPA 트랜잭션이 보통 자동 처리하지만 직접 JDBC 쓸 땐 try-with-resources 필수.

---

## 10.7 쿠키 vs 헤더 토큰 (JWT)

### 쿠키 기반 세션
1. 로그인 → 서버가 세션 생성, 세션 ID를 `Set-Cookie` 헤더로 반환.
2. 브라우저가 같은 도메인 요청 시 **자동으로** `Cookie` 헤더 동봉.
3. 서버는 세션 ID로 서버 측 저장소에서 사용자 조회.

### 헤더 토큰 (JWT) 기반
1. 로그인 → 서버가 JWT 발급, JSON 응답 본문에 담아 반환.
2. 클라이언트가 **수동으로** 매 요청에 `Authorization: Bearer <token>` 헤더 추가.
3. 서버는 JWT 서명 검증 + payload에서 사용자 ID 추출. DB 조회 없음.

### CSRF (Cross-Site Request Forgery)
**쿠키 기반의 취약점**:
- 사용자가 example.com 로그인 (쿠키 보유).
- 악성 사이트 방문 → 그 사이트가 `<img src="https://example.com/transfer?to=...">` 같은 요청.
- 브라우저가 example.com 쿠키 자동 동봉 → 사용자 의지와 무관하게 이체.

**JWT 헤더 방식은 CSRF 무력화**:
- 매 요청에 사람이 수동으로 헤더 첨부 (브라우저가 안 해줌).
- 악성 사이트가 사용자의 토큰을 알 수 없음.
- Mini Pay가 `csrf disable` 설정하는 이유.

### XSS (Cross-Site Scripting)는 다른 문제
- 악성 스크립트가 브라우저에 실행 → JS가 토큰 탈취 가능 (localStorage 접근).
- 쿠키는 `HttpOnly` 플래그로 JS 접근 차단 가능 (XSS 일부 방어).
- JWT를 localStorage에 두면 XSS에 취약.

### 트레이드오프
| | 쿠키 세션 | JWT 헤더 |
|---|---|---|
| CSRF | 취약 (SameSite로 완화) | 안전 |
| XSS | HttpOnly로 방어 | localStorage 시 취약 |
| 무효화 | 서버에서 즉시 | 어려움 (블랙리스트 필요) |
| 수평 확장 | 세션 저장소 동기화 필요 | stateless |
| 모바일 앱 | 쿠키 부적합 | 적합 |

Mini Pay는 모바일/API 친화적이라 JWT 선택 (ADR 0008).

---

## 10.8 CORS — Cross-Origin Resource Sharing

### 동일 출처 정책 (Same-Origin Policy)
브라우저 기본 보안: 같은 출처 (scheme + host + port)에서만 JS가 다른 출처 API 호출 가능.
- `https://app.example.com:443` ↔ `https://api.example.com:443` → 다른 출처 (host 다름).

### CORS
서버가 명시적으로 "다른 출처에서 호출 허용"이라 표시:
```
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST
Access-Control-Allow-Headers: Authorization
```

### Preflight (OPTIONS)
복잡한 요청(헤더 추가, 비단순 메서드) 전에 브라우저가 OPTIONS 요청으로 허용 확인:
```
OPTIONS /api/v1/payments
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: Authorization, Idempotency-Key, Content-Type
```
서버가 OK 응답하면 진짜 요청 전송.

### Mini Pay에서
- 학습 환경에선 CORS 설정 안 함.
- 프론트엔드 도메인이 다르면 SecurityConfig에 CorsConfigurationSource Bean 추가 필요.

### 비전공자 함정
- "CORS는 보안" 착각: CORS는 브라우저 정책. 서버는 그냥 헤더 받음. 직접 curl/Postman으론 CORS 무관하게 호출 가능.
- "Allow-Origin: *"의 위험: 모든 출처 허용 = 사실상 보호 X.

---

---

# Part 11. 보안 — OWASP Top 10

OWASP Top 10 (2021)을 Mini Pay에 매핑. 비전공자가 실수하기 가장 쉬운 영역.

---

## 11.1 A01 — Broken Access Control (취약한 접근 통제)

### 위협
사용자가 자기 권한 밖의 자원 접근.
- 다른 사용자의 계좌 조회.
- 일반 사용자가 관리자 API 호출.

### Mini Pay 현재 대응
- JWT subject(`sub=userId`)로 호출자 식별.
- Service에서 `userId` 기반으로 본인 자원만 조회:
```java
Account account = accountRepository.findByUserIdForUpdate(userId)
        .orElseThrow(() -> AccountNotFoundException.forUser(userId));
```

### 미구현 시나리오
- **IDOR (Insecure Direct Object Reference)**: `/api/v1/accounts/{id}` 같은 API에서 다른 사람의 id 넣으면 조회 가능 → 우리는 path variable 안 쓰고 JWT userId 기반.
- **역할 분리 부재**: 관리자/일반 사용자 구분 없음 (학습 단계).

### 권장 패턴
- 모든 조회/변경에 "이 요청자가 이 자원의 소유자인가" 검증.
- ID 추측 방지: UUID 사용 (auto-increment ID는 추측 쉬움).

---

## 11.2 A02 — Cryptographic Failures (암호화 실패)

### 위협
민감 데이터를 평문 또는 약한 암호로 처리.

### Mini Pay 대응
- 비밀번호 → **BCrypt 해시**, 평문 저장 안 함.
- JWT → HS256 서명, 서버 시크릿 키.

### 함정
- **시크릿 키를 코드에 하드코딩**: `application.yml`에 평문. 운영에선 환경변수/시크릿 매니저로 분리.
- **약한 알고리즘**: MD5, SHA1 (취약). BCrypt/Argon2/scrypt 사용.
- **솔트 누락**: BCrypt는 자동 솔트 → 안전. 직접 해시할 땐 솔트 필수.

### TLS 측면
- HTTPS로 전송 구간 암호화 — 운영에선 필수.
- 학습 단계 localhost는 평문 OK.

---

## 11.3 A03 — Injection

### SQL Injection
악성 SQL을 입력으로 주입.
```
email: alice@example.com' OR '1'='1
→ SELECT * FROM users WHERE email = 'alice@example.com' OR '1'='1'
→ 모든 사용자 노출
```

### Mini Pay가 안전한 이유
- JPA가 **Prepared Statement** 사용. 입력값을 SQL 문자열에 직접 합치지 않고 파라미터 바인딩.
- `repository.findByEmail(email)` → `SELECT ... WHERE email = ?` + `?` 자리에 안전하게 바인딩.

### 위험 패턴 (절대 금지)
```java
@Query("SELECT u FROM User u WHERE u.email = '" + email + "'")  // ❌ 문자열 연결
```
JPQL/SQL을 문자열 합성하면 인젝션 가능. **반드시 파라미터 바인딩**:
```java
@Query("SELECT u FROM User u WHERE u.email = :email")  // ✅
User findByEmail(@Param("email") String email);
```

### 기타 인젝션
- **NoSQL Injection**: MongoDB 등.
- **OS Command Injection**: `Runtime.exec` 인자에 사용자 입력.
- **LDAP Injection**.
- **XPath/JSON Injection**.

---

## 11.4 A04 — Insecure Design

### 위협
설계 단계의 보안 결함. 코드 수정으론 못 고침.

### Mini Pay 적용
- ADR 사상 자체가 Secure Design 의식: 잔액 변경 시 비관적 락 + 멱등성 이중 방어 + 도메인 검증.
- 인증 실패 메시지 통일 (사용자 존재 여부 노출 X) — ADR 0007.

### 함정
- 비번 reset 토큰 짧은 만료 없이 영구.
- 인증 우회 가능한 "테스트 모드" 코드.

---

## 11.5 A05 — Security Misconfiguration

### 위협
디폴트 설정, 불필요한 기능 활성화, 오류 메시지에 내부 정보 노출.

### Mini Pay 점검
- ✅ `csrf disable` — JWT 헤더 방식이라 의도적.
- ✅ STATELESS 세션 정책.
- ✅ GlobalExceptionHandler에서 fallback 500 시 스택트레이스 본문 노출 X.
- ⚠️ `application.yml`에 시크릿 평문 — 운영 시 환경변수 분리 필요.
- ⚠️ Actuator endpoint 노출 여부 점검 (운영 시 보호).

---

## 11.6 A06 — Vulnerable and Outdated Components

### 위협
오래된 라이브러리의 알려진 취약점.

### 점검 도구
- `./gradlew dependencyCheckAnalyze` (OWASP Dependency-Check 플러그인).
- GitHub Dependabot — PR로 업데이트 제안.
- Snyk, Renovate.

### Mini Pay 현재
- Spring Boot 3.5 (현시점 최신).
- 정기 업데이트 습관 필요.

### Log4Shell 같은 사고
- Log4j 2.x 원격 코드 실행 취약점 (2021).
- 의존성 한 줄이 전 세계 보안 사고.
- **빨리 업데이트 가능한 체계가 보안의 일부**.

---

## 11.7 A07 — Identification & Authentication Failures

### 위협
- 약한 비번 허용.
- Credential stuffing 방어 부재.
- 세션 ID 노출 / 재사용.

### Mini Pay 대응
- 비번 길이/패턴 검증 (`@Size`, `@Pattern`).
- BCrypt 해싱.
- JWT 만료 시간 설정.
- 인증 실패 응답 통일 (`InvalidCredentialsException`).

### 미구현
- **Rate limiting** — 로그인 시도 제한. 운영에선 필수.
- **2FA** — 학습 단계 제외.
- **Refresh token** — 단명 access + 장명 refresh 패턴. ADR 0008에서 미도입 결정.

---

## 11.8 A08 — Software and Data Integrity Failures

### 위협
서명/검증 없는 업데이트, CI/CD 파이프라인 변조, 직렬화 공격.

### Mini Pay 대응
- JWT 서명 검증 → payload 변조 차단.
- 멱등키 + DB UNIQUE → 중복 변조 차단.

### 함정
- Java 객체 직렬화(`ObjectInputStream`)는 RCE 위험 (deserialization gadget). 우리는 JSON만 사용 — 안전.
- npm/Maven 패키지의 typosquatting (이름 비슷한 악성 패키지).

---

## 11.9 A09 — Security Logging and Monitoring Failures

### 위협
공격 탐지 불가, 사후 추적 불가.

### 좋은 로깅
- 인증 실패: who, when, from where.
- 권한 거부: 어떤 자원에 누가 시도.
- 비정상 행동: 짧은 시간 다수 요청.

### 절대 로그에 X
- 비밀번호 (평문/해시 모두).
- JWT 전체.
- 카드번호, PIN.
- 개인 식별 정보 (마스킹 후 OK).

### Mini Pay 현재
- 기본 INFO 로그.
- 운영 추가 필요: 인증 실패 로그, 멱등키 정상/실패 로그.

---

## 11.10 A10 — Server-Side Request Forgery (SSRF)

### 위협
서버가 사용자 입력 URL을 그대로 호출 → 내부 네트워크 자원 노출.
```
사용자 입력: http://169.254.169.254/latest/meta-data/   (AWS 메타데이터)
서버: 그 URL 호출 → AWS 시크릿 노출
```

### Mini Pay 현재
- 외부 URL 호출 API 없음. SSRF 발생 여지 적음.

### 일반 대응
- URL 화이트리스트.
- 사설 IP 대역 차단.
- 호출 전 DNS 해결 후 IP 검증.

---

## 11.11 비밀 정보 관리

### 시크릿이 절대 들어가면 안 되는 곳
- Git 저장소 (코드, yml, properties).
- 로그.
- 에러 메시지.
- 클라이언트(JS, 모바일 앱).

### 좋은 관리
- **환경변수**: `${JWT_SECRET}` → `application.yml`에 placeholder만.
- **시크릿 매니저**: AWS Secrets Manager, HashiCorp Vault.
- **`.env` 파일 + `.gitignore`**: 로컬 개발용. 절대 커밋 X.

### Mini Pay 현재
- `jwt.secret` 평문 — 학습 단계 의도적.
- 운영 도입 시 환경변수로 분리 필요.

### 사고 났을 때
- 시크릿 노출 → **즉시 rotate** (새 키 발급).
- 옛 git 히스토리에 있어도 rotate가 답 (히스토리 정리는 어려움).

---

---

# Part 12. 분산 시스템 입문 — CAP·메시지 큐·Saga

Mini Pay는 단일 서버지만, 실무는 거의 모두 분산. 면접에서도 자주 등장.

---

## 12.1 CAP 정리

### 정리
**분산 시스템은 다음 셋 중 둘만 동시에 만족 가능**:
- **Consistency** (일관성): 모든 노드가 같은 데이터를 봄.
- **Availability** (가용성): 모든 요청에 응답 (성공 또는 실패).
- **Partition Tolerance** (분단 허용): 네트워크 분단이 있어도 동작.

### 현실
네트워크 분단은 **언제든 발생** → P는 사실상 필수.
**실제 선택**: CP 또는 AP.

### CP 시스템
- 분단 발생 시 → 한쪽이 응답 거부 (일관성 보호).
- 예: 전통적 RDB (PostgreSQL, MySQL), Redis (단일 마스터).
- 우리 Mini Pay = CP.

### AP 시스템
- 분단 발생 시 → 양쪽 모두 응답, 나중에 동기화 (eventual consistency).
- 예: Cassandra, DynamoDB, Riak.

### Mini Pay 트레이드오프
- 단일 PG → CP. 잔액 일관성 우선.
- 만약 다중 리전이라면 → AP로 전환하거나 + 동기화 비용 감수.

### 비전공자 함정
- "CAP은 셋 다 못 만족"이 아님: P가 없는(=네트워크 분단 없는) 환경에선 C+A 가능. 단일 머신.
- AP라고 일관성 0% 아님: eventually consistent — 시간 지나면 일치.

---

## 12.2 Consistency의 종류

### Strong Consistency
- 쓰기 후 즉시 모든 노드가 새 값을 봄.
- 비용 큼 (조정 필요).
- 우리 Mini Pay 잔액 = strong.

### Eventual Consistency
- 일정 시간 후 모든 노드 일치.
- 그 사이엔 다른 값 가능.
- DNS, S3 list (예전), 소셜 피드 등.

### Read-Your-Writes Consistency
- 자기가 쓴 건 즉시 자기가 봄. 다른 사용자는 나중에.

### Causal Consistency
- 인과 관계 있는 작업은 순서 보장. 무관한 건 순서 자유.

### Mini Pay 어디에 어떤 consistency?
- 잔액 → strong (돈은 즉시 일치 필수).
- 거래 알림 (가상) → eventual로 충분 (1초 늦어도 OK).
- 사용자 프로필 캐시 → eventual.

---

## 12.3 트랜잭션 vs 이벤트 정합성

### 단일 DB의 트랜잭션
ACID로 끝. 우리 Mini Pay 전부.

### 분산 트랜잭션 (2PC)
여러 DB에 걸친 트랜잭션을 **Two-Phase Commit**으로:
1. Prepare: 모든 참여자에게 "준비됐냐" 묻기.
2. Commit: 모두 OK면 진짜 commit.
- 문제: 한 노드 실패 시 무한 대기, 성능 저하.
- 실무에서 거의 안 씀.

### 이벤트 기반 정합성
1. 로컬 트랜잭션으로 변경 + 이벤트 발행 (같은 트랜잭션 안에서 outbox 테이블에 기록).
2. 별도 워커가 outbox에서 이벤트 읽어 메시지 큐로 발행.
3. 다른 서비스가 큐에서 받아 자기 로컬 변경.
4. 최종 일관성.

### Mini Pay 사상
- `@TransactionalEventListener(phase = AFTER_COMMIT)` = 이 패턴의 단순화.
- 결제 성공 → AFTER_COMMIT 시점에 알림 발송.
- 알림 실패가 결제를 롤백 안 함 (결제는 이미 확정).

---

## 12.4 메시지 큐 입문

### 왜 필요한가
- 서비스 간 결합 분리.
- 비동기 처리.
- 처리량 평활화 (peak 흡수).
- 재시도 / 죽은 메시지 큐 (DLQ).

### 대표 메시지 큐

**Kafka**
- 분산 로그 기반. 매우 높은 처리량.
- 메시지 영속화 + 재생 가능.
- 이벤트 소싱, 분석 파이프라인에 적합.

**RabbitMQ**
- 전통적 메시지 브로커. AMQP 프로토콜.
- 라우팅 유연 (exchange, queue).
- 작업 큐, 워크플로우에 적합.

**Redis Streams / Pub-Sub**
- 가벼움. 작은 규모.
- 우리 Mini Pay가 알림 도입 시 입문용으로 적합.

### Pattern
- **Publish/Subscribe**: 1개 발행 → N개 구독.
- **Work Queue**: 1개 발행 → 1개만 처리 (부하 분산).
- **Request/Reply**: 동기 응답이 필요할 때 (보통 안 함).

### Mini Pay 미래 시나리오
결제 성공 후:
1. 알림 발송 → 메시지 큐로 분리.
2. 포인트 적립 → 다른 서비스로 분리.
3. 분석 데이터 수집 → Kafka.

학습 단계엔 미도입.

---

## 12.5 분산 락

### Mini Pay의 Redis SETNX는 분산 락인가?
- 단일 Redis 인스턴스 SETNX = 단순 분산 락.
- **취약점**: Redis 마스터가 죽고 슬레이브로 fail-over 시 같은 키 두 번 발급 가능.

### Redlock 알고리즘 (Redis 공식)
- 여러 독립 Redis 노드에 락 동시 획득 시도.
- 과반 성공 시 락 보유로 간주.
- 더 안전하지만 복잡.

### ZooKeeper / etcd 기반 분산 락
- 합의 알고리즘(Raft/Paxos)으로 강한 일관성.
- 운영 부담 큼.

### Mini Pay 현재
- SETNX + DB UNIQUE 이중 방어.
- Redis 장애 시 DB UNIQUE가 최후 방어선 → 단일 Redis로 충분.

---

## 12.6 Saga 패턴

### 문제
마이크로서비스 결제: 결제 서비스 + 재고 서비스 + 배송 서비스. 모두 성공해야 하는데 분산 트랜잭션은 부담.

### Saga 해법
각 단계를 로컬 트랜잭션 + 실패 시 **보상 트랜잭션** 호출.
```
1. 결제 차감 (성공)
2. 재고 차감 (성공)
3. 배송 등록 (실패)
   ↓
4. 재고 복구 (보상)
5. 결제 환불 (보상)
```

### 2종류
- **Choreography (안무)**: 각 서비스가 이벤트로 다음 단계 트리거. 분산.
- **Orchestration (지휘)**: 중앙 오케스트레이터가 순서 관리. 집중.

### Mini Pay 적용 시
- 결제 + 외부 PG사 호출 + 알림.
- 외부 PG 실패 시 결제 환불 (보상).
- 학습 단계엔 미도입.

---

## 12.7 분산 환경의 멱등성

### 왜 더 중요한가
단일 서버: 클라이언트가 재시도 → 같은 키로 두 번째 요청 도착 → 멱등 처리.
**분산 환경 추가 시나리오**:
- 메시지 큐의 at-least-once delivery → 같은 메시지 두 번 도착.
- 서비스 간 호출 재시도 → 같은 작업 두 번 트리거.
- → 모든 작업이 멱등이어야 안전.

### Mini Pay 사상
- 결제/이체 모두 `Idempotency-Key` 필수.
- Redis SETNX + DB UNIQUE 이중 방어.
- 분산 환경 확장 시에도 동일 원리.

### 패턴
- **자연스러운 멱등**: GET, DELETE (이미 멱등).
- **인공적 멱등**: POST/PUT은 키 부여로 멱등 만들기.
- **결과 캐싱**: 같은 키 재요청 시 저장된 응답 반환.

---

## 12.8 분산 시스템에서 시간

### Clock Skew
- 노드마다 시계 다름.
- NTP로 동기화해도 ms 단위 차이.

### Logical Clock
- Lamport timestamp, Vector clock 등.
- "물리 시간"이 아니라 "인과 관계 순서"를 기록.

### 우리 Mini Pay 영향
- 단일 PG라 PG 시계 하나만 신뢰 → 문제 없음.
- 분산 환경 확장 시 OffsetDateTime 의미가 달라질 수 있음. UTC 기준 통일이 안전.

---

## 12.9 멀티 인스턴스 환경에서 Mini Pay의 문제점

### 시나리오: 같은 앱을 2대 띄움
- 둘 다 같은 PG와 Redis 연결.
- HTTP 부하분산기가 요청을 둘 중 하나로.

### 우리 코드가 안전한 부분
- DB 락 (`SELECT FOR UPDATE`) → 어느 인스턴스에서 와도 PG가 직렬화.
- Redis SETNX → 어느 인스턴스에서도 같은 Redis라 일관.
- JWT stateless → 인스턴스 무관 검증 가능.

### 잠재적 문제
- **로그 분산** → 같은 요청 추적이 어려움. correlation ID 도입 필요.
- **Redis 단일 노드 의존** → 장애 시 DB UNIQUE 의존. Redis Cluster로 확장 시 SETNX 동작 검증 필요.
- **인메모리 캐시** → 인스턴스별로 별개. 일관성 깨질 수 있음. 분산 캐시(Redis) 사용 또는 캐시 무효화 전략.

### 결론
Mini Pay의 사상은 분산 친화적. 인스턴스 늘려도 큰 변경 없이 동작 가능. **이게 stateless + 외부 상태(PG/Redis)에 위임한 사상의 보상**.

---
---

# 부록: 학습 순서 추천

## 1주차 — Part 1 정독
- 매일 1~2 챕터씩 Mini Pay 실제 파일 열어가며 읽기.
- 끝나면 코드 줄 단위 독해 90% 가능.

## 2주차 — Part 2 정독 + 디버거 실습
- JVM 챕터 정독.
- IntelliJ 디버거로 `PaymentService.pay()`, `TransferService.transfer()` 흐름 따라가기.

## 3주차 — Part 3 단축키 머슬 메모리
- 매일 30분, 위 5개 핵심 단축키 의식적으로 사용.
- 1주일 뒤 자동.

## 4주차 — Part 4 + 공식 문서 5종
- 4.1의 5개 javadoc 정독.
- Spring Boot reference의 "Web", "Data Access", "Transaction" 섹션 훑기.

## 5주차 — Part 5 Git 워크플로우
- 4영역 멘탈 모델 + 매일 쓰는 7개 명령 손에 익히기.
- `rebase`, `revert`, `reflog`를 하나씩 실습 브랜치에서 시험.
- 본인 Mini Pay 커밋들 `git log --oneline --graph`로 시각화하며 atomic 검증.

## 6주차 — Part 6 코드 리뷰
- 본인 PR 1개 골라 셀프 리뷰 — "처음 보는 사람"처럼.
- CLAUDE.md 체크리스트 30개 항목을 코드와 매핑.
- 가능하면 다른 오픈소스 PR 5개를 그냥 읽어보기 (관찰 학습).

## 7주차 — Part 7 자료구조 / Big-O
- Big-O 표 외우기 (O(1), O(log n), O(n), O(n²) 직관).
- HashMap 내부 동작 (체이닝, hashCode/equals 짝).
- DB 인덱스 = B-Tree 연결 짓기.
- LeetCode Easy 5문제 정도 (자바로) — 자료구조 감각 잡기용.

## 8주차 — Part 8 DB 깊이
- Mini Pay 3-테이블의 정규화 단계 분석.
- `EXPLAIN ANALYZE`로 실제 쿼리 실행 계획 보기.
- N+1 의도적 재현 (`@ManyToOne` 임시 도입 후 로그 확인) → ID 참조 복원.
- MVCC 시연: 두 psql 세션으로 동시 SELECT/UPDATE 관찰.

## 9주차 — Part 9 SOLID + 디자인 패턴
- Mini Pay 클래스마다 SOLID 5원칙 매핑.
- GoF 23패턴 중 실무 자주 보는 8개 (Factory, Repository, Strategy, Template Method, Observer, Decorator, Proxy, Adapter) 정리.
- "이 코드가 이미 어떤 패턴인가" 식별 훈련.

## 10주차 — Part 10 네트워크
- Wireshark로 localhost HTTP/HTTPS 패킷 캡처 — TCP handshake, TLS handshake 눈으로.
- HikariCP 풀 크기 변화 실험.
- 쿠키 vs JWT 양쪽 데모 (브라우저 + 모바일).

## 11주차 — Part 11 보안 / OWASP
- 본인 Mini Pay에 OWASP 10개 항목 자체 진단.
- SQL Injection 의도적 시연 (학습용 별도 브랜치) → JPA가 막는 것 확인.
- 시크릿 환경변수 분리 적용.

## 12주차 — Part 12 분산 시스템
- CAP 정리 + 우리 Mini Pay 위치 정리.
- 이벤트 기반 알림 도입 시뮬레이션 (`@TransactionalEventListener`).
- Mini Pay 2 인스턴스 띄워 부하 분산 + 동시성 시험.

## 13주차 이후 — 더 깊은 곳으로
- 시스템 디자인 입문 (Designing Data-Intensive Applications 정독).
- 자바 동시성 (java.util.concurrent, JMM).
- 클라우드 인프라 (k8s, IaC).
- DDD / 헥사고날 / CQRS.
- 옵저버빌리티 (Prometheus, Grafana, Loki, OpenTelemetry).
- 면접 답변지 ↔ 본인 ADR 매핑 강화.

이 가이드의 12 Part가 완전히 머리에 들어오면, 비전공자 딱지를 떼고 백엔드 주니어 ~ 미드 사이 어디쯤에 안착합니다. 그 다음은 폭이 아니라 깊이.

---

## 마지막 한마디

비전공자가 가장 빨리 자립하는 길은 **새 지식 폭을 늘리는 것**이 아니라 **지금 매일 보는 코드를 줄 단위로 정확히 읽는 것**입니다. Mini Pay 코드 전체가 머리에서 그림으로 그려지는 순간, 다른 어떤 Spring 프로젝트도 같은 패턴으로 보입니다.

이 문서를 한 번 읽고 끝내지 마시고, 막힐 때마다 해당 챕터로 돌아오는 **참조 문서**로 쓰십시오. 6개월 후의 자신을 위해.
