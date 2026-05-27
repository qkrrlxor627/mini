# Mini Pay — 프론트엔드 인수인계 가이드

> 이 문서는 Mini Pay 백엔드(Step 0~11 완료)를 프론트와 붙일 때 **프론트 개발자가 손쉽게 시작할 수 있도록** 필요한 정보를 한 문서에 모은 것.
>
> 작성일: 2026-05-18
> 백엔드 버전: Spring Boot 3.5.14, Java 17, PostgreSQL 16, Redis 7

---

## 0. 빠른 시작 (3분)

```powershell
# 1) 백엔드 인프라
docker compose up -d   # postgres + redis

# 2) 백엔드 부팅
.\gradlew bootRun

# 3) Swagger UI 접속
# http://localhost:8080/swagger
```

> ⚠️ `docker-compose.yml` + `.env.example` 참고. JWT 시크릿은 `.env`로 분리되어 있음.

---

## 1. 핵심 자료 4개

| 자료 | 위치 | 어떻게 활용 |
|---|---|---|
| **Swagger UI** | http://localhost:8080/swagger | API 카탈로그. Try it out으로 직접 호출 가능. 우측 상단 **Authorize 🔓** 버튼 한 번 누르면 protected API에 토큰 자동 부착 |
| **OpenAPI JSON** | http://localhost:8080/api-docs | [`openapi-typescript`](https://github.com/drwpow/openapi-typescript) / [`orval`](https://orval.dev/) 같은 도구로 **TypeScript 타입 + API 클라이언트 자동 생성**. 백엔드 변경 시 컴파일 에러로 즉시 감지 |
| **API 명세 원본** | [`docs/ready.md`](ready.md) §5 | 사람이 읽는 명세 — 요청/응답/에러 코드 의미 한눈에 |
| **E2E 시나리오 12종** | [`docs/swagger-e2e-0518.md`](swagger-e2e-0518.md) | 골든 패스 6 + 엣지 6. **그대로 프론트 화면 시나리오로 사용 가능** |

---

## 2. 인증·인가 흐름

```
[가입]   POST /api/v1/auth/signup   → 201 { userId, email }
[로그인] POST /api/v1/auth/login    → 200 { accessToken, expiresIn: 3600 }
[호출]   Authorization: Bearer <accessToken>
[만료]   401 UNAUTHORIZED           → 로그인 화면으로 리다이렉트
```

### 클라이언트 측 권장 패턴

| 항목 | 권장 | 이유 |
|---|---|---|
| 토큰 저장 | 메모리(Zustand/Recoil) 또는 `httpOnly` cookie | `localStorage`는 XSS 위험. 서버는 stateless라 어디 저장해도 작동은 함 |
| 헤더 부착 | axios `interceptor` 또는 fetch wrapper | 매 요청마다 수동 부착하지 않게 한 곳에서 일괄 |
| 만료 처리 | 401 응답 자동 감지 → 자동 로그아웃 + 로그인 화면 | **Refresh token 없음** (ADR 0008) — 1시간 후 재로그인 |
| 가입 검증 | 백엔드 룰과 동일하게 클라이언트에도 박기 | UX 향상. **단 보안 검증은 서버가 진실** |

### 가입 폼 검증 룰 (서버와 동일)

| 필드 | 룰 |
|---|---|
| `email` | `@Email`, 빈 값 불가 |
| `password` | 8자 이상, **영문 + 숫자 + 특수문자 모두 포함** (`^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).+$`) |
| `name` | 빈 값 불가, 100자 이하 |
| `pin` | **숫자 4자리** (`^\d{4}$`) |

---

## 3. ⚠️ 클라이언트가 책임지는 일 — **가장 중요**

### 3-1. `Idempotency-Key` 헤더 (충전·결제·이체 필수)

> ⚠️ **2026-05-26 변경(ADR 0012)**: 충전(`POST /accounts/charge`)도 이제 `Idempotency-Key` 헤더가 **필수**입니다. 충전도 돈이 들어오는 쓰기라 더블클릭/재시도 시 잔액이 2배 늘 수 있어, 결제·이체와 동일 규칙을 적용합니다. 충전 호출에 헤더를 안 붙이면 400 `MISSING_IDEMPOTENCY_KEY`.

```http
POST /api/v1/payments
Authorization: Bearer <token>
Idempotency-Key: <UUID>
Content-Type: application/json

{ "merchantId": "M-001", "amount": 2000 }
```

**왜 클라이언트가 책임지는가**:
- 사용자 더블 클릭, 네트워크 재시도, 백그라운드 sync 등 **중복 호출은 서버가 알 방법이 없음**
- 같은 의도의 호출이면 같은 UUID, 다른 의도면 다른 UUID를 클라이언트가 결정해야 함
- **누락 시 → 400 `MISSING_IDEMPOTENCY_KEY`** (사용자에게 보이면 안 됨, 프론트 버그)

**구현 패턴**:
```typescript
// 결제 버튼 클릭 시
const key = crypto.randomUUID();   // 한 의도당 한 번만 생성
await api.post('/api/v1/payments',
  { merchantId, amount },
  { headers: { 'Idempotency-Key': key } }
);
// 같은 키로 재시도하면 서버가 첫 응답 그대로 반환 (idempotent replay)
```

### 3-2. 자기 자신 이체 1차 차단

```typescript
if (counterpartyAccountId === myAccountId) {
  showError('자기 자신에게 이체할 수 없습니다');
  return;
}
```
서버도 거절하지만(400 `INVALID_TRANSFER_TARGET`), 네트워크 왕복 낭비.

### 3-3. 잔액 1차 차단

```typescript
if (amount > myBalance) {
  showError('잔액이 부족합니다');
  return;
}
```
서버는 비관적 락 잡고 다시 검증(400 `INSUFFICIENT_BALANCE`)하지만 UX 향상.

---

## 4. 에러 코드 카탈로그 (화면 분기 기준)

응답 포맷은 항상 동일:
```json
{ "errorCode": "...", "message": "...", "timestamp": "2026-05-18T..." }
```

> **메시지 텍스트는 서버 정책으로 바뀔 수 있음. 프론트는 `errorCode`로 분기.**

| errorCode | HTTP | 발생 상황 | 권장 UI |
|---|---|---|---|
| `DUPLICATE_EMAIL` | 409 | 가입 시 이미 사용 중인 이메일 | 이메일 필드 옆 빨간 메시지 |
| `VALIDATION_FAILED` | 400 | `@Email`/`@Pattern` 등 검증 실패 — 응답 `message`에 "필드명: 사유" 포함 | 해당 필드에 표시 |
| `INVALID_CREDENTIALS` | 401 | 로그인 — 이메일 없음 또는 비번 틀림 (구분 X — 계정 존재 노출 금지) | 로그인 폼 전체 에러 "이메일 또는 비밀번호를 확인해주세요" |
| `UNAUTHORIZED` | 401 | JWT 없음 / 만료 / 잘못된 토큰 | **자동 로그아웃 → 로그인 화면 리다이렉트** |
| `ACCOUNT_NOT_FOUND` | 404 | 이체 시 수신자 계좌 없음 (또는 충전 시 본인 계좌 없음) | 토스트 + 이전 화면 |
| `INSUFFICIENT_BALANCE` | 400 | 결제·이체 시 잔액 부족 | 모달 "잔액이 부족합니다" + 충전 화면 유도 |
| `MISSING_IDEMPOTENCY_KEY` | 400 | 충전·결제·이체 요청에 `Idempotency-Key` 헤더 누락 | **프론트 버그 — 사용자에게 보이면 안 됨**. Sentry로 알림 |
| `IDEMPOTENCY_KEY_CONFLICT` | 409 | 같은 키로 다른 본문 요청 | **프론트 버그** — 위와 동일 |
| `INVALID_TRANSFER_TARGET` | 400 | 자기 자신에게 이체 시도 | "자기 자신에게 이체할 수 없습니다" 토스트 |
| `INVALID_ARGUMENT` | 400 | 페이지네이션 `size > 100` 등 |  "요청 값을 확인해주세요" |
| `NOT_FOUND` | 404 | 매핑 없는 경로 | 404 페이지 |
| `INTERNAL_ERROR` | 500 | 서버 오류 (가능하면 발생 안 해야 됨) | "잠시 후 다시 시도" + 에러 로깅 |

---

## 5. 데이터 포맷 함정

### 5-1. Money (금액)

```json
{ "amount": 10000.0000, "balanceAfter": 8000.0000, "currency": "KRW" }
```

- **JSON `number` + scale 4** — 백엔드는 `BigDecimal(19,4)`
- KRW는 정수 통화라 현재 안전, **외화 도입 시 `Number.MAX_SAFE_INTEGER`(2^53) 초과 가능** → 그땐 string으로 변경 협의 필요
- 표시 시 천 단위 콤마 + 소수점 제거(KRW의 경우):
  ```typescript
  new Intl.NumberFormat('ko-KR').format(Math.floor(amount));
  ```

### 5-2. 시간

```json
{ "createdAt": "2026-05-18T00:08:41.4726448+09:00" }
```

- ISO 8601 + 시간대 offset (`+09:00`)
- `new Date(s)` 그대로 동작. dayjs / date-fns / Temporal API 권장

### 5-3. 거래내역 응답의 `direction` enum (Step 9)

```json
{
  "transactionId": 7,
  "type": "TRANSFER",
  "direction": "SENT",       // 또는 "RECEIVED" / "SELF"
  "amount": 3000.0000,
  "balanceAfter": 7000.0000,  // ⚠️ RECEIVED일 때는 null
  "counterpartyAccountId": 9
}
```

| direction | 의미 | UI 분기 |
|---|---|---|
| `SELF` | 본인 거래 (CHARGE, PAYMENT) | 색상 — 충전은 +, 결제는 − |
| `SENT` | 이체 송금자 시점 | 빨간 −, `balanceAfter` 표시 |
| `RECEIVED` | 이체 수신자 시점 | 초록 +, **`balanceAfter`는 null** (백엔드 모델 트레이드오프 — ADR 0006) |

> **왜 RECEIVED일 때 `balanceAfter`가 null?**
> 이체 거래를 단일 행으로 저장 (송금자 시점). 수신자의 거래 후 잔액은 행에 없음. 수신자가 자기 잔액 알려면 별도 API 호출 (현재 미제공 — §7 보완 후보 참고).

### 5-4. 페이지네이션

```json
{
  "content": [ ... ],
  "page": 0,
  "size": 20,
  "totalElements": 47,
  "totalPages": 3
}
```

- `page`는 **0-based** (page=0이 첫 페이지)
- 요청: `GET /api/v1/transactions?page=0&size=20`
- `size` 상한 100, 위반 시 400 `INVALID_ARGUMENT`
- 무한 스크롤: `page < totalPages - 1` 체크 후 다음 페이지 요청

---

## 6. 환경·CORS

### 6-1. 백엔드 URL

| 환경 | URL | 설정 |
|---|---|---|
| 로컬 | `http://localhost:8080` | 그대로 |
| 운영 | TBD | 프론트 env 변수로 분리 권장 (`VITE_API_BASE_URL` 등) |

### 6-2. CORS — **로컬 디폴트 4개 포트 허용 중**

`application.yml`에서:
```yaml
cors:
  allowed-origins: ${CORS_ALLOWED_ORIGINS:http://localhost:3000,http://localhost:5173,http://localhost:5174,http://localhost:8080}
```

- 자동 허용 origin: `localhost:3000` (Next.js / CRA), `localhost:5173`, `5174` (Vite), `8080` (Swagger UI 자기 자신)
- **다른 포트로 띄울 경우 환경변수 `CORS_ALLOWED_ORIGINS` 추가**: 콤마 구분 (예: `http://localhost:4000,http://192.168.0.10:3000`)
- 허용 메서드: GET, POST, PUT, PATCH, DELETE, OPTIONS
- 허용 헤더: `Authorization`, `Content-Type`, `Idempotency-Key`
- 노출 헤더: `Authorization` (응답에서 토큰 읽어야 할 경우 대비)
- `Access-Control-Max-Age: 3600` (preflight 1시간 캐시)
- `Allow-Credentials: false` (Bearer JWT 방식이라 cookie 불필요 — credentials cookie 인증 도입 시 협의 필요)

### 6-3. Preflight 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `CORS error: Access-Control-Allow-Origin missing` | 프론트 origin이 허용 목록에 없음 | `CORS_ALLOWED_ORIGINS` 환경변수에 추가 |
| `CORS error: Method ... not allowed` | 메서드가 `Allowed-Methods`에 없음 | SecurityConfig 확인 (위에 박힌 6종 외 사용 시 추가) |
| `CORS error: Request header field X-... not allowed` | 커스텀 헤더가 `Allowed-Headers`에 없음 | SecurityConfig에 헤더 추가 협의 |

---

## 7. 백엔드 보완 후보 (현재 부족한 것)

### 7-1. `GET /api/v1/accounts/me` ✅ 구현됨 (2026-05-26)

**용도**: 본인 `accountId` + 현재 잔액 조회. 대시보드 잔액 표시 + 이체 자기 자신 1차 차단에 사용.

- **인증 필요**, 멱등키 불필요.

**응답 (200)**:
```json
{ "accountId": 29, "balance": 7777.0000, "currency": "KRW" }
```

- `401 UNAUTHORIZED` — 토큰 누락/만료/위조
- `404 ACCOUNT_NOT_FOUND` — 계좌 없음 (정상 흐름에선 발생 안 함)

> 상세 명세는 `docs/api.md` §7 참고.

### 7-2. `GET /api/v1/accounts/by-email?email=...` 또는 친구 검색 (예정)

**용도**: 이체 시 수신자를 이메일/전화번호로 찾기.

**왜 필요한가**:
- 현재 이체는 `counterpartyAccountId`(숫자) 직접 입력 — 실제 사용자가 모름
- 학습 프로젝트라 미구현. 실서비스화 시 필수

---

## 8. 화면 시나리오 매핑

| 화면 | 사용하는 API | 참고 시나리오 (`docs/swagger-e2e-0518.md`) |
|---|---|---|
| 회원가입 | `POST /api/v1/auth/signup` | #1, #12 (중복 이메일) |
| 로그인 | `POST /api/v1/auth/login` | #2 + INVALID_CREDENTIALS |
| 메인/대시보드 | `GET /api/v1/accounts/me` + `GET /api/v1/transactions?size=5` | 잔액 + 최근 거래 미리보기 |
| 충전 | `POST /api/v1/accounts/charge` + `Idempotency-Key` | #3 |
| 결제 | `POST /api/v1/payments` + `Idempotency-Key` | #4, #7 (잔액 초과), #8 (replay) |
| 이체 | `POST /api/v1/transfers` + `Idempotency-Key` | #5, #9 (자기 자신), #10 (잔액 초과) |
| 거래내역 | `GET /api/v1/transactions?page=&size=` | #6 (송금자/수신자 양쪽 시점 + direction 분기) |
| 401 핸들링 | 모든 API | #11 (JWT 누락) — interceptor 한 곳에서 통일 |

---

## 9. 자주 묻는 질문 (FAQ)

### Q1. JWT 갱신은 어떻게?
> 현재 없음. 1시간 만료 후 재로그인 필요 (ADR 0008). Refresh token은 추후 도입 후보.

### Q2. 결제 실패 후 같은 키로 재시도해도 되나요?
> **됩니다.** 처음 요청이 잔액 부족(400)으로 실패했어도 Redis에 키만 남고 거래 행은 없음. 같은 키로 재시도하면 새 거래로 처리됨 (단, 사용자가 의도적으로 같은 거래를 재시도하는 게 맞을 때).
>
> 단, **첫 요청이 200 성공한 후 같은 키로 같은 본문 재시도하면 첫 응답 그대로 반환** (idempotent replay). 다른 본문으로 같은 키 사용은 409.

### Q3. 충전·결제·이체에서 `Idempotency-Key` 같은 값 재사용 언제까지 가능?
> Redis TTL **10분**. 그 후엔 DB UNIQUE만 남음 — DB에 같은 키 거래가 있으면 여전히 충돌 감지.

### Q4. 잔액 표시는 어디서 받나요?
> `GET /api/v1/accounts/me` (§7-1, 2026-05-26 구현됨)로 본인 잔액·accountId를 직접 조회. 거래 응답의 `balanceAfter`는 보조(단 RECEIVED는 null).

### Q5. WebSocket / SSE로 실시간 알림 있어요?
> 현재 없음. 모두 polling 또는 사용자 액션 기반.

---

## 10. 개발 시작 체크리스트 (프론트 개발자용)

- [ ] 백엔드 띄우기: `docker compose up -d` + `.\gradlew bootRun`
- [ ] Swagger UI 접속 확인: http://localhost:8080/swagger
- [ ] 가입 → 로그인 한 번 Try it out → 토큰 확보
- [ ] Authorize 🔓 버튼에 토큰 붙여넣기 → charge/payment/transfer/transactions Try it out
- [ ] (선택) `openapi-typescript` 또는 `orval`로 타입 생성
- [ ] axios interceptor 두 개 작성:
  - Request: `Authorization` 헤더 자동 부착
  - Response: 401 감지 → 로그아웃 + 로그인 화면 리다이렉트
- [ ] `Idempotency-Key` UUID 생성 유틸 (`crypto.randomUUID()`)
- [ ] 에러 코드 → 메시지/UI 매핑 한 곳 (위 §4 표 그대로)

---

## References

- [`docs/ready.md`](ready.md) — 도메인 용어집 + 유스케이스 + ERD + API 명세 + 시나리오 12종
- [`docs/swagger-e2e-0518.md`](swagger-e2e-0518.md) — E2E 12종 검증 결과 + Swagger UI 가이드
- [`docs/adr/`](adr/) — Architecture Decision Records 11장
- [`CLAUDE.md`](../CLAUDE.md) — 백엔드 컨벤션 + 보안 룰
