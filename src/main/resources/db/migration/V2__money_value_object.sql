-- V2: Money VO 도입에 따른 컬럼 분할
-- accounts.balance / transactions.amount / transactions.balance_after 를
-- (amount, currency) 두 컬럼 쌍으로 분리. JPA @Embedded Money 와 매핑.
--
-- V1 은 절대 수정하지 않음 (Flyway 체크섬 깨짐 + 운영 시뮬레이션 학습 목적).
-- 데이터 0건이라 NOT NULL DEFAULT 'KRW' 적용 무손실.

-- accounts: balance(NUMERIC) → balance_amount + balance_currency
ALTER TABLE accounts
    ADD COLUMN balance_amount   NUMERIC(19,4) NOT NULL DEFAULT 0,
    ADD COLUMN balance_currency VARCHAR(3)    NOT NULL DEFAULT 'KRW';

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_balance_check;
ALTER TABLE accounts DROP COLUMN balance;

ALTER TABLE accounts
    ADD CONSTRAINT accounts_balance_amount_nonneg CHECK (balance_amount >= 0);

-- transactions.amount → amount_amount + amount_currency
ALTER TABLE transactions RENAME COLUMN amount TO amount_amount;
ALTER TABLE transactions
    ADD COLUMN amount_currency VARCHAR(3) NOT NULL DEFAULT 'KRW';

-- transactions.balance_after → balance_after_amount + balance_after_currency
ALTER TABLE transactions RENAME COLUMN balance_after TO balance_after_amount;
ALTER TABLE transactions
    ADD COLUMN balance_after_currency VARCHAR(3) NOT NULL DEFAULT 'KRW';
