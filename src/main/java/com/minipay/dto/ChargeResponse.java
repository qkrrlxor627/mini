package com.minipay.dto;

import com.minipay.domain.Currency;
import com.minipay.domain.Transaction;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record ChargeResponse(
        Long transactionId,
        BigDecimal amount,
        BigDecimal balanceAfter,
        Currency currency,
        OffsetDateTime createdAt
) {

    public static ChargeResponse from(Transaction tx) {
        return new ChargeResponse(
                tx.getId(),
                tx.getAmount().getAmount(),
                tx.getBalanceAfter().getAmount(),
                tx.getAmount().getCurrency(),
                tx.getCreatedAt()
        );
    }
}
