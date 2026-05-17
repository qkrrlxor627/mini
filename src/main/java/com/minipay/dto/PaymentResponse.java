package com.minipay.dto;

import com.minipay.domain.Currency;
import com.minipay.domain.Transaction;
import com.minipay.domain.TransactionStatus;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record PaymentResponse(
        Long transactionId,
        String merchantId,
        BigDecimal amount,
        BigDecimal balanceAfter,
        Currency currency,
        TransactionStatus status,
        OffsetDateTime createdAt
) {

    public static PaymentResponse from(Transaction tx) {
        return new PaymentResponse(
                tx.getId(),
                tx.getMerchantId(),
                tx.getAmount().getAmount(),
                tx.getBalanceAfter().getAmount(),
                tx.getAmount().getCurrency(),
                tx.getStatus(),
                tx.getCreatedAt()
        );
    }
}
