package com.minipay.dto;

import com.minipay.domain.Currency;
import com.minipay.domain.Transaction;
import com.minipay.domain.TransactionDirection;
import com.minipay.domain.TransactionStatus;
import com.minipay.domain.TransactionType;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record TransactionResponse(
        Long transactionId,
        TransactionType type,
        TransactionDirection direction,
        BigDecimal amount,
        BigDecimal balanceAfter,
        Currency currency,
        String merchantId,
        Long counterpartyAccountId,
        TransactionStatus status,
        OffsetDateTime createdAt
) {

    public static TransactionResponse from(Transaction tx, Long myAccountId) {
        TransactionDirection direction = resolveDirection(tx, myAccountId);
        BigDecimal balanceAfter = direction == TransactionDirection.RECEIVED
                ? null
                : tx.getBalanceAfter().getAmount();

        return new TransactionResponse(
                tx.getId(),
                tx.getType(),
                direction,
                tx.getAmount().getAmount(),
                balanceAfter,
                tx.getAmount().getCurrency(),
                tx.getMerchantId(),
                tx.getCounterpartyAccountId(),
                tx.getStatus(),
                tx.getCreatedAt()
        );
    }

    private static TransactionDirection resolveDirection(Transaction tx, Long myAccountId) {
        if (tx.getType() != TransactionType.TRANSFER) {
            return TransactionDirection.SELF;
        }
        return tx.getAccountId().equals(myAccountId)
                ? TransactionDirection.SENT
                : TransactionDirection.RECEIVED;
    }
}
