## Mini Pay — MySQL DDL (ERD Cloud 입력용)

> 원본은 Postgres(`V1__init.sql` + `V2__money_value_object.sql` + `V3__transfer.sql`). ERD Cloud에 붙여넣을 수 있게 MySQL 8.0 문법으로 변환.
> 타입 결정 (2026-04-29): **NUMERIC(19,4) + TIMESTAMPTZ** → MySQL은 `DECIMAL(19,4)` + `TIMESTAMP(6)` 으로 매핑.
> 이체 추가 (2026-05-14): `transactions.counterparty_account_id` + CHECK 2종 + 부분 인덱스 반영 (ADR 0006).

### 변환 매핑 요약
| Postgres | MySQL |
|---|---|
| `BIGSERIAL PRIMARY KEY` | `BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY` |
| `NUMERIC(19,4)` | `DECIMAL(19,4)` (MySQL에서 둘은 synonym) |
| `TIMESTAMPTZ NOT NULL DEFAULT now()` | `TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)` (내부 UTC 저장 + 세션 TZ 변환 → TIMESTAMPTZ에 가장 근접) |
| `REFERENCES tbl(col)` (인라인) | 별도 `CONSTRAINT ... FOREIGN KEY ... REFERENCES` |
| `CHECK (balance >= 0)` | 그대로 (MySQL 8.0+ 강제됨) |
| 컬럼 인라인 `UNIQUE` | `UNIQUE KEY uk_xxx (col)` 별도 선언 |

---

### MySQL DDL

```sql
CREATE TABLE users (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name          VARCHAR(100) NOT NULL,
    pin_hash      VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_email (email)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE accounts (
    id         BIGINT        NOT NULL AUTO_INCREMENT,
    user_id    BIGINT        NOT NULL,
    balance    DECIMAL(19,4) NOT NULL DEFAULT 0,
    created_at TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_accounts_user_id (user_id),
    CONSTRAINT fk_accounts_user
        FOREIGN KEY (user_id) REFERENCES users (id),
    CONSTRAINT ck_accounts_balance_nonneg
        CHECK (balance >= 0)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE TABLE transactions (
    id                       BIGINT        NOT NULL AUTO_INCREMENT,
    account_id               BIGINT        NOT NULL,
    counterparty_account_id  BIGINT        NULL,                    -- TRANSFER 수신자, 그 외 NULL
    type                     VARCHAR(20)   NOT NULL,                -- CHARGE | PAYMENT | TRANSFER
    amount                   DECIMAL(19,4) NOT NULL,
    balance_after            DECIMAL(19,4) NOT NULL,                -- TRANSFER는 송금자 시점
    merchant_id              VARCHAR(50)   NULL,
    idempotency_key          VARCHAR(100)  NULL,
    status                   VARCHAR(20)   NOT NULL,                -- SUCCESS | FAILED
    created_at               TIMESTAMP(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_transactions_idem_key (idempotency_key),
    CONSTRAINT fk_transactions_account
        FOREIGN KEY (account_id) REFERENCES accounts (id),
    CONSTRAINT fk_transactions_counterparty
        FOREIGN KEY (counterparty_account_id) REFERENCES accounts (id),
    CONSTRAINT ck_transactions_counterparty_consistency
        CHECK (
            (type = 'TRANSFER' AND counterparty_account_id IS NOT NULL)
            OR
            (type <> 'TRANSFER' AND counterparty_account_id IS NULL)
        ),
    CONSTRAINT ck_transactions_counterparty_not_self
        CHECK (counterparty_account_id IS NULL OR counterparty_account_id <> account_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci;

CREATE INDEX idx_tx_account_created
    ON transactions (account_id, created_at DESC);

-- MySQL은 부분 인덱스(WHERE 절) 미지원 → 전체 인덱스로 표현. NULL 행 다수라 PG 부분 인덱스 대비 약간 큼.
CREATE INDEX idx_tx_counterparty_created
    ON transactions (counterparty_account_id, created_at DESC);
```

---

### ERD Cloud에 넣을 때 팁
- ERD Cloud는 **Import → MySQL**에서 위 DDL 통째로 붙여넣으면 테이블/관계가 자동 인식됨.
- 관계선:
  - `accounts.user_id` → `users.id` (1:1, `UNIQUE`라서 1:1로 그려짐)
  - `transactions.account_id` → `accounts.id` (N:1, 소유자/송금자 시점)
  - `transactions.counterparty_account_id` → `accounts.id` (N:1, 이체 수신자 시점, nullable)
- `CHECK` 제약은 ERD Cloud에서 시각화 안 될 수 있음 → 메모(Note)로 따로 적어두면 좋음.
- `idempotency_key UNIQUE`는 NULL 다수 허용 (MySQL 기본 동작) — Redis 만료 후 DB 최후 방어선 의미를 메모로 남겨두면 면접 답변용.
- 금액을 `DECIMAL(19,4)`로 잡은 이유 (다중 통화 확장 대비)도 다이어그램 메모에 한 줄 적어두면 면접 때 ERD 보면서 설명하기 좋음.
