package com.minipay.dto;

import com.minipay.domain.Currency;
import com.minipay.domain.Transaction;
import com.minipay.domain.TransactionStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record TransferResponse(
        Long transactionId,
        Long counterpartyAccountId,
        BigDecimal amount,
        BigDecimal balanceAfter,
        Currency currency,
        TransactionStatus status,
        OffsetDateTime createdAt
) {

    public static TransferResponse from(Transaction tx) {
        return new TransferResponse(
                tx.getId(),
                tx.getCounterpartyAccountId(),
                tx.getAmount().getAmount(),
                tx.getBalanceAfter().getAmount(),
                tx.getAmount().getCurrency(),
                tx.getStatus(),
                tx.getCreatedAt()
        );
    }
}
