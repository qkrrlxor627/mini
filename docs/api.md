# Mini Pay API 명세서

> **Base URL**: `http://localhost:8080`
> **API Prefix**: `/api/v1`
> **인증 방식**: JWT Bearer Token (`Authorization: Bearer <token>`)
> **시간 포맷**: ISO 8601 with offset (`OffsetDateTime`, 서버 타임존 `Asia/Seoul`)
> **금액 정밀도**: `NUMERIC(19,4)` — scale 4, `RoundingMode.HALF_EVEN`
> **통화**: 기본 `KRW` (ISO 4217 코드)
> **컨텐츠 타입**: `application/json` (요청/응답 모두)

---

## 목차

- [공통 규약](#공통-규약)
  - [인증](#인증)
  - [멱등성 헤더](#멱등성-헤더)
  - [에러 응답 포맷](#에러-응답-포맷)
  - [에러 코드 일람](#에러-코드-일람)
- [엔드포인트](#엔드포인트)
  - [1. 회원가입 — `POST /api/v1/auth/signup`](#1-회원가입--post-apiv1authsignup)
  - [2. 로그인 — `POST /api/v1/auth/login`](#2-로그인--post-apiv1authlogin)
  - [3. 잔액 충전 — `POST /api/v1/accounts/charge`](#3-잔액-충전--post-apiv1accountscharge)
  - [4. 결제 — `POST /api/v1/payments`](#4-결제--post-apiv1payments)
  - [5. 이체 — `POST /api/v1/transfers`](#5-이체--post-apiv1transfers)
  - [6. 거래내역 조회 — `GET /api/v1/transactions`](#6-거래내역-조회--get-apiv1transactions)
  - [7. 내 계좌 조회 — `GET /api/v1/accounts/me`](#7-내-계좌-조회--get-apiv1accountsme)

---

## 공통 규약

### 인증

- `/api/v1/auth/**` 외 모든 API는 **JWT Bearer 토큰 필수**
- 토큰은 `/api/v1/auth/login` 응답의 `accessToken` 사용
- 헤더: `Authorization: Bearer <accessToken>`
- 만료 시간: **1시간** (3600초, 응답 `expiresIn` 참고)
- 토큰 claim: `sub=userId`, HS256 서명. Refresh 토큰 없음 (재로그인).
- 누락/만료/위조 시 모두 **401 `UNAUTHORIZED`** (구분 없음 — 정보 누출 방지)

### 멱등성 헤더

| API | 헤더명 | 필수 여부 | 비고 |
|---|---|---|---|
| `POST /accounts/charge` | `Idempotency-Key` | **필수** | TTL 10분, prefix 분리 (`idem:charge:`) — ADR-0012 |
| `POST /payments` | `Idempotency-Key` | **필수** | TTL 10분, prefix 분리 (`idem:payment:`) |
| `POST /transfers` | `Idempotency-Key` | **필수** | TTL 10분, prefix 분리 (`idem:transfer:`) |

- 같은 키 + 같은 본문 → **200 OK + 첫 응답 그대로 반환** (replay)
- 같은 키 + 다른 본문 → **409 `IDEMPOTENCY_KEY_CONFLICT`**
- 누락 또는 빈 문자열 → **400 `MISSING_IDEMPOTENCY_KEY`**
- 권장값: UUID, ULID, 또는 클라이언트 고유 요청 ID

### 에러 응답 포맷

모든 에러는 동일한 포맷:

```json
{
  "errorCode": "INSUFFICIENT_BALANCE",
  "message": "잔액이 부족합니다",
  "timestamp": "2026-05-26T11:14:08.147+09:00"
}
```

### 에러 코드 일람

| HTTP | errorCode | 발생 상황 |
|---|---|---|
| 400 | `VALIDATION_FAILED` | 요청 본문 검증 실패 (`@Valid`) — `message`에 첫 위반 필드명+사유 |
| 400 | `INVALID_ARGUMENT` | 쿼리 파라미터 검증 실패 (페이지네이션 범위 등) |
| 400 | `INSUFFICIENT_BALANCE` | 결제/이체 시 잔액 부족 |
| 400 | `MISSING_IDEMPOTENCY_KEY` | 결제/이체에서 `Idempotency-Key` 헤더 누락 또는 빈 값 |
| 400 | `INVALID_TRANSFER_TARGET` | 자기 자신에게 이체 시도 (락 진입 전 거부) |
| 401 | `UNAUTHORIZED` | JWT 누락/만료/위조 — 인증 자체 실패 |
| 401 | `INVALID_CREDENTIALS` | 로그인 실패 (이메일 없음/비번 틀림 통합) |
| 404 | `ACCOUNT_NOT_FOUND` | 사용자 계좌 또는 이체 수신자 계좌 부재 |
| 404 | `NOT_FOUND` | 매핑 없는 경로 |
| 409 | `DUPLICATE_EMAIL` | 회원가입 시 이메일 중복 |
| 409 | `IDEMPOTENCY_KEY_CONFLICT` | 같은 멱등키로 다른 본문 요청 |
| 500 | `INTERNAL_ERROR` | 예기치 못한 서버 오류 |

---

## 엔드포인트

### 1. 회원가입 — `POST /api/v1/auth/signup`

회원가입과 동시에 잔액 0원의 `KRW` 계좌가 같은 트랜잭션 안에서 생성됩니다.

- **인증**: 불필요
- **멱등성 헤더**: 불필요

#### 요청 본문

| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `email` | string | `@Email`, 필수 | 이메일 |
| `password` | string | 8자 이상, 영문+숫자+특수문자 모두 포함 | 비밀번호 (BCrypt 해싱 저장) |
| `name` | string | 100자 이하, 필수 | 표시 이름 |
| `pin` | string | 숫자 4자리 (`^\d{4}$`) | 결제용 PIN (BCrypt 해싱 저장) |

```json
{
  "email": "alice@example.com",
  "password": "Secret#1234",
  "name": "Alice",
  "pin": "1234"
}
```

#### 응답 — `201 Created`

| 필드 | 타입 | 설명 |
|---|---|---|
| `userId` | number | 생성된 사용자 ID |
| `email` | string | 등록된 이메일 |

```json
{
  "userId": 22,
  "email": "alice@example.com"
}
```

#### 에러

- `400 VALIDATION_FAILED` — 검증 실패
- `409 DUPLICATE_EMAIL` — 이미 가입된 이메일

#### 예시 (curl)

```bash
curl -X POST http://localhost:8080/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Secret#1234","name":"Alice","pin":"1234"}'
```

---

### 2. 로그인 — `POST /api/v1/auth/login`

JWT Bearer 토큰을 발급합니다.

- **인증**: 불필요
- **멱등성 헤더**: 불필요

#### 요청 본문

| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `email` | string | `@Email`, 필수 | 이메일 |
| `password` | string | 필수 | 비밀번호 (평문 전송, HTTPS 가정) |

```json
{
  "email": "alice@example.com",
  "password": "Secret#1234"
}
```

#### 응답 — `200 OK`

| 필드 | 타입 | 설명 |
|---|---|---|
| `accessToken` | string | JWT (HS256, `sub=userId`) |
| `expiresIn` | number | 만료까지 초 단위 (기본 3600) |

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "expiresIn": 3600
}
```

#### 에러

- `400 VALIDATION_FAILED` — 형식 위반
- `401 INVALID_CREDENTIALS` — 이메일/비번 불일치 (계정 존재 여부 노출 금지)

---

### 3. 잔액 충전 — `POST /api/v1/accounts/charge`

본인 계좌에 잔액을 충전합니다. 비관적 락(`PESSIMISTIC_WRITE`)으로 직렬화됩니다. 결제·이체와 동일하게 멱등성 이중 방어가 적용됩니다 (ADR-0012 — 충전도 돈 들어오는 쓰기라 중복 시 잔액 2배 위험).

- **인증**: 필요
- **멱등성 헤더**: **필수** (`Idempotency-Key`)

#### 요청 헤더

| 헤더 | 필수 | 설명 |
|---|---|---|
| `Authorization` | ✅ | `Bearer <accessToken>` |
| `Idempotency-Key` | ✅ | 클라이언트 생성 고유 키 (UUID 권장), prefix `idem:charge:` |

#### 요청 본문

| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `amount` | number (BigDecimal) | `>= 1`, 정수부 15자리 / 소수부 4자리 이내 | 충전 금액 (KRW 고정) |

```json
{ "amount": 10000 }
```

#### 응답 — `200 OK`

| 필드 | 타입 | 설명 |
|---|---|---|
| `transactionId` | number | 거래 ID |
| `amount` | number | 충전 금액 |
| `balanceAfter` | number | 충전 후 잔액 |
| `currency` | string | 통화 (`KRW`) |
| `createdAt` | string (OffsetDateTime) | 거래 발생 시각 |

```json
{
  "transactionId": 3,
  "amount": 10000.0000,
  "balanceAfter": 10000.0000,
  "currency": "KRW",
  "createdAt": "2026-05-26T11:20:00.123+09:00"
}
```

> 같은 `Idempotency-Key` + 같은 본문으로 재전송 시 **위 응답이 그대로 200으로 반환됨** (`transactionId` 동일, 잔액 중복 증가 없음).

#### 에러

- `400 VALIDATION_FAILED` — 금액 1 미만 / 정밀도 초과 / null
- `400 MISSING_IDEMPOTENCY_KEY` — 헤더 누락 또는 빈 값
- `401 UNAUTHORIZED` — 토큰 누락/만료/위조
- `404 ACCOUNT_NOT_FOUND` — 사용자 계좌 없음 (정상 흐름에서는 발생 안 함)
- `409 IDEMPOTENCY_KEY_CONFLICT` — 같은 키로 다른 본문(금액) 요청

#### 예시 (curl)

```bash
curl -X POST http://localhost:8080/api/v1/accounts/charge \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: charge-2026-05-26-001" \
  -H "Content-Type: application/json" \
  -d '{"amount":10000}'
```

---

### 4. 결제 — `POST /api/v1/payments`

가맹점 결제. 비관적 락 + Redis SETNX + DB UNIQUE의 멱등성 이중 방어가 적용됩니다.

- **인증**: 필요
- **멱등성 헤더**: **필수** (`Idempotency-Key`)

#### 요청 헤더

| 헤더 | 필수 | 설명 |
|---|---|---|
| `Authorization` | ✅ | `Bearer <accessToken>` |
| `Idempotency-Key` | ✅ | 클라이언트 생성 고유 키 (UUID 권장) |

#### 요청 본문

| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `merchantId` | string | 1~50자, 필수 | 가맹점 ID |
| `amount` | number (BigDecimal) | `>= 1`, 정수부 15자리 / 소수부 4자리 이내 | 결제 금액 |

```json
{
  "merchantId": "M-001",
  "amount": 2000
}
```

#### 응답 — `200 OK`

| 필드 | 타입 | 설명 |
|---|---|---|
| `transactionId` | number | 거래 ID |
| `merchantId` | string | 가맹점 ID |
| `amount` | number | 결제 금액 |
| `balanceAfter` | number | 결제 후 잔액 |
| `currency` | string | 통화 |
| `status` | string | `SUCCESS` / `FAILED` |
| `createdAt` | string (OffsetDateTime) | 거래 발생 시각 |

```json
{
  "transactionId": 4,
  "merchantId": "M-001",
  "amount": 2000.0000,
  "balanceAfter": 8000.0000,
  "currency": "KRW",
  "status": "SUCCESS",
  "createdAt": "2026-05-26T11:25:30.456+09:00"
}
```

> 같은 `Idempotency-Key` + 같은 본문으로 재전송 시 **위 응답이 그대로 200으로 반환됨** (`transactionId` 동일).

#### 에러

- `400 VALIDATION_FAILED` — 본문 검증 실패
- `400 INSUFFICIENT_BALANCE` — 잔액 부족
- `400 MISSING_IDEMPOTENCY_KEY` — 헤더 누락 또는 빈 값
- `401 UNAUTHORIZED` — 토큰 누락/만료/위조
- `404 ACCOUNT_NOT_FOUND` — 사용자 계좌 없음
- `409 IDEMPOTENCY_KEY_CONFLICT` — 같은 키로 다른 본문 요청

#### 예시 (curl)

```bash
curl -X POST http://localhost:8080/api/v1/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: pay-2026-05-26-001" \
  -H "Content-Type: application/json" \
  -d '{"merchantId":"M-001","amount":2000}'
```

---

### 5. 이체 — `POST /api/v1/transfers`

본인 계좌에서 상대 계좌로 송금. **두 계정 모두 `PESSIMISTIC_WRITE`** + `account_id` 오름차순 정렬로 데드락 방지.

- **인증**: 필요
- **멱등성 헤더**: **필수** (`Idempotency-Key`)

#### 요청 헤더

| 헤더 | 필수 | 설명 |
|---|---|---|
| `Authorization` | ✅ | `Bearer <accessToken>` |
| `Idempotency-Key` | ✅ | 결제와 네임스페이스 분리 (`idem:transfer:`) |

#### 요청 본문

| 필드 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `counterpartyAccountId` | number | 필수 (`@NotNull`) | 수신자 계좌 ID |
| `amount` | number (BigDecimal) | `>= 1`, 정수부 15자리 / 소수부 4자리 이내 | 이체 금액 |

```json
{
  "counterpartyAccountId": 9,
  "amount": 3000
}
```

#### 응답 — `200 OK`

| 필드 | 타입 | 설명 |
|---|---|---|
| `transactionId` | number | 거래 ID |
| `counterpartyAccountId` | number | 수신자 계좌 ID |
| `amount` | number | 이체 금액 |
| `balanceAfter` | number | **송금자 시점** 이체 후 잔액 (수신자 시점 잔액은 거래 행에 저장 안 됨 — ADR-0006) |
| `currency` | string | 통화 |
| `status` | string | `SUCCESS` / `FAILED` |
| `createdAt` | string (OffsetDateTime) | 거래 발생 시각 |

```json
{
  "transactionId": 7,
  "counterpartyAccountId": 9,
  "amount": 3000.0000,
  "balanceAfter": 7000.0000,
  "currency": "KRW",
  "status": "SUCCESS",
  "createdAt": "2026-05-26T11:30:00.789+09:00"
}
```

#### 에러

- `400 VALIDATION_FAILED` — 본문 검증 실패
- `400 INSUFFICIENT_BALANCE` — 잔액 부족
- `400 MISSING_IDEMPOTENCY_KEY` — 헤더 누락 또는 빈 값
- `400 INVALID_TRANSFER_TARGET` — 자기 자신에게 이체 (락 진입 전 사전 거부)
- `401 UNAUTHORIZED` — 토큰 누락/만료/위조
- `404 ACCOUNT_NOT_FOUND` — 수신자 계좌 부재 또는 송금자 계좌 부재 (메시지로 구분)
- `409 IDEMPOTENCY_KEY_CONFLICT` — 같은 키로 다른 본문 요청

#### 예시 (curl)

```bash
curl -X POST http://localhost:8080/api/v1/transfers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: tx-2026-05-26-001" \
  -H "Content-Type: application/json" \
  -d '{"counterpartyAccountId":9,"amount":3000}'
```

---

### 6. 거래내역 조회 — `GET /api/v1/transactions`

본인 계좌가 **송금자 또는 수신자**로 등장한 모든 거래를 최신순으로 조회. 한 이체는 양쪽 시점에서 모두 노출되며 `direction`이 자동 분기됩니다.

- **인증**: 필요
- **멱등성 헤더**: 불필요

#### 쿼리 파라미터

| 파라미터 | 타입 | 기본값 | 제약 | 설명 |
|---|---|---|---|---|
| `page` | int | `0` | `>= 0` | 0-based 페이지 번호 |
| `size` | int | `20` | `1 ~ 100` | 페이지 크기 |

#### 응답 — `200 OK`

```json
{
  "content": [
    {
      "transactionId": 8,
      "type": "TRANSFER",
      "direction": "SENT",
      "amount": 1000.0000,
      "balanceAfter": 5000.0000,
      "currency": "KRW",
      "merchantId": null,
      "counterpartyAccountId": 9,
      "status": "SUCCESS",
      "createdAt": "2026-05-26T11:35:00.000+09:00"
    },
    {
      "transactionId": 4,
      "type": "PAYMENT",
      "direction": "SELF",
      "amount": 2000.0000,
      "balanceAfter": 8000.0000,
      "currency": "KRW",
      "merchantId": "M-001",
      "counterpartyAccountId": null,
      "status": "SUCCESS",
      "createdAt": "2026-05-26T11:25:30.456+09:00"
    },
    {
      "transactionId": 3,
      "type": "CHARGE",
      "direction": "SELF",
      "amount": 10000.0000,
      "balanceAfter": 10000.0000,
      "currency": "KRW",
      "merchantId": null,
      "counterpartyAccountId": null,
      "status": "SUCCESS",
      "createdAt": "2026-05-26T11:20:00.123+09:00"
    }
  ],
  "page": 0,
  "size": 20,
  "totalElements": 3,
  "totalPages": 1
}
```

#### 응답 필드

| 필드 | 타입 | 설명 |
|---|---|---|
| `content[].transactionId` | number | 거래 ID |
| `content[].type` | string | `CHARGE` / `PAYMENT` / `TRANSFER` |
| `content[].direction` | string | `SELF` (충전·결제) / `SENT` (이체 송금) / `RECEIVED` (이체 수신) |
| `content[].amount` | number | 거래 금액 |
| `content[].balanceAfter` | number \| null | 송금자/본인 시점 잔액. **`direction=RECEIVED`면 `null`** (수신자 시점 잔액은 거래 행에 없음 — ADR-0006) |
| `content[].currency` | string | 통화 |
| `content[].merchantId` | string \| null | `PAYMENT`만 값 존재 |
| `content[].counterpartyAccountId` | number \| null | `TRANSFER`만 값 존재 |
| `content[].status` | string | `SUCCESS` / `FAILED` |
| `content[].createdAt` | string | 거래 발생 시각 |
| `page` | int | 현재 페이지 (0-based) |
| `size` | int | 페이지 크기 |
| `totalElements` | long | 총 거래 수 |
| `totalPages` | int | 총 페이지 수 |

#### 에러

- `400 INVALID_ARGUMENT` — `page < 0` 또는 `size` 범위 초과
- `401 UNAUTHORIZED` — 토큰 누락/만료/위조
- `404 ACCOUNT_NOT_FOUND` — 사용자 계좌 부재 (정상 흐름에서는 발생 안 함)

#### 예시 (curl)

```bash
curl "http://localhost:8080/api/v1/transactions?page=0&size=20" \
  -H "Authorization: Bearer $TOKEN"
```

---

### 7. 내 계좌 조회 — `GET /api/v1/accounts/me`

로그인한 사용자 본인의 계좌 ID와 현재 잔액을 조회합니다. 프론트엔드 대시보드 잔액 표시 및 이체 시 자기 자신 검증에 사용됩니다.

- **인증**: 필요
- **멱등성 헤더**: 불필요

#### 요청

요청 본문 없음. `Authorization: Bearer <accessToken>` 헤더만.

#### 응답 — `200 OK`

| 필드 | 타입 | 설명 |
|---|---|---|
| `accountId` | number | 본인 계좌 ID |
| `balance` | number | 현재 잔액 |
| `currency` | string | 통화 (`KRW`) |

```json
{
  "accountId": 29,
  "balance": 7777.0000,
  "currency": "KRW"
}
```

#### 에러

- `401 UNAUTHORIZED` — 토큰 누락/만료/위조
- `404 ACCOUNT_NOT_FOUND` — 사용자 계좌 없음 (정상 흐름에서는 발생 안 함)

#### 예시 (curl)

```bash
curl http://localhost:8080/api/v1/accounts/me \
  -H "Authorization: Bearer $TOKEN"
```

---

## 부록

### Swagger UI / OpenAPI

- Swagger UI: <http://localhost:8080/swagger> (→ `/swagger-ui/index.html`)
- OpenAPI JSON: <http://localhost:8080/api-docs>
- 우측 상단 **Authorize 🔓** 버튼으로 토큰 1회 입력하면 protected API 전부에 자동 부착됩니다.

### 도메인 enum 값

- `TransactionType`: `CHARGE`, `PAYMENT`, `TRANSFER`
- `TransactionStatus`: `SUCCESS`, `FAILED`
- `TransactionDirection`: `SELF`, `SENT`, `RECEIVED` (응답 DTO 전용)
- `Currency`: `KRW` (기본)

### 관련 ADR

- ADR-0001 — Money Value Object (scale 4 / HALF_EVEN)
- ADR-0002 — Enum + `EnumType.STRING`
- ADR-0005 — Transaction은 Account를 ID로 참조
- ADR-0006 — 이체는 단일 행 + `counterparty_account_id`, 수신자 시점 잔액 없음
- ADR-0008 — JWT stateless 인증 (refresh 없음, 401 명시화)
- ADR-0009 — 비관적 락 (`PESSIMISTIC_WRITE`)
- ADR-0010 — 멱등성 Redis SETNX + DB UNIQUE 이중 방어
- ADR-0011 — 두 계정 락 `account_id` 오름차순 정렬
- ADR-0012 — 충전 API에도 멱등성 적용 (ADR-0010 패턴 확장)
