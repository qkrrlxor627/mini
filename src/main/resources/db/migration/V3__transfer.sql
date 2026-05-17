-- V3: 이체(TRANSFER) 기능 — counterparty 컬럼 + 제약 + 부분 인덱스
-- A안 채택: 단일 행 표현 (송금자 시점 1행). 수신자는 counterparty_account_id 역조회.
-- 관련 ADR: docs/adr/0006-transfer-modeling.md

    ALTER TABLE transactions
    ADD COLUMN counterparty_account_id BIGINT NULL REFERENCES accounts(id);

-- TRANSFER만 counterparty 필수, 그 외 타입(CHARGE/PAYMENT)은 NULL 강제.
-- 자바 Transaction.transfer 정적 팩토리 검증 우회 시 DB가 최후 방어선.
ALTER TABLE transactions
    ADD CONSTRAINT transactions_counterparty_consistency
    CHECK (
        (type = 'TRANSFER' AND counterparty_account_id IS NOT NULL)
        OR
        (type <> 'TRANSFER' AND counterparty_account_id IS NULL)
    );

-- 자기 자신에게 이체 금지.
ALTER TABLE transactions
    ADD CONSTRAINT transactions_counterparty_not_self
    CHECK (counterparty_account_id IS NULL OR counterparty_account_id <> account_id);

-- 수신자 시점 조회 가속: type='TRANSFER' AND counterparty_account_id=? ORDER BY created_at DESC.
-- 부분 인덱스로 CHARGE/PAYMENT 행(counterparty NULL)은 인덱스 미포함 → 크기 축소.
CREATE INDEX idx_transactions_counterparty_id_created_at
    ON transactions (counterparty_account_id, created_at DESC)
    WHERE counterparty_account_id IS NOT NULL;
