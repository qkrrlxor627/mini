CREATE TABLE users (
                       id            BIGSERIAL PRIMARY KEY,
                       email         VARCHAR(255) NOT NULL UNIQUE,
                       password_hash VARCHAR(255) NOT NULL,
                       name          VARCHAR(100) NOT NULL,
                       pin_hash      VARCHAR(255) NOT NULL,
                       created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
                          id         BIGSERIAL PRIMARY KEY,
                          user_id    BIGINT NOT NULL UNIQUE REFERENCES users(id),
                          balance    NUMERIC(19,4) NOT NULL DEFAULT 0 CHECK (balance >= 0),
                          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- idempotency_key = 멱등키 (중복 요청 방지용 식별자)
-- "같은 요청을 여러 번 보내도 결과는 한 번만 처리되게" 하기 위해, 클라이언트가 요청마다 부여하는 고유 ID.
CREATE TABLE transactions (
                              id              BIGSERIAL PRIMARY KEY,
                              account_id      BIGINT NOT NULL REFERENCES accounts(id),
                              type            VARCHAR(20) NOT NULL,
                              amount          NUMERIC(19,4) NOT NULL,
                              balance_after   NUMERIC(19,4) NOT NULL,
                              merchant_id     VARCHAR(50),
                              idempotency_key VARCHAR(100) UNIQUE,
                              status          VARCHAR(20) NOT NULL,
                              created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_account_id_created_at ON transactions(account_id, created_at DESC);
