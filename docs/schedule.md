# Mini Pay — 14일 일정 (B안)

> **시작**: 2026-05-04 (월)
> **종료**: 2026-05-17 (일)
> **목표**: 가이드 Step 0~11 완주 + 프론트 5화면 + AWS 수동 배포 + ADR 8건
> **연관 문서**: `docs/progress.md` (실시간 진행), `docs/architecture.md` (시스템 그림), `docs/ready.md` (산출물)

---

## 🗓 전체 14일 로드맵

### Week 1 — 백엔드 (5/4 월 ~ 5/10 일)

| 날짜 | 작업 | 산출물 | 막힐 가능성 |
|---|---|---|---|
| **5/4 월** | Step 3 마무리 (엔티티 4종) + ADR 0001~0004 | User/Transaction/enum 2종, ADR 4건 | 🟡 Money 두 번 임베드 |
| **5/5 화** | Step 4 회원가입 | `POST /signup`, BCrypt, 중복 이메일 처리 | 🟡 트랜잭션 (User+Account 동시 생성) |
| **5/6 수** | Step 5 Spring Security + JWT 필터 ⭐ | SecurityConfig, JwtAuthFilter, JwtProvider | 🔴 가장 어려움 (하루 풀로) |
| **5/7 목** | Step 6 로그인 + Step 5 잔여 디버깅 | `POST /login`, JWT 발급 | 🟡 인증 실패 메시지 통일 |
| **5/8 금** | Step 7 잔액 충전 | `POST /accounts/charge`, `FOR UPDATE` 첫 경험 | 🟢 |
| **5/9 토** | Step 8 결제 (Redis 멱등키) | Redis SETNX, `PaymentService` 절반 | 🔴 Redis 연동 첫 경험 |
| **5/10 일** | Step 8 마무리 (비관적 락 + 도메인) | `POST /payments` 골든패스 통과 | 🔴 락+멱등 동시 디버깅 |

### Week 2 — 통합·프론트·AWS·정리 (5/11 월 ~ 5/17 일)

| 날짜 | 작업 | 산출물 | 막힐 가능성 |
|---|---|---|---|
| **5/11 월** | Step 9 거래내역 + Step 11 Swagger 9시나리오 | `GET /transactions`, Swagger 통과 | 🟢 |
| **5/12 화** | Step 10 동시성 통합 테스트 ⭐ | 동시 결제 100건 → 잔액 정합성 검증 | 🔴 `@Transactional` 안 붙이기 함정 |
| **5/13 수** | 프론트 환경 세팅 + 가입/로그인 화면 | Vite/Next 프로젝트, 화면 2개 | 🟡 첫 React면 환경 셋업 |
| **5/14 목** | 프론트 대시보드/충전/결제/내역 | 화면 4개 추가, JWT 헤더 부착 로직 | 🟡 인증 흐름 |
| **5/15 금** | 프론트 마무리 + CORS + 풀스택 동작 | 로컬에서 골든패스 9개 통과 | 🔴 CORS·Preflight 디버깅 |
| **5/16 토** | AWS 수동 배포 | RDS + EC2(Spring + Redis docker) + S3+CloudFront | 🔴 보안그룹·환경변수 첫 경험 |
| **5/17 일** | 버그픽스 + ADR 8건 마무리 + README | 면접용 포트폴리오 완성 | 🟢 |

**🔴 = 하루 풀로 잡힐 가능성 높음 (총 5일)**
**🟡 = 반나절 잡힐 가능성**
**🟢 = 비교적 수월**

---

## 📅 오늘 (5/4 월) 상세

### ✅ 이미 완료 (오전)

- [x] B안 14일 일정 결정 (A안 1주 vs B안 2주 토론 후 B안 채택)
- [x] `docs/architecture.md` 작성 — 시스템 아키텍처 + 데이터 저장 매트릭스 + 결제/로그인 시퀀스
- [x] `docs/schedule.md` 작성 (이 파일)

### ☐ 오늘 남은 작업 — 체크리스트

**Phase 1: 엔티티 작성 (오전~점심 후)**
- [ ] `TransactionType.java` enum (`CHARGE`, `PAYMENT`)
- [ ] `TransactionStatus.java` enum (`SUCCESS`, `FAILED`)
- [ ] `User.java` 엔티티 + 정적 팩토리 `User.signUp(...)`
- [ ] `Transaction.java` 엔티티 ⭐ (Money 두 번 임베드 + `@AttributeOverrides`)

**Phase 2: 검증 (점심 후)**
- [ ] `./gradlew bootRun` → Flyway 통과 + Hibernate validate 통과 콘솔 로그 공유
- [ ] `docs/progress.md`의 Step 3 항목 `[x]` 처리

**Phase 3: ADR 4건 (저녁, 각 15분)**
- [ ] `docs/adr/0001-money-numeric.md` — 금액은 `NUMERIC(19,4)` + `BigDecimal`
- [ ] `docs/adr/0002-timestamptz.md` — 시간은 `TIMESTAMPTZ` + `OffsetDateTime`
- [ ] `docs/adr/0003-money-vo.md` — Money VO + `@Embeddable`
- [ ] `docs/adr/0004-enum-string.md` — `@Enumerated(STRING)` 고정

**보너스 (시간 남으면, Step 4 워밍업)**
- [ ] `UserRepository`, `AccountRepository`, `TransactionRepository` 인터페이스 3개

### 🤔 결정 필요한 것 (지금 또는 5/13 전까지)

- [ ] **프론트 스택**: Next.js (App Router + shadcn/ui) vs Vite + React + Tailwind
  - Next.js: Claude가 가장 잘 뽑음, 학습 곡선 있음, SSR 가능
  - Vite + React: 단순, SPA, 첫 React면 추천

### 시간 배분 (참고)

| 시간대 | 작업 |
|---|---|
| **오전 (2~3h)** | enum 2종 + `User.java` |
| **점심 후 (2~3h)** | `Transaction.java` ⭐ + `bootRun` 검증 |
| **저녁 (2h)** | ADR 4건 작성 |

### 작성할 엔티티 체크리스트

**`User.java`**
- 필드: `id`, `email`, `passwordHash`, `name`, `pinHash`, `createdAt`
- `@NoArgsConstructor(access = PROTECTED)`
- 정적 팩토리: `User.signUp(email, passwordHash, name, pinHash)` — 안에서 `OffsetDateTime.now()`
- setter 금지

**`TransactionType.java`** — `CHARGE`, `PAYMENT`
**`TransactionStatus.java`** — `SUCCESS`, `FAILED`

**`Transaction.java`** ⭐
- 필드: `id`, `accountId`(또는 `Account` 연관), `type`, `amountMoney`(`@Embedded` Money), `balanceAfterMoney`(`@Embedded` + `@AttributeOverrides`), `merchantId`, `idempotencyKey`, `status`, `createdAt`
- `@Enumerated(EnumType.STRING)` 2개
- 정적 팩토리: `Transaction.charge(account, amount, balanceAfter)`, `Transaction.payment(account, amount, balanceAfter, merchantId, idempotencyKey)`
- ⚠️ Money 두 번 임베드 시 `@AttributeOverrides` 필수 (V1 컬럼명: `amount_amount`/`amount_currency` vs `balance_after_amount`/`balance_after_currency`)

### 자주 막히는 지점 (선제적 안내)
1. **`@Embeddable` Money 두 개 임베드** → `@AttributeOverrides`로 컬럼명 분리 명시
2. **`@Enumerated` 빠뜨리면 ORDINAL이 디폴트** → STRING 무조건
3. **`@Column(updatable = false)`** for `createdAt` — 수정 시 NULL 덮임 사고 방지

---

## 🚨 일정 밀릴 때 컷 우선순위

전부 못 끝낼 위기면 아래 순서로 자르기. 위에 있을수록 먼저 컷.

1. **ADR 8건 → 5건으로** (0005, 0007, 0008은 5/17에 한꺼번에)
2. **Step 10 동시성 통합 테스트 컷** → Step 8 코드+ADR로 면접 답변 가능
3. **프론트 화면 5개 → 3개** (가입/로그인/결제만, 대시보드+내역 컷)
4. **AWS 도메인/HTTPS 컷** → EC2 퍼블릭 IP:8080 직노출
5. **프론트 자체 컷** → Swagger UI를 데모로 사용 (B안의 의미 퇴색)

**컷 1~2번은 학습 가치 손실 작음**, **3번부터는 포트폴리오 임팩트 손실**.

---

## 📊 진행률 추적

매일 끝날 때 `docs/progress.md`에 체크박스 업데이트 + 이 파일 § "전체 로드맵" 표 옆에 ✅ 표시 추가.

```
완료한 날: 작업 옆에 ✅
밀린 날: 다음 날로 이월 + 컷 우선순위 검토
```
