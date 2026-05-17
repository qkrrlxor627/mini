package com.minipay.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record PaymentRequest(

        @NotBlank(message = "merchantId는 필수입니다")
        @Size(max = 50, message = "merchantId는 50자 이하여야 합니다")
        String merchantId,

        @NotNull(message = "금액은 필수입니다")
        @DecimalMin(value = "1", message = "금액은 1 이상이어야 합니다")
        @Digits(integer = 15, fraction = 4, message = "금액 형식이 올바르지 않습니다")
        BigDecimal amount
) {
}
