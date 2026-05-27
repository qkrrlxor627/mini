package com.minipay.dto;

import com.minipay.domain.Account;
import com.minipay.domain.Currency;

import java.math.BigDecimal;

public record AccountMeResponse(
        Long accountId,
        BigDecimal balance,
        Currency currency
) {

    public static AccountMeResponse from(Account account) {
        return new AccountMeResponse(
                account.getId(),
                account.getBalance().getAmount(),
                account.getBalance().getCurrency()
        );
    }
}
