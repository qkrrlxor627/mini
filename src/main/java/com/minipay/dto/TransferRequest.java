package com.minipay.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record TransferRequest(

        @NotNull(message = "counterpartyAccountId는 필수입니다")
        Long counterpartyAccountId,

        @NotNull(message = "금액은 필수입니다")
        @DecimalMin(value = "1", message = "금액은 1 이상이어야 합니다")
        @Digits(integer = 15, fraction = 4, message = "금액 형식이 올바르지 않습니다")
        BigDecimal amount
) {
}
