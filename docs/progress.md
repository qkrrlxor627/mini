# Mini Pay 학습 진행 상황

> **마지막 업데이트**: 2026-05-04
> **가이드**: `docs/mini-pay-guide.md`
> **컨벤션**: `CLAUDE.md` (프로젝트 루트)
> **ADR**: `docs/adr/`
> **플랜**: `C:\Users\SSAFY\.claude\plans\goofy-launching-tiger.md` (현재)

---

## 🎯 현재 위치

**Step 3 진행 중 — Phase 1~3 완료, Phase 4 사용자 작성 대기.**

### 완료
- 사전 인프라: `CLAUDE.md` + `docs/adr/README.md` 작성
- `application.yml`에 `open-in-view: false` 추가
- `V2__money_value_object.sql` 작성 (Money VO 컬럼 분할)
- 샘플 자바: `Currency.java`, `Money.java`(VO), `Account.java`, `InsufficientBalanceException.java`

### 결정 사항 (Step 3)
- Money VO 지금 도입 (`@Embeddable` + `Currency` enum)
- type/status는 Enum + `@Enumerated(EnumType.STRING)`
- 진행 방식: Claude 샘플 → 사용자 따라 쓰기

### 다음 액션 (사용자)
1. `User.java`, `Transaction.java`, `TransactionType.java`, `TransactionStatus.java` 작성
2. `./gradlew bootRun` → 결과 공유
3. 검증 통과 시 ADR 4장 작성 (0001~0004) → Step 4 진입

---

## 🔁 진행 사이클 (모든 Step 동일)

1. Claude가 Step 목표/주의사항/자주 막히는 지점 안내
2. 사용자가 코드 작성 후 공유
3. Claude 검증 (가이드 일치 여부, 컨벤션, 보안)
4. 💭 고민의 흔적 Q&A로 마무리 (면접 답변 형태로 정리)

---

## 🗂 전체 로드맵

- [x] **Step 0 — 환경 세팅** ✅ 완료
  - [x] 1) `docker-compose.yml` 작성 ✅ (postgres + redis 정상 기동)
  - [x] 2) Spring Boot 프로젝트 생성 ✅ (3.5.14, Java 17, 의존성 8종)
  - [x] 3) `./gradlew bootRun` 부팅 확인 ✅ (3.577초 부팅, postgres/flyway/tomcat 모두 정상)
  - [ ] 💭 고민 답변 (나중에 한꺼번에)
- [x] **Step 1 — 의존성 + 설정 파일** ✅ 완료 (build.gradle에 springdoc/jjwt 추가, application.yml 작성)
- [x] **Step 2 — Flyway 마이그레이션 (3테이블)** ✅ 완료
  - [x] V1__init.sql 작성 (NUMERIC(19,4) + TIMESTAMPTZ)
  - [x] sql.md (ERD Cloud용 MySQL 버전) 동기화
  - [x] `./gradlew bootRun`으로 마이그레이션 통과 확인 (2026-04-29 14:27)
- [ ] Step 3 — 엔티티 작성 (BigDecimal + OffsetDateTime) ⬅️ 다음
- [ ] Step 4 — 회원가입 API
- [ ] Step 5 ⚠️ — Spring Security + JWT 필터
- [ ] Step 6 — 로그인 API
- [ ] Step 7 — 잔액 충전 API
- [ ] Step 8 ⭐ — 결제 API (비관적 락 + 멱등성)
- [ ] Step 9 — 거래내역 조회 API
- [ ] Step 10 ⭐ — 동시성 통합 테스트
- [ ] Step 11 — Swagger 시나리오 검증

---

## 👤 사용자 컨텍스트

- Docker, Spring Boot, Gradle 모두 **처음**
- 선수 학습 자료(Docker 입문 영상 등) 추천했으나 일단 가이드 따라가며 학습 중
- 한국어로 진행
- 목표: 코드 + "💭 고민의 흔적" 답변까지 채워서 **면접 답변지**로 활용

---

## 💬 마지막 대화 요약

1. 사용자가 nginx + postgres 베이스 `docker-compose.yml`을 가져옴 (Mini Pay와 안 맞음)
2. 점검 결과: nginx 불필요, redis 빠짐, networks/volumes 정의 누락 등 다수 문제
3. 사용자가 빈칸 퀴즈 → "사전 명세 먼저 달라" 요청 → `docs/spec.md` 생성
4. 사용자가 빈칸 채우는 데 막힘 → **Q1~Q7 정답 + 줄별 이유 설명 제공 완료**
5. 사용자가 파일 저장하고 오면 `docker compose up -d` 단계로 진행

### 2026-04-29 — Step 2 (V1__init.sql)
1. 사용자가 ERD Cloud용으로 MySQL 변환 요청 → `C:\mini\sql.md` 생성
2. `idempotency_key` 의미 질문 → 멱등키 개념 설명 (Redis SETNX + DB UNIQUE 이중 방어)
3. V1__init.sql 1차 채점: line 13 `DEFAULT CHECK` syntax error + TIMESTAMP/TIMESTAMPTZ 일관성 깨짐 + NUMERIC vs BIGINT 의문
4. 사용자가 트레이드오프 분석으로 반박 (NUMERIC, TIMESTAMPTZ 합리성) → Claude가 "진짜 버그"와 "다른 합리적 선택"을 분리해서 인정
5. 사용자 선택: **NUMERIC(19,4) + TIMESTAMPTZ** (다중 통화/글로벌 확장 가정. Step 3에서 자바는 `BigDecimal` + `OffsetDateTime`)
6. V1__init.sql 수정 완료 → 9개 항목 모두 통과
7. `sql.md`도 동기화 (DECIMAL(19,4) + TIMESTAMP(6))
8. `./gradlew bootRun` 실행 → Flyway 마이그레이션 정상 적용 확인 → **Step 2 완료**
9. 부팅 경고 2개 인지: OSIV (Step 3에서 끄기), Spring Security 기본 패스워드 (Step 5에서 사라짐)

### Q1~Q7 정답 (참고용)
- **Q1**: `postgres:16`
- **Q2**: `POSTGRES_DB/USER/PASSWORD: minipay` (3종 모두)
- **Q3**: `"5432:5432"`
- **Q4**: `pgdata:/var/lib/postgresql/data`
- **Q5**: `redis:7`
- **Q6**: `"6379:6379"`
- **Q7**: 최상위 `volumes: pgdata:`

---

## ▶️ 사용자가 "다음 진행 상황 알려줘"라고 하면

**현재 단계 기준 다음 액션**:

### 케이스 A — 사용자가 `bootRun` 실행 결과를 들고 옴
1. Flyway 로그에서 `Successfully applied 1 migration` 확인
2. `\dt` 결과로 4개 테이블 (users/accounts/transactions/flyway_schema_history) 검증
3. 통과하면 Step 2 [x] 처리 → Step 3 (엔티티) 진입 안내
   - 자바 타입 강조: `private BigDecimal balance;`, `private OffsetDateTime createdAt;`
   - 도메인 메서드의 `BigDecimal.add/subtract`, `compareTo` 사용 패턴 안내

### 케이스 B — "다음" 만 옴
1. `bootRun` 실행 결과부터 공유 요청
2. 받으면 케이스 A로

### 케이스 C — "Step 2 끝, 바로 Step 3 갈래"
1. 검증 생략한 채로 Step 3 들어가면 ddl-auto: validate에서 타입 불일치 터질 위험 → 짧게 경고
2. 사용자 의지면 진행

---

## 📝 진행 업데이트 규칙 (Claude용)

- 각 Step 또는 sub-step 완료 시 → 체크박스 업데이트 + "현재 위치" 갱신
- 💭 고민 답변 받을 때마다 → README/ADR 작성용으로 정리해두기
- 큰 결정/막힘 발생 시 → "마지막 대화 요약"에 추가
- **마지막 업데이트** 날짜 매번 갱신

---

## 📚 학습 메모

### 2026-05-04 — 자바 패키지 / enum 기초

#### 패키지명이 `com`으로 시작하는 이유
- **역도메인(reverse domain)** 관례. 회사 도메인을 거꾸로 써서 전 세계 패키지명 충돌 방지.
  - `google.com` → `com.google.*`
  - `apache.org` → `org.apache.*`
- 우리 `com.minipay`는 엄밀히는 도메인 소유 안 함 → 학습 프로젝트라 OK.
- 실제 서비스라면 `io.github.<username>.<project>` 또는 회사 도메인 기반.
- `package com.minipay.domain;` 선언 = 디렉토리 `src/main/java/com/minipay/domain/` 와 1:1 매칭.

#### enum vs class
- **선택지가 고정**되어 있고 **컴파일 타임에 알 수 있는 유한한 값**일 때 enum.
- enum이 주는 보장:
  1. 타입 안전성 — 오타/잘못된 값 컴파일 차단 (`String "CHRAGE"` 같은 사고 방지)
  2. 유한성 명시 — "거래 종류는 충전/결제 둘뿐"이 코드에 박힘
  3. switch 망라성 — 누락 케이스 컴파일러 경고
  4. 싱글톤 보장 — `==` 비교 가능
  5. JPA 매핑 깔끔 (`@Enumerated(EnumType.STRING)` 한 줄)
- enum 부적합 케이스: 운영자가 추가/삭제하는 카테고리 등 런타임 가변 값 → 별도 테이블.

#### enum 값이 "상수"인 이유
- **상수(constant)** = 한 번 정해지면 안 바뀌는 값. 수학의 π 같은 것.
- `TransactionType.CHARGE`는 JVM이 켜져 있는 동안 항상 같은 하나의 객체. 누구도 다른 값으로 못 바꿈.
- → "값이 안 바뀐다"는 상수의 정의에 정확히 맞음 → enum 값 = 상수.

#### 왜 대문자(`UPPER_SNAKE_CASE`)?
- 자바 언어 강제는 아니지만 Oracle Code Conventions / JLS 관례.
- 자바 생태계 3분류 신호:
  - 클래스명 → `PascalCase`
  - 메서드/변수 → `camelCase`
  - 상수 → `UPPER_SNAKE_CASE`
- 코드 훑을 때 대문자 = "변하지 않는 값" 즉시 식별.
- 표준 라이브러리 예: `DayOfWeek.MONDAY`, `RoundingMode.HALF_EVEN`, `TimeUnit.SECONDS`, `HttpMethod.POST`.
- 여러 단어는 언더스코어: `IN_PROGRESS`, `PARTIALLY_REFUNDED` (camelCase 아님!).

#### enum 순서 변경 안전한가?
- **STRING 매핑이면 OK** — DB에 `"CHARGE"`, `"PAYMENT"` 문자열로 저장되므로 자바 코드 순서 무관.
- **ORDINAL 매핑이면 위험** — 선언 순서(0,1,2)가 DB에 정수로 저장돼서 순서 바꾸면 기존 데이터 의미가 뒤바뀜 (충전 ↔ 결제 둔갑).
- → CLAUDE.md "ORDINAL 절대 금지"의 이유.
- 단, `Enum.values()` 순회나 `compareTo()` 등 선언 순서에 의존하는 코드가 있다면 영향 있음.

#### 주석 룰 (이번 채점에서 학습)
- **WHAT 적지 마라** — 이름이 이미 설명함. `// transactionType 충전, 결제` 같은 건 불필요.
- **WHY는 적되, 명백하면 생략** — 일반론(자바 문법 메모)은 주석 X, 학습 노트로.
- 좋은 주석 = 코드만 봐선 알 수 없는 **숨은 제약/이유**.
  - 예: `// 결제 정산 보고서가 enum 순서로 정렬되므로 바꾸면 리포트 깨짐`
